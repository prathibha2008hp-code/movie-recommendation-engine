import { useState, useCallback } from 'react'
import SearchBar from './components/SearchBar.jsx'
import MovieCard from './components/MovieCard.jsx'
import RecommendationList from './components/RecommendationList.jsx'
import SelectedMovie from './components/SelectedMovie.jsx'
import MovieDetailModal from './components/MovieDetailModal.jsx'
import WatchlistPage from './components/WatchlistPage.jsx'
import useWatchlist from './hooks/useWatchlist.js'
import { searchMovies, getMovieDetails, getRecommendations } from './api/movies.js'

/**
 * App.jsx — Root component
 *
 * Views:
 *   "home"      → hero + search + results + recommendations (default)
 *   "watchlist" → My Watchlist page
 *
 * Modal is independent of the current view — it can overlay both.
 */

/** Skeleton placeholder grid shown while recommendations load */
function SkeletonGrid({ count = 6 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="skeleton-card" key={i}>
          <div className="skeleton-poster" />
          <div className="skeleton-body">
            <div className="skeleton-line skeleton-line--med" />
            <div className="skeleton-line skeleton-line--short" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Navigation header — shown on all views */
function AppHeader({ watchlistCount, currentView, onNavHome, onNavWatchlist }) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        {/* Brand — always navigates home */}
        <button className="header-brand" onClick={onNavHome} aria-label="Go to home">
          <div className="header-brand-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 8h20v14a1 1 0 01-1 1H3a1 1 0 01-1-1V8zm18-2H4V3a1 1 0 011-1h14a1 1 0 011 1v3zM7 2v4M12 2v4M17 2v4M7 12l5 3-5 3v-6z"/>
            </svg>
          </div>
          <span className="header-brand-name">Movie<span>Mind</span></span>
        </button>

        {/* Watchlist nav item */}
        <button
          className={`header-watchlist-btn${currentView === 'watchlist' ? ' header-watchlist-btn--active' : ''}`}
          onClick={onNavWatchlist}
          aria-label={`My Watchlist, ${watchlistCount} saved`}
          aria-current={currentView === 'watchlist' ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
            <path
              d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
              fill={currentView === 'watchlist' ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Watchlist</span>
          {watchlistCount > 0 && (
            <span className="header-watchlist-count" aria-hidden="true">
              {watchlistCount}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}

export default function App() {
  // ── View state ────────────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState('home') // 'home' | 'watchlist'

  // ── Watchlist ─────────────────────────────────────────────────────────────
  const { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlist()

  // ── Recommendation / search state ─────────────────────────────────────────
  const [searchResults, setSearchResults]     = useState([])
  const [selectedMovie, setSelectedMovie]     = useState(null)
  const [recommendations, setRecommendations] = useState([])
  const [loadingSearch, setLoadingSearch]     = useState(false)
  const [loadingRecs, setLoadingRecs]         = useState(false)
  const [error, setError]                     = useState(null)
  const [hasSearched, setHasSearched]         = useState(false)

  // ── Modal state ───────────────────────────────────────────────────────────
  const [modalMovie, setModalMovie]   = useState(null)
  const [modalLoading, setModalLoading] = useState(false)

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleNavHome = useCallback(() => setCurrentView('home'), [])
  const handleNavWatchlist = useCallback(() => setCurrentView('watchlist'), [])

  // ── Search ────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(async (query) => {
    if (!query.trim()) return
    setCurrentView('home')
    setError(null)
    setLoadingSearch(true)
    setSearchResults([])
    setSelectedMovie(null)
    setRecommendations([])
    setHasSearched(true)
    try {
      const results = await searchMovies(query)
      setSearchResults(results)
    } catch {
      setError('Search failed. Make sure the backend is running on port 8000.')
    } finally {
      setLoadingSearch(false)
    }
  }, [])

  // ── Card body click → load recommendations ────────────────────────────────
  const handleSelectMovie = useCallback(async (tmdbId) => {
    setCurrentView('home')
    setError(null)
    setLoadingRecs(true)
    setSelectedMovie(null)
    setRecommendations([])
    setTimeout(() => {
      document.getElementById('detail-section')?.scrollIntoView({ behavior: 'smooth' })
    }, 80)
    try {
      const [detail, recs] = await Promise.all([
        getMovieDetails(tmdbId),
        getRecommendations(tmdbId),
      ])
      setSelectedMovie(detail)
      setRecommendations(recs)
    } catch {
      setError('Could not load movie details. Please try again.')
    } finally {
      setLoadingRecs(false)
    }
  }, [])

  // ── ⓘ button click → open detail modal ───────────────────────────────────
  const handleOpenModal = useCallback(async (movieOrId) => {
    if (movieOrId && typeof movieOrId === 'object') {
      setModalMovie(movieOrId)
      return
    }

    setModalLoading(true)
    try {
      const detail = await getMovieDetails(movieOrId)
      setModalMovie(detail)
    } catch {
      setModalLoading(false)
    } finally {
      setModalLoading(false)
    }
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalMovie(null)
  }, [])

  // ── Watchlist toggle from modal ───────────────────────────────────────────
  const handleWatchlistToggle = useCallback((movie) => {
    if (isInWatchlist(movie.id)) {
      removeFromWatchlist(movie.id)
    } else {
      addToWatchlist(movie)
    }
  }, [isInWatchlist, addToWatchlist, removeFromWatchlist])

  return (
    <>
      {/* ══ PERSISTENT HEADER ══════════════════════════════════════════════ */}
      <AppHeader
        watchlistCount={watchlist.length}
        currentView={currentView}
        onNavHome={handleNavHome}
        onNavWatchlist={handleNavWatchlist}
      />

      {/* ══ WATCHLIST VIEW ════════════════════════════════════════════════ */}
      {currentView === 'watchlist' && (
        <WatchlistPage
          watchlist={watchlist}
          onRemove={removeFromWatchlist}
          onOpenModal={handleOpenModal}
        />
      )}

      {/* ══ HOME VIEW ════════════════════════════════════════════════════ */}
      {currentView === 'home' && (
        <>
          {/* ── HERO ────────────────────────────────────────────────────── */}
          <section className="hero">
            <div className="hero-inner">
              <div className="brand">
                <div className="brand-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 8h20v14a1 1 0 01-1 1H3a1 1 0 01-1-1V8zm18-2H4V3a1 1 0 011-1h14a1 1 0 011 1v3zM7 2v4M12 2v4M17 2v4M7 12l5 3-5 3v-6z"/>
                  </svg>
                </div>
                <h1 className="hero-title">Movie<span>Mind</span></h1>
              </div>

              <p className="hero-subtitle">
                Discover your next favorite movie — powered by content similarity
              </p>

              <SearchBar onSearch={handleSearch} loading={loadingSearch} />
            </div>
          </section>

          {/* ── PAGE BODY ───────────────────────────────────────────────── */}
          <main className="page-body">

            {/* Error banner */}
            {error && (
              <div className="error-banner" role="alert">
                <span className="error-message">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </span>
                <button className="error-close" onClick={() => setError(null)} aria-label="Dismiss">×</button>
              </div>
            )}

            {/* Search loading */}
            {loadingSearch && (
              <div className="loading-state" aria-live="polite">
                <div className="spinner" />
                <p>Searching movies…</p>
              </div>
            )}

            {/* Empty state */}
            {!loadingSearch && hasSearched && searchResults.length === 0 && !error && (
              <div className="empty-state" role="status">
                <div className="empty-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <p className="empty-title">No movies found</p>
                <p className="empty-body">Try a different title — e.g. "Inception", "Avatar", or "The Dark Knight".</p>
              </div>
            )}

            {/* Search results */}
            {searchResults.length > 0 && (
              <section className="results-section">
                <div className="section-header">
                  <h2 className="section-title">Search Results</h2>
                  <span className="section-count">{searchResults.length}</span>
                </div>
                <div className="movie-grid">
                  {searchResults.map((movie) => (
                    <MovieCard
                      key={movie.id}
                      movie={movie}
                      onClick={handleSelectMovie}
                      onInfo={handleOpenModal}
                      isSelected={selectedMovie?.id === movie.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Detail + Recommendations */}
            <div id="detail-section">
              {loadingRecs && (
                <section className="selected-section">
                  <div className="section-header">
                    <h2 className="section-title">Loading…</h2>
                  </div>
                  <SkeletonGrid count={6} />
                </section>
              )}

              {selectedMovie && !loadingRecs && (
                <>
                  <hr className="section-divider" />

                  <section className="selected-section">
                    <div className="section-header">
                      <h2 className="section-title">Now Viewing</h2>
                    </div>
                    <SelectedMovie movie={selectedMovie} onInfo={handleOpenModal} />
                  </section>

                  <RecommendationList
                    movies={recommendations}
                    onSelect={handleSelectMovie}
                    onInfo={handleOpenModal}
                  />
                </>
              )}
            </div>

          </main>
        </>
      )}

      {/* ══ MODAL (mounted outside views so it overlays everything) ═══════ */}
      {modalLoading && (
        <div className="modal-fetch-indicator" aria-hidden="true">
          <div className="spinner" />
        </div>
      )}

      {modalMovie && (
        <MovieDetailModal
          movie={modalMovie}
          onClose={handleCloseModal}
          onWatchlist={handleWatchlistToggle}
          isWatchlisted={isInWatchlist(modalMovie.id)}
        />
      )}
    </>
  )
}
