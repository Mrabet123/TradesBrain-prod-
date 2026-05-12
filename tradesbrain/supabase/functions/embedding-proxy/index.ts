// embedding-proxy — proxies OpenAI text-embedding-3-small.
// Deploy with: supabase functions deploy embedding-proxy
// Secrets: OPENAI_API_KEY

// @ts-ignore — Deno globals available in Supabase Edge Functions runtime
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // @ts-ignore Deno
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return new Response('Missing OPENAI_API_KEY', { status: 500 });

  const body = await req.json();
  const upstream = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: body.input,
      model: body.model ?? 'text-embedding-3-small',
    }),
  });

  const data = await upstream.json();
  const embedding = data?.data?.[0]?.embedding ?? null;

  return new Response(JSON.stringify({ embedding }), {
    status: upstream.status,
    headers: { ...cors(), 'Content-Type': 'application/json' },
  });
});

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}
