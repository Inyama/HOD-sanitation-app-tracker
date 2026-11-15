import "server-only";
import type { DateTime } from "luxon";
import type { Repository } from "@/lib/repo/interfaces";
import {
  buildReport,
  REPORT_LABEL,
  type ReportData,
  type ReportFilters,
  type ReportFormat,
  type ReportType,
} from "@/lib/reports/admin-reports";
import { reportCsv, reportXlsx } from "@/lib/reports/render";
import { withRecurringMeetings } from "@/lib/time/schedule";
import { buildAnalytics } from "./analytics";
import { resolveRange } from "./range";
import { audit, type OpsContext } from "./ops-common";

/** Reports and exports (spec 7.4 item 8) and analytics (item 9): read models from the live records. */

export async function loadReportData(
  repo: Repository,
  now: DateTime,
  rangeValue: string | undefined,
): Promise<ReportData> {
  const range = resolveRange(rangeValue, now);
  const [users, stored, records, excuses, hours, duties, issues, teams, teamMembers, settings] = await Promise.all([
    repo.users.list(),
    repo.meetings.list({ orderBy: { field: "startsAt" } }),
    repo.records.list(),
    repo.excuses.list(),
    repo.serviceHours.list(),
    repo.duties.list(),
    repo.issues.list(),
    repo.teams.list({ orderBy: { field: "name" } }),
    repo.teamMembers.list(),
    repo.settings.get(),
  ]);
  const teamOf = new Map(teamMembers.map((m) => [m.userId, m.teamId]));
  return {
    now,
    range,
    people: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      approvedAt: u.approvedAt,
      createdAt: u.createdAt,
      statusChangedAt: u.statusChangedAt,
      teamId: teamOf.get(u.id) ?? null,
      isRemote: u.isRemote,
    })),
    meetings: withRecurringMeetings(stored, now, 4),
    records,
    excuses,
    hours,
    duties,
    issues,
    teams: teams.map((t) => ({ id: t.id, name: t.name })),
    lateWeight: settings.lateWeight,
    thresholds: settings.bandThresholds,
    atRiskPercent: settings.atRiskPercent,
    atRiskAbsences: settings.atRiskConsecutiveAbsences,
  };
}

export async function generateReport(
  repo: Repository,
  now: DateTime,
  type: ReportType,
  rangeValue: string | undefined,
  filters: ReportFilters,
) {
  const data = await loadReportData(repo, now, rangeValue);
  return buildReport(type, data, filters);
}

/** Render a report file and record the download in the audit log (download history). */
export async function reportFile(
  repo: Repository,
  ctx: OpsContext,
  type: ReportType,
  rangeValue: string | undefined,
  filters: ReportFilters,
  format: Exclude<ReportFormat, never>,
): Promise<{ name: string; type: string; body: Buffer | string }> {
  const report = await generateReport(repo, ctx.now, type, rangeValue, filters);
  let out: { name: string; type: string; body: Buffer | string };
  if (format === "csv")
    out = { name: `${report.fileBase}.csv`, type: "text/csv; charset=utf-8", body: reportCsv(report) };
  else if (format === "xlsx")
    out = {
      name: `${report.fileBase}.xlsx`,
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: reportXlsx(report),
    };
  else {
    const { renderReportPdf } = await import("@/lib/reports/admin-pdf");
    out = { name: `${report.fileBase}.pdf`, type: "application/pdf", body: await renderReportPdf(report) };
  }
  await audit(repo, ctx, "REPORT_DOWNLOADED", "Report", null, null, {
    type,
    label: REPORT_LABEL[type],
    format,
    period: report.period,
    range: rangeValue ?? null,
    filters: report.filters,
    query: { meetingType: filters.meetingType, teamId: filters.teamId, userId: filters.userId },
  });
  return out;
}

export async function reportHistory(repo: Repository, limit = 15) {
  const [rows, users] = await Promise.all([
    repo.audit.list({ where: { action: "REPORT_DOWNLOADED" }, orderBy: { field: "createdAt", dir: "desc" }, limit }),
    repo.users.list(),
  ]);
  const name = new Map(users.map((u) => [u.id, u.name]));
  return rows.map((r) => {
    const a = (r.after ?? {}) as {
      type?: ReportType;
      label?: string;
      format?: string;
      period?: string;
      range?: string | null;
      filters?: string[];
      query?: { meetingType?: string; teamId?: string; userId?: string | null };
    };
    return {
      id: r.id,
      at: r.createdAt,
      by: r.actorId ? (name.get(r.actorId) ?? "Admin") : "System",
      type: a.type ?? null,
      label: a.label ?? "Report",
      format: a.format ?? "",
      period: a.period ?? "",
      range: a.range ?? null,
      filters: a.filters ?? [],
      query: a.query ?? {},
    };
  });
}

export async function loadAnalytics(
  repo: Repository,
  now: DateTime,
  rangeValue: string | undefined,
  filters: { meetingType: "ALL" | "SATURDAY" | "THURSDAY_PRAYER" | "SPECIAL"; teamId: string },
) {
  const data = await loadReportData(repo, now, rangeValue);
  const analytics = buildAnalytics({
    now,
    range: data.range,
    people: data.people.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      status: p.status,
      approvedAt: p.approvedAt,
      createdAt: p.createdAt,
      statusChangedAt: p.statusChangedAt,
      teamId: p.teamId,
      isRemote: p.isRemote,
    })),
    meetings: data.meetings,
    records: data.records,
    hours: data.hours,
    teams: data.teams,
    lateWeight: data.lateWeight,
    meetingType: filters.meetingType,
    teamId: data.teams.some((t) => t.id === filters.teamId) ? filters.teamId : "ALL",
  });
  return {
    ...analytics,
    range: {
      label: data.range.label,
      fromDate: data.range.fromDate,
      toDate: data.range.toDate,
      value: data.range.value,
    },
    teams: data.teams,
  };
}

export type AnalyticsData = Awaited<ReturnType<typeof loadAnalytics>>;
