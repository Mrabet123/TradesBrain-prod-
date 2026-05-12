export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  planType: 'solo' | 'pro' | 'team';
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  seatCount: number;
  monthlyAmount: number;
  billingCycle: 'monthly' | 'annual';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  createdAt: string;
}

export interface BillingHistoryEntry {
  id: string;
  userId: string;
  subscriptionId: string;
  stripeInvoiceId: string;
  amountPaid: number;
  planType: string;
  seatCount: number;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  invoicePdfUrl: string | null;
  paidAt: string;
}
