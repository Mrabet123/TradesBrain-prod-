// D3 F8 — Team KPI time periods + metric definitions.
// The owner toggles between three periods. Each period defines the lower bound
// for the time window (now - duration). Aggregates sum per-member metrics.

export type KpiPeriod = 'daily' | 'weekly' | 'monthly';

export const PERIODS: { value: KpiPeriod; label: string; sinceMs: number }[] = [
  { value: 'daily', label: 'Last 24 h', sinceMs: 24 * 60 * 60 * 1000 },
  { value: 'weekly', label: 'Last 7 days', sinceMs: 7 * 24 * 60 * 60 * 1000 },
  { value: 'monthly', label: 'Last 30 days', sinceMs: 30 * 24 * 60 * 60 * 1000 },
];

export interface MemberKpi {
  memberId: string;
  fullName: string;
  sessions: number;
  reports: number;
  quotes: number;
  revenue: number; // confirmed_amount + confirmed_total summed
  photos: number;
  hoursOnSite: number; // sum(time_on_jobsite_seconds) / 3600
}

export interface TeamKpiSnapshot {
  perMember: MemberKpi[];
  total: Omit<MemberKpi, 'memberId' | 'fullName'>;
}

export const TEAM_MAX_SEATS = 10;
