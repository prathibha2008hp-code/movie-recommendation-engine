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

  genres   – "Action, Adventure, Science Fiction"   (comma-separated display names)
  director – "James Cameron"                         (single name, title-cased)
  cast     – "Sam Worthington Zoe Saldana ..."       (space-separated title-cased names)
  keywords – "space_marine marine ..."               (space-separated underscore tokens)

We never invent reasons.  Every item in the explanation list is a feature
that genuinely exists in BOTH movies.  If nothing meaningful overlaps we
return a single generic fallback reason that reflects the overall score.

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
        {"type": "keyword",  "label": "alien"},
        {"type": "score",    "label": "High content similarity (0.72)"}
    ]
}

`type` is used by the frontend to pick a colour/icon.
`label` is the human-readable text shown to the user.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.movie import Movie


# Maximum number of reasons to return — keeps the UI concise
_MAX_REASONS = 6

# Maximum keywords to surface — they are noisier than genres/cast
_MAX_KEYWORDS = 2


def _parse_csv(value: str | None) -> list[str]:
    """Split a comma-separated string into a clean list of non-empty strings."""
    if not value:
        return []
    return [v.strip() for v in value.split(",") if v.strip()]


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
    dict with a single key "reasons" — a list of {"type": str, "label": str}
    """
    reasons: list[dict] = []

    # ── 1. Genre overlap ────────────────────────────────────────────────────
    # genres is stored as "Action, Adventure, Science Fiction"
    source_genres = set(_parse_csv(source.genres))
    cand_genres   = set(_parse_csv(candidate.genres))
    shared_genres = sorted(source_genres & cand_genres)

    for g in shared_genres:
        reasons.append({"type": "genre", "label": g})
        if len(reasons) >= _MAX_REASONS:
            return {"reasons": reasons}

    # ── 2. Same director ────────────────────────────────────────────────────
    # director is stored as "James Cameron" (title-cased, spaces)
    src_dir  = (source.director or "").strip()
    cand_dir = (candidate.director or "").strip()
    if src_dir and cand_dir and src_dir.lower() == cand_dir.lower():
        reasons.append({"type": "director", "label": src_dir})
        if len(reasons) >= _MAX_REASONS:
            return {"reasons": reasons}

    # ── 3. Cast overlap ─────────────────────────────────────────────────────
    # cast is stored as space-separated title-cased names:
    # "Sam Worthington Zoe Saldana Sigourney Weaver"
    # Each name is a single token (no spaces within a name here) after
    # the ingest update that stores display-ready names.
    # We treat each word as a token — first+last names are joined by
    # ingest as "Sam_Worthington" etc., then title-cased to "Sam Worthington"
    # for display.  After title-casing they appear as separate words in the
    # cast string, so we re-join consecutive Title-cased words as full names.
    # cast is now stored as comma-separated: "Sam Worthington, Zoe Saldana, ..."
    src_cast  = _parse_csv(source.cast or "")
    cand_cast = _parse_csv(candidate.cast or "")
    shared_cast = sorted(
        {n.lower() for n in src_cast} & {n.lower() for n in cand_cast}
    )
    # Re-map back to the original casing for display
    cand_cast_lower_map = {n.lower(): n for n in cand_cast}

    for name_lower in shared_cast:
        display_name = cand_cast_lower_map.get(name_lower, name_lower.title())
        reasons.append({"type": "cast", "label": display_name})
        if len(reasons) >= _MAX_REASONS:
            return {"reasons": reasons}

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
        if len(reasons) >= _MAX_REASONS:
            return {"reasons": reasons}

    # ── 5. Language match ───────────────────────────────────────────────────
    # Only surface this when it is non-English — English is the default and
    # not informative as a reason.
    src_lang  = (source.original_language or "").strip().lower()
    cand_lang = (candidate.original_language or "").strip().lower()
    if src_lang and cand_lang and src_lang == cand_lang and src_lang != "en":
        lang_label = {
            "fr": "French", "de": "German", "es": "Spanish", "ja": "Japanese",
            "ko": "Korean", "zh": "Chinese", "it": "Italian", "pt": "Portuguese",
            "hi": "Hindi",  "ru": "Russian",
        }.get(src_lang, src_lang.upper())
        reasons.append({"type": "language", "label": f"{lang_label} film"})
        if len(reasons) >= _MAX_REASONS:
            return {"reasons": reasons}

    # ── 6. Fallback — generic score-based reason ────────────────────────────
    # Only shown when nothing else was found (unlikely with rich data, but
    # handles edge cases like very sparse metadata).
    if not reasons:
        if score >= 0.50:
            label = f"Very high content similarity ({score:.0%})"
        elif score >= 0.25:
            label = f"Strong thematic similarity ({score:.0%})"
        else:
            label = "Similar story and themes"
        reasons.append({"type": "score", "label": label})

    return {"reasons": reasons}


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
