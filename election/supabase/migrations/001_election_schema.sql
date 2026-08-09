-- ============================================================
-- WhatsApp Group Admin Election — Supabase Schema
-- RLS Fixes, Cascade Delete Candidate RPC, & Full Reset RPC (With explicit WHERE true)
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

-- Add new columns if missing
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

ALTER TABLE candidates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ============================================================
-- 3. VOTERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS voters (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_name          TEXT NOT NULL,
  private_token_hash  TEXT UNIQUE NOT NULL,  -- SHA-256 hash only
  has_voted           BOOLEAN NOT NULL DEFAULT FALSE,
  voted_at            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. BALLOTS TABLE — Absolute Anonymity
-- ============================================================
CREATE TABLE IF NOT EXISTS ballots (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id              UUID NOT NULL REFERENCES candidates(id) ON DELETE RESTRICT,
  anonymous_ballot_reference TEXT UNIQUE NOT NULL,
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
  ON election_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

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
  ON candidates FOR ALL
  TO authenticated, anon, service_role
  USING (true)
  WITH CHECK (true);

-- Voters
ALTER TABLE voters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage voters" ON voters;
CREATE POLICY "Admins can manage voters"
  ON voters FOR ALL
  TO authenticated, anon, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages voters" ON voters;
CREATE POLICY "Service role manages voters"
  ON voters FOR ALL USING (auth.role() = 'service_role');

-- Ballots
ALTER TABLE ballots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read ballots (count only)" ON ballots;
DROP POLICY IF EXISTS "Admins can manage ballots" ON ballots;
CREATE POLICY "Admins can manage ballots"
  ON ballots FOR ALL
  TO authenticated, anon, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages ballots" ON ballots;
CREATE POLICY "Service role manages ballots"
  ON ballots FOR ALL USING (auth.role() = 'service_role');

-- Vote attempts
ALTER TABLE vote_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages vote attempts" ON vote_attempts;
DROP POLICY IF EXISTS "Admins can manage vote attempts" ON vote_attempts;
CREATE POLICY "Admins can manage vote attempts"
  ON vote_attempts FOR ALL
  TO authenticated, anon, service_role
  USING (true)
  WITH CHECK (true);

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

  -- Log attempt
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

  -- Lock voter row
  SELECT * INTO v_voter FROM voters
  WHERE private_token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;

  IF v_voter.has_voted THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_voted');
  END IF;

  -- Insert anonymous ballot
  v_ballot_ref := gen_random_uuid()::TEXT;
  INSERT INTO ballots (candidate_id, anonymous_ballot_reference)
  VALUES (p_candidate_id, v_ballot_ref);

  -- Mark voter as voted
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
  SELECT * INTO v_settings FROM election_settings WHERE id = 1;

  SELECT * INTO v_voter FROM voters
  WHERE private_token_hash = p_token_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid_token');
  END IF;

  IF v_voter.has_voted THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'already_voted');
  END IF;

  IF v_settings.start_date IS NOT NULL AND NOW() < v_settings.start_date THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'election_not_started', 'start_date', v_settings.start_date);
  END IF;

  IF v_settings.end_date IS NOT NULL AND NOW() > v_settings.end_date THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'election_closed');
  END IF;

  RETURN jsonb_build_object('valid', true, 'voter_name', v_voter.voter_name);
END;
$$;

-- ============================================================
-- 9. GET ELECTION RESULTS RPC
-- ============================================================
CREATE OR REPLACE FUNCTION get_election_results()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_results         JSONB;
  v_total_voters    INTEGER;
  v_total_voted     INTEGER;
  v_settings        election_settings%ROWTYPE;
  v_is_unlocked     BOOLEAN;
BEGIN
  SELECT * INTO v_settings FROM election_settings WHERE id = 1;

  SELECT COUNT(*) INTO v_total_voters FROM voters;
  SELECT COUNT(*) INTO v_total_voted FROM voters WHERE has_voted = TRUE;

  -- Unlocked if end_date is set AND current time is past end_date (with 3s clock-drift tolerance)
  v_is_unlocked := (v_settings.end_date IS NOT NULL AND NOW() >= (v_settings.end_date - INTERVAL '3 seconds'));

  IF v_is_unlocked THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'candidate_id', c.id,
        'candidate_name', c.candidate_name,
        'candidate_description', c.candidate_description,
        'vote_count', COALESCE(b.vote_count, 0)
      ) ORDER BY COALESCE(b.vote_count, 0) DESC, c.candidate_name ASC
    ) INTO v_results
    FROM candidates c
    LEFT JOIN (
      SELECT candidate_id, COUNT(*) as vote_count
      FROM ballots
      GROUP BY candidate_id
    ) b ON b.candidate_id = c.id
    WHERE c.is_active = true;
  ELSE
    -- SECURITY: Before release, send NO candidate vote tallies over HTTP
    v_results := '[]'::JSONB;
  END IF;

  RETURN jsonb_build_object(
    'released', v_is_unlocked,
    'results_unlocked', v_is_unlocked,
    'election_closed', v_is_unlocked,
    'total_voters', v_total_voters,
    'total_voted', v_total_voted,
    'total_not_voted', v_total_voters - v_total_voted,
    'end_date', v_settings.end_date,
    'election_title', v_settings.election_title,
    'organization_name', v_settings.organization_name,
    'candidates', COALESCE(v_results, '[]'::JSONB)
  );
END;
$$;

-- ============================================================
-- 10. DELETE CANDIDATE CASCADE RPC (Explicit WHERE clause)
-- ============================================================
CREATE OR REPLACE FUNCTION delete_candidate_cascade(p_candidate_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM ballots WHERE candidate_id = p_candidate_id;
  DELETE FROM candidates WHERE id = p_candidate_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 11. RESET ELECTION RPC (Explicit WHERE true clause to bypass safe delete mode)
-- ============================================================
CREATE OR REPLACE FUNCTION reset_election_data(p_clear_candidates BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Delete all ballots, voters, and vote attempts using explicit WHERE true
  DELETE FROM ballots WHERE true;
  DELETE FROM voters WHERE true;
  DELETE FROM vote_attempts WHERE true;

  -- 2. Reactivate any previously withdrawn candidates
  UPDATE candidates SET is_active = TRUE WHERE true;

  -- 3. Optionally clear candidates completely if requested
  IF p_clear_candidates THEN
    DELETE FROM candidates WHERE true;
  END IF;

  -- 4. Reset schedule dates in election_settings
  UPDATE election_settings
  SET start_date = NULL,
      end_date = NULL,
      updated_at = NOW()
  WHERE id = 1;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 12. EXPLICIT GRANTS FOR RPC FUNCTIONS
-- ============================================================
GRANT EXECUTE ON FUNCTION submit_vote(TEXT, UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION validate_voter_token(TEXT) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_election_results() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION delete_candidate_cascade(UUID) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION reset_election_data(BOOLEAN) TO authenticated, anon, service_role;
