"""
recommender/ingest.py
---------------------
Reads the TMDB 5000 CSV files, processes them, and populates the SQLite database.

Run this once before starting the server:
    python -m app.recommender.ingest

Re-running is safe — existing records are updated in-place (upsert logic).

TMDB 5000 column reference
─────────────────────────────────────────────────────────────────────────────
tmdb_5000_movies.csv  →  budget, genres, homepage, id, keywords, original_language,
                          original_title, overview, popularity, production_companies,
                          production_countries, release_date, revenue, runtime,
                          spoken_languages, status, tagline, title, vote_average,
                          vote_count

tmdb_5000_credits.csv →  movie_id, title, cast, crew
─────────────────────────────────────────────────────────────────────────────

combined_features layout (what the TF-IDF model sees)
─────────────────────────────────────────────────────────────────────────────
Each source is weighted by how many times it appears in the string:

  genres   × 3  — strongest signal; "action adventure" nails the tone
  director × 3  — a director's style is a very strong similarity signal
  cast     × 2  — top-5 actors; repeated once for extra weight
  keywords × 2  — thematic tags (e.g. "based_on_novel", "revenge")
  overview × 1  — free text; contributes many unique words
  tagline  × 1  — short punchy phrase, often shares vocab with other films
  language × 2  — groups films by original language community
─────────────────────────────────────────────────────────────────────────────
"""

import ast
import re
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

# Make sure the backend/ package root is on sys.path when running as a script
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))  # → backend/

from app.config import DATA_DIR
from app.database import Base, SessionLocal, engine
from app.models.movie import Movie


# ─── JSON-like column parser ──────────────────────────────────────────────────

def _parse_list(raw) -> list:
    """
    The genres, keywords, cast, and crew columns are stored as Python-literal
    strings, e.g. "[{'id': 28, 'name': 'Action'}, ...]".
    ast.literal_eval converts them into real Python objects.
    Returns an empty list on any error or when the value is missing/NaN.
    """
    if not isinstance(raw, str) or not raw.strip():
        return []
    try:
        result = ast.literal_eval(raw)
        return result if isinstance(result, list) else []
    except (ValueError, SyntaxError):
        return []


# ─── Text normalisation ───────────────────────────────────────────────────────

# Pre-compiled pattern: keep only letters, digits, spaces, and underscores
_CLEAN_RE = re.compile(r"[^a-z0-9 _]")

def _normalise(text: str) -> str:
    """
    Lowercase, strip punctuation, and collapse whitespace.
    Underscores are kept because we use them as word-joiners for multi-word tokens.
    """
    text = text.lower()
    text = _CLEAN_RE.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _token(name: str) -> str:
    """
    Convert a multi-word name into a single underscore-joined token so the
    TF-IDF vectorizer treats it as one feature, not separate words.

    e.g. "Science Fiction" → "science_fiction"
         "Sam Worthington" → "sam_worthington"
    """
    return "_".join(name.lower().split())


# ─── Feature extractors ───────────────────────────────────────────────────────

def _extract_names(raw, limit: int | None = None) -> list[str]:
    """
    Return a list of unique underscore-joined name tokens from a JSON column.
    Deduplication preserves order (first occurrence wins).
    """
    items = _parse_list(raw)
    seen: set[str] = set()
    tokens: list[str] = []
    for item in items:
        name = (item.get("name") or "").strip()
        if not name:
            continue
        tok = _token(name)
        if tok and tok not in seen:
            seen.add(tok)
            tokens.append(tok)
        if limit and len(tokens) >= limit:
            break
    return tokens


def _extract_director(crew_raw) -> str:
    """
    Return the first Director's name as an underscore-joined token.
    Returns an empty string when no director entry is found.
    """
    for member in _parse_list(crew_raw):
        if member.get("job") == "Director":
            name = (member.get("name") or "").strip()
            if name:
                return _token(name)
    return ""


def _extract_display_genres(raw) -> str:
    """
    Return a human-readable comma-separated genre string for display on the UI,
    e.g. "Action, Adventure, Science Fiction".
    This is stored in the `genres` column and shown on movie cards.
    """
    items = _parse_list(raw)
    names = [item.get("name", "").strip() for item in items if item.get("name")]
    return ", ".join(n for n in names if n)


# ─── Feature string builder ───────────────────────────────────────────────────

def _build_combined_features(row: pd.Series) -> str:
    """
    Assemble the string that the TF-IDF vectorizer will be trained on.

    Weighting strategy
    ------------------
    Repetition is the simplest and most transparent way to increase a
    feature's influence in a bag-of-words model like TF-IDF.

    genres   × 3  — core content signal
    director × 3  — auteur style is a powerful similarity cue
    cast     × 2  — shared cast often means shared franchise/style
    keywords × 2  — curated thematic tags deserve more weight than raw text
    overview × 1  — adds specificity but contains many common words
    tagline  × 1  — short, memorable; shares vocabulary with thematically similar films
    language × 2  — groups non-English films together appropriately

    Deduplication: tokens that appear in both genres and keywords are only
    included once in the keywords slot so they don't get counted four times.
    """
    genres_tokens   = row.get("genres_tokens", []) or []
    keywords_tokens = row.get("keywords_tokens", []) or []
    cast_tokens     = row.get("cast_tokens", []) or []
    director_token  = row.get("director_token", "") or ""
    language        = _normalise(str(row.get("original_language") or ""))

    # Clean the raw overview and tagline text
    overview_clean = _normalise(str(row.get("overview") or ""))
    tagline_clean  = _normalise(str(row.get("tagline") or ""))

    # Deduplicate keywords against genres to avoid double-counting shared tokens
    genre_set = set(genres_tokens)
    unique_kw = [t for t in keywords_tokens if t not in genre_set]

    parts: list[str] = []

    # genres × 3
    genre_str = " ".join(genres_tokens)
    if genre_str:
        parts += [genre_str, genre_str, genre_str]

    # director × 3
    if director_token:
        parts += [director_token, director_token, director_token]

    # cast × 2
    cast_str = " ".join(cast_tokens)
    if cast_str:
        parts += [cast_str, cast_str]

    # keywords × 2  (deduplicated against genres)
    kw_str = " ".join(unique_kw)
    if kw_str:
        parts += [kw_str, kw_str]

    # overview × 1
    if overview_clean:
        parts.append(overview_clean)

    # tagline × 1
    if tagline_clean:
        parts.append(tagline_clean)

    # language × 2
    if language:
        parts += [language, language]

    return " ".join(parts).strip()


# ─── Main ingestion function ──────────────────────────────────────────────────

def ingest():
    movies_csv  = DATA_DIR / "tmdb_5000_movies.csv"
    credits_csv = DATA_DIR / "tmdb_5000_credits.csv"

    # ── 1. Validate files ────────────────────────────────────────────────────
    if not movies_csv.exists():
        print(f"[ERROR] Missing: {movies_csv}")
        print("  Place tmdb_5000_movies.csv in the data/ folder and re-run.")
        sys.exit(1)
    if not credits_csv.exists():
        print(f"[ERROR] Missing: {credits_csv}")
        print("  Place tmdb_5000_credits.csv in the data/ folder and re-run.")
        sys.exit(1)

    # ── 2. Load CSVs ─────────────────────────────────────────────────────────
    print("[1/6] Loading CSVs …")
    movies_df  = pd.read_csv(movies_csv)
    credits_df = pd.read_csv(credits_csv)

    print(f"      movies  : {len(movies_df):,} rows  | columns: {list(movies_df.columns)}")
    print(f"      credits : {len(credits_df):,} rows  | columns: {list(credits_df.columns)}")

    # ── 3. Merge on TMDB movie ID ─────────────────────────────────────────────
    # tmdb_5000_movies uses column "id"; tmdb_5000_credits uses "movie_id"
    print("[2/6] Merging on movie ID …")
    if "movie_id" in credits_df.columns:
        credits_df = credits_df.rename(columns={"movie_id": "id"})

    df = movies_df.merge(credits_df[["id", "cast", "crew"]], on="id", how="left")
    print(f"      merged  : {len(df):,} rows")

    # ── 4. Extract clean feature columns ─────────────────────────────────────
    print("[3/6] Extracting features …")

    # Token lists (used to build combined_features)
    df["genres_tokens"]   = df["genres"].apply(_extract_names)
    df["keywords_tokens"] = df["keywords"].apply(lambda x: _extract_names(x, limit=20))
    df["cast_tokens"]     = df["cast"].apply(lambda x: _extract_names(x, limit=5))
    df["director_token"]  = df["crew"].apply(_extract_director)

    # Human-readable genre string for display (stored in `genres` column)
    df["genres_display"]  = df["genres"].apply(_extract_display_genres)

    # Human-readable cast string — COMMA-SEPARATED so the explain module can
    # split names unambiguously: "Sam Worthington, Zoe Saldana, Sigourney Weaver"
    df["cast_display"]     = df["cast_tokens"].apply(
        lambda tokens: ", ".join(t.replace("_", " ").title() for t in tokens[:5])
    )
    df["director_display"] = df["director_token"].apply(
        lambda t: t.replace("_", " ").title() if t else ""
    )

    # ── 5. Build combined_features ────────────────────────────────────────────
    print("[4/6] Building combined_features …")
    df["combined_features"] = df.apply(_build_combined_features, axis=1)

    # Report how many rows ended up with an empty feature string
    empty_count = (df["combined_features"].str.strip() == "").sum()
    if empty_count:
        print(f"      ⚠  {empty_count} rows have empty combined_features (will be excluded from recommendations)")

    # ── 6. Create / migrate the database table ────────────────────────────────
    print("[5/6] Ensuring database schema exists …")
    Base.metadata.create_all(bind=engine)

    # ── 7. Upsert rows into SQLite ────────────────────────────────────────────
    print("[6/6] Writing to database …")
    db: Session = SessionLocal()
    inserted = 0
    updated  = 0

    try:
        for _, row in df.iterrows():
            tmdb_id = int(row["id"])

            data = {
                "tmdb_id":           tmdb_id,
                # Display-ready title
                "title":             str(row.get("title") or row.get("original_title") or ""),
                # Raw overview text (used for display, NOT for TF-IDF directly)
                "overview":          str(row.get("overview") or ""),
                # Human-readable genre string for card display: "Action, Adventure"
                "genres":            str(row.get("genres_display") or ""),
                # Space-separated keyword tokens (for display/debug)
                "keywords":          " ".join(row.get("keywords_tokens") or []),
                # Human-readable cast string: "Sam Worthington Zoe Saldana ..."
                "cast":              str(row.get("cast_display") or ""),
                # Human-readable director: "James Cameron"
                "director":          str(row.get("director_display") or ""),
                "original_language": str(row.get("original_language") or ""),
                "release_date":      str(row.get("release_date") or ""),
                "vote_average":      float(row["vote_average"])  if pd.notna(row.get("vote_average"))  else None,
                "vote_count":        int(row["vote_count"])      if pd.notna(row.get("vote_count"))     else None,
                "popularity":        float(row["popularity"])    if pd.notna(row.get("popularity"))     else None,
                # The TF-IDF training string
                "combined_features": str(row.get("combined_features") or ""),
            }

            existing = db.query(Movie).filter(Movie.tmdb_id == tmdb_id).first()
            if existing:
                for key, value in data.items():
                    setattr(existing, key, value)
                updated += 1
            else:
                db.add(Movie(**data))
                inserted += 1

        db.commit()
        print(f"\n✅ Done — inserted: {inserted}, updated: {updated}")
        print(f"   Database: {DATA_DIR.parent / 'backend' / 'movies.db'}")

    except Exception as exc:
        db.rollback()
        print(f"\n[ERROR] Ingestion failed: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    ingest()
