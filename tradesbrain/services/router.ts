// D4 Section 3.1 — Model Router
// First function called in every Claude API request

type MessageContext = {
  sessionStage: 1 | 2 | 3 | 4 | 5;
  messageType: 'diagnosis' | 'confirmation' | 'formatting' | 'summary' | 'lookup';
};

export function routeModel(ctx: MessageContext): string {
  // Sonnet 4.5 — complex reasoning
  if (ctx.sessionStage <= 2) return 'claude-sonnet-4-5-20250929';
  if (ctx.sessionStage === 4) return 'claude-sonnet-4-5-20250929';
  if (ctx.messageType === 'lookup') return 'claude-sonnet-4-5-20250929';
  if (ctx.messageType === 'diagnosis') return 'claude-sonnet-4-5-20250929';

  // Haiku — formatting and confirmations (~15x cheaper)
  return 'claude-haiku-4-5-20251001';
}
