// services/anthropic.ts — Claude API client (via Edge Function proxy).
// D4 Rule 4: ANTHROPIC_API_KEY never appears in the mobile bundle. All calls
// go through supabase functions/claude-proxy. Streaming SSE response is parsed
// for text_delta chunks and forwarded to onChunk.

import { supabase } from './supabase';
import { routeModel } from './router';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
      >;
}

export interface RexPayload {
  systemPrompt: string;
  messages: ClaudeMessage[];
  sessionStage: 1 | 2 | 3 | 4 | 5;
  messageType: 'diagnosis' | 'confirmation' | 'formatting' | 'summary' | 'lookup';
  ragContext?: string;
  maxTokens?: number;
}

export interface StreamResult {
  ok: boolean;
  fullText: string;
  modelUsed: string;
  error?: string;
}

const TIMEOUT_MS = 30000;

export async function streamRexResponse(
  payload: RexPayload,
  onChunk: (text: string) => void,
): Promise<StreamResult> {
  const model = routeModel({
    sessionStage: payload.sessionStage,
    messageType: payload.messageType,
  });

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/claude-proxy`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // React Native fetch on iOS does not reliably expose response.body as a
  // ReadableStream, so SSE getReader() silently drops chunks. Use a buffered
  // request and emit the full text in one onChunk call. The UI still shows a
  // streaming bubble; it just fills in at once instead of typewriter-style.
  let fullText = '';
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token ?? ''}`,
      },
      body: JSON.stringify({
        model,
        system:
          payload.systemPrompt +
          (payload.ragContext
            ? `\n\nRELEVANT CODE REFERENCES:\n${payload.ragContext}`
            : ''),
        messages: payload.messages,
        max_tokens: payload.maxTokens ?? 2000,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, fullText, modelUsed: model, error: `HTTP ${response.status}: ${errText}` };
    }

    const body = await response.json();
    const blocks = Array.isArray(body?.content) ? body.content : [];
    fullText = blocks
      .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text as string)
      .join('');

    if (!fullText) {
      return { ok: false, fullText, modelUsed: model, error: 'Empty response from Claude' };
    }
    onChunk(fullText);
    return { ok: true, fullText, modelUsed: model };
  } catch (e: any) {
    return { ok: false, fullText, modelUsed: model, error: e?.message ?? String(e) };
  } finally {
    clearTimeout(timer);
  }
}
