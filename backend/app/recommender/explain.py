"""
recommender/explain.py
----------------------
Generates a human-readable explanation for why a movie was recommended.

How it works
────────────
The recommendation engine uses TF-IDF cosine similarity on a combined
feature string.  The explanation module reverses this process at the
feature level: it takes the two Movie ORM objects (the source movie the
user picked and a recommended movie) and finds which *named* features
actually overlap between them.

Feature columns used (all stored in SQLite, populated during ingestion):

    genres   – comma-separated display names or legacy underscore tokens
    director – a display name or a legacy underscore token
    cast     – comma-separated names or legacy underscore-separated name tokens
    keywords – space-separated underscore tokens

We never invent reasons. Every item in the explanation list is a feature
that genuinely exists in BOTH movies. If no metadata or overview terms
overlap, the explanation contains no feature categories.

The result is a plain Python dict that the route layer attaches to the
recommendation response JSON, so the frontend just renders it.

Output shape
────────────
{
    "reasons": [
        {"type": "genre",    "label": "Action"},
        {"type": "genre",    "label": "Science Fiction"},
        {"type": "director", "label": "James Cameron"},
        {"type": "cast",     "label": "Zoe Saldana"},
        {"type": "keyword",  "label": "alien"}
    ],
    "content_terms": ["alien"]
}

`type` is used by the frontend to pick a colour/icon.
`label` is the human-readable text shown to the user.
"""

from __future__ import annotations

from collections import Counter
from typing import TYPE_CHECKING

from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

from app.recommender.feature_text import normalise_text

if TYPE_CHECKING:
    from app.models.movie import Movie


# Maximum shared keywords to surface — keywords are noisier than other metadata.
_MAX_KEYWORDS = 4
_MAX_CONTENT_TERMS = 4


def _parse_display_values(value: str | None) -> list[str]:
    """Read current comma-separated values or legacy whitespace-separated tokens."""
    if not value:
        return []
    values = value.split(",") if "," in value else value.split()
    return [v.strip().replace("_", " ") for v in values if v.strip()]


def _parse_space(value: str | None) -> list[str]:
    """Split a space-separated token string into a list."""
    if not value:
        return []
    return [v.strip() for v in value.split() if v.strip()]


def _humanise_keyword(token: str) -> str:
    """
    Convert an underscore-joined keyword token back to readable text.
    e.g. "space_marine" → "space marine"
         "based_on_novel" → "based on novel"
    """
    return token.replace("_", " ")


def _shared_overview_terms(source: "Movie", candidate: "Movie") -> list[str]:
    """Return frequent, meaningful terms present in both stored overviews."""
    stop_words = ENGLISH_STOP_WORDS
    source_terms = Counter(
        term for term in normalise_text(source.overview or "").split()
        if len(term) >= 4 and term not in stop_words
    )
    candidate_terms = Counter(
        term for term in normalise_text(candidate.overview or "").split()
        if len(term) >= 4 and term not in stop_words
    )
    shared_terms = source_terms.keys() & candidate_terms.keys()
    ordered_terms = sorted(
        shared_terms,
        key=lambda term: (-(source_terms[term] + candidate_terms[term]), term),
    )
    return [term.replace("_", " ") for term in ordered_terms[:_MAX_CONTENT_TERMS]]


def build_explanation(source: "Movie", candidate: "Movie", score: float) -> dict:
    """
    Compare two Movie objects and return a list of named overlapping features.

    Parameters
    ----------
    source    : the movie the user selected
    candidate : a recommended movie
    score     : the cosine similarity score (0.0–1.0)

    Returns
    -------
    dict containing actual metadata overlaps and shared overview terms.
    """
    reasons: list[dict] = []

    # ── 1. Genre overlap ────────────────────────────────────────────────────
    source_genres = {
        genre.casefold(): genre for genre in _parse_display_values(source.genres)
    }
    candidate_genres = {
        genre.casefold(): genre for genre in _parse_display_values(candidate.genres)
    }
    shared_genres = sorted(source_genres.keys() & candidate_genres.keys())

    for genre in shared_genres:
        reasons.append({"type": "genre", "label": candidate_genres[genre]})

    # ── 2. Same director ────────────────────────────────────────────────────
    src_dir = " ".join((source.director or "").replace("_", " ").split())
    cand_dir = " ".join((candidate.director or "").replace("_", " ").split())
    if src_dir and cand_dir and src_dir.casefold() == cand_dir.casefold():
        reasons.append({"type": "director", "label": src_dir})

    # ── 3. Cast overlap ─────────────────────────────────────────────────────
    src_cast = _parse_display_values(source.cast)
    cand_cast = _parse_display_values(candidate.cast)
    shared_cast = sorted(
        {name.casefold() for name in src_cast} & {name.casefold() for name in cand_cast}
    )
    cand_cast_lower_map = {name.casefold(): name for name in cand_cast}

    for name_lower in shared_cast:
        display_name = cand_cast_lower_map.get(name_lower, name_lower.title())
        reasons.append({"type": "cast", "label": display_name})

    # ── 4. Keyword overlap ──────────────────────────────────────────────────
    # keywords are stored as space-separated underscore tokens
    # e.g. "space_marine based_on_novel alien"
    src_kw  = set(_parse_space(source.keywords))
    cand_kw = set(_parse_space(candidate.keywords))
    shared_kw = sorted(src_kw & cand_kw)

    kw_added = 0
    for tok in shared_kw:
        if kw_added >= _MAX_KEYWORDS:
            break
        readable = _humanise_keyword(tok)
        # Skip very short/noisy tokens
        if len(readable) < 3:
            continue
        reasons.append({"type": "keyword", "label": readable})
        kw_added += 1

    # ── 5. Language match ───────────────────────────────────────────────────
    src_lang  = (source.original_language or "").strip().lower()
    cand_lang = (candidate.original_language or "").strip().lower()
    if src_lang and cand_lang and src_lang == cand_lang:
        lang_label = {
            "ar": "Arabic", "de": "German", "en": "English", "es": "Spanish",
            "fr": "French", "hi": "Hindi", "it": "Italian", "ja": "Japanese",
            "ko": "Korean", "pt": "Portuguese", "ru": "Russian", "zh": "Chinese",
        }.get(src_lang, src_lang.upper())
        reasons.append({"type": "language", "label": lang_label})

    return {
        "reasons": reasons,
        "content_terms": _shared_overview_terms(source, candidate),
    }


# ── Helper: split display-ready cast string into full names ──────────────────

def _split_names(cast_str: str) -> list[str]:
    """
    The ingest pipeline stores cast as title-cased names separated by spaces.
    Each original name like "Sam Worthington" was stored as "Sam_Worthington"
    then title-cased to "Sam Worthington".

    After the latest ingest improvement, cast is stored as:
        "Sam Worthington Zoe Saldana Sigourney Weaver Michelle Rodriguez Stephen Lang"

    We want to return ["Sam Worthington", "Zoe Saldana", ...].

    Strategy: re-join consecutive Title-cased tokens (first char uppercase,
    rest lowercase) as one name.  A new name starts when:
      • The sequence resets, OR
      • A token is all-lowercase (shouldn't happen with title-casing but
        guards against edge cases)

    This correctly handles: "Sam Worthington Zoe Saldana" → two names.
    """
    tokens = cast_str.split()
    if not tokens:
        return []

    names: list[str] = []
    current: list[str] = []

    for tok in tokens:
        # Each actor's first word starts a new name
        if tok and tok[0].isupper():
            if current:
                names.append(" ".join(current))
            current = [tok]
        else:
            current.append(tok)

    if current:
        names.append(" ".join(current))

    return [n for n in names if n]
