// claude-proxy — proxies Anthropic Messages API streaming responses.
// Required because mobile bundle must never carry ANTHROPIC_API_KEY (D4 Rule).
// Deploy with: supabase functions deploy claude-proxy
// Secrets: ANTHROPIC_API_KEY

// @ts-ignore — Deno globals available in Supabase Edge Functions runtime
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // @ts-ignore Deno
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return new Response('Missing ANTHROPIC_API_KEY', { status: 500 });

  const body = await req.json();
  const upstream = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  // Pass through streaming SSE
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...corsHeaders(),
      'Content-Type': upstream.headers.get('Content-Type') ?? 'text/event-stream',
    },
  });
});

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
