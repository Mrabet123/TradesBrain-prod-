// services/documents.ts — Report & Quote draft CRUD, PDF generation, versioning.
// D3 F2 / F3 + BuildGuide M3.
// PDF generation uses expo-print (HTML → PDF) — D4 §1 listed react-pdf which is
// a browser library; expo-print is the Expo equivalent for native and is what
// Claude Code ships in this build (see M3 Build Report deviation note).

import * as Print from 'expo-print';
import { supabase } from './supabase';
import { PAYMENT_METHODS, type PaymentMethod, DEFAULT_REPORT_SECTIONS, DEFAULT_QUOTE_SECTIONS, DEFAULT_VALIDITY_DAYS } from '../constants/paymentMethods';

// ─── Types ──────────────────────────────────────────────────────────────────
export interface ReportSection {
  id: string;
  name: string;
  content: string;
  custom: boolean;
}

export interface QuoteLineItem {
  id: string;
  name: string;
  qty: number;
  unitCost: number;
}

export interface ReportDraft {
  id: string;
  sessionId: string;
  userId: string;
  versionNumber: number;
  sections: ReportSection[];
  confirmedAmount: number | null;
  includesVat: boolean;
  includesLicense: boolean;
  voiceSummary: string;
}

export interface QuoteDraft {
  id: string;
  sessionId: string;
  userId: string;
  versionNumber: number;
  lineItems: QuoteLineItem[];
  labourHours: number;
  hourlyRateSnapshot: number;
  paymentTerms: string;
  paymentMethods: PaymentMethod[];
  validityDays: number;
  notes: string;
  confirmedTotal: number | null;
  includesVat: boolean;
  includesLicense: boolean;
}

export interface UserPrefs {
  sections?: string[];
  defaultIncludeVat?: boolean;
  defaultIncludeLicense?: boolean;
  defaultPaymentTerms?: string;
  paymentMethods?: PaymentMethod[];
}

export interface ProfileBlock {
  fullName: string;
  tradeType: string;
  hourlyRate: number;
  vatNumber: string;
  licenseNumber: string;
  companyName: string | null;
}

// ─── Worker preferences ─────────────────────────────────────────────────────
export async function loadPrefs(
  userId: string,
  documentType: 'report' | 'quote',
): Promise<UserPrefs | null> {
  const { data } = await supabase
    .from('worker_preferences')
    .select('*')
    .eq('user_id', userId)
    .eq('document_type', documentType)
    .maybeSingle();
  if (!data) return null;
  return {
    sections: data.sections,
    defaultIncludeVat: data.default_include_vat,
    defaultIncludeLicense: data.default_include_license,
    defaultPaymentTerms: data.default_payment_terms,
    paymentMethods: (data.sections as any)?.paymentMethods,
  };
}

export async function savePrefs(
  userId: string,
  documentType: 'report' | 'quote',
  prefs: UserPrefs,
): Promise<void> {
  await supabase.from('worker_preferences').upsert(
    {
      user_id: userId,
      document_type: documentType,
      sections: prefs.sections ?? [],
      default_include_vat: prefs.defaultIncludeVat ?? false,
      default_include_license: prefs.defaultIncludeLicense ?? false,
      default_payment_terms: prefs.defaultPaymentTerms ?? null,
    },
    { onConflict: 'user_id,document_type' },
  );
}

// ─── Versioning ─────────────────────────────────────────────────────────────
async function nextVersion(
  table: 'job_reports' | 'quotes',
  sessionId: string,
): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select('version_number')
    .eq('session_id', sessionId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.version_number ?? 0) + 1;
}

// ─── Report CRUD ────────────────────────────────────────────────────────────
export async function createReportDraft(
  sessionId: string,
  userId: string,
  initialText: string,
  prefs: UserPrefs | null,
): Promise<ReportDraft> {
  const versionNumber = await nextVersion('job_reports', sessionId);
  const sectionsList = prefs?.sections?.length
    ? prefs.sections
    : (DEFAULT_REPORT_SECTIONS as readonly string[]);
  const sections: ReportSection[] = sectionsList.map((name, i) => ({
    id: `s${i}`,
    name,
    content: i === 0 ? initialText : '',
    custom: false,
  }));

  const { data, error } = await supabase
    .from('job_reports')
    .insert({
      session_id: sessionId,
      user_id: userId,
      version_number: versionNumber,
      status: 'draft',
      report_text: initialText,
      sections_config: { sections },
      includes_vat: prefs?.defaultIncludeVat ?? false,
      includes_license: prefs?.defaultIncludeLicense ?? false,
    })
    .select()
    .single();
  if (error || !data) throw error;

  return {
    id: data.id,
    sessionId,
    userId,
    versionNumber,
    sections,
    confirmedAmount: null,
    includesVat: data.includes_vat,
    includesLicense: data.includes_license,
    voiceSummary: initialText,
  };
}

export async function saveReportDraft(draft: ReportDraft): Promise<void> {
  await supabase
    .from('job_reports')
    .update({
      report_text: draft.sections.map((s) => `## ${s.name}\n${s.content}`).join('\n\n'),
      sections_config: { sections: draft.sections },
      confirmed_amount: draft.confirmedAmount,
      includes_vat: draft.includesVat,
      includes_license: draft.includesLicense,
    })
    .eq('id', draft.id);
}

export async function discardReportDraft(reportId: string): Promise<void> {
  // D3 F2 DISCARD RULE — drafts never reach archive
  await supabase.from('job_reports').delete().eq('id', reportId).eq('status', 'draft');
}

export async function confirmReport(
  draft: ReportDraft,
  profile: ProfileBlock,
): Promise<{ pdfUri: string; pdfStoragePath: string }> {
  const html = renderReportHtml(draft, profile);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const storagePath = `${draft.userId}/reports/${draft.id}-v${draft.versionNumber}.pdf`;

  const blob = await (await fetch(uri)).blob();
  const { error: upErr } = await supabase.storage
    .from('job-documents')
    .upload(storagePath, blob, { contentType: 'application/pdf', upsert: false });
  if (upErr) throw upErr;

  await saveReportDraft(draft); // ensure latest content is persisted

  // Finalise — trigger prevent_finalised_update locks the row from here.
  const { error: finalErr } = await supabase
    .from('job_reports')
    .update({
      status: 'finalised',
      pdf_url: storagePath,
      report_text: draft.sections.map((s) => `## ${s.name}\n${s.content}`).join('\n\n'),
      sections_config: { sections: draft.sections },
      confirmed_amount: draft.confirmedAmount,
      includes_vat: draft.includesVat,
      includes_license: draft.includesLicense,
    })
    .eq('id', draft.id);
  if (finalErr) throw finalErr;

  return { pdfUri: uri, pdfStoragePath: storagePath };
}

// ─── Quote CRUD ─────────────────────────────────────────────────────────────
export async function createQuoteDraft(
  sessionId: string,
  userId: string,
  hourlyRateSnapshot: number,
  prefs: UserPrefs | null,
  seedLineItems: QuoteLineItem[] = [],
): Promise<QuoteDraft> {
  const versionNumber = await nextVersion('quotes', sessionId);
  const draft: Omit<QuoteDraft, 'id'> = {
    sessionId,
    userId,
    versionNumber,
    lineItems: seedLineItems,
    labourHours: 0,
    hourlyRateSnapshot,
    paymentTerms: prefs?.defaultPaymentTerms ?? 'Due on completion',
    paymentMethods: prefs?.paymentMethods ?? ['Bank transfer'],
    validityDays: DEFAULT_VALIDITY_DAYS,
    notes: '',
    confirmedTotal: null,
    includesVat: prefs?.defaultIncludeVat ?? false,
    includesLicense: prefs?.defaultIncludeLicense ?? false,
  };

  const { data, error } = await supabase
    .from('quotes')
    .insert({
      session_id: sessionId,
      user_id: userId,
      version_number: versionNumber,
      status: 'draft',
      line_items: draft.lineItems,
      labour_hours: draft.labourHours,
      hourly_rate_snapshot: draft.hourlyRateSnapshot,
      payment_terms: draft.paymentTerms,
      includes_vat: draft.includesVat,
      includes_license: draft.includesLicense,
      sections_config: {
        paymentMethods: draft.paymentMethods,
        validityDays: draft.validityDays,
        notes: draft.notes,
      },
    })
    .select()
    .single();
  if (error || !data) throw error;
  return { ...draft, id: data.id };
}

export async function saveQuoteDraft(draft: QuoteDraft): Promise<void> {
  await supabase
    .from('quotes')
    .update({
      line_items: draft.lineItems,
      labour_hours: draft.labourHours,
      hourly_rate_snapshot: draft.hourlyRateSnapshot,
      payment_terms: draft.paymentTerms,
      confirmed_total: draft.confirmedTotal,
      includes_vat: draft.includesVat,
      includes_license: draft.includesLicense,
      sections_config: {
        paymentMethods: draft.paymentMethods,
        validityDays: draft.validityDays,
        notes: draft.notes,
      },
    })
    .eq('id', draft.id);
}

export async function discardQuoteDraft(quoteId: string): Promise<void> {
  await supabase.from('quotes').delete().eq('id', quoteId).eq('status', 'draft');
}

export async function confirmQuote(
  draft: QuoteDraft,
  profile: ProfileBlock,
): Promise<{ pdfUri: string; pdfStoragePath: string }> {
  const html = renderQuoteHtml(draft, profile);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const storagePath = `${draft.userId}/quotes/${draft.id}-v${draft.versionNumber}.pdf`;

  const blob = await (await fetch(uri)).blob();
  const { error: upErr } = await supabase.storage
    .from('job-documents')
    .upload(storagePath, blob, { contentType: 'application/pdf', upsert: false });
  if (upErr) throw upErr;

  await saveQuoteDraft(draft);

  const { error: finalErr } = await supabase
    .from('quotes')
    .update({
      status: 'finalised',
      pdf_url: storagePath,
      line_items: draft.lineItems,
      labour_hours: draft.labourHours,
      hourly_rate_snapshot: draft.hourlyRateSnapshot,
      payment_terms: draft.paymentTerms,
      confirmed_total: draft.confirmedTotal,
      includes_vat: draft.includesVat,
      includes_license: draft.includesLicense,
      sections_config: {
        paymentMethods: draft.paymentMethods,
        validityDays: draft.validityDays,
        notes: draft.notes,
      },
    })
    .eq('id', draft.id);
  if (finalErr) throw finalErr;

  return { pdfUri: uri, pdfStoragePath: storagePath };
}

export function quoteSubtotal(draft: QuoteDraft): number {
  const lineItemSubtotal = draft.lineItems.reduce(
    (sum, li) => sum + li.qty * li.unitCost,
    0,
  );
  const labourCost = draft.labourHours * draft.hourlyRateSnapshot;
  return lineItemSubtotal + labourCost;
}

// ─── HTML renderers (printable to PDF) ──────────────────────────────────────
function renderReportHtml(draft: ReportDraft, profile: ProfileBlock): string {
  const sectionsHtml = draft.sections
    .map(
      (s) =>
        `<h2 style="font-size:14px;margin:18px 0 6px;color:#1E5A8F">${escapeHtml(s.name)}</h2><div style="white-space:pre-wrap;font-size:12px;line-height:1.5">${escapeHtml(s.content)}</div>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #222; padding: 32px; }
    h1 { font-size: 22px; margin: 0; color: #1E5A8F; }
    .meta { font-size: 11px; color: #666; margin-top: 4px; }
    .footer { margin-top: 28px; font-size: 11px; color: #666; }
    .amount { margin-top: 18px; font-size: 14px; font-weight: 600; }
  </style></head><body>
    <h1>Job Report — Version ${draft.versionNumber}</h1>
    <div class="meta">${escapeHtml(profile.fullName)} · ${escapeHtml(profile.tradeType)}${profile.companyName ? ' · ' + escapeHtml(profile.companyName) : ''}</div>
    <div class="meta">Date: ${new Date().toLocaleDateString()}</div>
    ${sectionsHtml}
    ${draft.confirmedAmount != null ? `<div class="amount">Confirmed amount: $${draft.confirmedAmount.toFixed(2)}</div>` : ''}
    <div class="footer">
      ${draft.includesVat ? `VAT: ${escapeHtml(profile.vatNumber)}<br/>` : ''}
      ${draft.includesLicense ? `License: ${escapeHtml(profile.licenseNumber)}` : ''}
    </div>
  </body></html>`;
}

function renderQuoteHtml(draft: QuoteDraft, profile: ProfileBlock): string {
  const rows = draft.lineItems
    .map(
      (li) =>
        `<tr><td>${escapeHtml(li.name)}</td><td style="text-align:right">${li.qty}</td><td style="text-align:right">$${li.unitCost.toFixed(2)}</td><td style="text-align:right">$${(li.qty * li.unitCost).toFixed(2)}</td></tr>`,
    )
    .join('');
  const subtotal = quoteSubtotal(draft);

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #222; padding: 32px; }
    h1 { font-size: 22px; margin: 0; color: #1E5A8F; }
    .meta { font-size: 11px; color: #666; margin-top: 4px; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; font-size: 12px; }
    th, td { border-bottom: 1px solid #eee; padding: 6px 4px; }
    th { background: #f7f7f7; text-align: left; }
    .right { text-align: right; }
    .footer { margin-top: 18px; font-size: 11px; color: #666; }
    .total { margin-top: 12px; font-size: 14px; font-weight: 600; text-align: right; }
  </style></head><body>
    <h1>Quote — Version ${draft.versionNumber}</h1>
    <div class="meta">${escapeHtml(profile.fullName)} · ${escapeHtml(profile.tradeType)}${profile.companyName ? ' · ' + escapeHtml(profile.companyName) : ''}</div>
    <div class="meta">Date: ${new Date().toLocaleDateString()} · Valid for ${draft.validityDays} days</div>
    <table>
      <thead><tr><th>Item</th><th class="right">Qty</th><th class="right">Unit cost</th><th class="right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:12px;margin-top:10px">Labour: ${draft.labourHours} h × $${draft.hourlyRateSnapshot.toFixed(2)} = $${(draft.labourHours * draft.hourlyRateSnapshot).toFixed(2)}</p>
    <div class="total">${draft.confirmedTotal != null ? `Confirmed total: $${draft.confirmedTotal.toFixed(2)}` : `Subtotal: $${subtotal.toFixed(2)}`}</div>
    <p style="font-size:12px">Payment terms: ${escapeHtml(draft.paymentTerms)}</p>
    <p style="font-size:12px">Payment methods: ${draft.paymentMethods.map(escapeHtml).join(', ')}</p>
    ${draft.notes ? `<p style="font-size:12px">Notes: ${escapeHtml(draft.notes)}</p>` : ''}
    <div class="footer">
      ${draft.includesVat ? `VAT: ${escapeHtml(profile.vatNumber)}<br/>` : ''}
      ${draft.includesLicense ? `License: ${escapeHtml(profile.licenseNumber)}` : ''}
    </div>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export { PAYMENT_METHODS };
export type { PaymentMethod };
