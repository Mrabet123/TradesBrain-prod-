export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

export const EDGE_FUNCTION_URLS = {
  handleStripeWebhook: `${SUPABASE_URL}/functions/v1/handle-stripe-webhook`,
  kycStatusCheck: `${SUPABASE_URL}/functions/v1/kyc-status-check`,
  decrementTrialQuery: `${SUPABASE_URL}/functions/v1/decrement-trial-query`,
  kycWebhook: `${SUPABASE_URL}/functions/v1/kyc-webhook`,
  stripeCreateCheckout: `${SUPABASE_URL}/functions/v1/stripe-create-checkout`,
  stripeUpdateSubscription: `${SUPABASE_URL}/functions/v1/stripe-update-subscription`,
  createTeamMember: `${SUPABASE_URL}/functions/v1/create-team-member`,
  deleteTeamMember: `${SUPABASE_URL}/functions/v1/delete-team-member`,
  calculateDaysRemaining: `${SUPABASE_URL}/functions/v1/calculate-days-remaining`,
  sendPushNotification: `${SUPABASE_URL}/functions/v1/send-push-notification`,
  ingestCodeDocument: `${SUPABASE_URL}/functions/v1/ingest-code-document`,
} as const;
