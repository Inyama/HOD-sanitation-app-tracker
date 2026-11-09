import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock3, Flame, Mail, MapPin, Phone, ShieldAlert } from "lucide-react";
import { requirePage } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { repo } from "@/lib/repo";
import { serverNow } from "@/lib/time/server-now";
import { ADMIN_LEVEL_LABELS, TITLE_LABELS } from "@/lib/repo/types";
import { VIEW_LABELS, type ViewKey } from "@/lib/attendance/aggregate";
import { lagosClock, lagosDay, typeLabel } from "@/lib/member/display";
import { loadProfile } from "@/lib/admin/data";
import { GlassCard, GlassCardHeader } from "@/components/ui/glass-card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { AttendanceRing } from "@/components/charts/AttendanceRing";
import { Heatmap } from "@/components/charts/Heatmap";
import { StatusChip } from "@/components/attendance/StatusChip";
import { BandChip, PersonStatusChip } from "@/components/admin/chips";
import { NotesForm, ProfileActions } from "@/components/admin/ProfileActions";

export const metadata: Metadata = { title: "Member profile" };

const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  });

const EXCUSE_LABEL = { PENDING: "Waiting", APPROVED: "Approved", DECLINED: "Declined" } as const;

export default async function MemberProfilePage({ params }: PageProps<"/admin/members/[id]">) {
  const { id } = await params;
  const { actor } = await requirePage(`/admin/members/${id}`);
  const now = await serverNow();
  const r = repo();
  const [p, teams] = await Promise.all([loadProfile(r, id, now), r.teams.list({ orderBy: { field: "name" } })]);
  if (!p) notFound();
  const u = p.user;
  const canManage = can(actor, "people.manage");
  const overall = p.views.overall;
  const roleText =
    u.role === "ADMIN"
      ? u.adminLevel
        ? ADMIN_LEVEL_LABELS[u.adminLevel]
        : "Admin"
      : u.role === "VOLUNTEER"
        ? "Volunteer"
        : "Member";

  return (
    <>
      <Link
        href="/admin/members"
        className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-role-strong hover:underline"
      >
        <ArrowLeft aria-hidden className="size-4" /> All members
      </Link>

      <GlassCard className="mb-6 flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar name={u.name} size={72} src={u.avatarUrl} />
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold sm:text-[2rem]">{u.name}</h1>
              <PersonStatusChip status={u.status} />
            </div>
            <p className="text-sm">
              <span className="font-semibold">{roleText}</span>
              {p.titles.length > 0 && <span> · {p.titles.map((t) => TITLE_LABELS[t]).join(", ")}</span>}
              {p.team && (
                <span>
                  {" "}
                  · {p.team.name} team{p.team.isLead ? " (lead)" : ""}
                </span>
              )}
              {u.isRemote && <span> · Remote member</span>}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <li className="flex min-w-0 items-center gap-1.5">
                <Mail aria-hidden className="size-4 shrink-0" />
                <a href={`mailto:${u.email}`} className="truncate hover:underline">
                  {u.email}
                </a>
                <span className="sr-only">{u.emailVerified ? "(confirmed)" : "(not confirmed)"}</span>
                {!u.emailVerified && <span className="text-xs text-(--status-late-fg)">not confirmed</span>}
              </li>
              {u.phone && (
                <li className="flex items-center gap-1.5">
                  <Phone aria-hidden className="size-4" /> {u.phone}
                </li>
              )}
              {(u.city || u.country) && (
                <li className="flex items-center gap-1.5">
                  <MapPin aria-hidden className="size-4" /> {[u.city, u.country].filter(Boolean).join(", ")}
                </li>
              )}
            </ul>
            <p className="text-xs text-muted-foreground">
              Signed up {fullDate(u.createdAt)}
              {u.approvedAt && ` · approved ${fullDate(u.approvedAt)}`}
              {u.lastLoginAt && ` · last signed in ${lagosDay(u.lastLoginAt)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 lg:flex-col lg:items-end">
          <AttendanceRing percent={overall.percent} size={120} label="Overall" />
        </div>
      </GlassCard>

      <div className="mb-6">
        <ProfileActions
          person={{
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            role: u.role,
            city: u.city,
            country: u.country,
            isRemote: u.isRemote,
            teamId: p.team?.id ?? null,
            status: u.status,
            canRestore: u.canRestore,
          }}
          teams={teams.map((t) => ({ id: t.id, name: t.name }))}
          canManage={canManage}
          canMessage={can(actor, "messages.send")}
          canAssignRoles={can(actor, "roles.assign")}
        />
      </div>

      {(u.status === "SUSPENDED" || u.status === "REMOVED" || u.deletionRequestedAt) && (
        <div
          role="note"
          className="mb-6 flex gap-3 rounded-(--radius-lg) border border-(--status-absent)/40 bg-(--status-absent-bg) p-4 text-sm text-(--status-absent-fg)"
        >
          <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            {u.status === "SUSPENDED" && (
              <p>
                <span className="font-semibold">Suspended</span>
                {u.statusChangedAt && ` on ${fullDate(u.statusChangedAt)}`}
                {u.statusReason && `: ${u.statusReason}`}
              </p>
            )}
            {u.status === "REMOVED" && (
              <p>
                <span className="font-semibold">Removed</span>
                {u.statusChangedAt && ` on ${fullDate(u.statusChangedAt)}`}
                {u.statusReason && `: ${u.statusReason}`}.{" "}
                {u.purgeOn &&
                  (u.canRestore ? `Personal data will be deleted on ${fullDate(u.purgeOn)} unless restored.` : "")}
              </p>
            )}
            {u.deletionRequestedAt && u.status !== "REMOVED" && (
              <p>
                <span className="font-semibold">Asked for their account to be deleted</span> on{" "}
                {fullDate(u.deletionRequestedAt)}.{" "}
                {canManage && (
                  <Link href="/admin/approvals" className="font-semibold underline">
                    Review the request
                  </Link>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      <section aria-label="Attendance views" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {(Object.keys(VIEW_LABELS) as ViewKey[]).map((k) => (
          <div key={k} className="rounded-(--radius-lg) border border-border bg-card p-4 shadow-soft">
            <p className="text-xs font-medium text-muted-foreground">{VIEW_LABELS[k]}</p>
            <p className="tabular font-heading text-2xl font-semibold">
              {p.views[k].percent === null ? "–" : `${p.views[k].percent}%`}
            </p>
            <BandChip bandKey={p.views[k].band.key} label={p.views[k].band.label} />
          </div>
        ))}
        <div className="rounded-(--radius-lg) border border-border bg-card p-4 shadow-soft">
          <p className="text-xs font-medium text-muted-foreground">Streak</p>
          <p className="tabular flex items-center gap-1.5 font-heading text-2xl font-semibold">
            <Flame aria-hidden className="size-5 text-gold-500" /> {p.streak}
          </p>
          <p className="text-xs text-muted-foreground">
            Best {p.longestStreak}
            {p.absencesInARow > 0 && ` · ${p.absencesInARow} absent in a row`}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3 [&>*]:min-w-0">
        <div className="space-y-4 xl:col-span-2">
          <GlassCard>
            <GlassCardHeader
              title="Heatmap, last 6 months"
              description="One square per meeting. Tab into the grid, then use the arrow keys."
            />
            <Heatmap cells={p.heat} title={`${u.name}: attendance heatmap`} />
          </GlassCard>

          <GlassCard>
            <GlassCardHeader
              title="Attendance timeline"
              description="Most recent first; the last 30 counted meetings"
            />
            {p.timeline.length === 0 ? (
              <EmptyState illustration="calendar" title="No counted meetings yet" />
            ) : (
              <ol
                className="max-h-[28rem] divide-y divide-border overflow-auto"
                tabIndex={0}
                aria-label="Attendance timeline"
              >
                {p.timeline.map((t) => (
                  <li key={t.meetingId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {lagosDay(t.startsAt)} · {typeLabel(t.type)}
                        {t.checkedInAt && ` · in at ${lagosClock(t.checkedInAt)}`}
                        {t.method && t.method !== "GEO" && ` · ${t.method === "SHEET" ? "from sheet" : "manual"}`}
                      </p>
                    </div>
                    <span className="flex flex-wrap gap-1.5">
                      <StatusChip status={t.status} size="sm" />
                      {t.method === "MANUAL" && <StatusChip status="MANUAL" size="sm" />}
                      {t.flagged && <StatusChip status="FLAGGED" size="sm" />}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </GlassCard>

          <GlassCard>
            <GlassCardHeader title="Excuse requests" />
            {p.excuses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No excuse requests.</p>
            ) : (
              <ul className="divide-y divide-border">
                {p.excuses.map((e) => (
                  <li key={e.id} className="space-y-1 py-2.5 text-sm">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{e.meeting}</span>
                      <StatusChip
                        status={e.status === "APPROVED" ? "EXCUSED" : e.status === "DECLINED" ? "ABSENT" : "PENDING"}
                        label={EXCUSE_LABEL[e.status]}
                        size="sm"
                      />
                    </p>
                    <p className="text-muted-foreground">{e.reason}</p>
                    {e.reviewer && (
                      <p className="text-xs text-muted-foreground">
                        {EXCUSE_LABEL[e.status]} by {e.reviewer}
                        {e.reviewNote && `: ${e.reviewNote}`}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>

        <div className="space-y-4">
          <GlassCard>
            <GlassCardHeader title="Admin notes" description="Private to admins" />
            {p.notes.length > 0 && (
              <ul className="mb-4 space-y-3">
                {p.notes.map((n) => (
                  <li key={n.id} className="rounded-(--radius-md) bg-muted/60 p-3 text-sm">
                    <p>{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.author} · {lagosDay(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {p.notes.length === 0 && !canManage && <p className="text-sm text-muted-foreground">No notes.</p>}
            {canManage && <NotesForm userId={u.id} />}
          </GlassCard>

          <GlassCard>
            <GlassCardHeader title="Titles and team" />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Role</dt>
                <dd className="font-medium">{roleText}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Titles</dt>
                <dd className="text-right font-medium">
                  {p.titles.length ? p.titles.map((t) => TITLE_LABELS[t]).join(", ") : "None"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Team</dt>
                <dd className="font-medium">{p.team ? `${p.team.name}${p.team.isLead ? " (lead)" : ""}` : "None"}</dd>
              </div>
              {u.role === "VOLUNTEER" && (
                <div className="flex justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock3 aria-hidden className="size-4" /> Service hours
                  </dt>
                  <dd className="font-medium">
                    {p.hours.total} h · {p.hours.duties} duties
                  </dd>
                </div>
              )}
            </dl>
          </GlassCard>

          <GlassCard>
            <GlassCardHeader title="Messages sent to them" />
            {p.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {p.messages.map((m) => (
                  <li key={m.id} className="text-sm">
                    <p className="font-medium">{m.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      From {m.from}
                      {m.sentAt && ` · ${lagosDay(m.sentAt)}`} · {m.readAt ? "Read" : "Not read yet"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>

          <GlassCard>
            <GlassCardHeader title="Audit entries" description="Changes made to this account" />
            {p.audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No changes recorded.</p>
            ) : (
              <ul className="space-y-2.5">
                {p.audit.map((a) => (
                  <li key={a.id} className="text-sm">
                    <p>
                      <span className="font-medium">{a.what}</span>{" "}
                      <span className="text-muted-foreground">by {a.who}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lagosDay(a.at)}, {lagosClock(a.at)}
                      {a.ip && ` · from ${a.ip}`}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
      </div>
    </>
  );
}
