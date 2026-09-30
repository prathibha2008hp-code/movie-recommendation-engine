/**
 * WhyCard
 * -------
 * Collapsible "Why recommended?" panel that sits below each recommendation
 * card in the grid.
 *
 * Uses the native <details>/<summary> HTML elements so it works without
 * any JS state — the browser handles open/close natively and accessibly.
 *
 * Props:
 *   reasons – array of { type: string, label: string }
 *             type is one of: "genre" | "director" | "cast" | "keyword" | "language" | "score"
 *             label is the human-readable text to display
 *   title   – movie title (used for aria labelling)
 */

/**
 * Icon and colour mapping per reason type.
 * Each type gets a distinct pill colour so the user can scan quickly.
 */
const TYPE_CONFIG = {
  genre:    { icon: '🎬', label: 'Genre',    cls: 'why-pill--genre'    },
  director: { icon: '🎥', label: 'Director', cls: 'why-pill--director' },
  cast:     { icon: '⭐', label: 'Cast',     cls: 'why-pill--cast'     },
  keyword:  { icon: '🏷', label: 'Theme',    cls: 'why-pill--keyword'  },
  language: { icon: '🌐', label: 'Language', cls: 'why-pill--language' },
  score:    { icon: '📊', label: 'Match',    cls: 'why-pill--score'    },
}

export default function WhyCard({ reasons, title }) {
  // If there are no reasons, render nothing at all — keeps the grid clean
  if (!reasons || reasons.length === 0) return null

  return (
    <details className="why-card">
      <summary className="why-summary" aria-label={`Why ${title} was recommended`}>
        <span className="why-summary-icon" aria-hidden="true">
          {/* Chevron — CSS rotates it on open */}
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
        <span className="why-summary-text">Why recommended?</span>
      </summary>

      <div className="why-body">
        <p className="why-intro">Matched because you liked:</p>
        <ul className="why-list" role="list">
          {reasons.map((r, i) => {
            const cfg = TYPE_CONFIG[r.type] || TYPE_CONFIG.score
            return (
              <li key={i} className="why-item">
                <span className={`why-pill ${cfg.cls}`} aria-label={`${cfg.label}: ${r.label}`}>
                  <span className="why-pill-icon" aria-hidden="true">{cfg.icon}</span>
                  <span className="why-pill-label">{r.label}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </details>
  )
}
