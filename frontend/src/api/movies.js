
import axios from 'axios'

const API_BASE_URL = import.meta.env.DEV
  ? '/api'
  : 'https://movie-recommendation-engine-mwo1.onrender.com'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
})

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

