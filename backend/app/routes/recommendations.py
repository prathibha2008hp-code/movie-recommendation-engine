"""
routes/recommendations.py
--------------------------
Provides one endpoint:
  GET /api/recommendations/{tmdb_id}

Returns the top 10 content-similar movies for the given TMDB movie ID,
each enriched with live TMDB API data (poster, rating, etc.) and an
explanation of why it was recommended.
"""

import asyncio

import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_BASE_URL
from app.database import get_db
from app.models.movie import Movie
from app.recommender.engine import get_recommendations
from app.recommender.explain import build_explanation

router = APIRouter()


# ─── TMDB API helper ─────────────────────────────────────────────────────────

async def _fetch_tmdb_details(tmdb_id: int, client: httpx.AsyncClient) -> dict:
    """
    Fetch live TMDB details for one movie using a shared httpx client.
    Returns an empty dict on any failure.
    """
    if not TMDB_API_KEY:
        return {}
    url = f"{TMDB_BASE_URL}/movie/{tmdb_id}"
    params = {"api_key": TMDB_API_KEY, "language": "en-US"}
    try:
        resp = await client.get(url, params=params)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return {}


def _build_rec_response(
    db_movie: Movie,
    tmdb_data: dict,
    score: float,
    explanation: dict,
) -> dict:
    """Combine database + TMDB API data + explanation into one recommendation card dict."""
    poster_path = tmdb_data.get("poster_path")
    poster_url = f"{TMDB_IMAGE_BASE_URL}{poster_path}" if poster_path else None

    genres_list = tmdb_data.get("genres", [])
    genres_str = ", ".join(g["name"] for g in genres_list) if genres_list else db_movie.genres

    return {
        "id": db_movie.tmdb_id,
        "title": db_movie.title,
        "overview": tmdb_data.get("overview") or db_movie.overview or "",
        "genres": genres_str or "",
        "release_date": tmdb_data.get("release_date") or db_movie.release_date or "",
        "vote_average": tmdb_data.get("vote_average") or db_movie.vote_average,
        "poster_url": poster_url,
        "similarity_score": score,
        # explanation is a dict {"reasons": [{"type": str, "label": str}, ...]}
        "explanation": explanation,
    }


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/{tmdb_id}")
async def recommend_movies(tmdb_id: int, db: Session = Depends(get_db)):
    """
    1. Look up the requested movie in the database.
    2. Run the TF-IDF cosine similarity engine to get the top 10 similar movies.
    3. Build feature-overlap explanations for each recommendation.
    4. Fetch live TMDB details for all 10 in parallel (using asyncio.gather).
    5. Return the enriched list with explanations attached.
    """
    # Verify the source movie exists in our dataset
    source_movie = db.query(Movie).filter(Movie.tmdb_id == tmdb_id).first()
    if not source_movie:
        raise HTTPException(status_code=404, detail="Movie not found in dataset")

    # Get similarity scores from the TF-IDF engine
    # Each item is {"tmdb_id": int, "score": float}
    similar = get_recommendations(tmdb_id, top_n=10)

    if not similar:
        return []

    # Fetch SQLite records for all recommended movies in one query
    similar_ids = [s["tmdb_id"] for s in similar]
    db_movies = (
        db.query(Movie)
        .filter(Movie.tmdb_id.in_(similar_ids))
        .all()
    )
    db_movie_map = {m.tmdb_id: m for m in db_movies}

    # Build score and explanation lookups
    score_map = {s["tmdb_id"]: s["score"] for s in similar}
    explanation_map = {
        sid: build_explanation(source_movie, db_movie_map[sid], score_map[sid])
        for sid in similar_ids
        if sid in db_movie_map
    }

    # Fetch live TMDB details for all recommended movies in parallel
    async with httpx.AsyncClient(timeout=5.0) as client:
        tasks = [_fetch_tmdb_details(mid, client) for mid in similar_ids]
        tmdb_results = await asyncio.gather(*tasks)

    # Assemble the final response, preserving the similarity-score order
    tmdb_map = {mid: data for mid, data in zip(similar_ids, tmdb_results)}

    recommendations = []
    for sid in similar_ids:
        if sid not in db_movie_map:
            continue
        recommendations.append(
            _build_rec_response(
                db_movie_map[sid],
                tmdb_map.get(sid, {}),
                score_map[sid],
                explanation_map.get(sid, {"reasons": []}),
            )
        )

    return recommendations
