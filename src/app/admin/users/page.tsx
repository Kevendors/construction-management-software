"use client";

import * as React from "react";
import { Plus, Trash2, Shield } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth/auth-context";
import { type AppRole, appRoleLabel } from "@/lib/auth/roles";

const LS_KEY = "sitehub:users:v1";

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  initials: string;
  avatarColor: string;
}

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"];
const ROLES: AppRole[] = ["admin", "supervisor", "viewer"];

function getInitials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function loadUsers(): ManagedUser[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [
    { id: "u1", name: "Admin User", email: "admin@keyvendors.com", role: "admin", initials: "AU", avatarColor: "#3b82f6" },
  ];
}

function saveUsers(users: ManagedUser[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(users));
  } catch { /* ignore */ }
}

const ROLE_VARIANT: Record<AppRole, "default" | "success" | "outline"> = {
  admin: "default",
  supervisor: "success",
  viewer: "outline",
};

export default function UserManagementPage() {
  const { role: currentRole } = useAuth();
  const [users, setUsers] = React.useState<ManagedUser[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [newRole, setNewRole] = React.useState<AppRole>("supervisor");

  React.useEffect(() => {
    setUsers(loadUsers());
  }, []);

  if (currentRole !== "admin") {
    return (
      <>
        <PageHeader title="User Management" description="Admin access required" />
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">You do not have permission to manage users.</p>
          </CardContent>
        </Card>
      </>
    );
  }

  function addUser(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const user: ManagedUser = {
      id: `u-${Date.now().toString(36)}`,
      name: name.trim(),
      email: email.trim(),
      role: newRole,
      initials: getInitials(name.trim()),
      avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
    const next = [...users, user];
    setUsers(next);
    saveUsers(next);
    setName("");
    setEmail("");
    setDialogOpen(false);
  }

  function changeRole(userId: string, role: AppRole) {
    const next = users.map((u) => (u.id === userId ? { ...u, role } : u));
    setUsers(next);
    saveUsers(next);
  }

  function removeUser(userId: string) {
    if (!confirm("Remove this user?")) return;
    const next = users.filter((u) => u.id !== userId);
    setUsers(next);
    saveUsers(next);
  }

  return (
    <>
      <PageHeader
        title="User Management"
        description="Add and manage user accounts and roles"
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus /> Add User
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar initials={u.initials} color={u.avatarColor} className="h-7 w-7 text-[11px]" />
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value as AppRole)}
                      className="h-8 w-32 text-xs"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{appRoleLabel[r]}</option>
                      ))}
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => removeUser(u.id)} disabled={u.id === "u1"}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add User" description="Create a new user account.">
        <form onSubmit={addUser} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Name</Label>
              <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email</Label>
              <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-role">Role</Label>
            <Select id="u-role" value={newRole} onChange={(e) => setNewRole(e.target.value as AppRole)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{appRoleLabel[r]}</option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit">Add User</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
