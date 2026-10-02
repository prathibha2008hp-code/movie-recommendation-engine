/**
 * useWatchlist
 * ------------
 * Custom hook that manages the watchlist stored in browser localStorage.
 *
 * Stored under the key "moviemind_watchlist" as a JSON array of movie objects.
 * Invalid / corrupt data is handled gracefully (returns empty array).
 *
 * Returns:
 *   watchlist        – array of saved movie objects
 *   addToWatchlist   – (movie) => void
 *   removeFromWatchlist – (movieId) => void
 *   isInWatchlist    – (movieId) => boolean
 */

import { useState, useCallback } from 'react'

const STORAGE_KEY = 'moviemind_watchlist'

function normalizeMovie(movie) {
  if (!movie || typeof movie !== 'object' || Array.isArray(movie)) return null

  const id = Number(movie.id)
  if (!Number.isSafeInteger(id) || id <= 0 || typeof movie.title !== 'string' || !movie.title.trim()) {
    return null
  }

  const genres = Array.isArray(movie.genres)
    ? movie.genres.filter((genre) => typeof genre === 'string').join(', ')
    : typeof movie.genres === 'string' ? movie.genres : ''
  const rating = Number(movie.vote_average)

  return {
    ...movie,
    id,
    title: movie.title.trim(),
    release_date: typeof movie.release_date === 'string' ? movie.release_date : '',
    vote_average: Number.isFinite(rating) ? rating : 0,
    genres,
    poster_url: typeof movie.poster_url === 'string' ? movie.poster_url : '',
  }
}

function readStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const seenIds = new Set()
    return parsed.reduce((movies, item) => {
      const movie = normalizeMovie(item)
      if (movie && !seenIds.has(movie.id)) {
        seenIds.add(movie.id)
        movies.push(movie)
      }
      return movies
    }, [])
  } catch {
    return []
  }
}

function writeStorage(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {
    // Quota exceeded or private mode — fail silently
  }
}

export default function useWatchlist() {
  const [watchlist, setWatchlist] = useState(() => readStorage())

  const addToWatchlist = useCallback((movie) => {
    const normalizedMovie = normalizeMovie(movie)
    if (!normalizedMovie) return

    setWatchlist((prev) => {
      if (prev.some((m) => m.id === normalizedMovie.id)) return prev
      const next = [normalizedMovie, ...prev]
      writeStorage(next)
      return next
    })
  }, [])

  const removeFromWatchlist = useCallback((movieId) => {
    const normalizedId = Number(movieId)
    setWatchlist((prev) => {
      const next = prev.filter((m) => m.id !== normalizedId)
      writeStorage(next)
      return next
    })
  }, [])

  const isInWatchlist = useCallback(
    (movieId) => watchlist.some((m) => m.id === Number(movieId)),
    [watchlist]
  )

  return { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist }
}
