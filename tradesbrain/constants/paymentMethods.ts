// D3 F3 / BuildGuide M3 RULE 6 — payment methods exactly six, multi-select.

export const PAYMENT_METHODS = [
  'Cash',
  'Bank transfer',
  'Bank direct debit',
  'Cheque',
  'Online payment link',
  'To be agreed',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// D3 F2 / D3 F3 — default section lists. Saved per user per document_type in
// worker_preferences after the first generation.
export const DEFAULT_REPORT_SECTIONS = [
  'Job description',
  'Work carried out',
  'Materials used',
  'Time on site',
  'Recommendations',
  'Photo documentation',
] as const;

export const DEFAULT_QUOTE_SECTIONS = [
  'Line items',
  'Labour',
  'Materials',
  'Payment terms',
  'Payment method',
  'Validity period',
  'Notes',
] as const;

export const DEFAULT_VALIDITY_DAYS = 30;
