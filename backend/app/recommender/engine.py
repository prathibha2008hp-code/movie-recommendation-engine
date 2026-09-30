"""
recommender/engine.py
---------------------
Loads the cleaned movie data from SQLite, builds TF-IDF vectors,
and computes cosine similarity to find the most similar movies.

How it works (beginner-friendly explanation)
─────────────────────────────────────────────
1. During ingestion each movie gets a `combined_features` string like:
       "action adventure science_fiction science_fiction action adventure
        james_cameron james_cameron sam_worthington zoe_saldana ..."

2. TF-IDF (Term Frequency – Inverse Document Frequency) turns every
   feature string into a numeric vector:
   - A word that appears in many movies scores LOW  (e.g. "action")
   - A word unique to a few movies scores HIGH  (e.g. a rare keyword)
   - sublinear_tf=True dampens very frequent words within one document,
     so a genre repeated 3× for weight doesn't drown everything else out.

3. Cosine similarity measures the angle between two vectors:
   - 1.0 → identical direction (very similar content)
   - 0.0 → perpendicular (nothing in common)

4. We return the top-N movies by cosine similarity, skipping the query
   movie itself.

Caching
───────
The TF-IDF matrix is built once when the first recommendation request
arrives and kept in module-level variables for the lifetime of the server
process. Subsequent requests reuse the cached matrix directly.
"""

import sys
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from app.database import SessionLocal
from app.models.movie import Movie


# ─── In-memory model cache ────────────────────────────────────────────────────
# All three variables are populated together in _load_model() and cleared
# together in reload_model().  They are never modified elsewhere.

_movie_ids: list[int] = []           # tmdb_ids in the same row-order as the matrix
_id_to_idx: dict[int, int] = {}      # O(1) lookup: tmdb_id → matrix row index
_tfidf_matrix = None                 # scipy sparse matrix (n_movies × n_features)
_vectorizer: TfidfVectorizer | None = None


def _load_model() -> None:
    """
    Build the TF-IDF matrix from the database if it has not been built yet.
    Called automatically before every recommendation lookup; is a no-op after
    the first call because it checks `_tfidf_matrix is not None` first.
    """
    global _movie_ids, _id_to_idx, _tfidf_matrix, _vectorizer

    if _tfidf_matrix is not None:
        return  # already loaded — nothing to do

    db: Session = SessionLocal()
    try:
        # Only load rows that actually have content to vectorize.
        # Filter out empty strings AND whitespace-only strings.
        movies = (
            db.query(Movie.tmdb_id, Movie.combined_features)
            .filter(
                Movie.combined_features != None,   # noqa: E711 — SQLAlchemy syntax
                Movie.combined_features != "",
            )
            .all()
        )
    finally:
        db.close()

    if not movies:
        raise RuntimeError(
            "No movies found in the database. "
            "Run `python -m app.recommender.ingest` first."
        )

    # Strip any remaining whitespace-only rows in Python
    rows = [(m.tmdb_id, m.combined_features.strip()) for m in movies]
    rows = [(tid, feat) for tid, feat in rows if feat]

    if not rows:
        raise RuntimeError("All combined_features strings are empty. Re-run ingest.")

    _movie_ids = [tid for tid, _ in rows]
    corpus     = [feat for _, feat in rows]

    # Build an O(1) id → matrix-row index lookup dict.
    # Without this, every recommendation call would do an O(n) list.index()
    # scan — harmless on 4 800 movies but wrong in principle.
    _id_to_idx = {tid: i for i, tid in enumerate(_movie_ids)}

    # ── TF-IDF vectorizer configuration ──────────────────────────────────────
    #
    # max_features=50_000
    #   Keep the 50 000 highest-scoring vocabulary terms.  With ~4 800 movies
    #   and the weighted repetitions in combined_features, this is well above
    #   the actual vocabulary size, so nothing useful is dropped.
    #
    # stop_words="english"
    #   Discard the ~318 most common English words (the, a, of, …).
    #   This is especially important because the overview field contains full
    #   natural-language sentences.
    #
    # ngram_range=(1, 1)  ← unigrams only
    #   Bigrams (1,2) were used before.  On a relatively small corpus of 4 800
    #   items, bigrams explode the feature space and assign high IDF scores to
    #   spurious two-word phrases that never repeat across movies.  Pure
    #   unigrams give more robust similarity scores here.
    #
    # sublinear_tf=True
    #   Replaces raw term-frequency counts with 1 + log(tf).
    #   This prevents a genre token repeated 3× for weighting purposes from
    #   dominating the vector and drowning out rarer, more discriminating terms.
    #   Effect: the deliberate repetitions in ingest.py still bump a feature's
    #   weight, but in a logarithmically dampened way.
    #
    # min_df=2
    #   Ignore terms that appear in only one document.  These contribute
    #   nothing to cross-movie similarity and waste memory.
    #
    # dtype=np.float32
    #   Use 32-bit floats instead of the default 64-bit to halve memory usage
    #   of the sparse matrix.  Cosine similarity precision is unaffected.
    #
    _vectorizer = TfidfVectorizer(
        max_features=50_000,
        stop_words="english",
        ngram_range=(1, 1),
        sublinear_tf=True,
        min_df=2,
        dtype=np.float32,
    )
    _tfidf_matrix = _vectorizer.fit_transform(corpus)

    print(
        f"[Recommender] TF-IDF matrix ready — "
        f"{_tfidf_matrix.shape[0]:,} movies × {_tfidf_matrix.shape[1]:,} features"
    )


def get_recommendations(tmdb_id: int, top_n: int = 10) -> list[dict]:
    """
    Return the top_n most content-similar movies for the given tmdb_id.

    Parameters
    ----------
    tmdb_id : int
        TMDB ID of the movie the user selected.
    top_n : int
        Number of recommendations to return (default 10).

    Returns
    -------
    list[dict]
        Each element: {"tmdb_id": int, "score": float}
        Ordered from most to least similar; never includes the query movie.
        Returns [] when tmdb_id is not in the dataset.
    """
    _load_model()  # no-op on all calls after the first

    # O(1) lookup — returns None immediately if the id is unknown
    idx = _id_to_idx.get(tmdb_id)
    if idx is None:
        return []   # unknown movie — handled gracefully by the route

    # Compute cosine similarity between this movie and every other movie.
    # _tfidf_matrix[idx] is a (1 × n_features) sparse row vector.
    # cosine_similarity returns a (1 × n_movies) ndarray of float32 scores.
    sim_scores: np.ndarray = cosine_similarity(
        _tfidf_matrix[idx], _tfidf_matrix
    ).flatten()

    # np.argsort gives ascending order; [::-1] reverses to descending.
    # This is O(n log n) but n ≈ 4 800, so it completes in microseconds.
    sorted_indices = np.argsort(sim_scores)[::-1]

    results: list[dict] = []
    for i in sorted_indices:
        if _movie_ids[i] == tmdb_id:
            continue  # never recommend the selected movie itself
        results.append({
            "tmdb_id": _movie_ids[i],
            "score":   round(float(sim_scores[i]), 4),
        })
        if len(results) >= top_n:
            break

    return results


def reload_model() -> None:
    """
    Clear the cached model and rebuild it from the current database state.
    Useful after re-running the ingestion script without restarting the server.
    """
    global _movie_ids, _id_to_idx, _tfidf_matrix, _vectorizer
    _movie_ids    = []
    _id_to_idx    = {}
    _tfidf_matrix = None
    _vectorizer   = None
    _load_model()
