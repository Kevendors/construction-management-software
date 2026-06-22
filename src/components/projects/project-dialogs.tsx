"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select, Textarea } from "@/components/ui/dialog";
import { useProjectInvoices, useStore } from "@/lib/store/project-store";
import { categoryLabel, costCodeLabel } from "@/lib/labels";
import { lineTotalWithTax } from "@/lib/mock/selectors";
import { formatINR } from "@/lib/utils";
import type { CostCode, ExpenseCategory } from "@/lib/types";

const CATEGORIES: ExpenseCategory[] = ["material", "salary", "site", "subcon", "other"];
const COST_CODES: CostCode[] = ["material", "machinery", "diesel", "labour", "other"];

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) =>
  new Date(+new Date(d) + n * 86400000).toISOString().slice(0, 10);

export function AddExpenseDialog({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { addTransaction } = useStore();
  const [amount, setAmount] = React.useState("");
  const [category, setCategory] = React.useState<ExpenseCategory>("material");
  const [costCode, setCostCode] = React.useState<CostCode>("material");
  const [date, setDate] = React.useState(today());
  const [note, setNote] = React.useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt) return;
    addTransaction({
      projectId,
      partyId: null,
      date,
      direction: "out",
      amount: amt,
      costCode,
      category,
      note: note.trim() || categoryLabel[category],
    });
    setAmount("");
    setNote("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add Expense" description="Updates P&L and expense charts live.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="e-amount">Amount (₹)</Label>
            <Input id="e-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-date">Date</Label>
            <Input id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="e-cat">Category</Label>
            <Select id="e-cat" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{categoryLabel[c]}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-code">Cost Code</Label>
            <Select id="e-code" value={costCode} onChange={(e) => setCostCode(e.target.value as CostCode)}>
              {COST_CODES.map((c) => (
                <option key={c} value={c}>{costCodeLabel[c]}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-note">Note</Label>
          <Textarea id="e-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was this for?" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Add Expense</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function AddInvoiceDialog({
  projectId,
  clientId,
  open,
  onClose,
  nextNumber,
}: {
  projectId: string;
  clientId: string;
  open: boolean;
  onClose: () => void;
  nextNumber: string;
}) {
  const { addInvoice } = useStore();
  const [number, setNumber] = React.useState(nextNumber);
  const [date, setDate] = React.useState(today());
  const [amount, setAmount] = React.useState("");
  const [taxRate, setTaxRate] = React.useState("18");
  const [received, setReceived] = React.useState("0");

  React.useEffect(() => {
    if (open) setNumber(nextNumber);
  }, [open, nextNumber]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt) return;
    const tax = Number(taxRate) || 0;
    const rec = Number(received) || 0;
    const total = amt + (amt * tax) / 100;
    const status = rec <= 0 ? "sent" : rec >= total ? "paid" : "partial";
    addInvoice({
      number: number.trim() || nextNumber,
      projectId,
      clientId,
      date,
      dueDate: addDays(date, 30),
      items: [{ id: "li-1", description: "Project billing", qty: 1, unit: "LS", rate: amt }],
      taxRate: tax,
      received: rec,
      status,
    });
    setAmount("");
    setReceived("0");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add Invoice" description="Updates the Sales Invoices card live.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="i-number">Invoice #</Label>
            <Input id="i-number" value={number} onChange={(e) => setNumber(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-date">Date</Label>
            <Input id="i-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="i-amount">Amount (₹)</Label>
            <Input id="i-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-tax">Tax %</Label>
            <Input id="i-tax" type="number" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-received">Received (₹)</Label>
            <Input id="i-received" type="number" value={received} onChange={(e) => setReceived(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Add Invoice</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function RecordPaymentDialog({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { recordPayment } = useStore();
  const invoices = useProjectInvoices(projectId);
  const [invoiceId, setInvoiceId] = React.useState("");
  const [amount, setAmount] = React.useState("");

  React.useEffect(() => {
    if (open && invoices.length && !invoiceId) setInvoiceId(invoices[0].id);
  }, [open, invoices, invoiceId]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || !invoiceId) return;
    recordPayment(invoiceId, amt);
    setAmount("");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Record Payment" description="Adds to the invoice's received amount.">
      {invoices.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No invoices yet — add an invoice first.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pay-inv">Invoice</Label>
            <Select id="pay-inv" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
              {invoices.map((inv) => {
                const total = lineTotalWithTax(inv.items, inv.taxRate);
                return (
                  <option key={inv.id} value={inv.id}>
                    {inv.number} · {formatINR(inv.received, { compact: true })} / {formatINR(total, { compact: true })}
                  </option>
                );
              })}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">Payment amount (₹)</Label>
            <Input id="pay-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">Record Payment</Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function AddAttendanceDialog({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { addAttendance } = useStore();
  const [date, setDate] = React.useState(today());
  const [present, setPresent] = React.useState("");
  const [absent, setAbsent] = React.useState("0");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = Number(present);
    if (!p && p !== 0) return;
    addAttendance({
      contractorId: "manual",
      projectId,
      date,
      shift: "general",
      present: p,
      absent: Number(absent) || 0,
      gps: "",
    });
    setPresent("");
    setAbsent("0");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add Attendance" description="Updates the labour attendance chart live.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="a-date">Date</Label>
          <Input id="a-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="a-present">Present</Label>
            <Input id="a-present" type="number" value={present} onChange={(e) => setPresent(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-absent">Absent</Label>
            <Input id="a-absent" type="number" value={absent} onChange={(e) => setAbsent(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Add Attendance</Button>
        </div>
      </form>
    </Dialog>
  );
}
