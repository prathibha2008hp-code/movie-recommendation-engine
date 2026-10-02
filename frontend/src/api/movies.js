
import axios from 'axios'

const API_BASE_URL = import.meta.env.DEV
  ? '/api'
  : 'https://movie-recommendation-engine-mwo1.onrender.com'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: import.meta.env.DEV ? 10_000 : 90_000,
})

export function getApiErrorMessage(error, fallback) {
  const status = error?.response?.status

  if (status === 404 || status === 422) return "We couldn't find that movie."
  if ([502, 503, 504].includes(status)) {
    return 'Movie service is waking up or temporarily unavailable. Please try again in a few seconds.'
  }
  if (['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code)) {
    return 'Movie service is taking longer than expected. Please try again in a few seconds.'
  }
  if (error?.code === 'ERR_NETWORK' || !error?.response) {
    return import.meta.env.PROD
      ? 'Movie service is waking up or temporarily unavailable. Please try again in a few seconds.'
      : 'Movie service is unavailable. Check that the local backend is running and try again.'
  }
  if (status >= 500) return 'Movie service is temporarily unavailable. Please try again.'

  return fallback
}

export async function searchMovies(query) {
  const { data } = await api.get('/movies/search', {
    params: { q: query },
  })
  return data
}

export async function getMovieDetails(tmdbId) {
  const { data } = await api.get(`/movies/${tmdbId}`)
  return data
}

export async function getRecommendations(tmdbId) {
  const { data } = await api.get(`/recommendations/${tmdbId}`)
  return data
}

export async function getMovieVideos(tmdbId) {
  const { data } = await api.get(`/movies/${tmdbId}/videos`)
  return data.trailer_key ?? null
}

