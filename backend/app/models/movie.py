"""
models/movie.py
---------------
Defines the Movie table in SQLite using SQLAlchemy ORM.
Each column maps to a piece of information we extracted from the TMDB CSV files.
"""

from sqlalchemy import Column, Integer, String, Float, Text
from app.database import Base


class Movie(Base):
    """
    Represents one movie row in the `movies` table.
    """
    __tablename__ = "movies"

    # Primary key — we use the TMDB movie ID so it's stable across runs
    id = Column(Integer, primary_key=True, index=True)

    # The numeric TMDB ID (e.g. 19995 for Avatar)
    tmdb_id = Column(Integer, unique=True, index=True, nullable=False)

    # Movie title
    title = Column(String, index=True, nullable=False)

    # Short text description of the movie
    overview = Column(Text, nullable=True)

    # Comma-separated genre names, e.g. "Action, Adventure, Fantasy"
    genres = Column(String, nullable=True)

    # Comma-separated keyword names
    keywords = Column(String, nullable=True)

    # Top 3 cast members, comma-separated
    cast = Column(String, nullable=True)

    # Director name(s)
    director = Column(String, nullable=True)

    # Original language code, e.g. "en"
    original_language = Column(String, nullable=True)

    # Release date string, e.g. "2009-12-10"
    release_date = Column(String, nullable=True)

    # Average TMDB vote score
    vote_average = Column(Float, nullable=True)

    # Number of votes
    vote_count = Column(Integer, nullable=True)

    # Popularity score from TMDB
    popularity = Column(Float, nullable=True)

    # ─── Computed field used by the recommendation engine ────────────────
    # A single string that combines all the features above.
    # The TF-IDF vectorizer will be trained on this field.
    combined_features = Column(Text, nullable=True)
