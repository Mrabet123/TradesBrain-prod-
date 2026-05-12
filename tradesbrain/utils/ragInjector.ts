// D4 Section 3.4 — Smart RAG Injection

export function getRAGChunkCount(stage: number, messageType: string): number {
  if (messageType === 'report' || messageType === 'quote') return 0;
  if (stage <= 2) return 5; // diagnosis — full context
  return 2; // execution — minimal context
}
