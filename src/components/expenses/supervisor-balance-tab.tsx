"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select } from "@/components/ui/dialog";
import { computeSupervisorBalances } from "./compute";
import type { ExpensesBoard } from "@/lib/data/expenses";
import { allocateBalanceAction } from "@/app/expenses/actions";
import { useRole } from "@/components/layout/role-provider";
import { cn, formatINR, todayISO } from "@/lib/utils";

export function SupervisorBalanceTab({ board }: { board: ExpensesBoard }) {
  const { ledger, users, expenses } = board;
  const { role, userId } = useRole();
  const isSuper = role === "super_admin";
  const [allocOpen, setAllocOpen] = React.useState(false);
  const userById = new Map(users.map((u) => [u.id, u]));

  let balances = computeSupervisorBalances(ledger, expenses);
  // A supervisor only ever sees their own imprest.
  if (!isSuper && userId) balances = balances.filter((b) => b.supervisorId === userId);

  return (
    <div className="space-y-4">
      {isSuper && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Allocate imprest to a supervisor; their approved expenses draw it down.</p>
          <Button size="sm" onClick={() => setAllocOpen(true)}>
            <Plus /> Allocate Balance
          </Button>
        </div>
      )}

      {balances.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {isSuper ? "No balance allocated yet — click “Allocate Balance”." : "No imprest balance allocated to you yet."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {balances.map((b) => {
            const sup = userById.get(b.supervisorId) ?? null;
            const spentPct = b.allocated > 0 ? Math.min(100, (b.spent / b.allocated) * 100) : 0;
            const entries = ledger
              .filter((e) => e.supervisorId === b.supervisorId && e.direction === "received")
              .sort((a, z) => +new Date(z.date) - +new Date(a.date));
            return (
              <Card key={b.supervisorId}>
                <CardHeader className="flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {sup && <Avatar initials={sup.initials} color={sup.avatarColor} className="h-8 w-8 text-xs" />}
                    <div>
                      <CardTitle className="text-base">{sup?.name ?? "Unknown"}</CardTitle>
                      <p className="text-xs text-muted-foreground">Site supervisor imprest</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className={cn("text-lg font-bold tabular-nums", b.remaining >= 0 ? "text-success" : "text-destructive")}>
                      {formatINR(b.remaining)}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-success/10 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Total Balance</p>
                      <p className="font-semibold tabular-nums text-success">{formatINR(b.allocated)}</p>
                    </div>
                    <div className="rounded-lg bg-destructive/10 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Spent (approved)</p>
                      <p className="font-semibold tabular-nums text-destructive">{formatINR(b.spent)}</p>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${spentPct}%` }} />
                  </div>
                  {entries.length > 0 && (
                    <ul className="space-y-1 pt-1 text-xs text-muted-foreground">
                      {entries.slice(0, 4).map((e) => (
                        <li key={e.id} className="flex items-center justify-between border-b border-border/60 py-1 last:border-0">
                          <span className="truncate">{e.note} · {new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                          <span className="font-medium text-success">+{formatINR(e.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {isSuper && <AllocateDialog board={board} open={allocOpen} onClose={() => setAllocOpen(false)} />}
    </div>
  );
}

function AllocateDialog({ board, open, onClose }: { board: ExpensesBoard; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { users } = board;
  const [supervisorId, setSupervisorId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(todayISO());
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setSupervisorId((v) => v || users[0]?.id || "");
  }, [open, users]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!supervisorId) return setError("Select a supervisor.");
    if (!Number(amount)) return setError("Enter a valid amount.");
    setSaving(true);
    setError(null);
    const res = await allocateBalanceAction({ supervisorId, amount: Number(amount), date, note: note.trim() });
    setSaving(false);
    if (res.error) return setError(res.error);
    onClose();
    setAmount(""); setNote("");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Allocate Balance" description="Give imprest cash to a supervisor." className="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="al-sup">Supervisor</Label>
          <Select id="al-sup" value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="al-amt">Amount (₹) *</Label>
            <Input id="al-amt" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="al-date">Date</Label>
            <Input id="al-date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="al-note">Note</Label>
          <Input id="al-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Cash advance for site works" />
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Allocate"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
