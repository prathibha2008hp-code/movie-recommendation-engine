/**
 * WatchlistPage
 * -------------
 * Displays all movies saved to the user's watchlist.
 *
 * Each row shows:
 *   • Movie poster
 *   • Title
 *   • Release year
 *   • Rating (star)
 *   • Genres (up to 3)
 *   • "Remove" button
 *
 * Clicking the poster or title opens the existing MovieDetailModal.
 * When empty, an attractive empty-state is shown.
 *
 * Props:
 *   watchlist           – array of movie objects from useWatchlist
 *   onRemove            – (movieId) => void
 *   onOpenModal         – (movie) => void  — opens MovieDetailModal from saved details
 */

const PLACEHOLDER = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'%3E%3Crect width='200' height='300' fill='%2311111a'/%3E%3Crect x='70' y='80' width='60' height='50' rx='4' fill='none' stroke='%2333335a' stroke-width='2'/%3E%3Ccircle cx='100' cy='170' r='20' fill='none' stroke='%2333335a' stroke-width='2'/%3E%3Cpath d='M94 170l8-5v10z' fill='%2333335a'/%3E%3Ctext x='100' y='230' font-family='sans-serif' font-size='11' fill='%2344446a' text-anchor='middle'%3ENo Poster%3C/text%3E%3C/svg%3E`

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="13" height="13">
      <polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        fill="currentColor"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15">
      <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M9 6V4h6v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

function WatchlistEmptyState() {
  return (
    <div className="watchlist-empty">
      <div className="watchlist-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path
            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="watchlist-empty-title">Your watchlist is empty</p>
      <p className="watchlist-empty-body">
        Open any movie's details and click <strong>Add to Watchlist</strong> to save it here.
      </p>
    </div>
  )
}

function WatchlistRow({ movie, onRemove, onOpenModal }) {
  const year   = (movie.release_date || '').slice(0, 4)
  const score  = movie.vote_average ? (Math.round(movie.vote_average * 10) / 10) : null
  const genres = (movie.genres || '')
    .split(',')
    .map((g) => g.trim())
    .filter(Boolean)
    .slice(0, 3)

  return (
    <article className="watchlist-row">
      {/* Poster — clicking opens modal */}
      <button
        className="watchlist-poster-btn"
        onClick={() => onOpenModal(movie)}
        aria-label={`View details for ${movie.title}`}
        tabIndex={0}
      >
        <img
          className="watchlist-poster"
          src={movie.poster_url || PLACEHOLDER}
          alt={`${movie.title} poster`}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = PLACEHOLDER }}
        />
      </button>

      {/* Movie info */}
      <div className="watchlist-info">
        <button
          className="watchlist-title-btn"
          onClick={() => onOpenModal(movie)}
          aria-label={`View details for ${movie.title}`}
        >
          {movie.title}
        </button>

        <div className="watchlist-meta-row">
          {year && <span className="watchlist-year">{year}</span>}
          {score !== null && (
            <span className="watchlist-rating" aria-label={`Rating ${score} out of 10`}>
              <StarIcon />
              {score}
            </span>
          )}
        </div>

        {genres.length > 0 && (
          <div className="genre-tags watchlist-genres">
            {genres.map((g) => (
              <span key={g} className="genre-tag">{g}</span>
            ))}
          </div>
        )}
      </div>

      {/* Remove button */}
      <button
        className="watchlist-remove-btn"
        onClick={() => onRemove(movie.id)}
        aria-label={`Remove ${movie.title} from watchlist`}
        title="Remove from watchlist"
      >
        <TrashIcon />
        <span className="watchlist-remove-label">Remove</span>
      </button>
    </article>
  )
}

export default function WatchlistPage({ watchlist, onRemove, onOpenModal }) {
  return (
    <main className="page-body watchlist-page">
      <div className="section-header watchlist-page-header">
        <h2 className="section-title">My Watchlist</h2>
        {watchlist.length > 0 && (
          <span className="section-count">{watchlist.length} saved</span>
        )}
      </div>

      {watchlist.length === 0 ? (
        <WatchlistEmptyState />
      ) : (
        <div className="watchlist-list">
          {watchlist.map((movie) => (
            <WatchlistRow
              key={movie.id}
              movie={movie}
              onRemove={onRemove}
              onOpenModal={onOpenModal}
            />
          ))}
        </div>
      )}
    </main>
  )
}
