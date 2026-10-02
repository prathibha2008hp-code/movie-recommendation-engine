import MovieCard from './MovieCard.jsx'
import WhyCard from './WhyCard.jsx'

/**
 * RecommendationList
 * ------------------
 * Shows the grid of content-similar movies below the selected movie banner.
 * Each movie card is paired with a collapsible WhyCard explanation panel.
 */
export default function RecommendationList({ movies, onSelect, onInfo, sourceTitle }) {
  if (!movies) return null

  return (
    <section className="recommendations-section">
      <div className="section-header">
        <h2 className="section-title">You Might Also Like</h2>
        {movies.length > 0 && (
          <span className="section-count">{movies.length} picks</span>
        )}
      </div>

      {movies.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                strokeLinecap="round" strokeLinejoin="round"
                strokeWidth="1.5" stroke="currentColor" fill="none"
              />
            </svg>
          </div>
          <p className="empty-title">No recommendations found</p>
          <p className="empty-body">
            This movie may not have enough metadata to generate suggestions.
          </p>
        </div>
      ) : (
        <>
          <p className="rec-meta">
            Ranked by content similarity — genres, keywords, cast &amp; director
          </p>

          {/*
           * rec-grid wraps each (MovieCard + WhyCard) pair in a .rec-cell div.
           * This keeps the card and its explanation visually grouped together
           * while the grid handles responsive column layout.
           */}
          <div className="rec-grid">
            {movies.map((movie) => (
              <div className="rec-cell" key={movie.id}>
                <MovieCard
                  movie={movie}
                  onClick={onSelect}
                  onInfo={onInfo}
                />
                <WhyCard
                  reasons={movie.explanation?.reasons}
                  contentTerms={movie.explanation?.content_terms}
                  similarityScore={movie.similarity_score}
                  sourceTitle={sourceTitle}
                  title={movie.title}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
