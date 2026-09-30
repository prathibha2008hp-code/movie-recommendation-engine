/**
 * api/movies.js
 * -------------
 * All HTTP calls to the FastAPI backend live here.
 * The Vite dev server proxies /api/* → http://localhost:8000
 * so we never need to hardcode the backend URL in the frontend code.
 */

import axios from 'axios'

const api = axios.create({
  baseURL: '/api',   // proxied to https://movie-recommendation-engine-mwo1.onrender.com by vite.config.js
  timeout: 10_000,   // 10-second timeout
})

/**
 * Search for movies by title.
 * @param {string} query
 * @returns {Promise<Array>}
 */
export async function searchMovies(query) {
  const { data } = await api.get('/movies/search', {
    params: { q: query },
  })
  return data
}

/**
 * Get full details for a single movie (including TMDB live data).
 * @param {number} tmdbId
 * @returns {Promise<Object>}
 */
export async function getMovieDetails(tmdbId) {
  const { data } = await api.get(`/movies/${tmdbId}`)
  return data
}

/**
 * Get content-based recommendations for a movie.
 * @param {number} tmdbId
 * @returns {Promise<Array>}
 */
export async function getRecommendations(tmdbId) {
  const { data } = await api.get(`/recommendations/${tmdbId}`)
  return data
}

/**
 * Get the YouTube trailer key for a movie.
 * The TMDB API key is never exposed to the browser — the backend handles it.
 * @param {number} tmdbId
 * @returns {Promise<string|null>}  YouTube video key, or null if unavailable
 */
export async function getMovieVideos(tmdbId) {
  const { data } = await api.get(`/movies/${tmdbId}/videos`)
  return data.trailer_key ?? null
}
