"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Loader2, Mail, Minus, Plus, Search, ShieldCheck, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FormField, NativeSelect } from "@/components/ui/form-field";
import { DataTable, type Column } from "@/components/ui/data-table";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ADMIN_LEVEL_LABELS, TITLE_LABELS, type AdminLevel, type Role, type TitleCode } from "@/lib/repo/types";
import { roleEffects, ROLE_LABELS, type Assignment } from "@/lib/admin/roles";
import { apiRequest } from "@/lib/api-client";
import { PersonStatusChip } from "./chips";

export interface RolePerson {
  id: string;
  name: string;
  email: string;
  role: Role;
  adminLevel: AdminLevel | null;
  titles: TitleCode[];
  teamName: string | null;
  status: "ACTIVE" | "SUSPENDED";
  isMe: boolean;
}

const LEVELS = Object.keys(ADMIN_LEVEL_LABELS) as AdminLevel[];
const TITLES = Object.keys(TITLE_LABELS) as TitleCode[];

const describe = (p: Pick<RolePerson, "role" | "adminLevel">) =>
  p.role === "ADMIN" && p.adminLevel ? ADMIN_LEVEL_LABELS[p.adminLevel] : ROLE_LABELS[p.role];

/** Roles and titles (spec 7.4 item 12). Admin-level changes and invitations need a Super Admin. */
export function RolesManager({
  people,
  canAdminLevels,
  focusId,
}: {
  people: RolePerson[];
  canAdminLevels: boolean;
  focusId?: string;
}) {
  const [q, setQ] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<"ALL" | Role>("ALL");
  const [editing, setEditing] = React.useState<RolePerson | null>(() => people.find((p) => p.id === focusId) ?? null);
  const [inviting, setInviting] = React.useState(false);

  const needle = q.trim().toLowerCase();
  const rows = people.filter(
    (p) =>
      (roleFilter === "ALL" || p.role === roleFilter) &&
      (!needle || p.name.toLowerCase().includes(needle) || p.email.toLowerCase().includes(needle)),
  );

  const columns: Column<RolePerson>[] = [
    {
      key: "name",
      header: "Person",
      primary: true,
      sortValue: (p) => p.name.toLowerCase(),
      cell: (p) => (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={p.name} size={32} className="hidden sm:inline-flex" />
          <div className="min-w-0">
            <Link href={`/admin/members/${p.id}`} className="block truncate font-semibold hover:underline">
              {p.name}
              {p.isMe && <span className="font-normal text-muted-foreground"> (you)</span>}
            </Link>
            <span className="block truncate text-xs text-muted-foreground">
              {p.teamName ? `${p.teamName} team` : "No team"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortValue: (p) => describe(p),
      cell: (p) => <span className="font-medium whitespace-nowrap">{describe(p)}</span>,
    },
    {
      key: "titles",
      header: "Titles",
      cell: (p) =>
        p.titles.length ? (
          <ul className="flex flex-wrap gap-1">
            {p.titles.map((t) => (
              <li key={t} className="rounded-full bg-role-soft px-2 py-0.5 text-xs font-medium text-role-strong">
                {TITLE_LABELS[t]}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">None</span>
        ),
    },
    { key: "status", header: "Status", cell: (p) => <PersonStatusChip status={p.status} /> },
    {
      key: "change",
      header: "Change",
      align: "right",
      cell: (p) => {
        const locked = p.isMe || (p.role === "ADMIN" && !canAdminLevels);
        return (
          <Button variant="outline" size="sm" disabled={locked} onClick={() => setEditing(p)}>
            <UserCog aria-hidden /> Change<span className="sr-only"> role for {p.name}</span>
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 basis-56 space-y-1">
          <label htmlFor="r-q" className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="r-q"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name or email"
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-44 space-y-1">
          <label htmlFor="r-role" className="text-xs font-medium text-muted-foreground">
            Role
          </label>
          <NativeSelect id="r-role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as "ALL" | Role)}>
            <option value="ALL">All roles</option>
            <option value="MEMBER">Members</option>
            <option value="VOLUNTEER">Volunteers</option>
            <option value="ADMIN">Admins</option>
          </NativeSelect>
        </div>
        {canAdminLevels && (
          <Button variant="role" onClick={() => setInviting(true)}>
            <Mail aria-hidden /> Invite an admin
          </Button>
        )}
      </div>
      {!canAdminLevels && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck aria-hidden className="size-4" /> Admin roles and levels can only be changed by a Super Admin.
        </p>
      )}

      <DataTable
        caption="People and their roles"
        columns={columns}
        rows={rows}
        getRowId={(p) => p.id}
        initialSort={{ key: "name", dir: "asc" }}
        maxHeight={640}
      />

      {editing && (
        <ChangeRoleDialog
          key={editing.id}
          person={editing}
          canAdminLevels={canAdminLevels}
          onClose={() => setEditing(null)}
        />
      )}
      <InviteAdminDialog open={inviting} onOpenChange={setInviting} />
    </div>
  );
}

function ChangeRoleDialog({
  person,
  canAdminLevels,
  onClose,
}: {
  person: RolePerson;
  canAdminLevels: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [next, setNext] = React.useState<Assignment>({
    role: person.role,
    adminLevel: person.adminLevel,
    titles: person.titles,
  });
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const before: Assignment = { role: person.role, adminLevel: person.adminLevel, titles: person.titles };
  const effects = roleEffects(before, next);
  const changed = effects.summary.length > 0 || effects.gains.length > 0 || effects.losses.length > 0;
  const isAdmin = person.role === "ADMIN";

  const toggleTitle = (t: TitleCode) =>
    setNext((n) => ({ ...n, titles: n.titles.includes(t) ? n.titles.filter((x) => x !== t) : [...n.titles, t] }));

  const save = async () => {
    setBusy(true);
    const r = await apiRequest<{ name: string }>(`/api/v1/admin/members/${person.id}/role`, {
      method: "PATCH",
      body: next,
    });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    toast.success(`${person.name}'s role is updated`, { description: "They were told by email and in the app." });
    onClose();
    router.refresh();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Change role for {person.name}</DialogTitle>
          <DialogDescription>
            Now: {describe(person)}
            {person.titles.length ? ` · ${person.titles.map((t) => TITLE_LABELS[t]).join(", ")}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {isAdmin ? (
            <FormField id="cr-level" label="Admin level" hint="Changing this needs a Super Admin.">
              {(aria) => (
                <NativeSelect
                  {...aria}
                  value={next.adminLevel ?? ""}
                  disabled={!canAdminLevels}
                  onChange={(e) => setNext((n) => ({ ...n, adminLevel: e.target.value as AdminLevel }))}
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {ADMIN_LEVEL_LABELS[l]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          ) : (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Primary role</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["MEMBER", "VOLUNTEER"] as const).map((r) => (
                  <label
                    key={r}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-(--radius-md) border border-border px-3 has-checked:border-role has-checked:bg-role-soft"
                  >
                    <input
                      type="radio"
                      name="cr-role"
                      value={r}
                      checked={next.role === r}
                      onChange={() => setNext((n) => ({ ...n, role: r }))}
                      className="accent-(--role)"
                    />
                    {ROLE_LABELS[r]}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                To make someone an admin, send them an admin invitation so they set up two-factor sign-in.
              </p>
            </fieldset>
          )}

          {!isAdmin && (
            <fieldset className="space-y-2" disabled={next.role !== "VOLUNTEER"}>
              <legend className="text-sm font-medium">Titles</legend>
              {next.role !== "VOLUNTEER" && <p className="text-xs text-muted-foreground">Titles are for volunteers.</p>}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TITLES.map((t) => (
                  <div
                    key={t}
                    className="flex min-h-11 items-center gap-2 rounded-(--radius-md) border border-border px-3"
                  >
                    <Checkbox
                      id={`cr-t-${t}`}
                      checked={next.role === "VOLUNTEER" && next.titles.includes(t)}
                      onCheckedChange={() => toggleTitle(t)}
                      disabled={next.role !== "VOLUNTEER"}
                    />
                    <Label htmlFor={`cr-t-${t}`} className="cursor-pointer font-normal">
                      {TITLE_LABELS[t]}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>
          )}

          <section
            aria-labelledby="cr-effects"
            aria-live="polite"
            className="space-y-2 rounded-(--radius-md) bg-muted/60 p-3 text-sm"
          >
            <h3 id="cr-effects" className="font-semibold">
              What changes
            </h3>
            {!changed ? (
              <p className="text-muted-foreground">Nothing yet. Pick a new role or titles.</p>
            ) : (
              <>
                {effects.summary.map((s) => (
                  <p key={s} className="flex items-start gap-1.5">
                    <ArrowRight aria-hidden className="mt-0.5 size-4 shrink-0" /> {s}
                  </p>
                ))}
                {effects.gains.length > 0 && (
                  <div>
                    <p className="font-medium text-(--status-ontime-fg)">They gain</p>
                    <ul className="mt-1 space-y-0.5">
                      {effects.gains.map((g) => (
                        <li key={g} className="flex items-center gap-1.5">
                          <Plus aria-hidden className="size-3.5 text-(--status-ontime-fg)" /> {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {effects.losses.length > 0 && (
                  <div>
                    <p className="font-medium text-(--status-absent-fg)">They lose</p>
                    <ul className="mt-1 space-y-0.5">
                      {effects.losses.map((g) => (
                        <li key={g} className="flex items-center gap-1.5">
                          <Minus aria-hidden className="size-3.5 text-(--status-absent-fg)" /> {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {person.role === "VOLUNTEER" && next.role !== "VOLUNTEER" && (
                  <p className="text-xs text-muted-foreground">Their upcoming duty spots are freed for others.</p>
                )}
              </>
            )}
          </section>

          {error && (
            <p role="alert" className="text-sm text-(--status-absent-fg)">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="role" disabled={!changed || busy} onClick={save}>
              {busy && <Loader2 aria-hidden className="animate-spin" />} Confirm change
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InviteAdminDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [level, setLevel] = React.useState<AdminLevel>("ATTENDANCE_OFFICER");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErrors({ email: "Enter a valid email address." });
    setBusy(true);
    const r = await apiRequest<{ existing: boolean }>("/api/v1/admin/invites", {
      body: { email: email.trim(), adminLevel: level },
    });
    setBusy(false);
    if (!r.ok) return setErrors(r.fields ?? { form: r.message });
    toast.success(`Invitation sent to ${email.trim()}`, {
      description: r.existing
        ? "They already have an account: accepting makes it an admin account with two-factor sign-in."
        : "The link works once and expires in 7 days.",
    });
    setEmail("");
    setErrors({});
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Invite an admin</DialogTitle>
          <DialogDescription>
            They get an email with a one-time link to set a password and turn on two-factor sign-in.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          {errors.form && (
            <p role="alert" className="text-sm text-(--status-absent-fg)">
              {errors.form}
            </p>
          )}
          <FormField id="inv-email" label="Email" error={errors.email} required>
            {(aria) => (
              <Input
                {...aria}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            )}
          </FormField>
          <FormField id="inv-level" label="Admin level" required>
            {(aria) => (
              <NativeSelect {...aria} value={level} onChange={(e) => setLevel(e.target.value as AdminLevel)}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {ADMIN_LEVEL_LABELS[l]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <Button type="submit" variant="role" className="w-full" disabled={busy}>
            {busy && <Loader2 aria-hidden className="animate-spin" />} Send invitation
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
