// services/payments.ts — Stripe PaymentSheet integration (D9 / BuildGuide M6).
// All Stripe secrets stay on the server. Mobile only:
//   1. POST to stripe-create-checkout (subscription with default_incomplete)
//   2. initPaymentSheet({ customerId, customerEphemeralKeySecret, paymentIntentClientSecret })
//   3. presentPaymentSheet()
//   4. On success → optimistic activation. Webhook fills the truth in <2s.

import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { initiateCheckout, updateSubscription } from './stripe';

export type PlanType = 'solo' | 'pro' | 'team';
export type BillingCycle = 'monthly' | 'annual';

export interface CheckoutResult {
  ok: boolean;
  /** When ok=false, the reason — used by paywall to show specific UI. */
  reason?: 'kyc_required' | 'already_subscribed' | 'declined' | 'network' | 'unknown';
  message?: string;
}

const MERCHANT_DISPLAY_NAME = 'TradesBrain';

export async function purchaseSubscription(
  plan: PlanType,
  cycle: BillingCycle,
): Promise<CheckoutResult> {
  // Step 1 — server-side: customer + subscription(incomplete) + payment intent.
  const checkout = await initiateCheckout(plan, cycle);
  if (!checkout.success) {
    const err = checkout.error ?? '';
    if (err.includes('kyc_required')) return { ok: false, reason: 'kyc_required' };
    if (err.includes('already_subscribed')) return { ok: false, reason: 'already_subscribed' };
    if (/network|fetch|failed to fetch/i.test(err))
      return { ok: false, reason: 'network', message: err };
    return { ok: false, reason: 'unknown', message: err };
  }

  const data = checkout.data ?? {};
  const clientSecret: string | undefined = data.client_secret;
  const ephemeralKey: string | undefined = data.ephemeral_key;
  const customerId: string | undefined = data.customer_id;

  if (!clientSecret || !ephemeralKey || !customerId) {
    return { ok: false, reason: 'unknown', message: 'Incomplete checkout payload' };
  }

  // Step 2 — initialise PaymentSheet
  const init = await initPaymentSheet({
    merchantDisplayName: MERCHANT_DISPLAY_NAME,
    customerId,
    customerEphemeralKeySecret: ephemeralKey,
    paymentIntentClientSecret: clientSecret,
    allowsDelayedPaymentMethods: false,
    applePay: { merchantCountryCode: 'US' },
    googlePay: { merchantCountryCode: 'US', testEnv: true },
  });
  if (init.error) {
    return { ok: false, reason: 'unknown', message: init.error.message };
  }

  // Step 3 — present sheet
  const present = await presentPaymentSheet();
  if (present.error) {
    const msg = present.error.message ?? '';
    if (present.error.code === 'Canceled') {
      return { ok: false, reason: 'unknown', message: 'Cancelled' };
    }
    if (/declined|card_declined/i.test(msg)) return { ok: false, reason: 'declined', message: msg };
    return { ok: false, reason: 'unknown', message: msg };
  }

  return { ok: true };
}

// Wrappers around stripe-update-subscription Edge Function:
export async function switchBillingCycle(cycle: BillingCycle) {
  return updateSubscription('switch_billing_cycle', { billing_cycle: cycle });
}

export async function changePlan(plan: PlanType) {
  return updateSubscription('change_plan', { plan_type: plan });
}

export async function cancelSubscription() {
  return updateSubscription('cancel');
}

export async function restoreSubscription() {
  return updateSubscription('restore');
}
