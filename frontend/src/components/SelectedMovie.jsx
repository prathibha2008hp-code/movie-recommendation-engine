/**
 * SelectedMovie
 * -------------
 * Displays the selected movie as a full-width cinematic banner.
 * Uses the movie's poster as a blurred backdrop (if available),
 * then overlays the poster thumbnail + metadata on top.
 *
 * Props:
 *   movie – full movie detail object from GET /api/movies/{id}
 */

// Same placeholder used in MovieCard
const PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect width='200' height='300' fill='%2311111a'/%3E%3Crect x='70' y='80' width='60' height='50' rx='4' fill='none' stroke='%2333335a' stroke-width='2'/%3E%3Ccircle cx='100' cy='170' r='20' fill='none' stroke='%2333335a' stroke-width='2'/%3E%3Cpath d='M94 170l8-5v10z' fill='%2333335a'/%3E%3Ctext x='100' y='230' font-family='sans-serif' font-size='11' fill='%2344446a' text-anchor='middle'%3ENo Poster%3C/text%3E%3C/svg%3E`

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

export default function SelectedMovie({ movie, onInfo }) {
  const year  = (movie.release_date || '').slice(0, 4)
  const score = movie.vote_average ? (Math.round(movie.vote_average * 10) / 10) : null
  const posterSrc = movie.poster_url || PLACEHOLDER
  // Use poster as backdrop if no separate backdrop_url
  const backdropSrc = movie.backdrop_url || movie.poster_url || null

  // Parse genre string
  const genres = (movie.genres || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)

  // director is already title-cased; strip any stray underscores defensively
  const director = (movie.director || '').replace(/_/g, ' ')
  // cast is now comma-separated: "Sam Worthington, Zoe Saldana, ..."
  const cast = (movie.cast || '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
    .join(', ')

  return (
    <div className="selected-banner">
      {/* Blurred backdrop */}
      {backdropSrc && (
        <div
          className="selected-backdrop"
          style={{ backgroundImage: `url(${backdropSrc})` }}
          aria-hidden="true"
        />
      )}
      <div className="selected-backdrop-overlay" aria-hidden="true" />

      {/* Content */}
      <div className="selected-content">
        {/* Poster thumbnail — clicking opens the detail modal */}
        <div className="selected-poster-wrap">
          <img
            className={`selected-poster${onInfo ? ' selected-poster--clickable' : ''}`}
            src={posterSrc}
            alt={`${movie.title} poster`}
            onClick={() => onInfo && onInfo(movie.id)}
            onError={(e) => { e.currentTarget.src = PLACEHOLDER }}
          />
        </div>

        {/* Metadata */}
        <div className="selected-meta">
          <h3 className="selected-title">{movie.title}</h3>

          {/* Year · Rating · Language */}
          <div className="selected-row">
            {year && <span className="selected-year">{year}</span>}
            {score !== null && (
              <span className="selected-rating" aria-label={`Rating ${score} out of 10`}>
                <StarIcon />
                {score}<span style={{ fontWeight: 400, opacity: 0.5, fontSize: '0.8em' }}>/10</span>
              </span>
            )}
            {movie.original_language && (
              <span className="selected-lang">{movie.original_language.toUpperCase()}</span>
            )}
          </div>

          {/* Genre tags */}
          {genres.length > 0 && (
            <div className="genre-tags">
              {genres.map((g) => (
                <span key={g} className="genre-tag">{g}</span>
              ))}
            </div>
          )}

          {/* Overview */}
          {movie.overview && (
            <p className="selected-overview">{movie.overview}</p>
          )}

          {/* Director / Cast */}
          {(director || cast) && (
            <div className="selected-credits">
              {director && (
                <p className="selected-credit-line">
                  <strong>Director</strong> — {director}
                </p>
              )}
              {cast && (
                <p className="selected-credit-line">
                  <strong>Cast</strong> — {cast}
                </p>
              )}
            </div>
          )}

          {/* View details button */}
          {onInfo && (
            <button
              className="selected-details-btn"
              onClick={() => onInfo(movie.id)}
              aria-label={`View full details for ${movie.title}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              View Details &amp; Trailer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
