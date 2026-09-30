import { useState } from 'react'

/**
 * SearchBar
 * ---------
 * Controlled search form with an SVG search icon and spinner in the button.
 * Lives inside the hero section.
 */
export default function SearchBar({ onSearch, loading }) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (query.trim()) onSearch(query.trim())
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit} role="search">
      {/* Left search icon */}
      <span className="search-icon-wrap" aria-hidden="true">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </span>

      <input
        className="search-input"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search a movie… e.g. Avatar, Inception, Interstellar"
        aria-label="Search movies"
        disabled={loading}
        autoComplete="off"
        spellCheck="false"
      />

      <button
        className="search-btn"
        type="submit"
        disabled={loading || !query.trim()}
        aria-label="Search"
      >
        {loading ? (
          <span className="btn-spinner" aria-hidden="true" />
        ) : (
          <>
            {/* Magnifier icon inside button */}
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>Search</span>
          </>
        )}
      </button>
    </form>
  )
}
