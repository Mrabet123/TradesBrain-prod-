-- M0-M3 build-audit remediation (issues #4, #6, #24 + push-token column).
-- 1. Harden RLS on users and team_members (originals were USING-only / over-permissive).
-- 2. Lock the three KYC fields D5 §2 marks LOCKED but no trigger enforced.
-- 3. Re-create three indexes as UNIQUE to match D5 §14.
-- 4. Add users.expo_push_token for the send-push-notification function.

-- ── 1. RLS — users: add WITH CHECK so INSERT is owner-scoped ──────────────────
DROP POLICY IF EXISTS users_own_row ON public.users;
CREATE POLICY users_own_row ON public.users
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── 1b. RLS — team_members: SELECT for owner+member, writes owner-only ────────
-- The single FOR ALL policy let a member INSERT/UPDATE/DELETE their own join row.
-- (create-/delete-team-member run as service role and bypass RLS regardless.)
DROP POLICY IF EXISTS team_members_policy ON public.team_members;
CREATE POLICY team_members_select ON public.team_members
  FOR SELECT
  USING (auth.uid() = team_owner_id OR auth.uid() = member_id);
CREATE POLICY team_members_owner_insert ON public.team_members
  FOR INSERT
  WITH CHECK (auth.uid() = team_owner_id);
CREATE POLICY team_members_owner_update ON public.team_members
  FOR UPDATE
  USING (auth.uid() = team_owner_id)
  WITH CHECK (auth.uid() = team_owner_id);
CREATE POLICY team_members_owner_delete ON public.team_members
  FOR DELETE
  USING (auth.uid() = team_owner_id);

-- ── 2. Lock the KYC fields (D5 §2 LOCKED FIELDS) ──────────────────────────────
-- license_number / license_proof_url / national_id_url are set once at sign-up
-- and must never change afterward (vat_number is already locked by 00002).
CREATE OR REPLACE FUNCTION prevent_kyc_field_update() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.license_number IS NOT NULL AND OLD.license_number IS DISTINCT FROM NEW.license_number THEN
    RAISE EXCEPTION 'license_number is locked and cannot be changed';
  END IF;
  IF OLD.license_proof_url IS NOT NULL AND OLD.license_proof_url IS DISTINCT FROM NEW.license_proof_url THEN
    RAISE EXCEPTION 'license_proof_url is locked and cannot be changed';
  END IF;
  IF OLD.national_id_url IS NOT NULL AND OLD.national_id_url IS DISTINCT FROM NEW.national_id_url THEN
    RAISE EXCEPTION 'national_id_url is locked and cannot be changed';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lock_kyc_fields ON public.users;
CREATE TRIGGER lock_kyc_fields BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION prevent_kyc_field_update();

-- ── 3. Re-create indexes as UNIQUE (D5 §14 labels these UNIQUE) ───────────────
DROP INDEX IF EXISTS idx_users_email;
CREATE UNIQUE INDEX idx_users_email ON public.users(email);
DROP INDEX IF EXISTS idx_users_stripe_customer_id;
CREATE UNIQUE INDEX idx_users_stripe_customer_id ON public.users(stripe_customer_id);
DROP INDEX IF EXISTS idx_subscriptions_stripe_id;
CREATE UNIQUE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

-- ── 4. Push-notification token column (used by send-push-notification) ────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS expo_push_token text;

-- ── 5. app_config — remote source for the force-upgrade gate (D6 Flow12 S19) ──
-- Single-row table (id is a boolean PK fixed to true). Readable by everyone so
-- the version check can run before authentication.
CREATE TABLE IF NOT EXISTS public.app_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  min_supported_version text NOT NULL DEFAULT '1.0.0',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_config_read ON public.app_config;
CREATE POLICY app_config_read ON public.app_config FOR SELECT USING (true);
