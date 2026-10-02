import { useEffect, useRef, useState } from 'react'
import { getMovieVideos } from '../api/movies.js'

/** Heart icon for the watchlist button */
function HeartIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
      <path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * MovieDetailModal
 * ----------------
 * Full-screen cinematic modal for a single movie.
 *
 * Features:
 *   • Blurred backdrop image behind all content
 *   • Large poster + full metadata (title, rating, year, runtime, genres, overview)
 *   • "Watch Trailer" button — fetches the YouTube key via the backend API
 *     so the TMDB API key is never exposed to the browser
 *   • YouTube embed appears inline when a trailer is found
 *   • Close on: ✕ button, Escape key, or clicking the dark overlay
 *   • Body scroll lock while open
 *   • Smooth fade+scale animation on open/close
 *
 * Props:
 *   movie   — full movie object from GET /api/movies/{id}
 *   onClose — callback to hide the modal
 */

const PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect width='200' height='300' fill='%2311111a'/%3E%3Crect x='70' y='80' width='60' height='50' rx='4' fill='none' stroke='%2333335a' stroke-width='2'/%3E%3Ccircle cx='100' cy='170' r='20' fill='none' stroke='%2333335a' stroke-width='2'/%3E%3Cpath d='M94 170l8-5v10z' fill='%2333335a'/%3E%3Ctext x='100' y='230' font-family='sans-serif' font-size='11' fill='%2344446a' text-anchor='middle'%3ENo Poster%3C/text%3E%3C/svg%3E`

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="14" height="14">
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        fill="currentColor"
      />
    </svg>
  )
}

/** Play triangle icon for the trailer button */
function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
    </svg>
  )
}

/** Reusable close ✕ button */
function CloseButton({ onClick, className = '' }) {
  return (
    <button
      className={`modal-close-btn ${className}`}
      onClick={onClick}
      aria-label="Close details"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  )
}

/** Format runtime minutes → "2h 22m" */
function formatRuntime(mins) {
  if (!mins || typeof mins !== 'number') return null
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default function MovieDetailModal({ movie, onClose, onWatchlist, isWatchlisted = false }) {
  // Trailer state
  const [trailerKey, setTrailerKey]         = useState(null)   // YouTube video ID
  const [trailerLoading, setTrailerLoading] = useState(false)
  const [trailerError, setTrailerError]     = useState(false)
  const [showPlayer, setShowPlayer]         = useState(false)  // show iframe embed

  // Animation state — we mount first, then apply the "open" class for the transition
  const [isVisible, setIsVisible] = useState(false)

  const dialogRef = useRef(null)

  // ── Derived values ──────────────────────────────────────────────────────────
  const year      = (movie.release_date || '').slice(0, 4)
  const score     = movie.vote_average ? (Math.round(movie.vote_average * 10) / 10) : null
  const runtime   = formatRuntime(movie.runtime)
  const posterSrc = movie.poster_url || PLACEHOLDER
  const backdrop  = movie.backdrop_url || movie.poster_url || null

  const genres = (movie.genres || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)

  const director = (movie.director || '').replace(/_/g, ' ')
  const cast = (movie.cast || '')
    .split(' ')
    .map((n) => n.replace(/_/g, ' '))
    .filter(Boolean)
    .join(', ')

  // ── Mount animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    // One rAF delay so the browser paints the initial state before the transition
    const id = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // ── Body scroll lock ────────────────────────────────────────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // ── Escape key handler ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Focus trap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    dialogRef.current?.focus()
  }, [])

  // ── Trailer fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function fetchTrailer() {
      setTrailerLoading(true)
      setTrailerError(false)
      try {
        const key = await getMovieVideos(movie.id)
        if (!cancelled) setTrailerKey(key)
      } catch {
        if (!cancelled) setTrailerError(true)
      } finally {
        if (!cancelled) setTrailerLoading(false)
      }
    }
    fetchTrailer()
    return () => { cancelled = true }
  }, [movie.id])

  // ── Close with exit animation ───────────────────────────────────────────────
  function handleClose() {
    setIsVisible(false)
    // Wait for the CSS transition to finish before unmounting
    setTimeout(onClose, 280)
  }

  // ── Overlay click — close only if clicking the dark background ──────────────
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) handleClose()
  }

  // ── Trailer button logic ────────────────────────────────────────────────────
  function handleWatchTrailer() {
    setShowPlayer(true)
  }

  const hasTrailer      = trailerKey !== null && !trailerError
  const trailerReady    = !trailerLoading && hasTrailer
  const trailerNotFound = !trailerLoading && !hasTrailer && !trailerError

  return (
    <div
      className={`modal-overlay${isVisible ? ' modal-overlay--visible' : ''}`}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Details for ${movie.title}`}
    >
      <div
        className={`modal-panel${isVisible ? ' modal-panel--visible' : ''}`}
        ref={dialogRef}
        tabIndex={-1}
      >
        {/* ── Backdrop image ───────────────────────────────────────────── */}
        {backdrop && (
          <div
            className="modal-backdrop"
            style={{ backgroundImage: `url(${backdrop})` }}
            aria-hidden="true"
          />
        )}
        <div className="modal-backdrop-overlay" aria-hidden="true" />

        {/* ── Close button ─────────────────────────────────────────────── */}
        <CloseButton onClick={handleClose} className="modal-close-btn--corner" />

        {/* ── Scrollable inner content ──────────────────────────────────── */}
        <div className="modal-inner">

          {/* Top section: poster + metadata side by side */}
          <div className="modal-top">
            {/* Poster */}
            <div className="modal-poster-wrap">
              <img
                className="modal-poster"
                src={posterSrc}
                alt={`${movie.title} poster`}
                onError={(e) => { e.currentTarget.src = PLACEHOLDER }}
              />
            </div>

            {/* Metadata */}
            <div className="modal-meta">
              <h2 className="modal-title">{movie.title}</h2>

              {/* Stat row */}
              <div className="modal-stat-row">
                {year && <span className="modal-year">{year}</span>}

                {score !== null && (
                  <span className="modal-rating" aria-label={`Rating ${score} out of 10`}>
                    <StarIcon />
                    {score}<span className="modal-rating-max">/10</span>
                  </span>
                )}

                {runtime && (
                  <span className="modal-runtime">{runtime}</span>
                )}

                {movie.original_language && (
                  <span className="modal-lang">
                    {movie.original_language.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Genre tags */}
              {genres.length > 0 && (
                <div className="genre-tags modal-genres">
                  {genres.map((g) => (
                    <span key={g} className="genre-tag">{g}</span>
                  ))}
                </div>
              )}

              {/* Overview */}
              {movie.overview && (
                <p className="modal-overview">{movie.overview}</p>
              )}

              {/* Director / Cast */}
              {(director || cast) && (
                <div className="modal-credits">
                  {director && (
                    <p className="modal-credit-line">
                      <span className="modal-credit-label">Director</span>
                      <span className="modal-credit-value">{director}</span>
                    </p>
                  )}
                  {cast && (
                    <p className="modal-credit-line">
                      <span className="modal-credit-label">Cast</span>
                      <span className="modal-credit-value">{cast}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Watchlist button */}
              {onWatchlist && (
                <button
                  className={`watchlist-btn${isWatchlisted ? ' watchlist-btn--active' : ''}`}
                  onClick={() => onWatchlist(movie)}
                  aria-label={isWatchlisted ? `Remove ${movie.title} from watchlist` : `Add ${movie.title} to watchlist`}
                >
                  <HeartIcon filled={isWatchlisted} />
                  {isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}
                </button>
              )}

              {/* Trailer button */}
              <div className="modal-trailer-area">
                {trailerLoading && (
                  <button className="trailer-btn trailer-btn--loading" disabled>
                    <span className="btn-spinner" aria-hidden="true" />
                    Checking for trailer…
                  </button>
                )}

                {trailerReady && !showPlayer && (
                  <button
                    className="trailer-btn"
                    onClick={handleWatchTrailer}
                    aria-label={`Watch trailer for ${movie.title}`}
                  >
                    <PlayIcon />
                    Watch Trailer
                  </button>
                )}

                {trailerNotFound && (
                  <span className="trailer-unavailable">
                    No trailer available
                  </span>
                )}

                {trailerError && (
                  <span className="trailer-unavailable">
                    Trailer lookup unavailable
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* YouTube embed — shown only after the user clicks "Watch Trailer" */}
          {showPlayer && trailerKey && (
            <div className="modal-player-wrap">
              <div className="modal-player-inner">
                {/* Close the player */}
                <button
                  className="player-close"
                  onClick={() => setShowPlayer(false)}
                  aria-label="Close video player"
                >
                  ✕ Close player
                </button>
                <div className="modal-iframe-wrap">
                  <iframe
                    className="modal-iframe"
                    src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0`}
                    title={`${movie.title} trailer`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </div>
            </div>
          )}

        </div>{/* /.modal-inner */}
      </div>{/* /.modal-panel */}
    </div>
  )
}
