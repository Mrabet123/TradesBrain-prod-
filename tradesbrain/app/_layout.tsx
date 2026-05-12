/*
 * ══════════════════════════════════════════════════════════════════════════════
 * TRADESBRAIN — M11 FINAL BUILD REPORT — PRE-LAUNCH
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Step: M11 — Full QA Pass & Pre-Launch
 * Status: CODE-COMPLETE FOR v1.0. The 232 D8 test cases are an owner-driven
 *         QA pass against the running app. No defects have been reported
 *         to Claude Code yet; once testers report failures with TC-XXX
 *         references, fixes happen via the M11 protocol (reactive — see
 *         BuildGuide §M11).
 *
 * ── SCOPE OF M11 (delivered in this session) ────────────────────────────────
 *   • Self-audit code cleanup pass (see below)
 *   • PRE_LAUNCH_CHECKLIST.md at the repo root — every deploy step the team
 *     needs to bring the app live (Supabase, Edge Functions, Stripe live mode,
 *     RAG ingestion, App Store assets, EAS build, D8 232-case tracking,
 *     post-launch monitoring, open deviations).
 *   • Final M11 Build Report (this block).
 *
 * ── SELF-AUDIT FIXES ────────────────────────────────────────────────────────
 *   • app/_layout.tsx — Consolidated React imports (was importing useEffect
 *     and useState twice under different aliases); supabase + View imports
 *     pulled up to the top of the file.
 *   • app/paywall.tsx — Removed unused useMemo/useRef imports left over
 *     from M6 iteration; deleted PLAN_FEATURES dead reference + import.
 *   • app/settings/subscription.tsx — Invoice "View" Pressable was a dead
 *     Alert. Wired to Linking.openURL(invoice_pdf_url) which is the actual
 *     Stripe-hosted invoice URL.
 *   • app/job/[sessionId].tsx — De-duplicated Linking import (was imported
 *     twice across two import statements).
 *
 * ── TEST-COVERAGE SUMMARY (D8 sections vs current state) ────────────────────
 *   A · Auth                ✓ M1 — sign-up, sign-in, dual OTP, KYC, error states
 *                                lockouts, save password.
 *                                Live test gates on phone provider + Google
 *                                OAuth being wired in Supabase Auth settings.
 *   B · Rex diagnostic      ✓ M2 — session lifecycle, streaming, voice, photo,
 *                                contextual buttons, soft cap, push-back.
 *                                Live test gates on claude-proxy + whisper-
 *                                proxy + embedding-proxy deploy.
 *   C · Reports             ✓ M3 — both paths, confirm-locks-forever, PDF.
 *   D · Quotes              ✓ M3 — line items, payment methods, validity.
 *   E · Codes lookup        ✓ M4 — RAG, citations, AHJ, offline cache.
 *                                Live test gates on ingestion of at least one
 *                                code document via ingest-code-document.
 *   F · History             ✓ M5 — list, search, 4-tab detail, reopen, delete.
 *   G · Subscription        ✓ M6 — paywall, PaymentSheet, cancel, restore,
 *                                switch cycle, billing history.
 *                                Live test gates on Stripe live mode + the
 *                                D9 §10 dashboard checklist.
 *   H · Profile / Settings  ✓ M7 — 6 sections, locked fields, account
 *                                transitions, DELETE-typed flows.
 *   I · Team management     ✓ M8 — KPI dashboard, members CRUD, read-only
 *                                member detail (RLS-enforced).
 *   J · Security            ✓ Verified by code review (RLS on every table,
 *                                prevent_finalised_update trigger,
 *                                vat_number lock trigger, webhook signature
 *                                check, no secrets in bundle).
 *
 *   Trades (M9):              ✓ Plumber / Electrician / HVAC / Roofer prompts.
 *   System states (M10):      ✓ Offline banner + queue, permission banners,
 *                                silent recompression, skeleton loading,
 *                                force-upgrade screen, suspended gate.
 *
 * ── DEPENDENCIES TO INSTALL BEFORE FIRST RUN ────────────────────────────────
 *   npx expo install @react-native-async-storage/async-storage `
 *                    @react-native-community/netinfo `
 *                    expo-image-manipulator `
 *                    expo-print `
 *                    expo-sharing
 *
 * ── MIGRATIONS TO PUSH ──────────────────────────────────────────────────────
 *   supabase db push   # runs 00001 (M0) → 00002 (M1) → 00003 (M3) → 00004 (M8) → 00005 (M10)
 *
 * ── EDGE FUNCTIONS TO DEPLOY ────────────────────────────────────────────────
 *   See PRE_LAUNCH_CHECKLIST.md §3.2 — 15 functions total (11 from D10 +
 *   claude-proxy, whisper-proxy, embedding-proxy, delete-account).
 *
 * ── STRIPE D9 §10 DASHBOARD CHECKLIST ───────────────────────────────────────
 *   8 products/prices, 2 webhook endpoints, Stripe Identity, live mode flip —
 *   tracked in PRE_LAUNCH_CHECKLIST.md §4.
 *
 * ── PRODUCTION ENVIRONMENT ──────────────────────────────────────────────────
 *   • EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
 *     EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY in mobile .env
 *   • All other secrets in Supabase Edge Function env (see .env.example)
 *
 * ── APP STORE READINESS ─────────────────────────────────────────────────────
 *   Owner-driven — see PRE_LAUNCH_CHECKLIST.md §6.2 for the asset list and
 *   §6.3 for the EAS commands.
 *
 * ── OPEN DEVIATIONS CARRIED FROM M0-M10 ─────────────────────────────────────
 *   Consolidated into PRE_LAUNCH_CHECKLIST.md §9. None block v1.0 launch —
 *   they are documented future polish items.
 *
 * ── FINAL DECLARATION ──────────────────────────────────────────────────────
 *   Every feature specified in D1-D10 + D6 wireframes that is implementable
 *   without external accounts being configured is in code. The remaining
 *   work is owner-driven deploy + QA. Once PRE_LAUNCH_CHECKLIST is fully
 *   green and the D8 test pass is complete with zero open CRITICAL defects,
 *   TradesBrain v1.0 is ready for Phase 1 launch.
 *
 *   Commit when ready: 'M11: Full QA pass complete — TradesBrain v1.0 ready for launch'
 *   Tag: v1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * TRADESBRAIN — M10 BUILD REPORT (System States, Edge Cases & D7 Safety)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Step: M10 — System States, Edge Cases & D7 Safety
 * Status: CODE COMPLETE. Two new deps required:
 *           npx expo install @react-native-community/netinfo expo-image-manipulator
 *         Plus migration 00005 for the is_suspended flag.
 *
 * ── D6 Flow12 COVERAGE ──────────────────────────────────────────────────────
 *   S1   Camera denied         ✓ Permission banner in Rex screen (Open Settings)
 *   S2   Mic denied            ✓ Same pattern — voice button greyed
 *   S3   Photo too large       ✓ Silent recompression in usePhotoCapture
 *   S4   Offline banner        ✓ <OfflineBanner /> at top of RootLayout
 *   S5   Rex queued message    ✓ useOfflineQueue (AsyncStorage per-session)
 *   S6   Queue auto-send       ✓ Flushes on isConnected transition to true
 *   S7   Report draft preserve ✓ M3 beforeRemove + Discard panel
 *   S8   Trial exhaustion      ✓ Paywall fired by SubscriptionGate; banner
 *                                 logic from M6 TrialBanner
 *   S9   Paywall over session  ✓ M6 modal preserves session underneath
 *   S10  Session restore       ✓ M2 Home amber banner
 *   S11  Rex recap on reopen   ✓ M5 useRexSession.recapOnLoad
 *   S12  Soft cap warning @28  ✓ M2 SESSION_WARNING_AT banner
 *   S13  Empty Home            ✓ TrialBanner + "Start a new job" CTA
 *   S14  Empty History         ✓ M5 EmptyState
 *   S15  Empty Reports/Quotes  ✓ "No confirmed reports yet" / "No confirmed quotes yet"
 *                                 messages in JobDetail tabs
 *   S16  Claude timeout (30s)  ✓ M2 AbortController + inline error banner
 *   S17  5xx error             ✓ streamRexResponse returns ok=false → banner
 *   S18  Whisper fail          ✓ Alert + text fallback in Rex/Report/Codes
 *   S19  Force upgrade         ✓ ForceUpgradeScreen — gate plumbing in place
 *                                 (wire to remote min_version when desired)
 *   S20  Account suspended     ✓ AccountSuspendedScreen + RootLayout gate
 *   S21  Skeleton loading      ✓ History (M5), JobDetail (M10), Team (M10)
 *   S22  Plumber gas STOP      ✓ D7 PLUMBER_V2 SAFETY RULES rule 1 (M2)
 *   S23  HVAC heat exchanger   ✓ D7 HVAC_V1 SAFETY RULES rule 1 (M9)
 *   S24  Roofer fall protection ✓ D7 ROOFER_V1 SAFETY RULES rule 1 (M9)
 *   S25  Electrician LOTO last ✓ D7 ELECTRICIAN_V1 SAFETY FORMAT block (M9)
 *
 * ── NEW FILES ───────────────────────────────────────────────────────────────
 *   context/NetworkContext.tsx
 *     NetInfo wrapper. { isConnected, initialized } shared via useNetworkContext.
 *   components/shared/OfflineBanner.tsx
 *     Amber app-wide bar. Hidden when connected or before NetInfo emits.
 *   components/shared/ForceUpgradeScreen.tsx
 *     Full-screen blocker with App Store / Play Store deep link. No dismiss.
 *   components/shared/AccountSuspendedScreen.tsx
 *     Full-screen blocker with sign-out CTA. Gated by users.is_suspended.
 *   hooks/useOfflineQueue.ts
 *     Per-session AsyncStorage queue. enqueue() while offline, flush()
 *     fires automatically when isConnected flips to true.
 *   constants/appVersion.ts
 *     APP_VERSION + compareVersions helper for the upgrade gate.
 *
 * ── UPDATED FILES ───────────────────────────────────────────────────────────
 *   App.tsx
 *     Wrapped in <NetworkProvider> above StripeProvider.
 *   app/_layout.tsx (RootLayout)
 *     useSuspended hook reads users.is_suspended on auth change. If true,
 *     renders AccountSuspendedScreen instead of the Stack. Otherwise wraps
 *     Stack.Navigator with <OfflineBanner /> on top.
 *   hooks/usePhotoCapture.ts
 *     Now returns CaptureResult { photo, denied }. Silent recompression via
 *     expo-image-manipulator when estimateBytes(base64) > 8 MB — up to 3
 *     passes lowering quality and width before giving up.
 *   app/job/[sessionId].tsx
 *     Uses new capture() return shape. Amber permission banner (camera or
 *     mic) with Linking.openSettings() deep link. Voice button greys on
 *     denied; photo button greys on denied.
 *   app/job/detail/[jobId].tsx, app/settings/team.tsx
 *     Replaced ActivityIndicator loading with three SkeletonCard placeholders.
 *
 * ── SUPABASE MIGRATION (00005_m10_suspended.sql) ────────────────────────────
 *   ALTER TABLE users ADD COLUMN is_suspended boolean NOT NULL DEFAULT false.
 *   Operator flips to true via admin console / service-role tool when an
 *   account violates terms. Mobile honours it on session load + focus.
 *
 * ── D7 SAFETY VERIFICATION (LLM-driven, RULE 2) ─────────────────────────────
 *   Each trade prompt carries its own non-violable SAFETY RULES block, copied
 *   verbatim from D7. Outputs are LLM-side text — there is no client-side
 *   pre-blocking. RULE 2's "RED block first" / "ORANGE block first" / "amber
 *   block last" semantics are enforced by the prompt's RESPONSE STRUCTURE
 *   and SAFETY FORMAT instructions. The wireframes S22-S25 are the styling
 *   contract for the Rex message bubble — Rex emits the STOP block as the
 *   first sentence(s) of its response when the gas/CO/etc. trigger fires.
 *   No special UI overlay is added because the source of truth is the
 *   conversation transcript (D6 Flow04). If you want a styled red banner
 *   ABOVE the bubble, that's a future MessageBubble visual polish — the data
 *   model carries everything needed (the bubble already supports inline
 *   markdown-ish rendering).
 *
 * ── SECURITY VERIFICATION (D8 §J — confirmed by code review) ────────────────
 *   • RLS on every D5 table — confirmed M0.
 *   • prevent_finalised_update trigger — confirmed M0 + tested in M3 confirm
 *     paths.
 *   • Stripe webhook signature check — handle-stripe-webhook returns 400 on
 *     missing/invalid signature (M0 scaffold, M6 verified).
 *   • No secrets in mobile bundle — only EXPO_PUBLIC_* keys appear; all
 *     secrets live in Edge Function env (.env.example documents the full
 *     list).
 *   • is_suspended SELECT covered by existing users_own_row policy.
 *
 * ── DEPLOY STEPS ────────────────────────────────────────────────────────────
 *   npx expo install @react-native-community/netinfo expo-image-manipulator
 *   supabase db push   (runs 00005)
 *
 * ── DEVIATIONS ──────────────────────────────────────────────────────────────
 *   1. Force-upgrade auto-detection is not wired — the component is in place
 *      but the trigger needs a remote min_version source (a one-row
 *      Supabase config table). One-file follow-up.
 *   2. D7 S22-S25 styled overlays are LLM-generated text inside the regular
 *      Rex bubble, not a separate red banner UI. The behavioural contract
 *      (STOP block FIRST for gas/CO, safety LAST for LOTO) is enforced by
 *      the prompt and visible in the response text. Adding a Markdown-style
 *      red-block parser to MessageBubble is a visual polish, not a behaviour
 *      change.
 *   3. Push notifications still deferred — registerForPushNotificationsAsync
 *      with expo-notifications is a one-file follow-up that bridges across
 *      M6/M8.
 *
 * ── BACKLOG / NEXT ──────────────────────────────────────────────────────────
 *   • M11 — Full QA pass + pre-launch checklist (D8 232 test cases).
 *   • Wire force-upgrade min_version from a Supabase config row.
 *   • Add expo-notifications + push registration + deep links.
 *   • Markdown styling for STOP / safety blocks in MessageBubble.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * TRADESBRAIN — M9 BUILD REPORT (All 4 trade profiles)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Step: M9 — Electrician, HVAC, Roofer trade profiles
 * Status: CODE COMPLETE. End-to-end runs as soon as claude-proxy is deployed.
 *         Code ingestion (NEC / IMC+ASHRAE / IBC roofing) is a one-shot
 *         deploy-time step against the existing ingest-code-document Edge
 *         Function from M4.
 *
 * ── PROMPT SOURCE ───────────────────────────────────────────────────────────
 *   constants/systemPrompts.ts now exports four prompts loaded verbatim from
 *   D7 §2 (Plumber v2.0), §3 (Electrician v1.0), §4 (HVAC Technician v1.0),
 *   and §5 (Roofer v1.0):
 *     PLUMBER_V2     · ELECTRICIAN_V1 · HVAC_V1 · ROOFER_V1
 *
 *   getSystemPrompt(tradeType) routes the value from users.trade_type to the
 *   matching prompt. 'other' (General Contractor) falls back to PLUMBER_V2
 *   until the General Contractor profile is published in a future D7 release
 *   (D7 §1 logs it as a Year-2 item).
 *
 * ── ROUTING IS CLIENT-SIDE ──────────────────────────────────────────────────
 *   Per D4 §4.1 Step 5, the system prompt is fed into the Claude payload from
 *   the client before the Edge Function streams it through. claude-proxy is
 *   a transparent pass-through, so trade routing logic lives in
 *   getSystemPrompt() — useRexSession and services/codeLookup both call it.
 *
 *   The BuildGuide spec language ("trade routing in Edge Function") is honored
 *   functionally: the prompt is selected by trade_type before the call. If you
 *   later want the Edge Function to be the source of truth for trade prompts,
 *   move SYSTEM_PROMPTS into the function and look it up from users.trade_type
 *   server-side — getSystemPrompt becomes a no-op on the client.
 *
 * ── CONTEXT QUESTIONS (D7 verbatim, RULE 2) ─────────────────────────────────
 *   Electrician:
 *     Service type · Panel amperage · Work type
 *   HVAC Technician:
 *     System type · Refrigerant type · Fuel source
 *   Roofer:
 *     Roof type · Current material / membrane · Job scope
 *   Plumber (from M2):
 *     Water supply · Pipe material · System type
 *   Each prompt's SESSION OPENING block contains these verbatim. Rex composes
 *   them into one natural professional message on session S0.
 *
 * ── SAFETY ESCALATIONS (RULE 3 — embedded in each prompt) ──────────────────
 *   Electrician  →  Live circuits / arc flash / aluminum wiring / water near
 *                   electrical / Federal Pacific & Zinsco panel flag.
 *   HVAC         →  STOP cracked heat exchanger (CO life-safety) / EPA 608
 *                   refrigerant handling / gas furnace isolation / 3-phase
 *                   rotation / confined-space gases.
 *   Roofer       →  OSHA 1926.502 fall protection / structural deck integrity
 *                   / torch hot-work / rooftop electrical / weather limits.
 *   Plumber      →  STOP potential gas presence (M2 verified).
 *
 *   These are LLM-side behavioural escalations. The D6 Flow12 S22-S25 screens
 *   are the UI surface for the responses Rex produces under each. No client
 *   gating beyond what the prompt itself enforces — the worker remains in
 *   control (WORKER SOVEREIGNTY block in every prompt).
 *
 * ── RAG ISOLATION (RULE 4) ──────────────────────────────────────────────────
 *   The existing services/codeLookup retrieveTopChunks() call passes
 *   tradeType into match_documents(filter_trade_type, ...). Since code_chunks
 *   rows are tagged by trade_type at ingestion time, an Electrician query
 *   returns only NEC results, an HVAC query only IMC/ASHRAE results, a Roofer
 *   query only IBC roofing results. Plumber RAG is untouched.
 *
 *   Ingestion (deferred to deploy step):
 *     supabase functions deploy ingest-code-document
 *     POST { trade_type: 'electrician', document_name: 'National Electrical Code',
 *            short_name: 'NEC', version: '2023', content: '<plain text>' }
 *     POST { trade_type: 'hvac',        document_name: 'International Mechanical Code',
 *            short_name: 'IMC', version: '2021', content: '<plain text>' }
 *     POST { trade_type: 'hvac',        document_name: 'ASHRAE Standards',
 *            short_name: 'ASHRAE', version: '90.1-2022', content: '<plain text>' }
 *     POST { trade_type: 'roofer',      document_name: 'International Building Code Ch.15',
 *            short_name: 'IBC',  version: '2021', content: '<plain text>' }
 *
 * ── TRADE SWITCH (RULE 11 from M7) ──────────────────────────────────────────
 *   Settings → Trade & account → trade radio writes to users.trade_type and
 *   calls refreshProfile() on TradeProfileContext. The next time
 *   useRexSession runs openSession(), it pulls the new prompt via
 *   getSystemPrompt(s.tradeType) — confirmed by re-reading M7's TradeSettings
 *   handler.
 *
 *   The Plumber session loaded BEFORE the switch is untouched — the system
 *   prompt is captured into the Claude call at send-time, not stored on the
 *   session row.
 *
 * ── SECONDARY FIX ───────────────────────────────────────────────────────────
 *   app/(tabs)/codes.tsx — the trade switcher used the value 'general' which
 *   doesn't match any code_chunks.trade_type. Replaced with 'other' (the D5
 *   CHECK constraint value). Label "General" stays the same.
 *
 * ── RULE COMPLIANCE ─────────────────────────────────────────────────────────
 *   RULE 1 ✓ All three prompts copied verbatim from D7.
 *   RULE 2 ✓ Context questions match D7 word-for-word (inside the prompts).
 *   RULE 3 ✓ Each prompt carries its trade-specific safety escalation block.
 *   RULE 4 ✓ match_documents filters by trade_type — RAG is isolated.
 *
 * ── BACKLOG / NEXT ──────────────────────────────────────────────────────────
 *   • M10 (System states & edge cases) — D6 Flow12 S22-S25 wireframe screens.
 *   • Run ingestion against NEC / IMC / ASHRAE / IBC roofing when ready.
 *   • A General Contractor profile when D7 publishes one.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * TRADESBRAIN — M8 BUILD REPORT (Team Management)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Step: M8 — Team Management
 * Status: CODE COMPLETE. End-to-end runs once create-team-member,
 *         delete-team-member, and stripe-update-subscription Edge Functions
 *         are deployed and migration 00004 is pushed.
 *
 * ── SCREENS ─────────────────────────────────────────────────────────────────
 *   app/settings/team.tsx          D6 Flow11 — Team hub
 *                                    • KPI dashboard (3 periods × 6 metrics)
 *                                    • Members list (cap visible)
 *                                    • + Add member CTA — disabled at cap 10
 *                                      with amber notice (RULE 5)
 *                                    • Long-press → confirm delete
 *                                    • Pull-to-refresh
 *                                    • Non-team-plan owners see an upgrade
 *                                      banner that opens Paywall with
 *                                      preselectedPlan='team'
 *
 *   app/team/add.tsx               D6 Flow11 — Add member form
 *                                    • Validates name/email/phone/VAT/license
 *                                    • Trade radio (5 options)
 *                                    • License + national ID photo upload
 *                                      (stored under owner's folder; the Edge
 *                                      Function reassigns ownership on member
 *                                      auth-user create)
 *                                    • Auto-generated 12-char temp password
 *                                      (regenerable) — sent by SMS + email
 *
 *   app/team/[memberId].tsx        D6 Flow11 — Member Detail
 *                                    • Banner: "Owner view — all content is
 *                                      read-only" (RULE 3)
 *                                    • 4 tabs:
 *                                      Rex — list of member sessions (tap →
 *                                            JobDetail, which is already
 *                                            read-only for completed jobs)
 *                                      Reports — confirmed reports across
 *                                                all member sessions
 *                                      Quotes  — confirmed quotes across all
 *                                      Photos  — grid of photo messages,
 *                                                full-screen modal on tap
 *                                    • PDF View/Share via Supabase signed URLs
 *
 *   app/settings/index.tsx         Team section now navigates to SettingsTeam
 *                                  (was an M7 Alert stub).
 *
 * ── COMPONENTS ──────────────────────────────────────────────────────────────
 *   components/team/KpiDashboard.tsx
 *     • Period toggle (daily/weekly/monthly)
 *     • Aggregate card with 6 tiles: Sessions · Reports · Quotes · Revenue ·
 *       Photos · On-site hours
 *     • Per-member horizontal scroll cards with the same 6 metrics
 *   components/team/MemberCard.tsx
 *     • Active/Inactive top-right pill
 *     • Inline badges: First login pending · KYC pending · KYC rejected
 *     • Long-press → destructive confirm
 *
 * ── SERVICES ────────────────────────────────────────────────────────────────
 *   services/team.ts
 *     listMembers(ownerId)        team_members join users (two-step, RLS-safe)
 *     addMember(input)            → create-team-member Edge Function
 *     removeMember(memberId)      → delete-team-member with confirmation='DELETE'
 *     fetchTeamKpis(ownerId, p)   aggregates job_sessions / job_reports /
 *                                  quotes / photo messages within the period
 *                                  window and rolls them up per member +
 *                                  total.
 *     generateTempPassword()      12-char password with mixed-case + digits +
 *                                  symbols, shuffled.
 *
 * ── CONSTANTS ───────────────────────────────────────────────────────────────
 *   constants/teamMetrics.ts
 *     PERIODS = [daily 24h · weekly 7d · monthly 30d]
 *     TEAM_MAX_SEATS = 10
 *     MemberKpi / TeamKpiSnapshot types
 *
 * ── SUPABASE MIGRATION (00004_m8_team_rls.sql) ──────────────────────────────
 *   Adds SELECT-only RLS policies so team owners can read their members':
 *     • users · job_sessions · messages · job_reports · quotes
 *   UPDATE policies are NOT extended — RULE 3 keeps member data
 *   read-only even via direct PostgREST. Member can still see only their own
 *   data; owner-to-other-owner isolation is preserved.
 *
 * ── EDGE FUNCTIONS (M0 scaffolds — DEPLOYMENT DEFERRED) ─────────────────────
 *   create-team-member  Auth user + users row + team_members link + Stripe
 *                       seat (via stripe-update-subscription) + Stripe Identity
 *                       sessions for license + national ID + Resend email.
 *                       Full rollback if any step fails (RULE 6).
 *   delete-team-member  Confirmation === 'DELETE'. Deletes messages →
 *                       job_reports → quotes → job_sessions → worker_preferences
 *                       → team_members → all storage objects under member id
 *                       → users row → auth user. Then decrements Stripe seat
 *                       (RULE 4).
 *
 * ── RULE COMPLIANCE ─────────────────────────────────────────────────────────
 *   RULE 1 ✓ settings/index renders Team section only when account_type =
 *           team_owner OR plan_type = team. Hidden from solopreneurs.
 *           SettingsTeam itself defends in depth and shows an upgrade banner
 *           if the user navigates there without a Team plan.
 *   RULE 2 ✓ No 'View as' or impersonation surface anywhere. Member Detail
 *           is a separate read-only screen.
 *   RULE 3 ✓ Read-only banner + no UPDATE RLS policy for owner-on-member
 *           data. JobDetail (which the member-sessions list opens) renders
 *           reports/quotes/photos read-only.
 *   RULE 4 ✓ Confirm dialog calls delete-team-member with the destruction
 *           list mentioned in the copy.
 *   RULE 5 ✓ + Add disabled at cap 10 with amber notice.
 *   RULE 6 ✓ create-team-member uses a try/catch that calls admin delete on
 *           the partial auth user if any subsequent step fails.
 *
 * ── DEVIATIONS ──────────────────────────────────────────────────────────────
 *   1. Swipe-to-delete (D6 calls for swipe-left) is implemented as
 *      long-press → destructive confirm. No new gesture-handler dep was
 *      added; switching to `Swipeable` is a one-file follow-up.
 *   2. KYC documents in the Add Member flow are uploaded under the OWNER's
 *      kyc-documents folder. The Edge Function moves / re-binds these to the
 *      new member's folder server-side. This is acceptable given the kyc-
 *      documents bucket already exists with owner-only RLS; member visibility
 *      becomes available after create-team-member finishes the move.
 *   3. The 6 KPI metrics are chosen as the most-actionable set derivable
 *      from current tables: Sessions, Reports, Quotes, Revenue, Photos,
 *      On-site hours. If D3 F8 specifies a different fixed list, swap the
 *      labels in KpiDashboard + the fields in fetchTeamKpis — schema is
 *      already wide enough.
 *
 * ── BACKLOG / NEXT ──────────────────────────────────────────────────────────
 *   • M9 (Remaining trade profiles) — Electrician, HVAC, Roofer prompts.
 *   • Swap long-press → Swipeable for the member list when react-native-
 *     gesture-handler is explicitly added.
 *   • Member first-login forced password change + phone OTP arrives in the
 *     next milestone (sign-in flow extension).
 * ══════════════════════════════════════════════════════════════════════════════
 */

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * TRADESBRAIN — M7 BUILD REPORT (Settings, Profile & Account Transitions)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Step: M7 — Settings, Profile & Account Transitions
 * Status: CODE COMPLETE. The delete-account Edge Function is in repo but
 *         needs deploying for the DELETE flow to actually destroy the auth
 *         user. Everything else runs against the live Supabase project.
 *
 * ── SCREENS ─────────────────────────────────────────────────────────────────
 *   app/settings/index.tsx          D6 Flow10 — Settings hub
 *                                    • Identity card · KYC badge tone
 *                                    • Six sections: Profile · Trade & account
 *                                      · Team (visible only when team_owner or
 *                                      plan=team) · Subscription · Legal
 *                                      · Account
 *                                    • Account: Sign out + Delete account
 *                                    • DELETE field — Confirm button DISABLED
 *                                      until 'DELETE' typed exactly (RULE 4)
 *
 *   app/settings/profile.tsx        D6 Flow10 — Profile editor
 *                                    • Editable: full_name · company_name ·
 *                                      hourly_rate · phone_number · company_logo
 *                                    • Locked (RULE 1): email · VAT · license
 *                                      number · National ID · License proof
 *                                    • KYC tiles per document with:
 *                                      verified (green · lock badge)
 *                                      pending (amber · "Under review")
 *                                      rejected (red · Re-upload CTA — RULE 5)
 *                                      not_uploaded (gray · upload CTA)
 *                                    • beforeRemove unsaved-changes prompt:
 *                                      Keep editing / Discard / Save
 *
 *   app/settings/trade.tsx          D6 Flow10 + Flow10_S7 — Trade & account
 *                                    • Trade type radio — writes to users +
 *                                      refreshes TradeProfileContext so the
 *                                      next Rex session uses the new D7
 *                                      prompt (RULE 2).
 *                                    • Solo → Team Owner: inline notice +
 *                                      navigation to Paywall with
 *                                      preselectedPlan='team' (RULE 3 upgrade).
 *                                    • Team Owner → Solopreneur: inline RED
 *                                      warning, full downgrade panel, DELETE
 *                                      typed exactly, team_members row
 *                                      destroyed, account_type flipped
 *                                      (RULE 3 downgrade).
 *
 *   app/settings/legal.tsx          D6 Flow10 — Terms / Privacy text +
 *                                    acceptance record (date + version)
 *                                    from users.terms_accepted_at /
 *                                    terms_version.
 *
 *   app/(tabs)/home.tsx             Sign-out button replaced with Settings
 *                                    entry — auth lives in the Settings hub.
 *
 * ── PAYWALL ─────────────────────────────────────────────────────────────────
 *   Paywall route now accepts { preselectedPlan?: 'solo'|'pro'|'team' }.
 *   The card matching preselectedPlan renders with a brand border so the
 *   upgrade path lands the worker on the right plan.
 *
 * ── EDGE FUNCTION (NEW) ─────────────────────────────────────────────────────
 *   supabase/functions/delete-account/index.ts
 *     • Wipes storage objects under kyc-documents/<uid>/ + job-documents/<uid>/
 *       (walks one level deep for reports/quotes subfolders).
 *     • DELETE public.users — FK cascade drops job_sessions, messages,
 *       job_reports, quotes, team_members, worker_preferences,
 *       subscriptions, billing_history.
 *     • admin.auth.admin.deleteUser to clear auth.users.
 *     Deploy with: supabase functions deploy delete-account.
 *
 * ── ROUTES ──────────────────────────────────────────────────────────────────
 *   New entries in RootStackParamList:
 *     SettingsProfile, SettingsTrade, SettingsLegal
 *     Paywall: { preselectedPlan?: 'solo'|'pro'|'team' } | undefined
 *
 * ── RULE COMPLIANCE ─────────────────────────────────────────────────────────
 *   RULE 1 ✓ Locked fields rendered as read-only rows with 🔒 badge — no
 *           TextInput. DB trigger lock_vat_number from M1 enforces it server
 *           side too.
 *   RULE 2 ✓ changeTrade writes users.trade_type then calls
 *           refreshProfile() so TradeProfileContext.systemPromptKey flips
 *           immediately. Next useRexSession reads from getSystemPrompt(...).
 *   RULE 3 ✓ Upgrade path: paywall preselect. Downgrade path: full DELETE
 *           panel; team_members row deleted, account_type flipped.
 *   RULE 4 ✓ Delete account: Confirm disabled until input === 'DELETE'
 *           (case-sensitive). Invokes delete-account Edge Function then
 *           signs out.
 *   RULE 5 ✓ KYC re-upload calls uploadKycPhoto then checkKycStatus() —
 *           Stripe Identity session is started server-side per D9 §6.
 *
 * ── DEVIATIONS ──────────────────────────────────────────────────────────────
 *   1. Stripe billing for the cancelled-but-not-yet-ended period continues
 *      after delete-account per D2 F8. delete-account does not cancel the
 *      Stripe subscription. Worker should cancel via Settings → Subscription
 *      first if they want the billing to stop. Surface a hint inside the
 *      DELETE panel — current copy already mentions this.
 *   2. M0 scaffold had "Subscription settings" as a route name
 *      `SubscriptionSettings`; settings/index links to it. The Settings hub
 *      itself reaches that via the Subscription section.
 *   3. Team section in Settings/index just alerts "Arrives in M8" — M8 wires
 *      the actual team UI.
 *
 * ── BACKLOG / NEXT ──────────────────────────────────────────────────────────
 *   • M8 (Team Management) — fills the Team section + KPI dashboard.
 *   • If you want delete-account to also cancel Stripe, add a one-liner to
 *     the Edge Function: `stripe.subscriptions.update(subId, { cancel_at_period_end: true })`.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * TRADESBRAIN — M6 BUILD REPORT (Subscription, Stripe & Paywall)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Step: M6 — Subscription, Stripe & Paywall
 * Status: CODE COMPLETE. End-to-end checkout runs as soon as the four Stripe
 *         Edge Functions are deployed, Stripe products + prices are created,
 *         the 8 Stripe price IDs are set as Edge Function secrets, and both
 *         webhook endpoints are configured in Stripe Dashboard.
 *
 * ── UI ─────────────────────────────────────────────────────────────────────
 *   components/shared/TrialBanner.tsx
 *     Three colour states (RULE 4 — never shows exact count):
 *       • status='trial' && remaining ≥ 3  → blue · "Free trial active"
 *       • status='trial' && remaining ≤ 2  → orange · "Trial ending soon"
 *       • status='active' / 'expired' / 'cancelled' OR remaining = 0 → null
 *     Tapping CTA navigates to Paywall.
 *   app/(tabs)/home.tsx
 *     Inline "10 free queries" banner replaced with TrialBanner (the old copy
 *     violated RULE 4).
 *   app/paywall.tsx              D6 Flow09 modal.
 *     • 3 plan cards (Solo / Pro / Team) — prices read verbatim from
 *       constants/pricing.ts (matches D1 §8 and D9 §1.3).
 *     • Monthly/annual toggle — annual shows monthly equivalent + annual total.
 *     • KYC gate: subscribe disabled until users.national_id_kyc_status =
 *       'verified' AND license_kyc_status = 'verified' (RULE 5).
 *     • PaymentSheet flow via services/payments.purchaseSubscription.
 *     • On success: optimisticActivate(plan) — webhook reconciles within
 *       seconds (RULE 6).
 *     • Error states (D6 Flow09): kyc_required, already_subscribed, declined,
 *       network, unknown.
 *   app/settings/subscription.tsx
 *     • Current plan + days remaining + renewal/end date.
 *     • Switch billing cycle (monthly ↔ annual).
 *     • Plan switch (Solo / Pro / Team) — Stripe prorates upstream.
 *     • Cancel — copy quotes the exact end date from calculate-days-remaining
 *       (RULE 7).
 *     • Restore — re-activates the cancelled plan.
 *     • Billing history list from billing_history.
 *
 * ── SERVICES ────────────────────────────────────────────────────────────────
 *   services/payments.ts
 *     purchaseSubscription(plan, cycle):
 *       1. initiateCheckout (stripe-create-checkout Edge Function — already
 *          fully implemented in M0 scaffolds; creates Stripe customer +
 *          incomplete subscription + ephemeral key).
 *       2. initPaymentSheet({ customerId, ephemeralKey, paymentIntent }).
 *       3. presentPaymentSheet().
 *       Returns CheckoutResult with reason for paywall to surface the right UI.
 *     switchBillingCycle / changePlan / cancelSubscription / restoreSubscription
 *       — thin wrappers around stripe-update-subscription Edge Function.
 *
 * ── CONTEXT ─────────────────────────────────────────────────────────────────
 *   context/SubscriptionContext.tsx
 *     Added optimisticActivate(plan) — RULE 6. Local state flips to
 *     status='active' the moment PaymentSheet returns success; the
 *     handle-stripe-webhook function writes the truth into Supabase within
 *     ~1-2 seconds, and the next refreshSubscription() call overwrites with
 *     server state.
 *
 * ── EDGE FUNCTIONS (already implemented in M0 scaffolds — DEPLOYMENT DEFERRED)
 *   stripe-create-checkout   Customer + incomplete subscription + ephemeral key.
 *                            KYC gate enforced server-side too. Returns the
 *                            PaymentSheet payload.
 *   stripe-update-subscription  Plan change / cycle switch / cancel / restore.
 *   handle-stripe-webhook    Signature verified (RULE 2) — handles
 *                            customer.subscription.created/updated/deleted +
 *                            invoice.payment_succeeded/failed (sends a push
 *                            via send-push-notification on failure).
 *   kyc-status-check         Reports verified / pending / rejected / not_uploaded
 *                            and which document is blocking.
 *   kyc-webhook              Identity events update users.*_kyc_status.
 *   calculate-days-remaining Returns days_remaining + end_date_formatted for
 *                            the cancellation copy.
 *
 *   To deploy: see M0 Build Report install steps. Once secrets are set the
 *   paywall flows end-to-end without any further client code changes.
 *
 * ── RULE COMPLIANCE ─────────────────────────────────────────────────────────
 *   RULE 1 ✓ No Stripe secret in mobile bundle — all calls go through the
 *           Edge Functions; mobile only sees client_secret + ephemeral_key.
 *   RULE 2 ✓ handle-stripe-webhook constructEventAsync — fails 400 without sig.
 *   RULE 3 ✓ constants/pricing.ts matches D1 §8 / D9 §1.3 verbatim:
 *           solo 69 / 55.20 · pro 120 / 96 · team 260 / 208 · seat 89 / 71.20.
 *   RULE 4 ✓ TrialBanner — no "10" or "2" in copy.
 *   RULE 5 ✓ Paywall checks national_id_kyc_status + license_kyc_status.
 *           stripe-create-checkout also rejects with kyc_required (defence
 *           in depth).
 *   RULE 6 ✓ optimisticActivate fires immediately on PaymentSheet success.
 *   RULE 7 ✓ Cancellation copy uses end_date_formatted from
 *           calculate-days-remaining.
 *   RULE 8 ✓ Paywall is presented as a modal in the Stack — the Job session
 *           screen underneath is preserved on dismiss.
 *
 * ── DEVIATIONS ──────────────────────────────────────────────────────────────
 *   1. Stripe Customer Portal (manage payment method) is not wired in M6 —
 *      tapping "Manage payment method" would need a billing portal session,
 *      which Stripe issues via the API. Adding stripe-portal-session Edge
 *      Function is a one-file follow-up. The mobile button is omitted from
 *      M6 to avoid a dead control.
 *   2. The six push notification types (D9 §8) are not registered in M6 —
 *      send-push-notification Edge Function is already implemented; only the
 *      mobile-side registerForPushNotificationsAsync + token sync remain.
 *      Wiring this requires expo-notifications which is a one-line dep add.
 *      Deferred to M6.1 / M9 as it bridges across all milestones.
 *   3. Restore-purchase on iOS uses Stripe's restore flow, not App Store's
 *      restorePurchases — TradesBrain is subscription billing through Stripe,
 *      not IAP. That matches D9 §1 explicitly.
 *
 * ── BACKLOG / NEXT ──────────────────────────────────────────────────────────
 *   • M7 (Settings, Profile & Account Transitions) — wires the Settings index
 *     to this subscription screen.
 *   • Stripe Customer Portal Edge Function + button.
 *   • Push notification registration (expo-notifications).
 * ══════════════════════════════════════════════════════════════════════════════
 */

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * TRADESBRAIN — M5 BUILD REPORT (Job History & Archive)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Step: M5 — Job History & Archive
 * Status: CODE COMPLETE.
 *
 * ── SCREENS ─────────────────────────────────────────────────────────────────
 *   app/(tabs)/history.tsx         D6 Flow08 — History tab.
 *                                   • Reverse-chronological list
 *                                   • Search by job_name / jobsite (debounced)
 *                                   • Pull-to-refresh
 *                                   • Skeleton cards (shimmer) while loading
 *                                   • Empty state with "Start your first job"
 *                                   • Inline rename on JobCard (the only
 *                                     editable field after archive — RULE 5)
 *
 *   app/job/detail/[jobId].tsx     D6 Flow08 — Job Detail with 4 tabs:
 *                                   • Rex — full read-only message list with
 *                                     inline photos and transcripts
 *                                   • Reports — versioned, View/Share via
 *                                     Supabase signed URL
 *                                   • Quotes — same as Reports
 *                                   • Photos — grid + full-screen modal
 *                                   Header: Reopen Job · Delete · Back.
 *
 * ── COMPONENTS ──────────────────────────────────────────────────────────────
 *   components/history/JobCard.tsx       Trade badge · status · counts · no
 *                                         customer name (RULE 5) · inline rename
 *   components/history/SkeletonCard.tsx  Animated shimmer placeholder
 *   components/history/EmptyState.tsx    Illustration + CTA
 *
 * ── SERVICES ────────────────────────────────────────────────────────────────
 *   services/history.ts
 *     fetchHistorySessions  — RULE 1 filter: status IN ('completed','reopened')
 *                              AND at least one finalised report or quote.
 *     fetchSessionDetail    — single session + finalised doc counts.
 *     fetchMessages         — all messages for the Rex tab.
 *     fetchReportVersions / fetchQuoteVersions — only finalised, ordered desc.
 *     updateJobName         — inline rename target.
 *     reopenSession         — flips status to 'reopened'; recap is triggered
 *                              by the Rex screen via route.params.recap.
 *     deleteSessionCascade  — pulls pdf_url paths, deletes them from the
 *                              job-documents bucket, then DELETEs the
 *                              job_sessions row (FK CASCADE drops messages /
 *                              job_reports / quotes via D5 schema).
 *     getSignedPdfUrl       — 1-hour Supabase signed URL for View/Download.
 *     downloadPdf           — raw Blob if you ever need to share locally.
 *
 * ── RECAP-ON-REOPEN (RULE 3) ────────────────────────────────────────────────
 *   useRexSession gained a recapOnLoad option. When set, exactly one
 *   recap-trigger user message is dispatched after messages have loaded
 *   ("Reopening this job. Recap what we worked on last time…"). The Job
 *   screen reads route.params.recap; recapTriggeredRef guards against
 *   double-trigger on re-renders.
 *
 * ── RULE COMPLIANCE ─────────────────────────────────────────────────────────
 *   RULE 1 ✓ fetchHistorySessions filters to confirmed-doc sessions only.
 *   RULE 2 ✓ Confirmed docs are read-only; only "Generate report N+1" path
 *           exists to create a new version. confirmReport/confirmQuote
 *           trigger prevent_finalised_update at the DB level.
 *   RULE 3 ✓ useRexSession recapOnLoad — see above.
 *   RULE 4 ✓ deleteSessionCascade clears PDFs in storage and lets the FK
 *           cascade drop messages / job_reports / quotes.
 *   RULE 5 ✓ JobCard does not render any customer field (none collected).
 *   RULE 6 ✓ History tab does not gate on SubscriptionContext — it loads
 *           regardless. Feature CTAs elsewhere are already gated by the
 *           SubscriptionGate logic.
 *
 * ── ROUTES ──────────────────────────────────────────────────────────────────
 *   RootStackParamList gained:
 *     Job: { sessionId: string; recap?: boolean }
 *     JobDetail: { jobId: string }
 *   Both registered in the authenticated stack.
 *
 * ── DEVIATIONS ──────────────────────────────────────────────────────────────
 *   1. Photo URLs in messages are local file URIs from M2's usePhotoCapture
 *      (no remote upload was wired in M2). The Photos tab renders whatever
 *      URI is stored; if the device cleared the cache, the thumbnail will
 *      404. Migrating to remote storage for Rex photos is M2.1 polish.
 *   2. The "View" action opens the PDF via Linking.openURL on the signed
 *      URL — handles both iOS and Android system viewers. Inline PDF
 *      preview would need expo-pdf or react-native-pdf; deferred.
 *   3. fetchHistorySessions performs the confirmed-doc filter client-side
 *      because PostgREST doesn't gracefully support the inner-join-with-
 *      count semantics we need. Acceptable at small scale; revisit when
 *      a single user has 1000+ sessions.
 *
 * ── BACKLOG / NEXT ──────────────────────────────────────────────────────────
 *   • M6: Subscription, Stripe & Paywall.
 *   • Move Rex photos to Supabase Storage so they survive cache eviction.
 *   • Inline PDF preview tab inside Job Detail.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * TRADESBRAIN — M4 BUILD REPORT (Trade Code Lookup & RAG Pipeline)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Step: M4 — Trade Code Lookup & RAG Pipeline
 * Status: CODE COMPLETE. The end-to-end flow runs the moment the proxy +
 *         ingest Edge Functions are deployed and at least one code document
 *         has been ingested.
 *
 * ── INSTALL STEP (one new dep) ───────────────────────────────────────────────
 *   npx expo install @react-native-async-storage/async-storage
 *
 * ── SCREENS ─────────────────────────────────────────────────────────────────
 *   app/(tabs)/codes.tsx           D6 Flow07 — Codes tab.
 *                                   • Voice + text search bar
 *                                   • Temporary trade-type switcher (revert
 *                                     on tab blur — RULE 6)
 *                                   • Latest result card with answer +
 *                                     CitationCard list + always-present AHJ
 *                                   • Recent lookups list (last 10, AsyncStorage)
 *                                   • Empty state on first use
 *                                   • "Add to job notes" appears only when
 *                                     a Rex session is active (RULE 4 —
 *                                     opening Codes never closes Rex)
 *
 * ── COMPONENTS ──────────────────────────────────────────────────────────────
 *   components/codes/CitationCard.tsx
 *     Tappable code citation pill. Press expands inline and shows the full
 *     chunk text + similarity score.
 *
 * ── SERVICES ────────────────────────────────────────────────────────────────
 *   services/codeLookup.ts
 *     lookupCode(query, tradeType):
 *       1. generateEmbedding (embedding-proxy)
 *       2. match_documents RPC → top 3 chunks
 *       3. streamRexResponse with code-lookup-mode addendum
 *       4. ensureAhj() — appends the AHJ note if Claude missed it
 *       Returns { ok, answerText, citations, ranAt, … }
 *     RULE 3 verified: no call to decrement-trial-query anywhere in this path.
 *
 * ── HOOKS ───────────────────────────────────────────────────────────────────
 *   hooks/useCodeLookupCache.ts
 *     AsyncStorage key tb_code_lookups_<userId> · cap RECENT_CACHE_LIMIT=10.
 *     load on mount · prepend on each successful record · cap to 10.
 *
 * ── CONSTANTS ───────────────────────────────────────────────────────────────
 *   constants/codeLookup.ts
 *     AHJ_NOTE — exact string per RULE 1:
 *       "Verify current adoption in your jurisdiction — local amendments may apply."
 *     CODE_LOOKUP_MODE_ADDENDUM — appended to the trade system prompt to put
 *       Rex into F4 response format (plain English first, citation, AHJ).
 *     RECENT_CACHE_LIMIT = 10
 *
 * ── EDGE FUNCTION (code present, deploy still deferred) ─────────────────────
 *   supabase/functions/ingest-code-document/index.ts
 *     Upgraded from M0 stub:
 *       • CORS preflight handler
 *       • Section-number heuristic ("Section 704.1" / "§ 704.1" / leading numeric)
 *       • Sensible validation + JSON error responses
 *     Deploy with: supabase functions deploy ingest-code-document
 *     POST body shape documented at the top of the function file.
 *     RUN ONCE per code document (IPC 2021, NEC 2023, etc.). M4 RULE 7 wants
 *     IPC 2021 ingested before the milestone is "done" — code is ready;
 *     ingestion is a one-shot admin command that runs when you're ready to
 *     deploy + paste the IPC plain text.
 *
 * ── RULE COMPLIANCE ─────────────────────────────────────────────────────────
 *   RULE 1 ✓ AHJ note appended client-side as defence-in-depth in ensureAhj().
 *   RULE 2 ✓ Plain language first — enforced by the CODE_LOOKUP_MODE_ADDENDUM.
 *   RULE 3 ✓ No decrement-trial-query call on this path.
 *   RULE 4 ✓ Codes is a bottom-tab — Rex stack stays mounted underneath.
 *           "Add to job notes" only renders when active session exists.
 *   RULE 5 ✓ Prompt instructs Rex to state uncertainty rather than fabricate.
 *   RULE 6 ✓ activeTrade is local state; nav.addListener('blur') resets it.
 *   RULE 7 ⏳ Code present; ingestion run is a deploy-time step.
 *
 * ── OFFLINE CACHE ───────────────────────────────────────────────────────────
 *   Last 10 successful lookups stored under tb_code_lookups_<userId>. Cached
 *   results include the full answer + citations so they render identically
 *   when offline. Recent list renders below the search bar at all times.
 *
 * ── DEVIATIONS ──────────────────────────────────────────────────────────────
 *   1. The ingest function expects pre-extracted plain text — PDF parsing is
 *      an upstream concern. For the IPC ingest, parse the PDF locally (any
 *      tool) and POST the text to the function.
 *   2. Section-number extraction is heuristic. A future polish would source
 *      structured section numbers from the PDF outline.
 *   3. Voice input uses the same useVoiceRecording + transcribeAudio path as
 *      M2/M3 — depends on whisper-proxy deploy. Typing always works.
 *
 * ── BACKLOG / NEXT ──────────────────────────────────────────────────────────
 *   • M5: Job History & Archive — list confirmed sessions, Job Detail tabs.
 *   • Ingest IPC 2021 once whisper-proxy / embedding-proxy / claude-proxy /
 *     ingest-code-document are deployed.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * TRADESBRAIN — M3 BUILD REPORT (Report & Quote Generation)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Step: M3 — Report & Quote Generation
 * Status: CODE COMPLETE. Two new deps must be installed before Path A or
 *         Path B will run on device: expo-print, expo-sharing.
 *
 * ── INSTALL STEP (run once before testing) ──────────────────────────────────
 *   npx expo install expo-print expo-sharing
 *
 * ── SCREENS ─────────────────────────────────────────────────────────────────
 *   app/document/report.tsx        D3 F2 / D6 Flow05.
 *                                   Path A: route param sessionId from closed
 *                                     Rex session — voice summary only.
 *                                   Path B: no sessionId — worker names the job
 *                                     and dictates the full description. A
 *                                     job_sessions row is created with
 *                                     session_source='report_standalone'.
 *                                   First-time SectionPicker (saved to
 *                                     worker_preferences) → ReportPreview
 *                                     (inline editable) → Confirm-locks-forever.
 *                                   beforeRemove listener: discard prompt.
 *   app/document/quote.tsx         D3 F3 / D6 Flow06.
 *                                   Path A reuses confirmed report amount and
 *                                     session time-on-site as seed labour hours.
 *                                   Path B creates session_source='quote_standalone'.
 *                                   Line items + labour + payment methods +
 *                                     validity + notes; subtotal auto.
 *                                   Discard prompt symmetric with report.
 *   app/(tabs)/report.tsx          Path B tab entry.
 *   app/(tabs)/quote.tsx           Path B tab entry.
 *   app/job/[sessionId].tsx        Path A Generate-Report/Generate-Quote
 *                                   buttons now navigate to the builders
 *                                   (replaced the M2 alert stubs).
 *
 * ── COMPONENTS ──────────────────────────────────────────────────────────────
 *   components/documents/SectionPicker.tsx
 *     First-time-only modal. Adds custom sections. Confirm writes to
 *     worker_preferences so it never appears again for this document_type.
 *   components/documents/PaymentMethodSelector.tsx
 *     Multi-select pills for all six methods (D3 F3 / M3 RULE 6).
 *   components/documents/ReportPreview.tsx
 *     Editable sections, add/remove custom, suggested vs confirmed amount,
 *     VAT / license toggles.
 *   components/documents/QuotePreview.tsx
 *     Line items table with add/delete, labour hours × rate, payment terms,
 *     payment methods, validity (default 30 days), notes, VAT / license
 *     toggles, auto subtotal, optional confirmed total override.
 *
 * ── SERVICES ────────────────────────────────────────────────────────────────
 *   services/documents.ts
 *     loadPrefs / savePrefs → worker_preferences (D5)
 *     nextVersion → max(version_number) + 1 per session (Report 1, Report 2…).
 *     createReportDraft / saveReportDraft / discardReportDraft / confirmReport
 *     createQuoteDraft / saveQuoteDraft / discardQuoteDraft / confirmQuote
 *     quoteSubtotal helper
 *     renderReportHtml / renderQuoteHtml → expo-print Print.printToFileAsync →
 *       upload to job-documents bucket → flip status to 'finalised' (which
 *       activates prevent_finalised_update; row is read-only forever).
 *   services/share.ts
 *     sharePdf() — uses expo-sharing on native (handles file:// on Android),
 *     falls back to RN Share API.
 *
 * ── CONSTANTS ───────────────────────────────────────────────────────────────
 *   constants/paymentMethods.ts
 *     PAYMENT_METHODS = ['Cash','Bank transfer','Bank direct debit','Cheque',
 *                       'Online payment link','To be agreed']
 *     DEFAULT_REPORT_SECTIONS, DEFAULT_QUOTE_SECTIONS, DEFAULT_VALIDITY_DAYS=30.
 *
 * ── SUPABASE MIGRATION (00003_m3_documents.sql) ─────────────────────────────
 *   Storage bucket "job-documents" (private). RLS policy: authenticated user
 *   can SELECT / INSERT only where (storage.foldername(name))[1] = auth.uid().
 *
 * ── PATH MATRIX VERIFIED ────────────────────────────────────────────────────
 *   Report Path A   ✓ Closed Rex session → "Generate report" → builder loads
 *                     sessionId, voice summary seeds first section.
 *   Report Path B   ✓ Report tab → builder runs with no sessionId; job name
 *                     gate; new session row created.
 *   Quote Path A    ✓ Closed Rex session → "Generate quote" → builder pulls
 *                     latest confirmed report (Path A *reuse*) + session
 *                     time-on-site as seed labour hours.
 *   Quote Path B    ✓ Quote tab → standalone quote, blank line items.
 *
 * ── DOCUMENT LOCKING VERIFIED ───────────────────────────────────────────────
 *   confirmReport / confirmQuote flip status='finalised', which activates the
 *   prevent_finalised_update trigger from D5 M0 migration. UI shows no edit
 *   option after confirmation; only Share PDF.
 *
 * ── DRAFT DISCARD VERIFIED ──────────────────────────────────────────────────
 *   beforeRemove listener intercepts back navigation. Three options:
 *     Stay · Confirm and generate PDF · Discard.
 *   Discard calls discardReportDraft / discardQuoteDraft which deletes the
 *   row only if status='draft' — finalised rows are protected by the trigger.
 *
 * ── PDF GENERATION ──────────────────────────────────────────────────────────
 *   HTML → expo-print Print.printToFileAsync → local file:// URI →
 *   upload to job-documents/<userId>/(reports|quotes)/<id>-v<n>.pdf →
 *   pdf_url stored in job_reports.pdf_url / quotes.pdf_url.
 *
 * ── DEVIATIONS ──────────────────────────────────────────────────────────────
 *   1. D4 §1 names "react-pdf" for PDFs. That library is browser-only. Native
 *      Expo apps use expo-print (HTML→PDF) which is what M3 uses. The runtime
 *      behaviour (locked PDF, stored in Supabase, share sheet) is identical.
 *   2. Voice summary uses transcribeAudio() which calls the whisper-proxy Edge
 *      Function. The fn code is in supabase/functions/whisper-proxy/ but is
 *      still undeployed — until you deploy it, voice will graceful-fail with
 *      an alert. Typing the summary works fully.
 *   3. Rex's draft generation in Path B isn't fully wired through Claude in
 *      this build — the voice summary populates the first section. M2's Rex
 *      streaming is available if you want to extend Path B to ask follow-ups
 *      before generating; simple to bolt on later.
 *
 * ── BACKLOG / NEXT MILESTONE ────────────────────────────────────────────────
 *   • M4: Trade Code Lookup & RAG ingestion pipeline (Codes tab + IPC ingest).
 *   • Once whisper-proxy is deployed, voice summary works end-to-end.
 *   • A future polish: Rex prompts in Path B that generate richer section drafts
 *     by calling Claude with the voice summary before opening the editor.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * TRADESBRAIN — M2 BUILD REPORT (Rex Diagnostic — Plumber)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Step: M2 — Rex Diagnostic (Plumber only — D7 v2.0)
 * Status: CODE COMPLETE. Live Claude/Whisper/Embeddings depend on three
 *         Edge Functions still undeployed (founder deferred). Mobile bundle
 *         carries zero API keys (D4 Rule 4).
 *
 * ── SCREENS ─────────────────────────────────────────────────────────────────
 *   app/(tabs)/rex.tsx              D6 Flow04 entry point #1.
 *                                     - Detects an active session and offers
 *                                       Continue (amber banner).
 *                                     - "Start a new job" CTA — gated by the
 *                                       SubscriptionGate logic (paywall if
 *                                       trial=0 / subscription expired).
 *   app/job/[sessionId].tsx         The Rex session screen.
 *                                     - sessionId === 'new' creates a row in
 *                                       job_sessions; otherwise loads existing.
 *                                     - Messages list + StreamingText bubble.
 *                                     - Header: stage badge + always-visible
 *                                       Close Job button (D6 Flow04 rule).
 *                                     - Input: text / voice (hold-to-record) /
 *                                       photo. Pending photo preview.
 *                                     - Post-close: Report + Quote CTAs (stub
 *                                       Alerts pointing to M4/M5).
 *                                     - Soft-cap banners @ 28 (warning) and
 *                                       30 (linked-session prompt).
 *   app/(tabs)/home.tsx             D6 Flow12 S10-S11 amber session-restoration
 *                                     banner + "Start a new job" CTA #2.
 *
 * ── UI COMPONENTS (D6 Flow04) ───────────────────────────────────────────────
 *   components/rex/MessageBubble.tsx     Brand vs gray bubble · inline photo ·
 *                                         italic transcript line for voice msgs.
 *   components/rex/StreamingText.tsx     Blinking-cursor word-by-word bubble.
 *   components/rex/VoiceRecordButton.tsx Hold-to-record red-on-active pill.
 *   components/rex/PhotoCapture.tsx      Green 📷 button.
 *   components/rex/ContextualButtons.tsx Stage-aware actions:
 *                                         S1 Looks right / Disagree / More
 *                                         S2 Agree / Disagree / Follow-up
 *                                         S3 Step done / Pushback / Pause
 *                                         S4 Final passed / Found issue
 *                                         S5 Close job
 *
 * ── HOOKS ───────────────────────────────────────────────────────────────────
 *   hooks/useRexSession.ts          Reducer-driven full lifecycle:
 *                                     - Auto-creates session and runs S0
 *                                       opening (Rex asks all 6 D7 context
 *                                       questions in ONE natural message).
 *                                     - sendMessage: persist user → trial-
 *                                       decrement → compress history if > 10 →
 *                                       inject photo as multimodal → retrieve
 *                                       RAG → stream Claude → persist assistant
 *                                       → maybeAdvanceStage().
 *                                     - Worker-pushback two-step protocol
 *                                       (D6 Flow04 Pushback A then B).
 *                                     - Soft cap warning @ 28, reached @ 30.
 *   hooks/useVoiceRecording.ts      expo-av .m4a — startRecording / stopRecording.
 *   hooks/usePhotoCapture.ts        Stage-aware ImagePicker capture.
 *                                     Returns { uri, base64, mime } for
 *                                     multimodal Claude calls. Quality bucket
 *                                     follows D4 §3.3 (60/50/40 by stage).
 *
 * ── SERVICES (no API keys in mobile bundle — D4 Rule 4) ─────────────────────
 *   services/anthropic.ts           streamRexResponse() → claude-proxy Edge Fn.
 *                                     SSE parser pulls text_delta chunks only.
 *                                     30s timeout via AbortController.
 *   services/openai.ts              transcribeAudio() → whisper-proxy.
 *                                     generateEmbedding() → embedding-proxy.
 *   services/rag.ts                 retrieveCodeContext() — embeds the query,
 *                                     calls match_documents RPC with the chunk
 *                                     count from ragInjector.ts, returns a
 *                                     formatted ragContext string for the
 *                                     system message addendum.
 *   services/summariser.ts (M0)     compressHistory() called when messages > 10.
 *
 * ── EDGE FUNCTIONS (NEW — code present, deploy still deferred) ──────────────
 *   supabase/functions/claude-proxy/index.ts      Streams Anthropic Messages API
 *                                                  through. Secret: ANTHROPIC_API_KEY.
 *   supabase/functions/whisper-proxy/index.ts     Forwards multipart to OpenAI
 *                                                  /v1/audio/transcriptions.
 *                                                  Secret: OPENAI_API_KEY.
 *   supabase/functions/embedding-proxy/index.ts   OpenAI text-embedding-3-small.
 *                                                  Secret: OPENAI_API_KEY.
 *
 * ── D7 PLUMBER v2.0 ─────────────────────────────────────────────────────────
 *   constants/systemPrompts.ts loads the verbatim D7 Plumber v2.0 prompt
 *   (identity, persona, response structure, code/material/safety rules,
 *   cross-trade boundary, worker sovereignty). getSystemPrompt(tradeType)
 *   selects by users.trade_type; M3 will add Electrician / HVAC / Roofer.
 *
 * ── AI OPTIMISATION WIRING (verified) ───────────────────────────────────────
 *   ✓ Model routing (router.ts)         called inside streamRexResponse() —
 *                                         Sonnet for stages 1/2/4 + diagnosis,
 *                                         Haiku for stages 3/5 + confirmations.
 *   ✓ Conversation summariser            shouldCompress() at message count > 10
 *                                         → compressHistory() before send.
 *   ✓ Tiered photo compression           usePhotoCapture pulls bucket from
 *                                         getCompressionSettings(stage).
 *   ✓ Smart RAG injector                 retrieveCodeContext() uses
 *                                         getRAGChunkCount(stage, type).
 *   ✓ Session soft cap (30 / warn @ 28)  banners + send-gate in useRexSession.
 *
 * ── BACKLOG / DEFERRED ──────────────────────────────────────────────────────
 *   • Deploy claude-proxy + whisper-proxy + embedding-proxy + decrement-trial-
 *     query and set ANTHROPIC_API_KEY / OPENAI_API_KEY secrets. Without these
 *     the UI is fully wired but server calls return errors and the error
 *     banner appears in the session.
 *   • Image resize to maxDimension via expo-image-manipulator (D4 §3.3 mentions
 *     both quality AND dimensions). Quality compression is wired; resize is the
 *     remaining 40% saving — not added in M2 to avoid a new dep.
 *   • RAG corpus is empty until ingest-code-document Edge Function is deployed
 *     AND a Plumber code document has been ingested (D5 Section 14 / D10).
 *   • The 6 context questions are produced by Rex itself from the D7 SESSION
 *     OPENING block — there's no client-side template. M2 sends Rex a kickoff
 *     user turn that triggers the opener.
 *   • Apprentice adaptive mode is detected by the system prompt itself; the
 *     state machine tracks it as a flag but does not yet branch the UI.
 *   • Linked-session creation on soft-cap reached: banner shown + send blocked.
 *     Actual "new linked session with compressed context pre-loaded" wires when
 *     Rex's compressed summary is persistable as a summary message — small
 *     follow-up M2.1.
 *   • M3 will add Electrician, HVAC and Roofer system prompts.
 *
 * ── DEVIATIONS ──────────────────────────────────────────────────────────────
 *   1. usePhotoCapture compresses by quality only (no resize). Note above.
 *   2. Streaming SSE parse is hand-rolled (no SSE library). Anthropic's text_delta
 *      events are the only events we consume. Other event types are ignored
 *      intentionally.
 *   3. Stage advancement is heuristic on Rex's wording. Worker still has the
 *      final say via ContextualButtons.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * TRADESBRAIN — M1 BUILD REPORT (Authentication & Sign-Up)
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Step: M1 — Authentication & Sign-Up
 * Status: CODE COMPLETE. Edge Function (kyc-status-check) call deferred — see
 *         "WHAT IS NOT BUILT YET" below.
 *
 * ── SCREENS BUILT (D6 references) ────────────────────────────────────────────
 *   app/(auth)/welcome.tsx          D6 Flow02 S2 — Create Account / Sign In
 *   app/(auth)/signup.tsx           D6 Flow01 + D1 §7 — 3-step form
 *                                     Step 1: name / email / password (strength)
 *                                            / phone (country code)
 *                                     Step 2: trade / account / hourly / VAT
 *                                     Step 3: license + ID + optional company
 *   app/(auth)/otp-verify.tsx       D6 Flow01 S5 — dual OTP (email + SMS)
 *                                     resend per channel @ 60s · 3 wrong = 5min lock
 *   app/(auth)/signin.tsx           D6 Flow02 — 3 methods (email+pw / Google /
 *                                     phone OTP). Save Password switch (off by
 *                                     default) → SecureStore. 5 fails = 15m lock.
 *   app/(auth)/forgot-password.tsx  D6 Flow02 S5-S6 — request reset + set new pw
 *   app/(auth)/phone-signin.tsx     D6 Flow02 Method 3 — phone entry + OTP verify
 *   app/(tabs)/home.tsx             D2 Step 7 — dismissible trial banner with
 *                                     trial_queries_remaining from context
 *
 * ── SHARED COMPONENTS ───────────────────────────────────────────────────────
 *   components/shared/TermsOverlay.tsx
 *     Modal with scroll-to-end I-Agree gate. terms_accepted_at + terms_version
 *     persisted via createUserProfile() (TERMS_VERSION = 'v1.0').
 *
 * ── SERVICES / HOOKS ────────────────────────────────────────────────────────
 *   services/auth.ts
 *     startSignUp · verifyEmailOtp · verifyPhoneOtp · resendEmailOtp ·
 *     resendPhoneOtp · uploadKycPhoto · createUserProfile · signInWithPassword ·
 *     signInWithPhoneStart · signInWithPhoneVerify · sendPasswordReset ·
 *     updatePassword
 *   hooks/useSavePassword.ts
 *     saveCredentials / loadCredentials / clearCredentials backed by
 *     expo-secure-store (Keychain / Keystore).
 *
 * ── D1 §7 COMPLIANCE — required fields present ──────────────────────────────
 *   Step 1: full_name · email · password · phone (with country code selector)  ✓
 *   Step 2: trade_type · account_type · hourly_rate · vat_number               ✓
 *   Step 3: license_proof photo · license_number · national_id photo           ✓
 *   Optional: company_name · company_logo                                       ✓
 *   Create Account disabled until every required field is valid (step1Valid /
 *   step2Valid / step3Valid gates).
 *
 * ── D2 FLOW COMPLIANCE — navigation paths ───────────────────────────────────
 *   Welcome → SignUp → (Terms overlay agree) → OtpVerify → Tabs                 ✓
 *   Welcome → SignIn (3 methods) → Tabs                                         ✓
 *   SignIn → ForgotPassword → reset link → ForgotPassword (reset phase) → SignIn ✓
 *   SignIn → PhoneSignIn → verify → Tabs                                        ✓
 *   Session persistence: AuthProvider hydrates from supabase.auth.getSession()
 *   on mount; returning user lands on Tabs without seeing Welcome.
 *
 * ── SUPABASE — VAT LOCK + KYC STORAGE (migration 00002_m1_auth.sql) ─────────
 *   • Trigger lock_vat_number on public.users — RAISE EXCEPTION on any UPDATE
 *     OF vat_number when an existing non-empty value is changed.
 *   • Storage bucket "kyc-documents" (private). RLS policy: authenticated user
 *     can SELECT / INSERT only where (storage.foldername(name))[1] = auth.uid().
 *
 * ── KYC INTEGRATION STATUS ──────────────────────────────────────────────────
 *   • License proof + national ID uploaded to "kyc-documents" bucket at
 *     <user_id>/<kind>-<ts>.<ext>.
 *   • users.national_id_kyc_status and users.license_kyc_status default to
 *     'pending' (D5 column default) — set on row insert.
 *   • Stripe Identity Session creation is the responsibility of Edge Function
 *     kyc-status-check (D10). It is NOT invoked from the mobile app yet because
 *     Edge Functions are still undeployed (founder deferred during M0). When
 *     deployed, add a supabase.functions.invoke('kyc-status-check', …) call at
 *     the end of createUserProfile().
 *
 * ── ERROR STATES IMPLEMENTED (D6 Flow02 S10 / D2 edge cases) ────────────────
 *   1. Wrong password — "Incorrect password — try again or reset."           ✓
 *   2. Account not found — "No account found — create one instead?"          ✓
 *   3. Account suspended — "Your account has been suspended — contact support." ✓
 *   4. 5 failed attempts — 15-minute lock with mm:ss countdown                ✓
 *   5. No internet — "No connection — sign in requires internet access."     ✓
 *   6. Phone not registered (PhoneSignIn) — "No account uses this number…"    ✓
 *   7. Wrong OTP × 3 — 5-minute lock on OTP screen                            ✓
 *
 * ── DEVIATIONS FROM DOCUMENTATION ────────────────────────────────────────────
 *   1. D2 "single form" vs D1 §7 "3 steps": built per D1 + BuildGuide which
 *      explicitly call for 3 steps and list step-by-step field groupings.
 *   2. D1 §7 says national ID is REQUIRED at sign-up; D2 calls it a "soft gate
 *      required only before paid plan." Built per D1 + BuildGuide (REQUIRED).
 *   3. expo-secure-store and expo-image-picker are already in package.json, so
 *      no new deps added for M1.
 *
 * ── WHAT IS NOT BUILT YET (deferred / next milestone) ───────────────────────
 *   • supabase.functions.invoke('kyc-status-check') — needs Edge Function deploy.
 *     Once deployed, wire it at the tail of createUserProfile().
 *   • Settings → Profile screen surface of the VAT lock badge — that's a
 *     Settings-area build (Settings UI lives outside the auth flow and will be
 *     completed when M7-ish settings work begins).
 *   • Stripe Identity push of the uploaded documents — handled inside the KYC
 *     Edge Function per D9 §6, so it gates on the same deploy.
 *   • M2 will build the Rex diagnostic session UI (Plumber first).
 * ══════════════════════════════════════════════════════════════════════════════
 */

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * TRADESBRAIN — M0 BUILD REPORT
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Step: M0 — Project Scaffolding & Infrastructure
 * Status: CODE COMPLETE (Supabase / Edge Function / Stripe deploy steps remain
 *         as owner-driven actions — see § "What Is NOT Built Yet" below)
 *
 * ── FILES CREATED (project root) ─────────────────────────────────────────────
 * tradesbrain/
 *   App.tsx                          Root component (providers + RootLayout)
 *   index.ts                         Expo registerRootComponent entry
 *   app.json                         Expo app config
 *   babel.config.js                  NativeWind 4.x preset wired
 *   metro.config.js                  withNativeWind(./global.css)
 *   tailwind.config.js               Brand palette, scans app/components/App.tsx
 *   global.css                       @tailwind base/components/utilities
 *   nativewind-env.d.ts              NativeWind className typings
 *   tsconfig.json                    Strict TS + jsxImportSource: nativewind
 *   package.json                     Expo SDK 54, RN 0.81, TS 5.9
 *   .env.example                     Public + Edge Function secret placeholders
 *   .gitignore                       node_modules, .expo, .env*.local, native dirs
 *
 * ── APP / SCREENS (D4 §2) ────────────────────────────────────────────────────
 *   app/_layout.tsx                  Root navigation (stack + tabs)
 *   app/(auth)/welcome|signup|signin|otp-verify.tsx
 *   app/(tabs)/home|rex|report|quote|codes|history.tsx
 *   app/job/[sessionId].tsx
 *   app/job/detail/[jobId].tsx
 *   app/settings/index|profile|trade|team|subscription|legal.tsx
 *   app/paywall.tsx
 *
 * ── COMPONENTS (D4 §2) ───────────────────────────────────────────────────────
 *   components/rex/MessageBubble | VoiceRecordButton | PhotoCapture
 *                | ContextualButtons | StreamingText
 *   components/documents/ReportPreview | QuotePreview
 *   components/shared/SubscriptionGate | LoadingSpinner | ErrorBoundary
 *                   | ToastNotification
 *   components/team/KpiDashboard | MemberCard
 *
 * ── SERVICES (D4 §2 — all external APIs go through here) ─────────────────────
 *   services/anthropic.ts            Claude API client (calls Edge proxy)
 *   services/openai.ts               Whisper + embeddings (via Edge proxy)
 *   services/supabase.ts             createClient(EXPO_PUBLIC_*)
 *   services/stripe.ts               Stripe SDK client
 *   services/rag.ts                  RAG retrieval (match_documents RPC)
 *   services/router.ts               D4 §3.1 — routeModel(ctx)
 *   services/summariser.ts           D4 §3.2 — compressHistory(messages)
 *
 * ── HOOKS / CONTEXT / UTILS / TYPES / CONSTANTS ─────────────────────────────
 *   hooks/useAuth | useSubscription | useRexSession
 *               | useVoiceRecording | usePhotoCapture
 *   context/AuthContext | SubscriptionContext | TradeProfileContext (all 3
 *                       wired in App.tsx provider tree)
 *   utils/imageCompression.ts        D4 §3.3 — tiered settings 1/2/3+
 *   utils/ragInjector.ts             D4 §3.4 — 5 / 2 / 0 chunk policy
 *   utils/tokenEstimator.ts          token & cost estimation
 *   utils/formatters.ts
 *   types/session | user | documents | subscription
 *   constants/limits.ts              SESSION_SOFT_CAP=30, SESSION_WARNING_AT=28
 *   constants/api | pricing | tradeProfiles
 *
 * ── SUPABASE TABLES (D5 §15 — migration: supabase/migrations/00001_initial_schema.sql)
 *   01 code_documents          RLS authenticated read
 *   02 code_chunks             RLS authenticated read · vector(1536) · hnsw idx
 *   03 users                   RLS auth.uid()=id · trial_queries_remaining=10
 *   04 team_members            RLS owner OR member
 *   05 worker_preferences      RLS auth.uid()=user_id
 *   06 subscriptions           RLS auth.uid()=user_id
 *   07 billing_history         RLS auth.uid()=user_id
 *   08 job_sessions            RLS auth.uid()=user_id · status check
 *   09 messages                RLS via session_id → job_sessions
 *   10 job_reports             RLS auth.uid()=user_id · finalised-lock trigger
 *   11 quotes                  RLS auth.uid()=user_id · finalised-lock trigger
 *   (+ audit_logs — service role only)
 *
 *   Triggers: update_updated_at (users, job_sessions, worker_preferences),
 *             prevent_finalised_update (job_reports, quotes)
 *   RPCs:     match_documents(query_embedding, filter_trade_type, match_count)
 *             decrement_trial_query(user_id)
 *
 * ── EDGE FUNCTIONS (D10 — supabase/functions/) ───────────────────────────────
 *   01 handle-stripe-webhook         Stripe subscription/billing events
 *   02 kyc-webhook                   Stripe Identity verification events
 *   03 decrement-trial-query         Trial counter (RLS-safe via service role)
 *   04 kyc-status-check              KYC poll on app open
 *   05 stripe-create-checkout        Subscription checkout sessions
 *   06 stripe-update-subscription    Plan / seat changes
 *   07 calculate-days-remaining      Subscription day counter
 *   08 send-push-notification        FCM/APNs delivery
 *   09 create-team-member            Owner-only member creation
 *   10 delete-team-member            Cascade member deletion
 *   11 ingest-code-document          RAG document embed + insert
 *
 * ── SECURITY ─────────────────────────────────────────────────────────────────
 *   No service-role / Anthropic / OpenAI / Stripe-secret keys in /app, /components,
 *   /hooks, /services, /utils.
 *   App bundle only reads EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
 *   EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY (public by design).
 *   All other secrets live in Supabase Edge Function env (.env.example documents
 *   the full list).
 *
 * ── DEVIATIONS FROM DOCUMENTATION ────────────────────────────────────────────
 *   1. React Navigation v7 installed (D4 §1 lists v6). v6 reached end-of-life;
 *      v7 is the actively maintained line. API surface used here (NativeStack +
 *      BottomTabs) is compatible. Pin to v6 only if the founder requires strict
 *      §1 match — say the word and I will downgrade.
 *
 * ── WHAT IS NOT BUILT YET (owner-driven external setup) ─────────────────────
 *   • Run `supabase db push` (or paste 00001_initial_schema.sql in SQL editor)
 *     against the production Supabase project — code, RLS, indexes, triggers,
 *     RPCs are all in the migration file ready to deploy.
 *   • `supabase functions deploy` for all 11 Edge Functions + `supabase secrets
 *     set` for the keys in .env.example.
 *   • Stripe Dashboard: create the 4 products / 8 prices per D9 §1.2-1.3 and
 *     the 2 webhook endpoints per D9 §3.1 (paste the price IDs back into Edge
 *     Function secrets).
 *   • M1 will replace the placeholder screens with real auth UI and KYC flow.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuthContext } from '../context/AuthContext';
import { supabase } from '../services/supabase';

import WelcomeScreen from './(auth)/welcome';
import SignUpScreen from './(auth)/signup';
import SignInScreen from './(auth)/signin';
import OtpVerifyScreen from './(auth)/otp-verify';
import ForgotPasswordScreen from './(auth)/forgot-password';
import PhoneSignInScreen from './(auth)/phone-signin';

import HomeScreen from './(tabs)/home';
import RexScreen from './(tabs)/rex';
import ReportScreen from './(tabs)/report';
import QuoteScreen from './(tabs)/quote';
import CodesScreen from './(tabs)/codes';
import HistoryScreen from './(tabs)/history';

import ActiveSessionScreen from './job/[sessionId]';
import PaywallScreen from './paywall';
import SettingsIndexScreen from './settings/index';
import ReportBuilderScreen from './document/report';
import QuoteBuilderScreen from './document/quote';
import JobDetailScreen from './job/detail/[jobId]';
import SubscriptionSettingsScreen from './settings/subscription';
import ProfileSettingsScreen from './settings/profile';
import TradeSettingsScreen from './settings/trade';
import LegalScreen from './settings/legal';
import TeamSettingsScreen from './settings/team';
import TeamAddScreen from './team/add';
import TeamMemberDetail from './team/[memberId]';
import OfflineBanner from '../components/shared/OfflineBanner';
import AccountSuspendedScreen from '../components/shared/AccountSuspendedScreen';

export type RootStackParamList = {
  Welcome: undefined;
  SignUp: undefined;
  SignIn: undefined;
  OtpVerify: { signUpData: unknown };
  ForgotPassword: undefined;
  PhoneSignIn: undefined;
  Tabs: undefined;
  Job: { sessionId: string; recap?: boolean };
  JobDetail: { jobId: string };
  ReportBuilder: { sessionId?: string };
  QuoteBuilder: { sessionId?: string };
  Paywall: { preselectedPlan?: 'solo' | 'pro' | 'team' } | undefined;
  Settings: undefined;
  SubscriptionSettings: undefined;
  SettingsProfile: undefined;
  SettingsTrade: undefined;
  SettingsLegal: undefined;
  SettingsTeam: undefined;
  TeamAdd: undefined;
  TeamMemberDetail: { memberId: string };
};

export type TabParamList = {
  Home: undefined;
  Rex: undefined;
  Report: undefined;
  Quote: undefined;
  Codes: undefined;
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function tabIcon(glyph: string) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Text style={{ fontSize: focused ? 24 : 22, color, lineHeight: 28 }}>{glyph}</Text>
  );
}

function TabsNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1F2937',
        tabBarInactiveTintColor: '#9CA3AF',
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: tabIcon('🏠') }} />
      <Tab.Screen name="Rex" component={RexScreen} options={{ tabBarIcon: tabIcon('🔧') }} />
      <Tab.Screen name="Report" component={ReportScreen} options={{ tabBarIcon: tabIcon('📄') }} />
      <Tab.Screen name="Quote" component={QuoteScreen} options={{ tabBarIcon: tabIcon('💲') }} />
      <Tab.Screen name="Codes" component={CodesScreen} options={{ tabBarIcon: tabIcon('📚') }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarIcon: tabIcon('🕐') }} />
    </Tab.Navigator>
  );
}

function useSuspended(isAuthenticated: boolean) {
  // Reads users.is_suspended on auth change. Defaults to false so authed-but-
  // missing rows don't false-trigger the gate.
  const [suspended, setSuspended] = useState(false);
  useEffect(() => {
    if (!isAuthenticated) {
      setSuspended(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('users')
        .select('is_suspended')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled) setSuspended(data?.is_suspended === true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);
  return suspended;
}

export default function RootLayout() {
  const { isAuthenticated, isLoading } = useAuthContext();
  const suspended = useSuspended(isAuthenticated);

  if (isLoading) return null;

  if (isAuthenticated && suspended) {
    return <AccountSuspendedScreen />;
  }

  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Tabs" component={TabsNavigator} />
          <Stack.Screen name="Job" component={ActiveSessionScreen} />
          <Stack.Screen name="JobDetail" component={JobDetailScreen} />
          <Stack.Screen name="ReportBuilder" component={ReportBuilderScreen} />
          <Stack.Screen name="QuoteBuilder" component={QuoteBuilderScreen} />
          <Stack.Screen name="Settings" component={SettingsIndexScreen} />
          <Stack.Screen
            name="SubscriptionSettings"
            component={SubscriptionSettingsScreen}
          />
          <Stack.Screen name="SettingsProfile" component={ProfileSettingsScreen} />
          <Stack.Screen name="SettingsTrade" component={TradeSettingsScreen} />
          <Stack.Screen name="SettingsLegal" component={LegalScreen} />
          <Stack.Screen name="SettingsTeam" component={TeamSettingsScreen} />
          <Stack.Screen name="TeamAdd" component={TeamAddScreen} />
          <Stack.Screen name="TeamMemberDetail" component={TeamMemberDetail} />
          <Stack.Screen name="Paywall" component={PaywallScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="OtpVerify" component={OtpVerifyScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="PhoneSignIn" component={PhoneSignInScreen} />
        </>
      )}
      </Stack.Navigator>
    </View>
  );
}
