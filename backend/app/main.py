"""
main.py
-------
FastAPI application entry point.

Run with:
    uvicorn app.main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
# Allow the React dev server (port 5173) to call this backend (port 8000).
# In production you would restrict origins to your real domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
