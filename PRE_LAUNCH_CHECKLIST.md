# TradesBrain — Pre-Launch Checklist (M11)

This is the single document the team works through before shipping v1.0. It
collects everything that's currently *code-complete but deferred to deploy
time* and walks you through the exact order to bring it live.

> All file paths are relative to `tradesbrain/`.

---

## 1. Local prerequisites

```powershell
# One-time per machine
npm install -g supabase
npx expo install                                # ensures every dep in package.json resolves
npx expo install @react-native-community/netinfo expo-image-manipulator \
                  expo-print expo-sharing       @react-native-async-storage/async-storage
```

The bare-minimum dev environment:

- Node 20+
- Xcode 16+ (Mac) for iOS / Android Studio for Android
- An EAS account if you intend to ship builds (optional for local testing)

---

## 2. Supabase project

### 2.1 Create the project + push all migrations

```powershell
supabase login
supabase link --project-ref <your-project-ref>

# Pushes 00001 → 00005 in order
supabase db push
```

After push, in Supabase Dashboard → Table Editor confirm:

- [ ] All 11 D5 tables present (+ `audit_logs`)
- [ ] RLS green-shield on every table
- [ ] `kyc-documents` and `job-documents` storage buckets exist (private)
- [ ] `users.is_suspended` column present (default false)
- [ ] `match_documents` and `decrement_trial_query` RPC functions exist

### 2.2 Auth provider configuration

In Supabase Dashboard → Authentication:

- [ ] **Email** provider enabled with OTP/confirmation
- [ ] **Phone** provider enabled — Twilio / MessageBird credentials set so the dual-OTP signup actually delivers an SMS
- [ ] **Google OAuth** client configured (client ID + secret)
- [ ] Site URL set to `tradesbrain://`
- [ ] Password-reset redirect set to `tradesbrain://auth-callback`

---

## 3. Edge Functions (all 14 — 11 from D10 + 3 proxies)

### 3.1 Set secrets

```powershell
supabase secrets set `
  ANTHROPIC_API_KEY=sk-ant-... `
  OPENAI_API_KEY=sk-... `
  STRIPE_SECRET_KEY=sk_test_or_live_... `
  STRIPE_WEBHOOK_SECRET=whsec_... `
  STRIPE_IDENTITY_WEBHOOK_SECRET=whsec_... `
  RESEND_API_KEY=re_... `
  SUPABASE_SERVICE_ROLE_KEY=eyJ... `
  APP_URL=https://tradesbrain.app
```

### 3.2 Deploy

```powershell
# D10 set
supabase functions deploy handle-stripe-webhook
supabase functions deploy kyc-webhook
supabase functions deploy decrement-trial-query
supabase functions deploy kyc-status-check
supabase functions deploy stripe-create-checkout
supabase functions deploy stripe-update-subscription
supabase functions deploy calculate-days-remaining
supabase functions deploy send-push-notification
supabase functions deploy create-team-member
supabase functions deploy delete-team-member
supabase functions deploy ingest-code-document

# M2 / M3 / M7 additions
supabase functions deploy claude-proxy
supabase functions deploy whisper-proxy
supabase functions deploy embedding-proxy
supabase functions deploy delete-account
```

After deploy, every function should show **Active** in Supabase Dashboard →
Edge Functions.

---

## 4. Stripe — D9 §10 Dashboard Setup Checklist

Run through these in the Stripe Dashboard before flipping to live mode. The 20
items map to D9 §10. Tick each as you complete it.

### Products & prices (8 prices total — D9 §1.2-1.3)

- [ ] **Solo** product → monthly price $69.00
- [ ] **Solo** product → annual price (12 × $55.20 = $662.40)
- [ ] **Pro** product → monthly price $120.00
- [ ] **Pro** product → annual price (12 × $96.00 = $1152.00)
- [ ] **Team Base** product → monthly price $260.00
- [ ] **Team Base** product → annual price (12 × $208.00 = $2496.00)
- [ ] **Team Seat** product → monthly price $89.00
- [ ] **Team Seat** product → annual price (12 × $71.20 = $854.40)

Copy each price ID into Edge Function secrets:

```powershell
supabase secrets set `
  STRIPE_PRICE_SOLO_MONTHLY=price_... `
  STRIPE_PRICE_SOLO_ANNUAL=price_... `
  STRIPE_PRICE_PRO_MONTHLY=price_... `
  STRIPE_PRICE_PRO_ANNUAL=price_... `
  STRIPE_PRICE_TEAM_MONTHLY=price_... `
  STRIPE_PRICE_TEAM_ANNUAL=price_... `
  STRIPE_PRICE_SEAT_MONTHLY=price_... `
  STRIPE_PRICE_SEAT_ANNUAL=price_...
```

### Webhooks (D9 §3.1)

- [ ] Endpoint #1 → `https://<project-ref>.supabase.co/functions/v1/handle-stripe-webhook`
      Events: `customer.subscription.created`, `customer.subscription.updated`,
              `customer.subscription.deleted`, `invoice.payment_succeeded`,
              `invoice.payment_failed`
- [ ] Endpoint #2 → `https://<project-ref>.supabase.co/functions/v1/kyc-webhook`
      Events: `identity.verification_session.verified`,
              `identity.verification_session.requires_input`,
              `identity.verification_session.processing`

Copy the signing secret of each endpoint into the matching Edge Function secret
above (`STRIPE_WEBHOOK_SECRET` / `STRIPE_IDENTITY_WEBHOOK_SECRET`).

### Stripe Identity

- [ ] Identity enabled in Dashboard → Identity
- [ ] Test verification with your own ID document (test mode)
- [ ] Switch to live mode and repeat with a real ID document

### Live mode flip (last)

- [ ] All test cards work in test mode end-to-end
- [ ] Real test purchase with a personal card on **live** keys
- [ ] Webhook in live mode receives `invoice.payment_succeeded` → DB
      `subscription_status='active'`

---

## 5. RAG ingestion

Run once per code document. The function expects pre-parsed plain text.

```powershell
$ANON = (supabase status | Select-String "anon key:").ToString().Split(":")[1].Trim()

curl -X POST `
  "https://<project-ref>.supabase.co/functions/v1/ingest-code-document" `
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" `
  -H "Content-Type: application/json" `
  -d '{
    "trade_type":"plumber",
    "document_name":"International Plumbing Code",
    "short_name":"IPC", "version":"2021",
    "content":"<full plain text>"
  }'
```

- [ ] IPC 2021 ingested → `code_chunks.trade_type='plumber'`
- [ ] NEC 2023 ingested → `code_chunks.trade_type='electrician'`
- [ ] IMC 2021 ingested → `code_chunks.trade_type='hvac'`
- [ ] ASHRAE 90.1 ingested → `code_chunks.trade_type='hvac'`
- [ ] IBC 2021 Ch. 15 ingested → `code_chunks.trade_type='roofer'`

Test query per trade: search a known topic and confirm `match_documents`
returns the expected document.

---

## 6. Mobile environment + EAS

### 6.1 .env

```text
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon>
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 6.2 App Store assets

- [ ] App icon 1024×1024 PNG (no transparency)
- [ ] Splash 1242×2436 PNG
- [ ] iOS screenshots 6.5" (3-10 images)
- [ ] Android screenshots phone + tablet (3-8 images)
- [ ] Privacy labels filled in App Store Connect
- [ ] App description, keywords, support URL
- [ ] Privacy Policy URL live at `tradesbrain.app/legal`

### 6.3 EAS build

```powershell
eas build:configure
eas build -p ios --profile production
eas build -p android --profile production
eas submit -p ios
eas submit -p android
```

- [ ] iOS binary uploaded to App Store Connect
- [ ] Android binary uploaded to Play Console
- [ ] TestFlight / internal track invitees received

---

## 7. D8 Test Plan — 232 cases

Track progress in a spreadsheet keyed by `TC-XXX`. The categories:

| Section | Theme |
|---|---|
| A | Auth (sign-up, sign-in, OTP, KYC) |
| B | Rex diagnostic |
| C | Reports |
| D | Quotes |
| E | Codes lookup |
| F | History |
| G | Subscription |
| H | Profile / Settings |
| I | Team management |
| J | Security |

Rules per BuildGuide M11:
- Every fix must reference the failing `TC-XXX`.
- Every fix retests the affected feature for regressions.
- No new features in this step.

---

## 8. Post-launch monitoring

- [ ] Stripe Dashboard → Failed payments alert email
- [ ] Supabase Dashboard → Logs explorer for Edge Function errors
- [ ] Resend Dashboard → email delivery monitoring (sign-up + invoice receipts)
- [ ] App Store Connect / Play Console → crash reports

---

## 9. Open deviations carried over from M0-M10

Tracked here so the team knows what's intentionally not in v1.0:

| Deviation | Source | Owner action |
|---|---|---|
| React Navigation v7 (D4 §1 says v6) | M0 | Downgrade if strict match required |
| Voice / Rex / Codes depend on proxy Edge Functions | M2+ | Deploy per §3 above |
| expo-print used instead of `react-pdf` for PDFs (D4 §1) | M3 | Behaviour identical; no action |
| Long-press to delete team member (D6 calls for swipe) | M8 | Swap to `Swipeable` from react-native-gesture-handler when ready |
| `is_suspended` set manually via admin tool | M10 | Build admin UI later |
| Force-upgrade min_version not auto-fetched | M10 | Add `app_config` table + query |
| 6 push notification types not yet wired on the client | M6 / M10 | Add `expo-notifications` registration + token sync |
| Stripe Customer Portal "Manage payment method" button | M6 | Add `stripe-portal-session` Edge Function |

---

## 10. Final gate

When every item above is checked, run the M11 commit and tag:

```powershell
git commit -am "M11: Full QA pass complete — TradesBrain v1.0 ready for launch"
git tag v1.0.0
git push origin v1.0.0
```
