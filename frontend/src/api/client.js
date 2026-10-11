import axios from 'axios'
import i18next from 'i18next'
import { demoAdapter } from '../demo/adapter'

const TOKEN_KEY = 'clinic.token'

// localStorage can throw (private mode, blocked storage); treat that as "no token".
export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // ignore
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // ignore
    }
  },
}

// Called when the API answers 401. AuthContext replaces it to reset its state;
// the default sends the browser to the login page.
let onUnauthorized = () => {
  if (window.location.pathname !== '/login') window.location.assign('/login')
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

// The demo answers every request in the browser (src/demo); VITE_DEMO=false uses the real API.
export const DEMO_MODE = import.meta.env.VITE_DEMO !== 'false'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { Accept: 'application/json' },
  ...(DEMO_MODE ? { adapter: demoAdapter } : {}),
})

client.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  // The API answers in this language (validation and error messages).
  config.headers['Accept-Language'] = i18next.resolvedLanguage || i18next.language || 'ar'
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    // A 401 on a request that carried a token means it expired or was revoked.
    if (error.response?.status === 401 && error.config?.headers?.Authorization) {
      tokenStorage.clear()
      onUnauthorized()
    }
    return Promise.reject(error)
  },
)

export default client
