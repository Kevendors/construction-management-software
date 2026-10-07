"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Calculator, CheckCircle2, IndianRupee, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn, formatINR } from "@/lib/utils";
import { departmentLabel } from "@/lib/labels";
import { updateEmployeeSalaryAction, generateSlipAction } from "@/app/payroll/actions";
import type { Department, Employee, SalarySlip } from "@/lib/types";

const DEPARTMENTS: Department[] = ["site", "engineering", "design", "accounts", "admin"];
const SALARY_PRESETS = [20000, 25000, 30000, 35000, 45000, 60000];

export interface SetSalaryDialogProps {
  open: boolean;
  onClose: () => void;
  employee: Employee | null;
  month: string;
  existingSlip: SalarySlip | null;
}

export function SetSalaryDialog({
  open,
  onClose,
  employee,
  month,
  existingSlip,
}: SetSalaryDialogProps) {
  const router = useRouter();
  const [monthlyCtc, setMonthlyCtc] = React.useState<string>("");
  const [designation, setDesignation] = React.useState<string>("");
  const [department, setDepartment] = React.useState<Department>("site");
  const [phone, setPhone] = React.useState<string>("");
  const [deductPf, setDeductPf] = React.useState<boolean>(true);
  const [deductEsi, setDeductEsi] = React.useState<boolean>(true);
  const [recalcDraft, setRecalcDraft] = React.useState<boolean>(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (employee) {
      setMonthlyCtc(employee.monthlyCtc > 0 ? String(employee.monthlyCtc) : "");
      setDesignation(employee.designation || "");
      setDepartment(employee.department || "site");
      setPhone(employee.phone || "");
      setDeductPf(employee.deductPf !== false);
      setDeductEsi(employee.deductEsi !== false);
      setError(null);
    }
  }, [employee]);

  if (!employee) return null;

  // Real-time payroll breakdown calculations
  const ctc = Math.max(0, Number(monthlyCtc) || 0);
  const perDayRate = Math.round(ctc / 30);
  const basic = Math.round(ctc * 0.5);
  const hra = Math.round(ctc * 0.2);
  const allowances = Math.max(0, ctc - basic - hra);
  const pf = deductPf ? Math.round(basic * 0.12) : 0;
  const esi = deductEsi ? Math.round(ctc * 0.0075) : 0;
  const estNet = Math.max(0, ctc - pf - esi);

  const monthLabel = new Date(`${month}-01`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ctc < 0) return setError("Monthly CTC cannot be negative.");
    setSaving(true);
    setError(null);

    const res = await updateEmployeeSalaryAction({
      employeeId: employee!.id,
      monthlyCtc: ctc,
      designation: designation.trim(),
      department,
      phone: phone.trim(),
      deductPf,
      deductEsi,
    });

    if (res.error) {
      setSaving(false);
      return setError(res.error);
    }

    // If there is an existing draft slip and admin opted to recalculate
    if (existingSlip && existingSlip.status === "draft" && recalcDraft) {
      await generateSlipAction(employee!.id, month, existingSlip.paidDays || 30);
    }

    setSaving(false);
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Set Salary — ${employee.name}`}
      description="Configure monthly CTC and view Indian statutory payroll breakdown."
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Employee Summary Header */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-xs">
          <div>
            <div className="font-semibold text-foreground">{employee.name}</div>
            <div className="text-muted-foreground">{employee.designation || "Staff Member"}</div>
          </div>
          <Badge variant="outline">{departmentLabel[department]}</Badge>
        </div>

        {/* Salary Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="s-ctc" className="font-medium text-foreground">
              Monthly CTC (Cost to Company) *
            </Label>
            {ctc > 0 && (
              <span className="text-xs font-semibold text-primary">
                {formatINR(ctc)} / month
              </span>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-sm font-semibold text-muted-foreground">
              ₹
            </span>
            <Input
              id="s-ctc"
              type="number"
              min="0"
              step="500"
              value={monthlyCtc}
              onChange={(e) => setMonthlyCtc(e.target.value)}
              placeholder="e.g. 30000"
              className="pl-7 text-base font-medium"
              autoFocus
              required
            />
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] text-muted-foreground">Quick pick:</span>
            {SALARY_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setMonthlyCtc(String(preset))}
                className={`rounded px-2 py-0.5 text-[11px] transition-colors ${
                  ctc === preset
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                ₹{(preset / 1000).toFixed(0)}k
              </button>
            ))}
          </div>
        </div>

        {/* Statutory Deductions Configuration */}
        <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
          <div className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span>Statutory Deductions (PF & ESI)</span>
            <span className="text-[11px] font-normal text-muted-foreground">Toggle per employee</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <label className="flex items-start gap-2.5 cursor-pointer select-none rounded border border-border/70 bg-card p-2.5 transition-colors hover:bg-muted/30">
              <input
                type="checkbox"
                checked={deductPf}
                onChange={(e) => setDeductPf(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="space-y-0.5">
                <span className="font-medium text-foreground block">Deduct PF (12% of basic)</span>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {deductPf
                    ? `Deducting ${formatINR(Math.round(basic * 0.12))}/mo`
                    : "Exempt — No PF deducted"}
                </p>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer select-none rounded border border-border/70 bg-card p-2.5 transition-colors hover:bg-muted/30">
              <input
                type="checkbox"
                checked={deductEsi}
                onChange={(e) => setDeductEsi(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="space-y-0.5">
                <span className="font-medium text-foreground block">Deduct ESI (0.75% gross)</span>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {deductEsi
                    ? `Deducting ${formatINR(Math.round(ctc * 0.0075))}/mo`
                    : "Exempt — No ESI deducted"}
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Live Salary Structure Breakdown */}
        {ctc > 0 && (
          <div className="rounded-lg border border-border bg-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="flex items-center gap-1.5 text-foreground">
                <Calculator className="h-3.5 w-3.5 text-primary" /> Indian Payroll Breakdown Preview
              </span>
              <span className="font-medium tabular-nums text-foreground">
                {formatINR(perDayRate)} / day (30d base)
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-border/60">
              <div>
                <span className="text-muted-foreground block text-[11px]">Basic Pay (50%)</span>
                <span className="font-semibold text-foreground tabular-nums">{formatINR(basic)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">HRA (20%)</span>
                <span className="font-semibold text-foreground tabular-nums">{formatINR(hra)}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Allowances (30%)</span>
                <span className="font-semibold text-foreground tabular-nums">{formatINR(allowances)}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-border/60">
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  {deductPf ? "PF (12% of basic)" : "PF (Exempt)"}
                </span>
                <span className={cn("font-semibold tabular-nums", deductPf ? "text-destructive" : "text-muted-foreground")}>
                  {deductPf ? `-${formatINR(pf)}` : "₹0"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  {deductEsi ? "ESI (0.75% gross)" : "ESI (Exempt)"}
                </span>
                <span className={cn("font-semibold tabular-nums", deductEsi ? "text-destructive" : "text-muted-foreground")}>
                  {deductEsi ? `-${formatINR(esi)}` : "₹0"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Est. Take-Home</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatINR(estNet)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Designation & Department */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-desig">Designation</Label>
            <Input
              id="s-desig"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="e.g. Site Supervisor"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-dept">Department</Label>
            <Select
              id="s-dept"
              value={department}
              onChange={(e) => setDepartment(e.target.value as Department)}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {departmentLabel[d]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Optional draft slip recalculation */}
        {existingSlip && existingSlip.status === "draft" && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                checked={recalcDraft}
                onChange={(e) => setRecalcDraft(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-primary/40 text-primary"
              />
              <div className="text-xs">
                <span className="font-medium text-foreground">
                  Recalculate {monthLabel} Draft Salary Slip
                </span>
                <p className="text-muted-foreground">
                  Immediately updates this month&apos;s slip with the new salary structure.
                </p>
              </div>
            </label>
          </div>
        )}

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Salary"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
