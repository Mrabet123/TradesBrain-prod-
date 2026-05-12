export const TRADE_TYPES = ['plumber', 'electrician', 'hvac', 'roofer', 'other'] as const;
export type TradeType = typeof TRADE_TYPES[number];

export const TRADE_LABELS: Record<TradeType, string> = {
  plumber: 'Plumber',
  electrician: 'Electrician',
  hvac: 'HVAC Technician',
  roofer: 'Roofer',
  other: 'Other Trade',
};

export const SYSTEM_PROMPT_KEYS: Record<TradeType, string> = {
  plumber: 'rex_plumber_v2',
  electrician: 'rex_electrician_v2',
  hvac: 'rex_hvac_v2',
  roofer: 'rex_roofer_v2',
  other: 'rex_general_v2',
};
