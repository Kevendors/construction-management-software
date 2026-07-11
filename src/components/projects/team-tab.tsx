"use client";

import * as React from "react";
import { UserPlus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Label } from "@/components/ui/input";
import { Dialog, Select } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRole } from "@/components/layout/role-provider";
import { useProjectTeam, useStore } from "@/lib/store/project-store";
import { roleLabel } from "@/lib/labels";
import type { Role, User } from "@/lib/types";

/** Project roles a super admin can assign (full catalog, menu order). */
const PROJECT_ROLES: Role[] = [
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

function AddMemberDialog({
  open,
  onClose,
  candidates,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  candidates: User[];
  onAdd: (userId: string, role: Role) => Promise<string | null>;
}) {
  const [userId, setUserId] = React.useState("");
  const [role, setRole] = React.useState<Role>("engineer");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // keep the selection valid as the candidate list changes
  const selected = candidates.some((u) => u.id === userId)
    ? userId
    : (candidates[0]?.id ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    const err = await onAdd(selected, role);
    setSaving(false);
    if (err) return setError(err);
    setUserId("");
    setRole("engineer");
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add to Project Team"
      description="Assign an existing member to this project with a project role."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pt-user">Member</Label>
          <Select id="pt-user" value={selected} onChange={(e) => setUserId(e.target.value)}>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
          {candidates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Everyone in the organization is already on this project.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pt-role">Project role</Label>
          <Select id="pt-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {PROJECT_ROLES.map((r) => (
              <option key={r} value={r}>{roleLabel[r] ?? r}</option>
            ))}
          </Select>
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !selected}>
            {saving ? "Adding…" : "Add Member"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function TeamTab({ projectId }: { projectId: string }) {
  const { role } = useRole();
  const { users, addProjectMember, setProjectMemberRole, removeProjectMember } = useStore();
  const team = useProjectTeam(projectId);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  const canManage = role === "super_admin";
  const onProject = new Set(team.map((t) => t.member.userId));
  const candidates = users.filter((u) => !onProject.has(u.id));

  async function changeRole(userId: string, next: Role) {
    setBusy(userId);
    const err = await setProjectMemberRole(projectId, userId, next);
    setBusy(null);
    if (err) window.alert(err);
  }

  async function remove(userId: string) {
    setBusy(userId);
    const err = await removeProjectMember(projectId, userId);
    setBusy(null);
    if (err) window.alert(err);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Project Team</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <UserPlus /> Add Member
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Project role</TableHead>
                {canManage && <TableHead className="text-right">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map(({ member, user }) => (
                <TableRow key={member.userId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar
                        initials={user?.initials || "?"}
                        color={user?.avatarColor ?? "#1e3a5f"}
                        className="h-7 w-7 text-[10px]"
                      />
                      <span className="font-medium">{user?.name ?? "Unknown user"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <Select
                        value={member.role}
                        disabled={busy === member.userId}
                        onChange={(e) => changeRole(member.userId, e.target.value as Role)}
                        className="h-8 w-44 text-xs"
                      >
                        {PROJECT_ROLES.map((r) => (
                          <option key={r} value={r}>{roleLabel[r] ?? r}</option>
                        ))}
                      </Select>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {roleLabel[member.role] ?? member.role}
                      </span>
                    )}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === member.userId}
                        onClick={() => remove(member.userId)}
                      >
                        <X /> Remove
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {team.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={canManage ? 3 : 2}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    {canManage
                      ? "No one is assigned yet — add a member to give them access to this project."
                      : "No team members have been assigned to this project yet."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {!canManage && team.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Only a Super Admin can change project assignments.
            </p>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <AddMemberDialog
          open={open}
          onClose={() => setOpen(false)}
          candidates={candidates}
          onAdd={(userId, r) => addProjectMember(projectId, userId, r)}
        />
      )}
    </>
  );
}
