# 🎬 Movie Recommendation Engine

A full-stack content-based movie recommendation website built with:
- **Backend:** Python · FastAPI · SQLAlchemy · SQLite · scikit-learn
- **Frontend:** React · Vite · JavaScript · Axios

It uses the **TMDB 5000 dataset** for offline recommendation logic and the **TMDB API** for live movie metadata (posters, ratings, etc.).

---

## Features

- 🔍 Search movies by title
- 🎯 Content-based filtering using TF-IDF + cosine similarity
- 🖼️ Live poster/backdrop images via TMDB API
- ⭐ Ratings, release dates, and overviews on every card
- 📱 Responsive design
- ⚠️ Graceful handling of missing images and API errors

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Axios |
| Backend | Python 3.10+, FastAPI, Uvicorn |
| Database | SQLite (via SQLAlchemy) |
| ML | pandas, scikit-learn (TF-IDF + cosine similarity) |
| External API | TMDB API |

---

## Folder Structure

```
movie-recommendation-engine/
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          ← FastAPI application entry point
│   │   ├── config.py        ← Environment variable loading
│   │   ├── database.py      ← SQLAlchemy engine + session
│   │   ├── models/
│   │   │   └── movie.py     ← SQLAlchemy Movie model
│   │   ├── routes/
│   │   │   ├── movies.py    ← /api/movies/search + /api/movies/{id}
│   │   │   └── recommendations.py  ← /api/recommendations/{id}
│   │   └── recommender/
│   │       ├── ingest.py    ← CSV → SQLite ingestion script
│   │       └── engine.py    ← TF-IDF + cosine similarity logic
│   ├── requirements.txt
│   ├── .env.example
│   └── .env                 ← (git-ignored) your real API key goes here
│
├── frontend/
│   ├── src/
│   │   ├── api/movies.js    ← Axios calls to the backend
│   │   ├── components/
│   │   │   ├── SearchBar.jsx
│   │   │   ├── MovieCard.jsx
│   │   │   └── RecommendationList.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
├── data/
│   ├── tmdb_5000_movies.csv
│   └── tmdb_5000_credits.csv
│
├── .gitignore
└── README.md
```

---

## Setup Instructions

### 1. Prerequisites

- Python 3.10 or newer
- Node.js 18 or newer
- A free [TMDB API key](https://www.themoviedb.org/settings/api)

### 2. Add your TMDB API key

Copy the example file and fill in your key:

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and replace the placeholder:

```
TMDB_API_KEY=your_real_api_key_here
```

**Never commit `backend/.env`** — it is already in `.gitignore`.

### 3. Place the dataset

Copy the two CSV files into the `data/` folder:

```
data/tmdb_5000_movies.csv
data/tmdb_5000_credits.csv
```

### 4. Install backend dependencies

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 5. Ingest the dataset

This reads both CSV files, builds the recommendation features, and populates `backend/movies.db`:

```bash
# (still inside backend/ with venv active)
python -m app.recommender.ingest
```

You will see progress output. Re-running is safe — duplicates are skipped.

### 6. Run the backend

```bash
# (still inside backend/ with venv active)
uvicorn app.main:app --reload --port 8000
```

The API is now live at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`

### 7. Install frontend dependencies

Open a **new terminal**:

```bash
cd frontend
npm install
```

### 8. Run the frontend

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### Deploy the backend to Render

The SQLite database is generated from the tracked CSV files during each Render build; do not commit `backend/movies.db`.

Set the Render service commands to:

**Build command**

```bash
pip install -r backend/requirements.txt && cd backend && python -m app.recommender.ingest
```

**Start command**

```bash
cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Add these environment variables in the Render dashboard:

- `TMDB_API_KEY`: the server-side TMDB key (never add it to the frontend).
- `CORS_ORIGINS`: the exact Vercel origin, such as `https://your-project.vercel.app` (no trailing slash). Multiple origins can be comma-separated.

The local `.env` file is not used by Render; environment variables must be configured in the service dashboard.

---

## API Endpoint Documentation

### Search movies
```
GET /api/movies/search?q=<title>
```
Returns a list of movies matching the search query.

**Example:** `GET /api/movies/search?q=avatar`

---

### Get movie details
```
GET /api/movies/{tmdb_id}
```
Returns full details for a single movie, enriched with live TMDB API data (poster, backdrop, etc.).

**Example:** `GET /api/movies/19995`

---

### Get recommendations
```
GET /api/recommendations/{tmdb_id}
```
Returns up to 10 content-similar movies, enriched with TMDB API data.

**Example:** `GET /api/recommendations/19995`

---

## How the Recommendation Works

1. During ingestion, each movie's **genres**, **keywords**, **overview**, **cast** (top 3), **director**, and **original language** are combined into a single text string called `combined_features`.
2. At startup, the backend computes **TF-IDF vectors** for all movies.
3. When you request recommendations for a movie, **cosine similarity** is calculated against every other movie.
4. The top 10 most similar movies (excluding the selected one) are returned.

---

## Notes

- The TMDB API is only used for enriching cards with live images and metadata. The core recommendations run 100% offline from the CSV data.
- If the TMDB API is unreachable or a movie has no poster, a placeholder image is shown.
- The SQLite database is generated locally — it is not committed to git.
