export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateImageTokens(width: number, height: number): number {
  const tiles = Math.ceil(width / 512) * Math.ceil(height / 512);
  return tiles * 170 + 85;
}

export function estimateMessageCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  if (model.includes('haiku')) {
    return (inputTokens * 0.25 + outputTokens * 1.25) / 1_000_000;
  }
  return (inputTokens * 3 + outputTokens * 15) / 1_000_000;
}
