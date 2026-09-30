/**
 * MovieCard
 * ---------
 * Poster-fill card with an overlay design.
 *
 * The card has TWO distinct interactions:
 *   • Clicking the card body  → calls onClick(movie.id)
 *                               (triggers recommendation fetch in App.jsx)
 *   • Clicking the ⓘ button  → calls onInfo(movie.id)
 *                               (opens the detail modal)
 *
 * Props:
 *   movie      – movie object from the API
 *   onClick    – called with movie.id on card click (recommendation flow)
 *   onInfo     – called with movie.id on info-button click (modal flow)
 *   isSelected – adds a glowing accent border when true
 */

const PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect width='200' height='300' fill='%2311111a'/%3E%3Crect x='70' y='80' width='60' height='50' rx='4' fill='none' stroke='%2533335a' stroke-width='2'/%3E%3Ccircle cx='100' cy='170' r='20' fill='none' stroke='%2333335a' stroke-width='2'/%3E%3Cpath d='M94 170l8-5v10z' fill='%2333335a'/%3E%3Ctext x='100' y='230' font-family='sans-serif' font-size='11' fill='%2344446a' text-anchor='middle'%3ENo Poster%3C/text%3E%3C/svg%3E`

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

export default function MovieCard({ movie, onClick, onInfo, isSelected = false }) {
  const handleCardClick = () => { if (onClick) onClick(movie.id) }
  const handleInfoClick = (e) => {
    // Stop the event so it doesn't also trigger handleCardClick
    e.stopPropagation()
    if (onInfo) onInfo(movie.id)
  }

  const year  = (movie.release_date || '').slice(0, 4)
  const score = movie.vote_average ? (Math.round(movie.vote_average * 10) / 10) : null

  // similarity_score is a cosine similarity float (0.0–1.0) returned only for
  // recommendation cards. Convert to a whole-number percentage for display.
  // null/undefined means this is a search result card — hide the badge entirely.
  const matchPct =
    movie.similarity_score != null
      ? Math.round(movie.similarity_score * 100)
      : null

  const genres = (movie.genres || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
    .slice(0, 3)

  const overviewSnippet =
    (movie.overview || '').slice(0, 120) +
    ((movie.overview || '').length > 120 ? '…' : '')

  return (
    <article
      className={`movie-card${isSelected ? ' movie-card--selected' : ''}`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={`Get recommendations for ${movie.title}`}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
    >
      {/* Poster */}
      <div className="card-poster-wrap">
        <img
          className="card-poster"
          src={movie.poster_url || PLACEHOLDER}
          alt={`${movie.title} poster`}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = PLACEHOLDER }}
        />
      </div>

      {/* Rating badge — top right */}
      {score !== null && (
        <div className="card-badge" aria-label={`Rating ${score} out of 10`}>
          <StarIcon />
          {score}
        </div>
      )}

      {/* Info button — top left, opens detail modal */}
      {onInfo && (
        <button
          className="card-info-btn"
          onClick={handleInfoClick}
          aria-label={`View details for ${movie.title}`}
          tabIndex={0}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </button>
      )}

      {/* Overlay — purely decorative aria-hidden */}
      <div className="card-overlay" aria-hidden="true">
        <div className="card-info-base">
          <p className="card-title">{movie.title}</p>
          <div className="card-meta-row">
            {year && <span className="card-year">{year}</span>}
            {matchPct !== null && (
              <span className="card-match-badge">
                Match: {matchPct}%
              </span>
            )}
          </div>
        </div>

        <div className="card-info-hover">
          {overviewSnippet && (
            <p className="card-overview-clip">{overviewSnippet}</p>
          )}
          {genres.length > 0 && (
            <div className="genre-tags">
              {genres.map((g) => (
                <span key={g} className="genre-tag">{g}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
