/**
 * Application Configuration & Reusable Voter Link Resolver
 */

export const APP_PRODUCTION_URL = 'https://whatsapp-group-election.vercel.app'

/**
 * Resolves the canonical base URL for generating voter links.
 * Order of precedence:
 * 1. import.meta.env.VITE_APP_URL (if configured)
 * 2. Stable production domain if running anywhere on vercel.app
 * 3. window.location.origin (for local dev like http://localhost:5173)
 */
export function getBaseUrl() {
  // 1. Explicit VITE_APP_URL environment variable
  const envUrl = import.meta.env.VITE_APP_URL
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '')
  }

  // 2. Browser origin resolution
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin.trim().replace(/\/+$/, '')
    if (origin.includes('vercel.app')) {
      return APP_PRODUCTION_URL
    }
    return origin
  }

  return APP_PRODUCTION_URL
}

/**
 * Single reusable function to generate clean, unpolluted voter links.
 * Returns ONLY: https://whatsapp-group-election.vercel.app/vote/TOKEN
 * Contains NO trailing text, NO linebreaks, NO extra spaces.
 */
export function getVoterLink(token) {
  if (!token || typeof token !== 'string') return ''
  const baseUrl = getBaseUrl()
  const cleanToken = token.trim()
  return `${baseUrl.replace(/\/+$/, '')}/vote/${cleanToken}`
}
