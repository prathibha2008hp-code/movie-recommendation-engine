"""
main.py
-------
FastAPI application entry point.

Run with:
    uvicorn app.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import CORS_ORIGINS
from app.database import Base, engine
from app.routes import movies, recommendations

# ─── Create all database tables if they don't exist yet ──────────────────────
# This is safe to call every time — it skips tables that already exist.
Base.metadata.create_all(bind=engine)

# ─── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="Movie Recommendation Engine",
    description="Content-based movie recommendations using TF-IDF + cosine similarity.",
    version="1.0.0",
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# Set CORS_ORIGINS to the exact Vercel site origin in the Render dashboard.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Accept", "Content-Type"],
    max_age=600,
)

# ─── Register route groups ────────────────────────────────────────────────────
app.include_router(movies.router, prefix="/api/movies", tags=["movies"])
app.include_router(
    recommendations.router,
    prefix="/api/recommendations",
    tags=["recommendations"],
)


# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/", tags=["health"])
def root():
    return {"status": "ok", "message": "Movie Recommendation Engine is running."}
