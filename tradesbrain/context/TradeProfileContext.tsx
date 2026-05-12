import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuthContext } from './AuthContext';
import { supabase } from '../services/supabase';

interface TradeProfileContextType {
  tradeType: string;
  hourlyRate: number;
  systemPromptKey: string;
  refreshProfile: () => Promise<void>;
}

const TradeProfileContext = createContext<TradeProfileContextType>({
  tradeType: '',
  hourlyRate: 0,
  systemPromptKey: '',
  refreshProfile: async () => {},
});

export function TradeProfileProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuthContext();
  const [tradeType, setTradeType] = useState('');
  const [hourlyRate, setHourlyRate] = useState(0);
  const [systemPromptKey, setSystemPromptKey] = useState('');

  const refreshProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('users')
      .select('trade_type, hourly_rate')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      setTradeType(data.trade_type);
      setHourlyRate(Number(data.hourly_rate));
      setSystemPromptKey(`rex_${data.trade_type}_v2`);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshProfile();
    }
  }, [isAuthenticated, user?.id]);

  return (
    <TradeProfileContext.Provider value={{ tradeType, hourlyRate, systemPromptKey, refreshProfile }}>
      {children}
    </TradeProfileContext.Provider>
  );
}

export const useTradeProfileContext = () => useContext(TradeProfileContext);
export default TradeProfileContext;
