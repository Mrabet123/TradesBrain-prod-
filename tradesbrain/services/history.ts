// services/history.ts — Job History & Archive (D3 F5 / BuildGuide M5).
// fetchHistorySessions filters to confirmed-closed jobs only (status in
// ('completed','reopened') AND at least one finalised report or quote — D3 F5
// LOCKED RULE).
//
// deleteSessionCascade removes the job_sessions row (FKs cascade messages /
// job_reports / quotes via D5 schema) AND wipes any PDFs from the
// job-documents storage bucket. Photos referenced by message.photo_url are
// stored only by URI; nothing to clean up in remote storage for those.

import { supabase } from './supabase';

export interface HistoryJob {
  id: string;
  jobName: string | null;
  jobsite: string | null;
  tradeType: string;
  status: 'completed' | 'reopened';
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  messageCount: number;
  reportCount: number;
  quoteCount: number;
}

export interface DocVersion {
  id: string;
  versionNumber: number;
  status: 'draft' | 'finalised';
  pdfUrl: string | null;
  createdAt: string;
}

export interface MessageRow {
  id: string;
  role: 'user' | 'assistant';
  contentText: string | null;
  photoUrl: string | null;
  transcriptOriginal: string | null;
  transcriptEdited: string | null;
  sessionStage: number | null;
  isSummary: boolean;
  createdAt: string;
}

// ── Fetch + search ──────────────────────────────────────────────────────────
export async function fetchHistorySessions(
  userId: string,
  search: string,
): Promise<HistoryJob[]> {
  let query = supabase
    .from('job_sessions')
    .select(
      'id, job_name, jobsite, trade_type, status, created_at, updated_at, closed_at, message_count, job_reports!left(id, status), quotes!left(id, status)',
    )
    .eq('user_id', userId)
    .in('status', ['completed', 'reopened'])
    .order('updated_at', { ascending: false });

  if (search.trim()) {
    const s = `%${search.trim()}%`;
    query = query.or(`job_name.ilike.${s},jobsite.ilike.${s}`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  return data
    .map((row: any) => {
      const reports = (row.job_reports ?? []).filter((r: any) => r.status === 'finalised');
      const quotes = (row.quotes ?? []).filter((q: any) => q.status === 'finalised');
      return {
        id: row.id,
        jobName: row.job_name,
        jobsite: row.jobsite,
        tradeType: row.trade_type,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        closedAt: row.closed_at,
        messageCount: row.message_count,
        reportCount: reports.length,
        quoteCount: quotes.length,
      };
    })
    .filter((j) => j.reportCount + j.quoteCount > 0);
}

// ── Job Detail ──────────────────────────────────────────────────────────────
export async function fetchSessionDetail(jobId: string): Promise<HistoryJob | null> {
  const { data } = await supabase
    .from('job_sessions')
    .select(
      'id, job_name, jobsite, trade_type, status, created_at, updated_at, closed_at, message_count, job_reports!left(id, status), quotes!left(id, status)',
    )
    .eq('id', jobId)
    .single();
  if (!data) return null;
  const reports = ((data as any).job_reports ?? []).filter((r: any) => r.status === 'finalised');
  const quotes = ((data as any).quotes ?? []).filter((q: any) => q.status === 'finalised');
  return {
    id: data.id,
    jobName: data.job_name,
    jobsite: data.jobsite,
    tradeType: data.trade_type,
    status: data.status as 'completed' | 'reopened',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    closedAt: data.closed_at,
    messageCount: data.message_count,
    reportCount: reports.length,
    quoteCount: quotes.length,
  };
}

export async function fetchMessages(sessionId: string): Promise<MessageRow[]> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (!data) return [];
  return data.map((m: any) => ({
    id: m.id,
    role: m.role,
    contentText: m.content_text,
    photoUrl: m.photo_url,
    transcriptOriginal: m.transcript_original,
    transcriptEdited: m.transcript_edited,
    sessionStage: m.session_stage,
    isSummary: m.is_summary,
    createdAt: m.created_at,
  }));
}

export async function fetchReportVersions(sessionId: string): Promise<DocVersion[]> {
  const { data } = await supabase
    .from('job_reports')
    .select('id, version_number, status, pdf_url, created_at')
    .eq('session_id', sessionId)
    .eq('status', 'finalised')
    .order('version_number', { ascending: false });
  return (data ?? []).map((d: any) => ({
    id: d.id,
    versionNumber: d.version_number,
    status: d.status,
    pdfUrl: d.pdf_url,
    createdAt: d.created_at,
  }));
}

export async function fetchQuoteVersions(sessionId: string): Promise<DocVersion[]> {
  const { data } = await supabase
    .from('quotes')
    .select('id, version_number, status, pdf_url, created_at')
    .eq('session_id', sessionId)
    .eq('status', 'finalised')
    .order('version_number', { ascending: false });
  return (data ?? []).map((d: any) => ({
    id: d.id,
    versionNumber: d.version_number,
    status: d.status,
    pdfUrl: d.pdf_url,
    createdAt: d.created_at,
  }));
}

// ── Mutations ───────────────────────────────────────────────────────────────
export async function updateJobName(jobId: string, jobName: string): Promise<void> {
  await supabase.from('job_sessions').update({ job_name: jobName }).eq('id', jobId);
}

export async function reopenSession(jobId: string): Promise<void> {
  // D6 Flow12 / M5 RULE 3 — status flips to reopened, recap is triggered by
  // the Rex session screen via route.params.recap.
  await supabase
    .from('job_sessions')
    .update({ status: 'reopened', closed_at: null })
    .eq('id', jobId);
}

export async function deleteSessionCascade(jobId: string): Promise<void> {
  // 1) Collect PDF paths from job_reports + quotes BEFORE deleting (FK cascade
  //    will drop the rows, but storage objects need explicit removal).
  const [reports, quotes] = await Promise.all([
    supabase.from('job_reports').select('pdf_url').eq('session_id', jobId),
    supabase.from('quotes').select('pdf_url').eq('session_id', jobId),
  ]);
  const pdfPaths = [
    ...(reports.data ?? []).map((r: any) => r.pdf_url).filter(Boolean),
    ...(quotes.data ?? []).map((q: any) => q.pdf_url).filter(Boolean),
  ] as string[];

  if (pdfPaths.length > 0) {
    await supabase.storage.from('job-documents').remove(pdfPaths);
  }

  // 2) Delete the session — FK cascade handles messages / job_reports / quotes.
  await supabase.from('job_sessions').delete().eq('id', jobId);
}

// ── Signed URL for PDF view / download ──────────────────────────────────────
export async function getSignedPdfUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('job-documents')
    .createSignedUrl(path, 60 * 60); // 1 hour
  if (error || !data) return null;
  return data.signedUrl;
}

// ── Download a remote PDF to a local file for sharing ───────────────────────
export async function downloadPdf(path: string): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from('job-documents').download(path);
  if (error || !data) return null;
  return data;
}
