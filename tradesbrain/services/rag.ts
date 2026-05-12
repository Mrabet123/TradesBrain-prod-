// services/rag.ts — RAG retrieval via Supabase pgvector match_documents RPC.
// Top-N chunk count is picked by utils/ragInjector.ts (5 stage 1-2, 2 stage 3-5,
// 0 for reports/quotes — D4 §3.4).

import { supabase } from './supabase';
import { generateEmbedding } from './openai';
import { getRAGChunkCount } from '../utils/ragInjector';

interface MatchRow {
  id: string;
  content: string;
  section_number: string | null;
  document_name: string;
  version: string;
  similarity: number;
}

export async function retrieveCodeContext(
  queryText: string,
  tradeType: string,
  stage: number,
  messageType: string,
): Promise<{ chunks: MatchRow[]; ragContext: string }> {
  const matchCount = getRAGChunkCount(stage, messageType);
  if (matchCount === 0) return { chunks: [], ragContext: '' };

  const embedding = await generateEmbedding(queryText);
  if (!embedding) return { chunks: [], ragContext: '' };

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    filter_trade_type: tradeType,
    match_count: matchCount,
  });

  if (error || !data) return { chunks: [], ragContext: '' };

  const chunks = data as MatchRow[];
  const ragContext = chunks
    .map(
      (c) =>
        `[${c.document_name} ${c.version}${c.section_number ? ' §' + c.section_number : ''}]\n${c.content}`,
    )
    .join('\n\n');

  return { chunks, ragContext };
}
