import { supabase } from '../lib/supabase'

/**
 * Generate a cryptographically secure 32-byte (64 hex char) token
 */
export function generateToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash a token using SHA-256 via the Web Crypto API
 * @param {string} token - raw token string
 * @returns {Promise<string>} hex-encoded SHA-256 hash
 */
export async function hashToken(token) {
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate a voter token (checks DB without exposing voter info)
 * @param {string} token - raw token from URL
 * @returns {Promise<{valid: boolean, reason?: string, voterName?: string}>}
 */
export async function validateToken(token) {
  try {
    const tokenHash = await hashToken(token)
    const { data, error } = await supabase.rpc('validate_voter_token', {
      p_token_hash: tokenHash,
    })
    if (error) throw error
    return {
      valid: data.valid,
      reason: data.reason,
      voterName: data.voter_name,
      startDate: data.start_date,
    }
  } catch (err) {
    console.error('Token validation error:', err.message)
    return { valid: false, reason: 'error' }
  }
}

/**
 * Submit a vote securely via RPC
 * @param {string} token - raw token from URL
 * @param {string} candidateId - UUID of selected candidate
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function submitVote(token, candidateId) {
  try {
    const tokenHash = await hashToken(token)
    const { data, error } = await supabase.rpc('submit_vote', {
      p_token_hash: tokenHash,
      p_candidate_id: candidateId,
    })
    if (error) throw error
    return data
  } catch (err) {
    console.error('Vote submission error:', err.message)
    return { success: false, error: 'network_error' }
  }
}

/**
 * Get all active candidates (public)
 */
export async function getCandidates() {
  const { data, error } = await supabase
    .from('candidates')
    .select('id, candidate_name, candidate_description, is_active')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

/**
 * Get election settings (public)
 */
export async function getElectionSettings() {
  const { data, error } = await supabase
    .from('election_settings')
    .select('*')
    .eq('id', 1)
    .single()
  if (error) throw error
  return data
}

/**
 * Get election results via RPC (admin only — requires authenticated session)
 */
export async function getElectionResults() {
  const { data, error } = await supabase.rpc('get_election_results')
  if (error) throw error
  return data
}
