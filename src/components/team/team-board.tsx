"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound, UserPlus } from "lucide-react";
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
  resetMemberPasswordAction,
  setMemberActiveAction,
  setMemberPoAccessAction,
  setMemberRoleAction,
} from "@/app/team/actions";
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

export function TeamBoard({
  members,
  currentUserId,
  migrationPending,
}: {
  members: TeamMember[];
  currentUserId: string;
  migrationPending?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [resetting, setResetting] = React.useState<TeamMember | null>(null);

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
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{m.employeeId || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{m.phone || m.email || "—"}</TableCell>
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
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
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
    </>
  );
}
