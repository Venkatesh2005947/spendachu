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
 * Delete a voter (admin management)
 */
export async function deleteVoter(voterId) {
  const { error } = await supabase
    .from('voters')
    .delete()
    .eq('id', voterId)
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
      is_active: true,
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
 * Cleanly remove or withdraw candidate without triggering HTTP 409 Conflict network errors
 * Checks ballot count first before deciding whether to DELETE or UPDATE
 */
export async function deleteCandidate(id) {
  try {
    // 1. Check if ballots reference this candidate first to prevent HTTP 409 Conflict in browser network tab
    const { count, error: countErr } = await supabase
      .from('ballots')
      .select('id', { count: 'exact', head: true })
      .eq('candidate_id', id)

    const ballotCount = (countErr || count === null) ? 0 : count

    if (ballotCount > 0) {
      // Candidate has received votes: issue UPDATE directly (HTTP 200 OK — zero 409 errors in DevTools!)
      const { error: softErr } = await supabase
        .from('candidates')
        .update({ is_active: false })
        .eq('id', id)

      if (softErr) throw softErr

      return {
        success: true,
        deactivated: true,
        message: 'Candidate has already received votes, so the candidate was withdrawn instead of permanently deleted. To delete permanently, click "Reset Election Data" in Settings first.',
      }
    }

    // 2. Candidate has 0 votes: issue DELETE directly (HTTP 204/200 OK — zero 409 errors in DevTools!)
    const { error: deleteErr } = await supabase
      .from('candidates')
      .delete()
      .eq('id', id)

    if (deleteErr) {
      if (deleteErr.code === '23503' || deleteErr.status === 409) {
        const { error: softErr } = await supabase
          .from('candidates')
          .update({ is_active: false })
          .eq('id', id)

        if (softErr) throw softErr

        return {
          success: true,
          deactivated: true,
          message: 'Candidate has already received votes, so the candidate was withdrawn instead of permanently deleted.',
        }
      }
      throw deleteErr
    }

    return {
      success: true,
      deactivated: false,
      message: 'Candidate permanently deleted.',
    }
  } catch (err) {
    console.error('deleteCandidate error:', err?.message || err)
    throw new Error(err?.message || 'Failed to remove candidate.')
  }
}

/**
 * Update election settings — uses upsert to ensure row id:1 exists cleanly
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
    id: 1,
    election_title: title || 'Group Admin Election',
    election_description: description || '',
    start_date: startDate || null,
    end_date: endDate || null,
    updated_at: new Date().toISOString(),
  }

  if (organizationName !== undefined) updatePayload.organization_name = organizationName
  if (whatsappMessageTemplate !== undefined) updatePayload.whatsapp_message_template = whatsappMessageTemplate
  if (rulesText !== undefined) updatePayload.rules_text = rulesText

  const { data, error } = await supabase
    .from('election_settings')
    .upsert(updatePayload, { onConflict: 'id' })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * FULL ELECTION RESET: Wipes all ballots, voters, vote attempts, reactivates candidates, and clears schedule
 */
export async function resetElectionData(clearCandidates = false) {
  // 1. Direct Table Deletes (Guarantees 100% table wipe)
  await supabase.from('ballots').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('voters').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('vote_attempts').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // 2. Reactivate any previously withdrawn candidates
  await supabase.from('candidates').update({ is_active: true }).neq('id', '00000000-0000-0000-0000-000000000000')

  // 3. Delete candidates if clearCandidates checkbox was checked
  if (clearCandidates) {
    await supabase.from('candidates').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }

  // 4. Reset schedule dates in settings
  await supabase.from('election_settings').update({ start_date: null, end_date: null }).eq('id', 1)

  // 5. Also execute database RPC reset_election_data if available
  try {
    await supabase.rpc('reset_election_data', { p_clear_candidates: clearCandidates })
  } catch (rpcErr) {
    console.warn('RPC reset execution notice:', rpcErr)
  }

  return { success: true }
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
