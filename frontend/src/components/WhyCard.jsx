/**
 * WhyCard
 * -------
 * Collapsible "Why this movie?" panel that sits below each recommendation
 * card in the grid.
 *
 * Uses the native <details>/<summary> HTML elements so it works without
 * any JS state — the browser handles open/close natively and accessibly.
 *
 * Props:
 *   reasons         – verified metadata overlaps from the recommendation API
 *   contentTerms    – shared, normalized terms from both movie overviews
 *   similarityScore – cosine similarity returned by the recommendation engine
 *   sourceTitle     – title of the movie used to generate recommendations
 *   title           – recommended movie title (used for aria labelling)
 */

/**
 * Icon and colour mapping per reason type.
 * Each type gets a distinct pill colour so the user can scan quickly.
 */
const TYPE_CONFIG = {
  genre:    { icon: '🎭', label: 'Genres' },
  director: { icon: '🎬', label: 'Director' },
  cast:     { icon: '👥', label: 'Cast overlap' },
  keyword:  { icon: '🔑', label: 'Shared keywords' },
  language: { icon: '🌐', label: 'Language' },
}

export default function WhyCard({ reasons = [], contentTerms = [], similarityScore, sourceTitle, title }) {
  const groupedReasons = Object.entries(TYPE_CONFIG)
    .map(([type, config]) => ({
      ...config,
      type,
      labels: [...new Set(reasons.filter((reason) => reason.type === type && reason.label).map((reason) => reason.label))],
    }))
    .filter((group) => group.labels.length > 0)
  const validContentTerms = [...new Set(contentTerms.filter((term) => typeof term === 'string' && term.trim()))]
  const matchPercent = Number.isFinite(similarityScore)
    ? Math.round(Math.max(0, Math.min(1, similarityScore)) * 100)
    : null

  if (!groupedReasons.length && !validContentTerms.length && matchPercent === null) return null

  return (
    <details className="why-card">
      <summary className="why-summary" aria-label={`Why ${title} was recommended`}>
        <span className="why-summary-icon" aria-hidden="true">
          {/* Chevron — CSS rotates it on open */}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
        <span className="why-summary-text">Why this movie?</span>
      </summary>

      <div className="why-body">
        {sourceTitle && <p className="why-intro">Compared with {sourceTitle}</p>}
        <div className="why-groups">
          {groupedReasons.map((group) => (
            <section className="why-group" key={group.type}>
              <h3 className="why-group-heading">
                <span aria-hidden="true">{group.icon}</span>
                {group.label}
              </h3>
              <div className="why-values">
                {group.labels.map((label) => <span className="why-value" key={label}>{label}</span>)}
              </div>
            </section>
          ))}

          {validContentTerms.length > 0 && (
            <section className="why-group">
              <h3 className="why-group-heading"><span aria-hidden="true">📝</span>Shared overview terms</h3>
              <div className="why-values">
                {validContentTerms.map((term) => <span className="why-value" key={term}>{term}</span>)}
              </div>
            </section>
          )}
        </div>

        {matchPercent !== null && (
          <div className="why-match">
            <div className="why-match-heading">
              <span>Content match</span>
              <strong>{matchPercent}%</strong>
            </div>
            <div className="why-match-track" role="meter" aria-label={`Content match ${matchPercent}%`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={matchPercent}>
              <span style={{ width: `${matchPercent}%` }} />
            </div>
          </div>
        )}
      </div>
    </details>
  )
}
