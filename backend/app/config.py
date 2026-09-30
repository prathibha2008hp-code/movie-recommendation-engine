"""
config.py
---------
Loads environment variables from the .env file in the backend/ directory.
Uses python-dotenv so secrets never have to be hardcoded.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Resolve the path to backend/.env regardless of where the script is called from
BASE_DIR = Path(__file__).resolve().parent.parent  # → backend/
load_dotenv(BASE_DIR / ".env")

# TMDB API key — set this in backend/.env
TMDB_API_KEY: str = os.getenv("TMDB_API_KEY", "")

# Base URL for all TMDB API calls
TMDB_BASE_URL: str = "https://api.themoviedb.org/3"

# Base URL for TMDB image CDN
TMDB_IMAGE_BASE_URL: str = "https://image.tmdb.org/t/p/w500"

# Path to the SQLite database file (created automatically on first run)
DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'movies.db'}"

# Path to the data folder containing the CSV files
DATA_DIR: Path = BASE_DIR.parent / "data"
