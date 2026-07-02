"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, UserPlus } from "lucide-react";
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
  setMemberActiveAction,
  setMemberRoleAction,
} from "@/app/team/actions";
import { roleLabel } from "@/lib/labels";
import type { Role } from "@/lib/types";

export interface TeamMember {
  userId: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
  isActive: boolean;
}

/** Roles an admin can assign (in menu order). */
const ASSIGNABLE: Role[] = ["super_admin", "admin", "pm", "supervisor"];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
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
                <TableHead>Login</TableHead>
                <TableHead>Role</TableHead>
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
                      <Badge variant={m.isActive ? "success" : "muted"}>{m.isActive ? "Active" : "Disabled"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === m.userId || self}
                        onClick={() => toggleActive(m.userId, !m.isActive)}
                        title={self ? "You can't disable your own account" : undefined}
                      >
                        {m.isActive ? "Disable" : "Enable"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No members yet — add one with “New Member”.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewMemberDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
