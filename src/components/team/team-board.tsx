"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, Pencil, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createMemberAction,
  renameMemberAction,
  resetMemberPasswordAction,
  setMemberActiveAction,
  setMemberOfficeAction,
  setMemberPoAccessAction,
  setMemberRoleAction,
  setWeeklyOffPatternAction,
  updateMemberPhoneAction,
} from "@/app/team/actions";
import { isSunday, orgToday, weekOffUiEnabled, type WeekOffKind } from "@/lib/attendance/compute";
import { roleLabel } from "@/lib/labels";
import type { Role } from "@/lib/types";

export interface TeamMember {
  userId: string;
  name: string;
  /** Auto-generated KV001-style ID; empty until migration 0015 is applied. */
  employeeId: string;
  phone: string;
  email: string;
  role: Role;
  isActive: boolean;
  canViewPurchaseOrders: boolean;
  /** Explicit Office/Site setting (attendance leave/holiday policy + badge) — independent of project assignment. */
  isOffice: boolean;
  /** Default weekly off day, 0 = Sunday … 6 = Saturday (0047; Sunday until applied). */
  weeklyOffDow: number;
  /** Weekly-off type (0049; "fixed" until applied). */
  weeklyOffKind: WeekOffKind;
  /** alternate_sunday: one off Sunday ("YYYY-MM-DD"), else "". */
  weeklyOffAnchor: string;
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The Team page's "Type" choices — "sunday" and "other" are both kind "fixed". */
type WeekOffChoice = "sunday" | "alternate" | "flexible" | "other";

function weekOffChoiceOf(m: TeamMember): WeekOffChoice {
  if (m.weeklyOffKind === "alternate_sunday") return "alternate";
  if (m.weeklyOffKind === "flexible") return "flexible";
  return m.weeklyOffDow === 0 ? "sunday" : "other";
}

/** Short read-only label for a member's weekly off ("" = the default, every Sunday). */
function weekOffSummary(m: TeamMember): string {
  if (m.weeklyOffKind === "alternate_sunday") return "Alt. Sundays";
  if (m.weeklyOffKind === "flexible") return "Flexible";
  return m.weeklyOffDow === 0 ? "" : WEEKDAYS_SHORT[m.weeklyOffDow];
}

/**
 * Off-Sunday choices for alternate Sundays: the previous 4 and next 8
 * Sundays around today (org-local), plus `current` when it's outside that range.
 */
function sundayOptions(current: string): { value: string; label: string }[] {
  const [y, mo, d] = orgToday().split("-").map(Number);
  const start = new Date(Date.UTC(y, mo - 1, d));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay() - 4 * 7); // 4 Sundays before this week's
  const values = Array.from({ length: 13 }, (_, i) => {
    const s = new Date(start);
    s.setUTCDate(s.getUTCDate() + i * 7);
    return s.toISOString().slice(0, 10);
  });
  if (current && isSunday(current) && !values.includes(current)) values.push(current);
  return values.sort().map((value) => ({
    value,
    label: new Date(`${value}T00:00:00Z`).toLocaleDateString("en-IN", {
      timeZone: "UTC",
      weekday: "short",
      day: "2-digit",
      month: "short",
      ...(value.slice(0, 4) !== String(y) ? { year: "numeric" } : {}),
    }),
  }));
}

/** Roles an admin can assign (in menu order) — the full catalog. */
const ASSIGNABLE: Role[] = [
  "super_admin",
  "pm",
  "supervisor",
  "accountant",
  "hr",
  "staff",
  "architect",
  "engineer",
  "subcontractor",
  "viewer",
  "client",
];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

/** 10 chars from an unambiguous alphabet (no 0/O/1/l/i) — these get read aloud. */
function randomPassword() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function NewMemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<Role>("supervisor");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await createMemberAction({ name: name.trim(), phone: phone.trim(), password, role });
    setSaving(false);
    if (res.error) return setError(res.error);
    onClose();
    setName("");
    setPhone("");
    setPassword("");
    setRole("supervisor");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="New Team Member" description="Creates a phone + password login and assigns a role.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="m-name">Full name</Label>
          <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh Kumar" autoFocus required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="m-phone">Phone number</Label>
            <Input id="m-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9XXXXXXXXX" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-role">Role</Label>
            <Select id="m-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ASSIGNABLE.map((r) => (
                <option key={r} value={r}>{roleLabel[r] ?? r}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="m-pass">Temporary password</Label>
          <Input id="m-pass" type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min 6 characters" required />
          <p className="text-xs text-muted-foreground">They log in with their phone number + this password.</p>
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create Account"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ResetPasswordDialog({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  const [password, setPassword] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    setError(null);
    const res = await resetMemberPasswordAction(member.userId, password);
    setSaving(false);
    if (res.error) return setError(res.error);
    setDone(true);
  }

  return (
    <Dialog
      open={!!member}
      onClose={onClose}
      title="Reset Password"
      description={member ? `Set a new login password for ${member.name}.` : ""}
    >
      {done ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md bg-success/10 px-3 py-3 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div>
              <p className="font-medium">Password updated.</p>
              <p className="mt-1 text-muted-foreground">
                Share it with {member?.name} — it isn&apos;t shown again after you close this.
              </p>
            </div>
          </div>
          <div className="rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-center font-mono text-base tracking-wide">
            {password}
          </div>
          <div className="flex justify-end pt-2">
            <Button type="button" onClick={onClose}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="r-pass">New password</Label>
            <div className="flex gap-2">
              <Input
                id="r-pass"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="min 6 characters"
                autoComplete="off"
                autoFocus
                required
              />
              <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>
                Generate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              They sign in with their phone number and this password. No email is sent.
            </p>
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Set Password"}</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function RenameMemberDialog({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = React.useState(member?.name ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setName(member?.name ?? "");
    setError(null);
  }, [member]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    setError(null);
    const res = await renameMemberAction(member.userId, name);
    setSaving(false);
    if (res.error) return setError(res.error);
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={!!member}
      onClose={onClose}
      title="Edit Name"
      description={member ? `Change the display name for ${member.name}.` : ""}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="rn-name">Full name</Label>
          <Input id="rn-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
          <p className="text-xs text-muted-foreground">
            This only changes how their name is shown — their login phone number and password stay the same.
          </p>
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function EditPhoneDialog({ member, onClose }: { member: TeamMember | null; onClose: () => void }) {
  const router = useRouter();
  const [phone, setPhone] = React.useState(member?.phone ?? "");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPhone(member?.phone ?? "");
    setError(null);
  }, [member]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;
    setSaving(true);
    setError(null);
    const res = await updateMemberPhoneAction(member.userId, phone);
    setSaving(false);
    if (res.error) return setError(res.error);
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={!!member}
      onClose={onClose}
      title="Edit Login Phone"
      description={member ? `Change the phone number ${member.name} logs in with.` : ""}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ph-phone">Phone number</Label>
          <Input id="ph-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9XXXXXXXXX" autoFocus required />
          <p className="text-xs text-muted-foreground">
            They&apos;ll need to log in with this new number from now on — their password stays the same.
          </p>
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function TeamBoard({
  members: initialMembers,
  currentUserId,
  migrationPending,
  weekOffPending,
  weekOffKindsPending,
}: {
  members: TeamMember[];
  currentUserId: string;
  migrationPending?: boolean;
  /** weekly_off_dow column missing (0047 not applied) — the select is disabled. */
  weekOffPending?: boolean;
  /** weekly_off_kind column missing (0049 not applied) — Alternate / Flexible are disabled. */
  weekOffKindsPending?: boolean;
}) {
  const router = useRouter();
  const [members, setMembers] = React.useState(initialMembers);
  React.useEffect(() => setMembers(initialMembers), [initialMembers]);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [resetting, setResetting] = React.useState<TeamMember | null>(null);
  const [renaming, setRenaming] = React.useState<TeamMember | null>(null);
  const [editingPhone, setEditingPhone] = React.useState<TeamMember | null>(null);
  // Members switched to "Alternate Sundays off" whose off Sunday isn't chosen
  // yet — nothing is saved until a Sunday is picked.
  const [pendingAlternate, setPendingAlternate] = React.useState<Set<string>>(() => new Set());
  const setAlternatePending = (userId: string, pending: boolean) =>
    setPendingAlternate((prev) => {
      const next = new Set(prev);
      if (pending) next.add(userId);
      else next.delete(userId);
      return next;
    });

  async function changeRole(userId: string, role: Role) {
    setBusy(userId);
    const res = await setMemberRoleAction(userId, role);
    setBusy(null);
    if (res.error) window.alert(res.error);
    else router.refresh();
  }

  async function toggleActive(userId: string, next: boolean) {
    setBusy(userId);
    const res = await setMemberActiveAction(userId, next);
    setBusy(null);
    if (res.error) window.alert(res.error);
    else router.refresh();
  }

  async function togglePoAccess(userId: string, next: boolean) {
    setBusy(userId);
    const res = await setMemberPoAccessAction(userId, next);
    setBusy(null);
    if (res.error) window.alert(res.error);
    else router.refresh();
  }

  async function toggleOffice(userId: string, next: boolean) {
    // Optimistic: flip it instantly instead of waiting on a full page
    // refresh (which also re-lists every auth user and felt slow for a
    // same-row dropdown change). Revert only if the save actually fails.
    setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, isOffice: next } : m)));
    setBusy(userId);
    const res = await setMemberOfficeAction(userId, next);
    setBusy(null);
    if (res.error) {
      window.alert(res.error);
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, isOffice: !next } : m)));
    }
  }

  async function changeWeeklyOff(member: TeamMember, kind: WeekOffKind, dow: number, anchor: string) {
    const before = {
      weeklyOffKind: member.weeklyOffKind,
      weeklyOffDow: member.weeklyOffDow,
      weeklyOffAnchor: member.weeklyOffAnchor,
    };
    const next = { weeklyOffKind: kind, weeklyOffDow: dow, weeklyOffAnchor: anchor };
    // Optimistic, same as toggleOffice — revert only if the save fails.
    setMembers((prev) => prev.map((m) => (m.userId === member.userId ? { ...m, ...next } : m)));
    setBusy(member.userId);
    const res = await setWeeklyOffPatternAction(member.userId, { kind, dow, anchor: anchor || undefined });
    setBusy(null);
    if (res.error) {
      window.alert(res.error);
      setMembers((prev) => prev.map((m) => (m.userId === member.userId ? { ...m, ...before } : m)));
    }
  }

  function changeWeekOffChoice(member: TeamMember, choice: WeekOffChoice) {
    // Alternate needs an off Sunday first — show the Sunday picker, save on pick.
    if (choice === "alternate") {
      if (member.weeklyOffKind !== "alternate_sunday") setAlternatePending(member.userId, true);
      return;
    }
    setAlternatePending(member.userId, false);
    if (choice === "sunday") return changeWeeklyOff(member, "fixed", 0, "");
    if (choice === "other") {
      const keep = member.weeklyOffKind === "fixed" && member.weeklyOffDow !== 0;
      return changeWeeklyOff(member, "fixed", keep ? member.weeklyOffDow : 1, "");
    }
    return changeWeeklyOff(member, "flexible", 0, "");
  }

  /** Saves kind + anchor together, only once an off Sunday is picked. */
  function changeWeekOffAnchor(member: TeamMember, anchor: string) {
    if (!isSunday(anchor)) return;
    setAlternatePending(member.userId, false);
    if (member.weeklyOffKind === "alternate_sunday" && anchor === member.weeklyOffAnchor) return;
    void changeWeeklyOff(member, "alternate_sunday", 0, anchor);
  }

  return (
    <>
      <PageHeader
        title="Team & Roles"
        description="Create accounts, assign roles, and control access"
        action={
          <Button onClick={() => setOpen(true)}>
            <UserPlus /> New Member
          </Button>
        }
      />

      {migrationPending && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span className="font-medium">Setup step required:</span> run the one-time database migration
          (role values + <code>memberships.is_active</code>) so creating members with new roles and
          activate/deactivate work. Until then those actions will show an error.
        </div>
      )}

      <Card>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Employee ID</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Office / Site</TableHead>
                <TableHead>Weekly off</TableHead>
                <TableHead>Purchase Orders</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const self = m.userId === currentUserId;
                return (
                  <TableRow key={m.userId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar initials={initials(m.name)} color="#1e3a5f" className="h-7 w-7 text-[10px]" />
                        <span className="font-medium">{m.name}{self && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          aria-label={`Edit ${m.name}'s name`}
                          title="Edit name"
                          onClick={() => setRenaming(m)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{m.employeeId || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span>{m.phone || m.email || "—"}</span>
                        {!m.email && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            aria-label={`Edit ${m.name}'s login phone`}
                            title="Edit login phone"
                            onClick={() => setEditingPhone(m)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={m.role}
                        disabled={busy === m.userId}
                        onChange={(e) => changeRole(m.userId, e.target.value as Role)}
                        className="h-8 w-44 text-xs"
                      >
                        {ASSIGNABLE.map((r) => (
                          <option key={r} value={r}>{roleLabel[r] ?? r}</option>
                        ))}
                        {!ASSIGNABLE.includes(m.role) && <option value={m.role}>{roleLabel[m.role] ?? m.role}</option>}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={m.isOffice ? "office" : "site"}
                        disabled={busy === m.userId}
                        onChange={(e) => toggleOffice(m.userId, e.target.value === "office")}
                        className="h-8 w-28 text-xs"
                        title="Which attendance leave/holiday policy applies — independent of project assignment"
                      >
                        <option value="office">Office</option>
                        <option value="site">Site</option>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {weekOffUiEnabled(m.isOffice) ? (
                        (() => {
                          const pendingAlt = pendingAlternate.has(m.userId);
                          const choice = pendingAlt ? "alternate" : weekOffChoiceOf(m);
                          const disabled = busy === m.userId || weekOffPending;
                          const kindsTip = "Run 0049_attendance_weekly_off_types.sql in Supabase first";
                          // Alternate / Flexible are Site-only; an office member keeps seeing a
                          // current non-fixed value (so the select never shows a wrong choice).
                          const showSiteKinds = (c: WeekOffChoice) => !m.isOffice || choice === c;
                          return (
                            <div className="flex flex-wrap items-center gap-1">
                              <Select
                                aria-label={`${m.name}'s weekly off type`}
                                value={choice}
                                disabled={disabled}
                                onChange={(e) => changeWeekOffChoice(m, e.target.value as WeekOffChoice)}
                                className="h-8 w-44 text-xs"
                                title={
                                  weekOffPending
                                    ? "Run 0047_attendance_weekly_off.sql in Supabase first"
                                    : "Weekly off (applies from today) — swaps are recorded on the Attendance tab"
                                }
                              >
                                <option value="sunday">Every Sunday off</option>
                                {showSiteKinds("alternate") && (
                                  <option value="alternate" disabled={weekOffKindsPending} title={weekOffKindsPending ? kindsTip : undefined}>
                                    Alternate Sundays off
                                  </option>
                                )}
                                {showSiteKinds("flexible") && (
                                  <option value="flexible" disabled={weekOffKindsPending} title={weekOffKindsPending ? kindsTip : undefined}>
                                    Flexible (= Sundays in month)
                                  </option>
                                )}
                                <option value="other">Fixed other day</option>
                              </Select>
                              {choice === "other" && (
                                <Select
                                  aria-label={`${m.name}'s weekly off day`}
                                  value={String(m.weeklyOffDow)}
                                  disabled={disabled}
                                  onChange={(e) => changeWeeklyOff(m, "fixed", Number(e.target.value), "")}
                                  className="h-8 w-20 text-xs"
                                >
                                  {WEEKDAYS_SHORT.map((d, i) =>
                                    i === 0 ? null : <option key={d} value={i}>{d}</option>
                                  )}
                                </Select>
                              )}
                              {choice === "alternate" && (
                                <Select
                                  aria-label={`${m.name}'s off Sunday`}
                                  title="An off Sunday — every other Sunday from it is off too"
                                  value={pendingAlt ? "" : m.weeklyOffAnchor}
                                  disabled={disabled}
                                  onChange={(e) => changeWeekOffAnchor(m, e.target.value)}
                                  className="h-8 w-40 text-xs"
                                >
                                  <option value="" disabled>
                                    Choose an off Sunday…
                                  </option>
                                  {sundayOptions(m.weeklyOffAnchor).map((o) => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </Select>
                              )}
                            </div>
                          );
                        })()
                      ) : weekOffSummary(m) ? (
                        // UI not enabled for this category, but a non-default weekly off still applies — show it.
                        <span className="text-xs text-muted-foreground" title="Weekly off (read-only for this category)">
                          {weekOffSummary(m)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.role === "super_admin" ? (
                        <Badge variant="success">Always</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant={m.canViewPurchaseOrders ? "default" : "outline"}
                          disabled={busy === m.userId}
                          onClick={() => togglePoAccess(m.userId, !m.canViewPurchaseOrders)}
                          className="h-8"
                        >
                          {m.canViewPurchaseOrders ? "Granted" : "No access"}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.isActive ? "success" : "muted"}>{m.isActive ? "Active" : "Disabled"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === m.userId}
                          onClick={() => setResetting(m)}
                          title="Set a new login password"
                        >
                          <KeyRound /> Reset Password
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === m.userId || self}
                          onClick={() => toggleActive(m.userId, !m.isActive)}
                          title={self ? "You can't disable your own account" : undefined}
                        >
                          {m.isActive ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    No members yet — add one with “New Member”.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewMemberDialog open={open} onClose={() => setOpen(false)} />
      {/* keyed per member so each open starts from a clean form */}
      <ResetPasswordDialog
        key={resetting?.userId ?? "none"}
        member={resetting}
        onClose={() => setResetting(null)}
      />
      <RenameMemberDialog
        key={`rename-${renaming?.userId ?? "none"}`}
        member={renaming}
        onClose={() => setRenaming(null)}
      />
      <EditPhoneDialog
        key={`phone-${editingPhone?.userId ?? "none"}`}
        member={editingPhone}
        onClose={() => setEditingPhone(null)}
      />
    </>
  );
}
