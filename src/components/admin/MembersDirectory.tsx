"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArchiveRestore,
  Ban,
  Eye,
  FileUp,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/form-field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ADMIN_LEVEL_LABELS, TITLE_LABELS } from "@/lib/repo/types";
import { apiRequest } from "@/lib/api-client";
import { filterMembers, type MemberFilters, type MemberRow } from "@/lib/admin/members";
import { cn } from "@/lib/utils";
import { MessageDialog } from "./MessageDialog";
import { ReasonDialog } from "./ReasonDialog";
import { MemberFormSheet, type MemberFormValues } from "./MemberFormSheet";
import { ImportMembersSheet } from "./ImportMembersSheet";
import { MemberStatusDialogs, type StatusTarget } from "./MemberStatusDialogs";
import { BandChip, PersonStatusChip } from "./chips";

interface MembersDirectoryProps {
  rows: (MemberRow & { canRestore: boolean })[];
  teams: { id: string; name: string }[];
  canManage: boolean;
  canMessage: boolean;
  startAdding?: boolean;
}

type StatusFilter = "CURRENT" | NonNullable<MemberFilters["status"]>;

/** Members directory (spec 7.4 item 3). */
export function MembersDirectory({ rows, teams, canManage, canMessage, startAdding = false }: MembersDirectoryProps) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [role, setRole] = React.useState<MemberFilters["role"]>("ALL");
  const [status, setStatus] = React.useState<StatusFilter>("CURRENT");
  const [teamId, setTeamId] = React.useState("ALL");
  const [band, setBand] = React.useState<MemberFilters["band"]>("ALL");
  const [remote, setRemote] = React.useState<MemberFilters["remote"]>("ALL");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [form, setForm] = React.useState<{ key: number; initial: MemberFormValues | null } | null>(
    startAdding && canManage ? { key: 1, initial: null } : null,
  );
  const [importing, setImporting] = React.useState(false);
  const [statusTarget, setStatusTarget] = React.useState<StatusTarget | null>(null);
  const [messageTo, setMessageTo] = React.useState<{ id: string; name: string }[] | null>(null);
  const [bulkSuspend, setBulkSuspend] = React.useState(false);
  const [bulkTeam, setBulkTeam] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const visible = React.useMemo(() => {
    const base = status === "CURRENT" ? rows.filter((r) => r.status !== "REMOVED") : rows;
    return filterMembers(base, { q, role, status: status === "CURRENT" ? "ALL" : status, teamId, band, remote });
  }, [rows, q, role, status, teamId, band, remote]);

  // Keep the selection to people still on screen.
  const chosen = visible.filter((r) => selected.has(r.id));
  const refresh = () => {
    setSelected(new Set());
    router.refresh();
  };

  const assignTeam = async () => {
    if (!bulkTeam) return;
    setBusy(true);
    const r = await apiRequest<{ done: string[]; skipped: { message: string }[] }>("/api/v1/admin/members/bulk", {
      body: { action: "assignTeam", ids: chosen.map((c) => c.id), teamId: bulkTeam === "NONE" ? null : bulkTeam },
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.message);
    toast.success(`Team updated for ${r.done.length} ${r.done.length === 1 ? "person" : "people"}`, {
      description: r.skipped.length ? `${r.skipped.length} skipped: ${r.skipped[0].message}` : undefined,
    });
    setBulkTeam("");
    refresh();
  };

  const filtersActive =
    q || role !== "ALL" || status !== "CURRENT" || teamId !== "ALL" || band !== "ALL" || remote !== "ALL";
  const clearFilters = () => {
    setQ("");
    setRole("ALL");
    setStatus("CURRENT");
    setTeamId("ALL");
    setBand("ALL");
    setRemote("ALL");
  };

  const editValues = (r: MemberRow): MemberFormValues => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    role: r.role,
    city: r.city,
    country: r.country,
    isRemote: r.isRemote,
    teamId: r.teamId,
  });

  const columns: Column<MemberRow & { canRestore: boolean }>[] = [
    {
      key: "name",
      header: "Name",
      primary: true,
      sortValue: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={r.name} size={34} className="hidden sm:inline-flex" />
          <div className="min-w-0">
            <Link href={`/admin/members/${r.id}`} className="block truncate font-semibold hover:underline">
              {r.name}
            </Link>
            <span className="block truncate text-xs font-normal text-muted-foreground">{r.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortValue: (r) => r.role,
      cell: (r) => (
        <div className="min-w-0">
          <span className="font-medium">
            {r.role === "ADMIN"
              ? r.adminLevel
                ? ADMIN_LEVEL_LABELS[r.adminLevel]
                : "Admin"
              : r.role === "VOLUNTEER"
                ? "Volunteer"
                : "Member"}
          </span>
          {r.titles.length > 0 && (
            <span className="block text-xs text-muted-foreground">
              {r.titles.map((t) => TITLE_LABELS[t]).join(", ")}
            </span>
          )}
          {r.isRemote && <span className="block text-xs text-muted-foreground">Remote</span>}
        </div>
      ),
    },
    {
      key: "team",
      header: "Team",
      sortValue: (r) => r.teamName,
      className: "whitespace-nowrap",
      cell: (r) => r.teamName ?? <span className="text-muted-foreground">None</span>,
    },
    {
      key: "percent",
      header: "Attendance",
      align: "right",
      sortValue: (r) => r.percent,
      cell: (r) => (
        <span className="inline-flex flex-col items-end gap-0.5">
          <span className="font-semibold">{r.percent === null ? "–" : `${r.percent}%`}</span>
          <BandChip bandKey={r.bandKey} label={r.bandLabel} />
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      cell: (r) => <PersonStatusChip status={r.status} deletionRequested={!!r.deletionRequestedAt} />,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-11" aria-label={`Actions for ${r.name}`}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link href={`/admin/members/${r.id}`}>
                <Eye aria-hidden /> View profile
              </Link>
            </DropdownMenuItem>
            {canMessage && r.status === "ACTIVE" && (
              <DropdownMenuItem onSelect={() => setMessageTo([{ id: r.id, name: r.name }])}>
                <MessageSquare aria-hidden /> Message
              </DropdownMenuItem>
            )}
            {canManage && (
              <>
                {r.status !== "REMOVED" && (
                  <DropdownMenuItem onSelect={() => setForm({ key: Date.now(), initial: editValues(r) })}>
                    <Pencil aria-hidden /> Edit
                  </DropdownMenuItem>
                )}
                {r.status === "PENDING" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/approvals">
                      <UserCheck aria-hidden /> Review sign-up
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {r.status === "ACTIVE" && (
                  <DropdownMenuItem onSelect={() => setStatusTarget({ id: r.id, name: r.name, action: "suspend" })}>
                    <Ban aria-hidden /> Suspend
                  </DropdownMenuItem>
                )}
                {r.status === "SUSPENDED" && (
                  <DropdownMenuItem onSelect={() => setStatusTarget({ id: r.id, name: r.name, action: "reactivate" })}>
                    <UserCheck aria-hidden /> Reactivate
                  </DropdownMenuItem>
                )}
                {r.status === "REMOVED" ? (
                  r.canRestore && (
                    <DropdownMenuItem onSelect={() => setStatusTarget({ id: r.id, name: r.name, action: "restore" })}>
                      <ArchiveRestore aria-hidden /> Restore
                    </DropdownMenuItem>
                  )
                ) : (
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setStatusTarget({ id: r.id, name: r.name, action: "remove" })}
                  >
                    <Trash2 aria-hidden /> Remove
                  </DropdownMenuItem>
                )}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filterSelect = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: [string, string][],
  ) => (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {canManage && (
          <>
            <Button variant="role" onClick={() => setForm({ key: Date.now(), initial: null })}>
              <UserPlus aria-hidden /> Add member
            </Button>
            <Button variant="outline" onClick={() => setImporting(true)}>
              <FileUp aria-hidden /> Import CSV
            </Button>
          </>
        )}
      </div>

      <section
        aria-label="Filters"
        className="grid grid-cols-2 gap-3 rounded-(--radius-lg) border border-border bg-card p-4 shadow-soft md:grid-cols-3 xl:grid-cols-6"
      >
        <div className="col-span-2 min-w-0 space-y-1 md:col-span-3 xl:col-span-1">
          <label htmlFor="m-q" className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="m-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email or phone"
              className="pl-9"
            />
          </div>
        </div>
        {filterSelect("m-role", "Role", role ?? "ALL", (v) => setRole(v as MemberFilters["role"]), [
          ["ALL", "All roles"],
          ["MEMBER", "Members"],
          ["VOLUNTEER", "Volunteers"],
          ["ADMIN", "Admins"],
        ])}
        {filterSelect("m-status", "Status", status, (v) => setStatus(v as StatusFilter), [
          ["CURRENT", "Current"],
          ["ACTIVE", "Active"],
          ["PENDING", "Pending"],
          ["SUSPENDED", "Suspended"],
          ["REMOVED", "Removed (30 days)"],
          ["ALL", "Everyone"],
        ])}
        {filterSelect("m-team", "Team", teamId, setTeamId, [
          ["ALL", "All teams"],
          ...teams.map((t) => [t.id, t.name] as [string, string]),
          ["NONE", "No team"],
        ])}
        {filterSelect("m-band", "Band", band ?? "ALL", (v) => setBand(v as MemberFilters["band"]), [
          ["ALL", "All bands"],
          ["gold", "Gold standard"],
          ["green", "Strong"],
          ["amber", "Needs attention"],
          ["red", "At risk"],
          ["none", "No meetings yet"],
        ])}
        {filterSelect("m-remote", "Remote", remote ?? "ALL", (v) => setRemote(v as MemberFilters["remote"]), [
          ["ALL", "Everyone"],
          ["YES", "Remote only"],
          ["NO", "In Lagos"],
        ])}
      </section>

      {chosen.length > 0 && (canManage || canMessage) && (
        <section
          aria-label="Bulk actions"
          className="flex flex-wrap items-end gap-2 rounded-(--radius-lg) border border-role/40 bg-role-soft/60 p-3"
        >
          <p className="w-full text-sm font-semibold sm:w-auto sm:self-center" aria-live="polite">
            {chosen.length} selected
          </p>
          {canMessage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMessageTo(chosen.map((c) => ({ id: c.id, name: c.name })))}
            >
              <MessageSquare aria-hidden /> Message
            </Button>
          )}
          {canManage && (
            <>
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <label htmlFor="bulk-team" className="text-xs font-medium">
                    Assign team
                  </label>
                  <NativeSelect
                    id="bulk-team"
                    value={bulkTeam}
                    onChange={(e) => setBulkTeam(e.target.value)}
                    className="h-9 w-44"
                  >
                    <option value="">Choose a team…</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                    <option value="NONE">No team</option>
                  </NativeSelect>
                </div>
                <Button variant="outline" size="sm" disabled={!bulkTeam || busy} onClick={assignTeam}>
                  {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Users aria-hidden />} Apply
                </Button>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setBulkSuspend(true)}>
                <Ban aria-hidden /> Suspend
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </section>
      )}

      <DataTable
        caption="Members directory"
        columns={columns}
        rows={visible}
        getRowId={(r) => r.id}
        rowLabel={(r) => r.name}
        selectable={canManage || canMessage}
        selected={selected}
        onSelectedChange={setSelected}
        initialSort={{ key: "name", dir: "asc" }}
        maxHeight={640}
        toolbar={
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Showing <span className={cn("font-semibold text-foreground")}>{visible.length}</span> of {rows.length}{" "}
            people
          </p>
        }
        empty={
          <EmptyState
            illustration="search"
            title="Nobody matches these filters"
            description="Try a different search, or clear the filters."
            action={
              filtersActive ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />

      {form && (
        <MemberFormSheet
          key={form.key}
          open
          onOpenChange={(o) => !o && setForm(null)}
          teams={teams}
          initial={form.initial}
          onSaved={refresh}
        />
      )}
      <ImportMembersSheet open={importing} onOpenChange={setImporting} onImported={refresh} />
      <MemberStatusDialogs target={statusTarget} onClose={() => setStatusTarget(null)} onDone={refresh} />
      <MessageDialog
        people={messageTo ?? []}
        open={!!messageTo}
        onOpenChange={(o) => !o && setMessageTo(null)}
        onSent={() => setSelected(new Set())}
      />
      <ReasonDialog
        open={bulkSuspend}
        onOpenChange={setBulkSuspend}
        title={`Suspend ${chosen.length} ${chosen.length === 1 ? "person" : "people"}`}
        description="They cannot sign in while suspended. Admin accounts and people who are not active are skipped."
        confirmLabel="Suspend"
        destructive
        onConfirm={async (reason) => {
          const r = await apiRequest<{ done: string[]; skipped: { message: string }[] }>("/api/v1/admin/members/bulk", {
            body: { action: "suspend", ids: chosen.map((c) => c.id), reason },
          });
          if (!r.ok) return r.message;
          toast.success(`${r.done.length} suspended`, {
            description: r.skipped.length ? `${r.skipped.length} skipped: ${r.skipped[0].message}` : undefined,
          });
          refresh();
          return null;
        }}
      />
    </div>
  );
}
