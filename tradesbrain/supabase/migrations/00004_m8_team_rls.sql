-- M8 — Team Management RLS extensions.
-- Owners of Team plans need read-only access to their members' data.
-- M0 base policies grant SELECT/UPDATE only on auth.uid() = user_id. These
-- policies add a SECOND select-only path for team owners (via team_members
-- join). UPDATE is intentionally NOT extended — RULE 3 keeps member data
-- non-editable by the owner.

-- ── users — owner can read member profile rows ───────────────────────────
DROP POLICY IF EXISTS users_team_owner_read ON public.users;
CREATE POLICY users_team_owner_read ON public.users
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.member_id = public.users.id
        AND tm.team_owner_id = auth.uid()
        AND tm.is_active = true
    )
  );

-- ── job_sessions — owner can read member sessions ────────────────────────
DROP POLICY IF EXISTS job_sessions_team_owner_read ON public.job_sessions;
CREATE POLICY job_sessions_team_owner_read ON public.job_sessions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.member_id = public.job_sessions.user_id
        AND tm.team_owner_id = auth.uid()
        AND tm.is_active = true
    )
  );

-- ── messages — via session ownership ─────────────────────────────────────
DROP POLICY IF EXISTS messages_team_owner_read ON public.messages;
CREATE POLICY messages_team_owner_read ON public.messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.job_sessions js
      JOIN public.team_members tm
        ON tm.member_id = js.user_id
       AND tm.team_owner_id = auth.uid()
       AND tm.is_active = true
      WHERE js.id = public.messages.session_id
    )
  );

-- ── job_reports — owner can read member finalised reports ────────────────
DROP POLICY IF EXISTS job_reports_team_owner_read ON public.job_reports;
CREATE POLICY job_reports_team_owner_read ON public.job_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.member_id = public.job_reports.user_id
        AND tm.team_owner_id = auth.uid()
        AND tm.is_active = true
    )
  );

-- ── quotes — same ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS quotes_team_owner_read ON public.quotes;
CREATE POLICY quotes_team_owner_read ON public.quotes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.member_id = public.quotes.user_id
        AND tm.team_owner_id = auth.uid()
        AND tm.is_active = true
    )
  );
