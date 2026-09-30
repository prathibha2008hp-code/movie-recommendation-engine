"""
database.py
-----------
Sets up the SQLAlchemy engine and session factory.
All other modules import `SessionLocal` to get a database session
and `Base` to define ORM models.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import DATABASE_URL

# `check_same_thread=False` is required for SQLite when used with FastAPI
# because FastAPI can handle multiple requests across threads.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

# Each call to SessionLocal() creates a new database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# All ORM model classes will inherit from Base
Base = declarative_base()


def get_db():
    """
    FastAPI dependency that yields a database session per request
    and ensures it is always closed afterwards — even on errors.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
