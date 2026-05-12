// services/team.ts — Owner-side team management.
// All mutations route through Edge Functions (server-side admin auth + Stripe).
// SELECTs use RLS policies added in migration 00004.

import { supabase } from './supabase';
import {
  PERIODS,
  type KpiPeriod,
  type MemberKpi,
  type TeamKpiSnapshot,
} from '../constants/teamMetrics';

export interface TeamMember {
  memberId: string;
  fullName: string;
  email: string;
  phone: string;
  tradeType: string;
  isActive: boolean;
  temporaryPasswordSet: boolean;
  nationalIdKycStatus: string;
  licenseKycStatus: string;
}

export interface AddMemberInput {
  full_name: string;
  email: string;
  phone_number: string;
  trade_type: string;
  vat_number: string;
  license_number: string;
  // KYC photo URLs are uploaded by the owner before calling — the function
  // expects paths in Supabase Storage (kyc-documents bucket).
  license_proof_url: string;
  national_id_url: string;
  // 12-char temp password — owner can generate or supply.
  temp_password: string;
}

export async function listMembers(ownerId: string): Promise<TeamMember[]> {
  // Two-step: read team_members for the owner, then read users for each
  // member_id. RLS on users now allows owners to SELECT member rows.
  const { data: links, error } = await supabase
    .from('team_members')
    .select('member_id, is_active, temporary_password_set, created_at')
    .eq('team_owner_id', ownerId)
    .order('created_at', { ascending: true });
  if (error || !links?.length) return [];

  const memberIds = links.map((l) => l.member_id);
  const { data: profiles } = await supabase
    .from('users')
    .select(
      'id, full_name, email, phone_number, trade_type, national_id_kyc_status, license_kyc_status',
    )
    .in('id', memberIds);

  const byId = new Map<string, any>();
  (profiles ?? []).forEach((p) => byId.set(p.id, p));

  return links.map((l) => {
    const p = byId.get(l.member_id) ?? {};
    return {
      memberId: l.member_id,
      fullName: p.full_name ?? 'Unknown member',
      email: p.email ?? '',
      phone: p.phone_number ?? '',
      tradeType: p.trade_type ?? '',
      isActive: l.is_active,
      temporaryPasswordSet: l.temporary_password_set,
      nationalIdKycStatus: p.national_id_kyc_status ?? 'not_uploaded',
      licenseKycStatus: p.license_kyc_status ?? 'not_uploaded',
    };
  });
}

export async function addMember(input: AddMemberInput): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('create-team-member', {
    body: input,
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}

export async function removeMember(memberId: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('delete-team-member', {
    body: { member_id: memberId, confirmation: 'DELETE' },
  });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true };
}

export async function fetchTeamKpis(
  ownerId: string,
  period: KpiPeriod,
): Promise<TeamKpiSnapshot> {
  const sinceMs = PERIODS.find((p) => p.value === period)!.sinceMs;
  const sinceIso = new Date(Date.now() - sinceMs).toISOString();

  const members = await listMembers(ownerId);
  const memberIds = members.map((m) => m.memberId);

  if (memberIds.length === 0) {
    return {
      perMember: [],
      total: { sessions: 0, reports: 0, quotes: 0, revenue: 0, photos: 0, hoursOnSite: 0 },
    };
  }

  const [sessions, reports, quotes, photoMessages] = await Promise.all([
    supabase
      .from('job_sessions')
      .select('id, user_id, time_on_jobsite_seconds, created_at')
      .in('user_id', memberIds)
      .gte('created_at', sinceIso),
    supabase
      .from('job_reports')
      .select('user_id, confirmed_amount, created_at, status')
      .in('user_id', memberIds)
      .eq('status', 'finalised')
      .gte('created_at', sinceIso),
    supabase
      .from('quotes')
      .select('user_id, confirmed_total, created_at, status')
      .in('user_id', memberIds)
      .eq('status', 'finalised')
      .gte('created_at', sinceIso),
    // Photos are messages with photo_url — RLS allows owner read via session.
    supabase
      .from('messages')
      .select('session_id, created_at, photo_url, job_sessions!inner(user_id)')
      .in('job_sessions.user_id', memberIds)
      .not('photo_url', 'is', null)
      .gte('created_at', sinceIso),
  ]);

  const sByMember = new Map<string, MemberKpi>();
  members.forEach((m) =>
    sByMember.set(m.memberId, {
      memberId: m.memberId,
      fullName: m.fullName,
      sessions: 0,
      reports: 0,
      quotes: 0,
      revenue: 0,
      photos: 0,
      hoursOnSite: 0,
    }),
  );

  for (const s of sessions.data ?? []) {
    const k = sByMember.get(s.user_id);
    if (!k) continue;
    k.sessions += 1;
    k.hoursOnSite += (s.time_on_jobsite_seconds ?? 0) / 3600;
  }
  for (const r of reports.data ?? []) {
    const k = sByMember.get(r.user_id);
    if (!k) continue;
    k.reports += 1;
    k.revenue += Number(r.confirmed_amount ?? 0);
  }
  for (const q of quotes.data ?? []) {
    const k = sByMember.get(q.user_id);
    if (!k) continue;
    k.quotes += 1;
    k.revenue += Number(q.confirmed_total ?? 0);
  }
  for (const p of photoMessages.data ?? []) {
    const userId = (p as any).job_sessions?.user_id;
    const k = sByMember.get(userId);
    if (!k) continue;
    k.photos += 1;
  }

  const perMember = Array.from(sByMember.values());
  const total = perMember.reduce(
    (acc, m) => ({
      sessions: acc.sessions + m.sessions,
      reports: acc.reports + m.reports,
      quotes: acc.quotes + m.quotes,
      revenue: acc.revenue + m.revenue,
      photos: acc.photos + m.photos,
      hoursOnSite: acc.hoursOnSite + m.hoursOnSite,
    }),
    { sessions: 0, reports: 0, quotes: 0, revenue: 0, photos: 0, hoursOnSite: 0 },
  );

  return { perMember, total };
}

export function generateTempPassword(): string {
  // 12-char temp password: 4 lower, 4 upper, 2 digits, 2 symbols — shuffled.
  const pick = (chars: string, n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const raw =
    pick('abcdefghjkmnpqrstuvwxyz', 4) +
    pick('ABCDEFGHJKMNPQRSTUVWXYZ', 4) +
    pick('23456789', 2) +
    pick('!@#$%&*?', 2);
  return raw
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
}
