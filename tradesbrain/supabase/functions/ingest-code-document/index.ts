// ingest-code-document — F4 RAG pipeline (D10 + D4 §6.4).
// Accepts plain-text content for now (PDF parsing is upstream). Splits into
// ~500-word chunks with 50-word overlap, generates OpenAI embeddings, and
// inserts rows into code_chunks + a code_documents row.
//
// Deploy with: supabase functions deploy ingest-code-document
// Secrets: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// POST body:
//   {
//     "document_name": "International Plumbing Code",
//     "short_name":    "IPC",
//     "version":       "2021",
//     "trade_type":    "plumber",
//     "source_url":    "https://...",          // optional
//     "ingested_by":   "admin",                 // optional
//     "content":       "<full plain text>"
//   }

// @ts-ignore — Deno globals
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore — ESM via Deno
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// @ts-ignore Deno
const supabase = createClient(
  // @ts-ignore Deno
  Deno.env.get('SUPABASE_URL')!,
  // @ts-ignore Deno
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);
// @ts-ignore Deno
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

async function embed(text: string): Promise<number[]> {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: text, model: 'text-embedding-3-small' }),
  });
  const d = await r.json();
  return d?.data?.[0]?.embedding ?? [];
}

function chunkText(text: string, size = 500, overlap = 50): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    out.push(words.slice(i, i + size).join(' '));
    if (i + size >= words.length) break;
  }
  return out;
}

// Heuristic section number extraction: scans the chunk for the first
// occurrence of something like "Section 704.1" or "§ 704.1" or a leading
// numeric heading like "704.1 ".
function extractSection(text: string): string | null {
  const m =
    text.match(/Section\s+(\d+(?:\.\d+)+)/i) ??
    text.match(/§\s*(\d+(?:\.\d+)+)/) ??
    text.match(/^(\d+(?:\.\d+)+)\s/m);
  return m?.[1] ?? null;
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...cors(), 'Content-Type': 'application/json' },
    });
  }

  const required = ['document_name', 'trade_type', 'content'];
  for (const k of required) {
    if (!body[k]) {
      return new Response(JSON.stringify({ error: `Missing field: ${k}` }), {
        status: 400,
        headers: { ...cors(), 'Content-Type': 'application/json' },
      });
    }
  }

  const { data: doc, error: docErr } = await supabase
    .from('code_documents')
    .insert({
      document_name: body.document_name,
      short_name: body.short_name ?? body.document_name,
      version: body.version ?? '1.0',
      trade_type: body.trade_type,
      source_url: body.source_url ?? null,
      chunk_count: 0,
      ingested_by: body.ingested_by ?? 'admin',
    })
    .select()
    .single();

  if (docErr || !doc) {
    return new Response(
      JSON.stringify({ error: 'code_documents insert failed', detail: docErr?.message }),
      { status: 500, headers: { ...cors(), 'Content-Type': 'application/json' } },
    );
  }

  const chunks = chunkText(body.content);
  let inserted = 0;
  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const embedding = await embed(content);
    if (embedding.length === 0) continue;
    const sectionNumber = extractSection(content);
    const { error: insErr } = await supabase.from('code_chunks').insert({
      document_id: doc.id,
      trade_type: body.trade_type,
      document_name: body.document_name,
      version: body.version ?? '1.0',
      section_number: sectionNumber,
      page_number: i + 1,
      content,
      embedding,
    });
    if (!insErr) inserted++;
  }

  await supabase
    .from('code_documents')
    .update({ chunk_count: inserted })
    .eq('id', doc.id);

  return new Response(
    JSON.stringify({ success: true, document_id: doc.id, chunks_created: inserted }),
    { status: 201, headers: { ...cors(), 'Content-Type': 'application/json' } },
  );
});
