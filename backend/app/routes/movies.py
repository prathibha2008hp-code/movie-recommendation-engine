"""
routes/movies.py
----------------
Provides five endpoints:
  GET /api/movies/search?q=<title>      → search for movies by title
  GET /api/movies/popular?limit=N       → top-N movies by popularity score
  GET /api/movies/by-genre?genre=X&limit=N → movies filtered by genre name
  GET /api/movies/{tmdb_id}             → get details for one movie
  GET /api/movies/{tmdb_id}/videos      → get YouTube trailer key (if any)

NOTE: literal-path routes (/search, /popular, /by-genre) MUST be declared
before the path-parameter route (/{tmdb_id}) so FastAPI doesn't treat
"popular" or "by-genre" as a tmdb_id integer.

Both detail endpoints enrich database results with live TMDB API data
(poster, backdrop, rating, etc.) when available.

The /videos endpoint keeps the TMDB API key on the server — the frontend
never sees it.
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import TMDB_API_KEY, TMDB_BASE_URL, TMDB_IMAGE_BASE_URL
from app.database import get_db
from app.models.movie import Movie

router = APIRouter()


# ─── TMDB API helpers ─────────────────────────────────────────────────────────

async def _fetch_tmdb_details(tmdb_id: int) -> dict:
    """
    Call the TMDB API to get live movie details for one movie.
    Returns an empty dict if the request fails or the API key is missing.
    """
    if not TMDB_API_KEY:
        return {}
    url = f"{TMDB_BASE_URL}/movie/{tmdb_id}"
    params = {"api_key": TMDB_API_KEY, "language": "en-US"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return {}


def _build_movie_response(db_movie: Movie, tmdb_data: dict) -> dict:
    """
    Merge SQLite data with live TMDB API data into one response dict.
    TMDB API values are preferred when available; we fall back to the
    database values (populated during CSV ingestion) otherwise.
    """
    # Build the full image URL from the poster_path returned by TMDB
    poster_path = tmdb_data.get("poster_path")
    backdrop_path = tmdb_data.get("backdrop_path")

    poster_url = f"{TMDB_IMAGE_BASE_URL}{poster_path}" if poster_path else None
    # Use a larger size for the backdrop image
    backdrop_url = (
        f"https://image.tmdb.org/t/p/w1280{backdrop_path}" if backdrop_path else None
    )

    # Prefer TMDB genres (already a list of dicts) over the CSV-derived string
    genres_list = tmdb_data.get("genres", [])
    genres_str = ", ".join(g["name"] for g in genres_list) if genres_list else db_movie.genres

    return {
        "id": db_movie.tmdb_id,
        "title": db_movie.title,
        "overview": tmdb_data.get("overview") or db_movie.overview or "",
        "genres": genres_str or "",
        "release_date": tmdb_data.get("release_date") or db_movie.release_date or "",
        "vote_average": tmdb_data.get("vote_average") or db_movie.vote_average,
        "vote_count": tmdb_data.get("vote_count") or db_movie.vote_count,
        "popularity": tmdb_data.get("popularity") or db_movie.popularity,
        "poster_url": poster_url,
        "backdrop_url": backdrop_url,
        "original_language": db_movie.original_language or "",
        "cast": db_movie.cast or "",
        "director": db_movie.director or "",
        "keywords": db_movie.keywords or "",
    }


# ─── Endpoint: search ─────────────────────────────────────────────────────────

@router.get("/search")
async def search_movies(
    q: str = Query(..., min_length=1, description="Movie title search query"),
    db: Session = Depends(get_db),
):
    """
    Search for movies whose title contains the query string.
    Returns up to 20 results with basic info (no live TMDB enrichment,
    to keep search fast).
    """
    results = (
        db.query(Movie)
        .filter(Movie.title.ilike(f"%{q}%"))
        .order_by(Movie.popularity.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": m.tmdb_id,
            "title": m.title,
            "release_date": m.release_date or "",
            "vote_average": m.vote_average,
            "overview": (m.overview or "")[:200] + ("…" if len(m.overview or "") > 200 else ""),
            "genres": m.genres or "",
            "original_language": m.original_language or "",
            # Poster URLs for search results come from a TMDB pattern using the stored tmdb_id.
            # We skip a live API call here to keep search snappy; the frontend can request
            # full details when the user clicks a card.
            "poster_url": None,
        }
        for m in results
    ]


# ─── Endpoint: popular movies ─────────────────────────────────────────────────

@router.get("/popular")
async def get_popular_movies(
    limit: int = Query(default=20, ge=1, le=100, description="Number of movies to return"),
    db: Session = Depends(get_db),
):
    """
    Return the top N movies ordered by TMDB popularity score descending.

    Uses only the local SQLite database — no live TMDB API call — so this
    responds instantly even without a network connection or API key.

    Each result includes a poster_url built from a standard TMDB CDN pattern
    using the stored tmdb_id, giving instant posters without individual API calls.

    Response shape matches the search endpoint for easy reuse in the frontend.
    """
    movies = (
        db.query(Movie)
        .filter(Movie.popularity != None)  # noqa: E711
        .order_by(Movie.popularity.desc())
        .limit(limit)
        .all()
    )
    return [_movie_to_card(m) for m in movies]


# ─── Endpoint: movies by genre ─────────────────────────────────────────────────

@router.get("/by-genre")
async def get_movies_by_genre(
    genre: str = Query(..., min_length=1, description="Genre name to filter by"),
    limit: int = Query(default=20, ge=1, le=100, description="Number of movies to return"),
    db: Session = Depends(get_db),
):
    """
    Return up to N movies whose genre string contains the requested genre.

    The `genres` column holds comma-separated display names populated during
    ingestion, e.g. "Action, Adventure, Science Fiction".  A case-insensitive
    LIKE search correctly matches any movie that includes the requested genre.

    Results are ordered by popularity so the best-known films appear first.
    """
    movies = (
        db.query(Movie)
        .filter(Movie.genres.ilike(f"%{genre}%"))
        .order_by(Movie.popularity.desc())
        .limit(limit)
        .all()
    )
    return [_movie_to_card(m) for m in movies]


# ─── Endpoint: movie detail ────────────────────────────────────────────────────

@router.get("/{tmdb_id}")
async def get_movie(tmdb_id: int, db: Session = Depends(get_db)):
    """
    Return full details for a single movie, enriched with live TMDB API data.
    """
    movie = db.query(Movie).filter(Movie.tmdb_id == tmdb_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    tmdb_data = await _fetch_tmdb_details(tmdb_id)
    return _build_movie_response(movie, tmdb_data)


# ─── Endpoint: movie videos / trailer ─────────────────────────────────────────

@router.get("/{tmdb_id}/videos")
async def get_movie_videos(tmdb_id: int, db: Session = Depends(get_db)):
    """
    Fetch the official trailer YouTube key for a movie from the TMDB API.

    The TMDB API key stays on the server — it is never sent to the browser.

    Response
    --------
    {
        "trailer_key": "dQw4w9WgXcQ"   # YouTube video ID, or null if none found
    }

    Priority order when multiple videos are available:
      1. Official Trailer on YouTube
      2. Any Trailer on YouTube
      3. Any Teaser on YouTube
    """
    # Verify the movie exists in our database first
    movie = db.query(Movie).filter(Movie.tmdb_id == tmdb_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    if not TMDB_API_KEY:
        # No API key configured — return null gracefully rather than erroring
        return {"trailer_key": None}

    url = f"{TMDB_BASE_URL}/movie/{tmdb_id}/videos"
    params = {"api_key": TMDB_API_KEY, "language": "en-US"}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return {"trailer_key": None}
            videos = resp.json().get("results", [])
    except Exception:
        return {"trailer_key": None}

    # Filter to YouTube videos only — we embed them with the YouTube iframe API
    yt_videos = [v for v in videos if v.get("site") == "YouTube"]

    # Priority 1: official trailer
    for v in yt_videos:
        if v.get("type") == "Trailer" and v.get("official"):
            return {"trailer_key": v["key"]}

    # Priority 2: any trailer
    for v in yt_videos:
        if v.get("type") == "Trailer":
            return {"trailer_key": v["key"]}

    # Priority 3: any teaser
    for v in yt_videos:
        if v.get("type") == "Teaser":
            return {"trailer_key": v["key"]}

    # Nothing usable found
    return {"trailer_key": None}
