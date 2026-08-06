import { supabase } from '../lib/supabase'
import { generateToken, hashToken } from './electionService'

/**
 * Get all voters (admin only)
 */
export async function getVoters() {
  const { data, error } = await supabase
    .from('voters')
    .select('id, voter_name, has_voted, voted_at, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

/**
 * Add a new voter and generate their private token
 * Returns { voter, rawToken } — rawToken is ONLY returned once, never stored
 */
export async function addVoter(voterName) {
  const rawToken = generateToken()
  const tokenHash = await hashToken(rawToken)

  const { data, error } = await supabase
    .from('voters')
    .insert({
      voter_name: voterName.trim(),
      private_token_hash: tokenHash,
    })
    .select('id, voter_name, has_voted, created_at')
    .single()

  if (error) throw error
  return { voter: data, rawToken }
}

/**
 * Delete a voter (only if they haven't voted yet)
 */
export async function deleteVoter(voterId) {
  const { error } = await supabase
    .from('voters')
    .delete()
    .eq('id', voterId)
    .eq('has_voted', false)
  if (error) throw error
}

/**
 * Get all candidates (admin — includes inactive)
 */
export async function getAllCandidates() {
  const { data, error } = await supabase
    .from('candidates')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

/**
 * Add a new candidate
 */
export async function addCandidate({ candidateName, candidateDescription }) {
  const { data, error } = await supabase
    .from('candidates')
    .insert({
      candidate_name: candidateName.trim(),
      candidate_description: candidateDescription?.trim() || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Update a candidate
 */
export async function updateCandidate(id, { candidateName, candidateDescription, isActive }) {
  const { data, error } = await supabase
    .from('candidates')
    .update({
      candidate_name: candidateName?.trim(),
      candidate_description: candidateDescription?.trim(),
      is_active: isActive,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Delete a candidate (only if no ballots reference them)
 */
export async function deleteCandidate(id) {
  const { error } = await supabase
    .from('candidates')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/**
 * Update election settings (supports organization_name, template, and rules)
 */
export async function updateElectionSettings({
  organizationName,
  title,
  description,
  whatsappMessageTemplate,
  rulesText,
  startDate,
  endDate,
}) {
  const updatePayload = {
    election_title: title,
    election_description: description,
    start_date: startDate || null,
    end_date: endDate || null,
    updated_at: new Date().toISOString(),
  }

  if (organizationName !== undefined) updatePayload.organization_name = organizationName
  if (whatsappMessageTemplate !== undefined) updatePayload.whatsapp_message_template = whatsappMessageTemplate
  if (rulesText !== undefined) updatePayload.rules_text = rulesText

  const { data, error } = await supabase
    .from('election_settings')
    .update(updatePayload)
    .eq('id', 1)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Reset election data (wipes voters, ballots, and attempts for a new election)
 * @param {boolean} clearCandidates - whether to also wipe candidates list
 */
export async function resetElectionData(clearCandidates = false) {
  const { data, error } = await supabase.rpc('reset_election_data', {
    p_clear_candidates: clearCandidates,
  })
  if (error) throw error
  return data
}

/**
 * Admin sign in
 */
export async function adminSignIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

/**
 * Admin sign out
 */
export async function adminSignOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Get current admin session
 */
export async function getAdminSession() {
  const { data } = await supabase.auth.getSession()
  return data?.session
}
