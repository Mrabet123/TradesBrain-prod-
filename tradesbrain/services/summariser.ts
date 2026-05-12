// D4 Section 3.2 — Conversation Summariser
// Triggered when message count exceeds 10

import { Message } from '../types/session';

interface CompressedHistory {
  summary: string;
  recentMessages: Message[];
}

export async function compressHistory(messages: Message[]): Promise<CompressedHistory> {
  const toCompress = messages.slice(0, -3);
  const recent = messages.slice(-3);

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/claude-proxy`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        system: 'Summarise this job site conversation in 3-5 sentences. Preserve all technical details, measurements, and decisions.',
        messages: toCompress.map(m => ({ role: m.role, content: m.contentText ?? '' })),
        max_tokens: 800,
      }),
    }
  );

  const data = await response.json();
  const summary = data?.content?.[0]?.text ?? 'Session summary unavailable.';

  return { summary, recentMessages: recent };
}

export function shouldCompress(messageCount: number): boolean {
  return messageCount > 10;
}
