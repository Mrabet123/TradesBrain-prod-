// D2 F7 / D3 F6 — Subscription context.
// Reads users.subscription_status, plan_type, trial_queries_remaining,
// subscription_end_date and refreshes on auth change.
// Exposes optimisticActivate() which the paywall calls immediately after
// PaymentSheet returns success (BuildGuide M6 RULE 6). The webhook overwrites
// with truth within seconds.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { useAuthContext } from './AuthContext';
import { supabase } from '../services/supabase';

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';
export type PlanType = 'solo' | 'pro' | 'team' | null;

interface SubscriptionContextType {
  subscriptionStatus: SubscriptionStatus;
  planType: PlanType;
  trialQueriesRemaining: number;
  subscriptionEndDate: string | null;
  refreshSubscription: () => Promise<void>;
  decrementTrialQuery: () => void;
  optimisticActivate: (plan: Exclude<PlanType, null>) => void;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscriptionStatus: 'trial',
  planType: null,
  trialQueriesRemaining: 10,
  subscriptionEndDate: null,
  refreshSubscription: async () => {},
  decrementTrialQuery: () => {},
  optimisticActivate: () => {},
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuthContext();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('trial');
  const [planType, setPlanType] = useState<PlanType>(null);
  const [trialQueriesRemaining, setTrialQueriesRemaining] = useState(10);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null);

  const refreshSubscription = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('users')
      .select(
        'subscription_status, plan_type, trial_queries_remaining, subscription_end_date',
      )
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setSubscriptionStatus(data.subscription_status as SubscriptionStatus);
      setPlanType(data.plan_type as PlanType);
      setTrialQueriesRemaining(data.trial_queries_remaining);
      setSubscriptionEndDate(data.subscription_end_date);
    }
  }, [user]);

  const decrementTrialQuery = useCallback(() => {
    setTrialQueriesRemaining((prev) => Math.max(prev - 1, 0));
  }, []);

  // BuildGuide M6 RULE 6 — optimistic activation immediately after PaymentSheet
  // success. Webhook reconciles within seconds.
  const optimisticActivate = useCallback((plan: Exclude<PlanType, null>) => {
    setSubscriptionStatus('active');
    setPlanType(plan);
  }, []);

  useEffect(() => {
    if (isAuthenticated) refreshSubscription();
  }, [isAuthenticated, user?.id, refreshSubscription]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscriptionStatus,
        planType,
        trialQueriesRemaining,
        subscriptionEndDate,
        refreshSubscription,
        decrementTrialQuery,
        optimisticActivate,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscriptionContext = () => useContext(SubscriptionContext);
export default SubscriptionContext;
