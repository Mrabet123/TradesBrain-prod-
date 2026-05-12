-- M10 — Account suspension flag.
-- Used by the AccountSuspendedScreen gate in App.tsx. Operators flip this to
-- true via the admin console (or a service-role tool) when an account violates
-- terms. The mobile app reads it on session load and on focus.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;

-- Owner of the row can read their own suspended state — no policy change
-- needed because the M0 users_own_row policy already covers SELECT.
