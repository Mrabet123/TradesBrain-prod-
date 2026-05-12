// D9 Section 1.3 — Stripe pricing
export const PRICING = {
  solo: { monthly: 69.00, annual: 662.40, monthlyEquivalent: 55.20 },
  pro: { monthly: 120.00, annual: 1152.00, monthlyEquivalent: 96.00 },
  team: { monthly: 260.00, annual: 2496.00, monthlyEquivalent: 208.00 },
  seat: { monthly: 89.00, annual: 854.40, monthlyEquivalent: 71.20 },
} as const;

export const PLAN_FEATURES = {
  solo: { queries: 'Unlimited', reports: true, quotes: true, codeLookup: true, team: false },
  pro: { queries: 'Unlimited', reports: true, quotes: true, codeLookup: true, team: false },
  team: { queries: 'Unlimited', reports: true, quotes: true, codeLookup: true, team: true },
} as const;
