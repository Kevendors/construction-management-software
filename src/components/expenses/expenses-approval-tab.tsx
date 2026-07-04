"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X, FileText, UploadCloud, FileUp, Trash2 } from "lucide-react";
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
import { logExpense, setExpenseStatus, addExpenseCategoryAction, deleteExpenseAction } from "@/app/expenses/actions";
import { fileToResizedDataUrl } from "@/lib/image";
import type { ExpensesBoard, ExpenseCategoryOption } from "@/lib/data/expenses";
import { useRole } from "@/components/layout/role-provider";
import { approvalMeta, categoryLabel } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import type { ApprovalStatus } from "@/lib/types";

const ADD_NEW = "__add_new__";
const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Card", "Cheque"];
const STATUSES: ApprovalStatus[] = ["pending", "approved", "rejected"];
const today = () => new Date().toISOString().slice(0, 10);

async function fileToDataUrl(file: File): Promise<string> {
  if (file.type.startsWith("image/")) return fileToResizedDataUrl(file, 1400, 0.7);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

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
  const { projects, users } = board;
  const [title, setTitle] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [byId, setById] = React.useState("");
  const [cats, setCats] = React.useState<ExpenseCategoryOption[]>(board.categories);
  const [category, setCategory] = React.useState<string>(board.categories[0]?.slug ?? "other");
  const [addingCat, setAddingCat] = React.useState(false);
  const [newCat, setNewCat] = React.useState("");
  const [savingCat, setSavingCat] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [paymentMode, setPaymentMode] = React.useState("Cash");
  const [date, setDate] = React.useState(today());
  const [status, setStatus] = React.useState<ApprovalStatus>("pending");
  const [note, setNote] = React.useState("");
  const [billName, setBillName] = React.useState("");
  const [billSize, setBillSize] = React.useState(0);
  const [billDataUrl, setBillDataUrl] = React.useState("");
  const billInputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setProjectId((v) => v || projects[0]?.id || "");
    setById((v) => v || users[0]?.id || "");
  }, [open, projects, users]);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setError("Please choose an image or PDF file.");
      return;
    }
    setError(null);
    setBillName(file.name);
    setBillSize(file.size);
    try {
      setBillDataUrl(await fileToDataUrl(file));
    } catch {
      setError("Could not read that file.");
    }
  }

  function onBill(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function clearBill() {
    setBillName("");
    setBillSize(0);
    setBillDataUrl("");
    if (billInputRef.current) billInputRef.current.value = "";
  }

  function onCategoryChange(value: string) {
    if (value === ADD_NEW) {
      setAddingCat(true);
      setNewCat("");
      return;
    }
    setCategory(value);
  }

  async function addCategory() {
    const label = newCat.trim();
    if (!label) return setAddingCat(false);
    setSavingCat(true);
    setError(null);
    const res = await addExpenseCategoryAction(label);
    setSavingCat(false);
    if (res.error) return setError(res.error);
    if (res.slug && res.label) {
      setCats((prev) => (prev.some((c) => c.slug === res.slug) ? prev : [...prev, { slug: res.slug!, label: res.label! }]));
      setCategory(res.slug);
    }
    setAddingCat(false);
    setNewCat("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Expense title is required.");
    if (!projectId) return setError("Project is required.");
    if (!byId) return setError("Employee / person is required.");
    const amt = Number(amount);
    if (!amt) return setError("Amount is required.");
    if (date > today()) return setError("Expense date can't be in the future.");
    setSaving(true);
    setError(null);
    const res = await logExpense({
      title: title.trim(),
      projectId,
      byId,
      date,
      category,
      amount: amt,
      paymentMode,
      status,
      note: note.trim(),
      billDataUrl: billDataUrl || undefined,
    });
    setSaving(false);
    if (res.error) return setError(res.error);
    onClose();
    setTitle("");
    setAmount("");
    setNote("");
    clearBill();
    setStatus("pending");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Log Expense" description="Track who spent how much, on which project." className="max-w-xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="x-title">Expense Title *</Label>
          <Input id="x-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cement purchase" autoFocus required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="x-project">Project *</Label>
            <Select id="x-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} required>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="x-person">Employee / Person *</Label>
            <Select id="x-person" value={byId} onChange={(e) => setById(e.target.value)} required>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="x-amount">Amount (₹) *</Label>
            <Input id="x-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="x-cat">Category</Label>
            {addingCat ? (
              <div className="flex gap-1.5">
                <Input
                  autoFocus
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addCategory(); }
                    if (e.key === "Escape") setAddingCat(false);
                  }}
                  placeholder="New category name"
                  className="h-9"
                />
                <Button type="button" size="sm" onClick={addCategory} disabled={savingCat}>
                  {savingCat ? "…" : "Add"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setAddingCat(false)}>✕</Button>
              </div>
            ) : (
              <Select id="x-cat" value={category} onChange={(e) => onCategoryChange(e.target.value)}>
                {cats.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
                <option value={ADD_NEW}>+ Add category…</option>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="x-pay">Payment Mode</Label>
            <Select id="x-pay" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="x-date">Date</Label>
            <Input id="x-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="x-status">Status</Label>
            <Select id="x-status" value={status} onChange={(e) => setStatus(e.target.value as ApprovalStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{approvalMeta[s].label}</option>)}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="x-note">Notes</Label>
          <Textarea id="x-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional details…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="x-bill">Bill / Receipt (image or PDF)</Label>
          <input
            ref={billInputRef}
            id="x-bill"
            type="file"
            accept="image/*,application/pdf"
            onChange={onBill}
            className="sr-only"
          />
          {billName ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{billName}</p>
                {billSize > 0 && (
                  <p className="text-xs text-muted-foreground">{(billSize / 1024).toFixed(0)} KB</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => billInputRef.current?.click()}
                className="shrink-0 text-xs font-medium text-primary hover:underline"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={clearBill}
                aria-label="Remove attachment"
                className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => billInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
              className={`flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition ${
                dragging ? "border-primary bg-primary/5" : "border-border bg-secondary/20 hover:border-primary/50 hover:bg-secondary/40"
              }`}
            >
              <UploadCloud className={`h-6 w-6 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-sm font-medium text-foreground">
                Click to upload <span className="font-normal text-muted-foreground">or drag &amp; drop</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <FileUp className="h-3 w-3" /> Image or PDF, up to ~10 MB
              </span>
            </button>
          )}
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
  const catLabelOf = (slug: string) =>
    board.categories.find((c) => c.slug === slug)?.label ?? categoryLabel[slug] ?? slug;
  const { role } = useRole();
  const isSuper = role === "super_admin";
  const [open, setOpen] = React.useState(false);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [projectFilter, setProjectFilter] = React.useState("all");
  const [personFilter, setPersonFilter] = React.useState("all");

  const rows = expenses
    .filter((e) => projectFilter === "all" || e.projectId === projectFilter)
    .filter((e) => personFilter === "all" || e.byId === personFilter)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const filteredTotal = rows.reduce((s, e) => s + e.amount, 0);

  async function decide(id: string, status: "approved" | "rejected") {
    setBusyId(id);
    const res = await setExpenseStatus(id, status);
    setBusyId(null);
    if (!res.error) router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Permanently delete this expense? This cannot be undone.")) return;
    setBusyId(id);
    const res = await deleteExpenseAction(id);
    setBusyId(null);
    if (!res.error) router.refresh();
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="h-8 w-44 text-xs">
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </Select>
          <Select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)} className="h-8 w-44 text-xs">
            <option value="all">All people</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <span className="text-xs text-muted-foreground">
            {rows.length} · <span className="font-medium text-foreground tabular-nums">{formatINR(filteredTotal)}</span>
          </span>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> Log Expense
        </Button>
      </div>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Person</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Bill</TableHead>
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
                  <TableCell className="max-w-[16rem]">
                    <div className="font-medium">{e.title || e.note || "—"}</div>
                    {e.title && e.note && <div className="text-xs text-muted-foreground">{e.note}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{project?.code}</TableCell>
                  <TableCell>
                    {by && (
                      <div className="flex items-center gap-2">
                        <Avatar initials={by.initials} color={by.avatarColor} className="h-6 w-6 text-[10px]" />
                        <span className="text-xs text-muted-foreground">{by.name}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="outline">{catLabelOf(e.category)}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.paymentMode || "—"}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatINR(e.amount)}</TableCell>
                  <TableCell>
                    {e.billUrl ? (
                      <a href={e.billUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        <FileText className="h-3.5 w-3.5" /> View
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                  <TableCell className="text-right">
                    {isSuper ? (
                      <div className="flex justify-end gap-1">
                        {e.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" disabled={busyId === e.id} onClick={() => decide(e.id, "approved")}>
                              <Check /> Approve
                            </Button>
                            <Button size="sm" variant="ghost" disabled={busyId === e.id} onClick={() => decide(e.id, "rejected")}>
                              <X /> Reject
                            </Button>
                          </>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" disabled={busyId === e.id} onClick={() => remove(e.id)} title="Delete expense">
                          <Trash2 className="h-4 w-4" />
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
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  No expenses match — adjust filters or log a new one.
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
