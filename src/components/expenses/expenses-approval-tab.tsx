"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select, Textarea } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { logExpense, setExpenseStatus } from "@/app/expenses/actions";
import type { ExpensesBoard } from "@/lib/data/expenses";
import { approvalMeta, categoryLabel, costCodeLabel } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import type { CostCode, ExpenseCategory } from "@/lib/types";

const CATEGORIES: ExpenseCategory[] = ["material", "salary", "site", "subcon", "other"];
const COST_CODES: CostCode[] = ["material", "machinery", "diesel", "labour", "other"];
const today = () => new Date().toISOString().slice(0, 10);

function LogExpenseDialog({
  board,
  open,
  onClose,
}: {
  board: ExpensesBoard;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { projects } = board;
  const [projectId, setProjectId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState<ExpenseCategory>("material");
  const [costCode, setCostCode] = React.useState<CostCode>("material");
  const [date, setDate] = React.useState(today());
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setProjectId((v) => v || projects[0]?.id || "");
  }, [open, projects]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt) return;
    setSaving(true);
    setError(null);
    const res = await logExpense({
      projectId,
      date,
      category,
      costCode,
      amount: amt,
      note: note.trim() || categoryLabel[category],
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
    setAmount("");
    setNote("");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Log Expense" description="Recorded as pending approval.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="x-amount">Amount (₹)</Label>
            <Input id="x-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="x-date">Date</Label>
            <Input id="x-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="x-project">Project</Label>
          <Select id="x-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="x-cat">Category</Label>
            <Select id="x-cat" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel[c]}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="x-code">Cost Code</Label>
            <Select id="x-code" value={costCode} onChange={(e) => setCostCode(e.target.value as CostCode)}>
              {COST_CODES.map((c) => <option key={c} value={c}>{costCodeLabel[c]}</option>)}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="x-note">Note</Label>
          <Textarea id="x-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was this for?" />
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Log Expense"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ExpensesApprovalTab({ board }: { board: ExpensesBoard }) {
  const router = useRouter();
  const { expenses, projects, users } = board;
  const userById = new Map(users.map((u) => [u.id, u]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const rows = [...expenses].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const [open, setOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function decide(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    const res = await setExpenseStatus(id, status);
    setBusyId(null);
    if (!res.error) router.refresh();
  }

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{expenses.length} expenses logged</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> Log Expense
        </Button>
      </div>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>By</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => {
              const by = userById.get(e.byId) ?? null;
              const project = projectById.get(e.projectId) ?? null;
              const meta = approvalMeta[e.status];
              return (
                <TableRow key={e.id}>
                  <TableCell className="tabular-nums">
                    {new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </TableCell>
                  <TableCell className="max-w-[18rem]">
                    <div className="font-medium">{e.note}</div>
                    <div className="text-xs text-muted-foreground">{costCodeLabel[e.costCode]}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{project?.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{categoryLabel[e.category]}</Badge>
                  </TableCell>
                  <TableCell>
                    {by && (
                      <div className="flex items-center gap-2">
                        <Avatar initials={by.initials} color={by.avatarColor} className="h-6 w-6 text-[10px]" />
                        <span className="text-xs text-muted-foreground">{by.name}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatINR(e.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {e.status === "pending" ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" disabled={busyId === e.id} onClick={() => decide(e.id, "approved")}>
                          <Check /> Approve
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busyId === e.id} onClick={() => decide(e.id, "rejected")}>
                          <X /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No expenses logged yet — click “Log Expense”.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <LogExpenseDialog board={board} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
