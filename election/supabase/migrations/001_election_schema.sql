-- ============================================================
-- WhatsApp Group Admin Election — Supabase Schema
-- Reusable for Any Election / Multi-Election Lifecycle
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. ELECTION SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS election_settings (
  id                        INTEGER PRIMARY KEY DEFAULT 1,
  organization_name         TEXT NOT NULL DEFAULT 'WhatsApp Group',
  election_title            TEXT NOT NULL DEFAULT 'Group Admin Election',
  election_description      TEXT DEFAULT 'Welcome to our official group election. Please cast your vote anonymously.',
  whatsapp_message_template TEXT DEFAULT 'Hi {voter_name},\n\nHere is your private one-time link to vote in our {election_title}:\n\n{link}\n\nYour vote is 100% secret and anonymous.',
  rules_text                TEXT DEFAULT '1. Select only one candidate.\n2. Voting link works only once.\n3. Vote cannot be changed after submission.',
  start_date                TIMESTAMPTZ,
  end_date                  TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row if not present
INSERT INTO election_settings (id, election_title, organization_name)
VALUES (1, 'Group Admin Election', 'WhatsApp Group')
ON CONFLICT (id) DO NOTHING;

-- Add new columns if missing (for seamless upgrades)
ALTER TABLE election_settings ADD COLUMN IF NOT EXISTS organization_name TEXT DEFAULT 'WhatsApp Group';
ALTER TABLE election_settings ADD COLUMN IF NOT EXISTS whatsapp_message_template TEXT DEFAULT 'Hi {voter_name},\n\nHere is your private one-time link to vote in our {election_title}:\n\n{link}\n\nYour vote is 100% secret and anonymous.';
ALTER TABLE election_settings ADD COLUMN IF NOT EXISTS rules_text TEXT DEFAULT '1. Select only one candidate.\n2. Voting link works only once.\n3. Vote cannot be changed after submission.';

-- ============================================================
-- 2. CANDIDATES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS candidates (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_name       TEXT NOT NULL,
  candidate_description TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. VOTERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS voters (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_name          TEXT NOT NULL,
  private_token_hash  TEXT UNIQUE NOT NULL,  -- SHA-256 hash only, never raw token
  has_voted           BOOLEAN NOT NULL DEFAULT FALSE,
  voted_at            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. BALLOTS TABLE — No voter linkage whatsoever
-- ============================================================
CREATE TABLE IF NOT EXISTS ballots (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id              UUID NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT,
  anonymous_ballot_reference TEXT UNIQUE NOT NULL,  -- random UUID, not linked to any voter
  submitted_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. VOTE ATTEMPT RATE LIMITING
-- ============================================================
CREATE TABLE IF NOT EXISTS vote_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash    TEXT NOT NULL,
  attempted_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

-- Election Settings
ALTER TABLE election_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read election settings" ON election_settings;
CREATE POLICY "Public can read election settings"
  ON election_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages election settings" ON election_settings;
CREATE POLICY "Service role manages election settings"
  ON election_settings FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can update election settings" ON election_settings;
CREATE POLICY "Admins can update election settings"
  ON election_settings FOR ALL USING (auth.role() = 'authenticated');

-- Candidates
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read active candidates" ON candidates;
CREATE POLICY "Public can read active candidates"
  ON candidates FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Service role manages candidates" ON candidates;
CREATE POLICY "Service role manages candidates"
  ON candidates FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Admins can manage candidates" ON candidates;
CREATE POLICY "Admins can manage candidates"
  ON candidates FOR ALL USING (auth.role() = 'authenticated');

-- Voters
ALTER TABLE voters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage voters" ON voters;
CREATE POLICY "Admins can manage voters"
  ON voters FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role manages voters" ON voters;
CREATE POLICY "Service role manages voters"
  ON voters FOR ALL USING (auth.role() = 'service_role');

-- Ballots
ALTER TABLE ballots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read ballots (count only)" ON ballots;
CREATE POLICY "Admins can read ballots (count only)"
  ON ballots FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role manages ballots" ON ballots;
CREATE POLICY "Service role manages ballots"
  ON ballots FOR ALL USING (auth.role() = 'service_role');

-- Vote attempts
ALTER TABLE vote_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages vote attempts" ON vote_attempts;
CREATE POLICY "Service role manages vote attempts"
  ON vote_attempts FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 7. SECURE VOTE SUBMISSION RPC
-- ============================================================
CREATE OR REPLACE FUNCTION submit_vote(
  p_token_hash  TEXT,
  p_candidate_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voter        voters%ROWTYPE;
  v_candidate    candidates%ROWTYPE;
  v_ballot_ref   TEXT;
  v_attempt_count INTEGER;
  v_settings     election_settings%ROWTYPE;
BEGIN
  -- Rate limiting: max 5 attempts per token hash in last 10 minutes
  SELECT COUNT(*) INTO v_attempt_count
  FROM vote_attempts
  WHERE token_hash = p_token_hash
    AND attempted_at > NOW() - INTERVAL '10 minutes';

  IF v_attempt_count >= 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  -- Log this attempt
  INSERT INTO vote_attempts (token_hash) VALUES (p_token_hash);

  -- Check election timing
  SELECT * INTO v_settings FROM election_settings WHERE id = 1;
  IF v_settings.start_date IS NOT NULL AND NOW() < v_settings.start_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'election_not_started');
  END IF;
  IF v_settings.end_date IS NOT NULL AND NOW() > v_settings.end_date THEN
    RETURN jsonb_build_object('success', false, 'error', 'election_closed');
  END IF;

  -- Validate candidate exists and is active
  SELECT * INTO v_candidate FROM candidates
  WHERE id = p_candidate_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_candidate');
  END IF;

  -- Lock voter row to prevent race conditions (simultaneous requests)
  SELECT * INTO v_voter FROM voters
  WHERE private_token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF v_voter.has_voted THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_voted');
  END IF;

  -- Generate a random anonymous ballot reference (NOT linked to voter)
  v_ballot_ref := gen_random_uuid()::TEXT;

  -- Insert anonymous ballot
  INSERT INTO ballots (candidate_id, anonymous_ballot_reference)
  VALUES (p_candidate_id, v_ballot_ref);

  -- Mark voter as voted (atomically in same transaction)
  UPDATE voters
  SET has_voted = TRUE, voted_at = NOW()
  WHERE id = v_voter.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 8. VALIDATE TOKEN RPC
-- ============================================================
CREATE OR REPLACE FUNCTION validate_voter_token(p_token_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_voter    voters%ROWTYPE;
  v_settings election_settings%ROWTYPE;
BEGIN
  -- Check election settings
  SELECT * INTO v_settings FROM election_settings WHERE id = 1;

  -- Find voter by token hash
  SELECT * INTO v_voter FROM voters
  WHERE private_token_hash = p_token_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'invalid_token'
    );
  END IF;

  IF v_voter.has_voted THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'already_voted'
    );
  END IF;

  -- Check timing
  IF v_settings.start_date IS NOT NULL AND NOW() < v_settings.start_date THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'election_not_started',
      'start_date', v_settings.start_date
    );
  END IF;

  IF v_settings.end_date IS NOT NULL AND NOW() > v_settings.end_date THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'election_closed'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'voter_name', v_voter.voter_name
  );
END;
$$;

-- ============================================================
-- 9. GET RESULTS RPC (admin only via authenticated role)
-- ============================================================
CREATE OR REPLACE FUNCTION get_election_results()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_results JSONB;
  v_total_voters INTEGER;
  v_total_voted  INTEGER;
  v_settings     election_settings%ROWTYPE;
BEGIN
  SELECT * INTO v_settings FROM election_settings WHERE id = 1;

  SELECT COUNT(*) INTO v_total_voters FROM voters;
  SELECT COUNT(*) INTO v_total_voted FROM voters WHERE has_voted = TRUE;

  -- Get per-candidate vote counts
  SELECT jsonb_agg(
    jsonb_build_object(
      'candidate_id', c.id,
      'candidate_name', c.candidate_name,
      'candidate_description', c.candidate_description,
      'vote_count', COALESCE(b.vote_count, 0)
    ) ORDER BY COALESCE(b.vote_count, 0) DESC
  ) INTO v_results
  FROM candidates c
  LEFT JOIN (
    SELECT candidate_id, COUNT(*) as vote_count
    FROM ballots
    GROUP BY candidate_id
  ) b ON b.candidate_id = c.id
  WHERE c.is_active = true;

  RETURN jsonb_build_object(
    'total_voters', v_total_voters,
    'total_voted', v_total_voted,
    'total_not_voted', v_total_voters - v_total_voted,
    'election_closed', (v_settings.end_date IS NOT NULL AND NOW() > v_settings.end_date),
    'election_title', v_settings.election_title,
    'organization_name', v_settings.organization_name,
    'candidates', COALESCE(v_results, '[]'::JSONB)
  );
END;
$$;

-- ============================================================
-- 10. RESET ELECTION RPC (admin only)
-- Clears all ballots, voters, and vote attempts for a fresh election
-- Optionally clears candidates if p_clear_candidates is true
-- ============================================================
CREATE OR REPLACE FUNCTION reset_election_data(p_clear_candidates BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Truncate ballots, voters, and vote_attempts
  DELETE FROM ballots;
  DELETE FROM voters;
  DELETE FROM vote_attempts;

  IF p_clear_candidates THEN
    DELETE FROM candidates;
  END IF;

  -- Reset dates in settings
  UPDATE election_settings
  SET start_date = NULL,
      end_date = NULL,
      updated_at = NOW()
  WHERE id = 1;

  RETURN jsonb_build_object('success', true);
END;
$$;
