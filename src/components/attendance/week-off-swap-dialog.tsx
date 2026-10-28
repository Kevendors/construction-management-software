"use client";

import * as React from "react";
import { Dialog, Textarea } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import {
  FLEXIBLE_SWAP_ERROR,
  isWeeklyOff,
  orgToday,
  validateWeekOffSwap,
  weekOffPatternOn,
  type AttendanceMember,
  type OrgHoliday,
} from "@/lib/attendance/compute";
import { createWeekOffSwapAction } from "@/app/attendance/week-off-actions";

/** "YYYY-MM-DD" shifted by `n` days (UTC arithmetic, so DST never skews it). */
function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Nearest weekly off on/after `from` that isn't already part of a swap — the dialog's default worked day. */
function nextFreeWeeklyOff(member: AttendanceMember, from: string): string {
  const used = (d: string) => member.weekOff.swaps.some((s) => s.workedDate === d || s.offDate === d);
  for (let i = 0; i < 28; i++) {
    const d = addDays(from, i);
    if (isWeeklyOff(d, member.weekOff) && !used(d)) return d;
  }
  return from;
}

const longDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });

/**
 * Super_admin/hr only: record that an employee works one of their weekly off
 * days and takes another day in the same week (±6 days) off instead.
 * Approved on save. Mounted only while open, so each open starts fresh.
 */
export function WeekOffSwapDialog({
  member,
  holidays,
  onClose,
  onSaved,
}: {
  member: AttendanceMember;
  holidays: OrgHoliday[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [workedDate, setWorkedDate] = React.useState(() => nextFreeWeeklyOff(member, orgToday()));
  const [offDate, setOffDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  // Flexible staff have no fixed off days to swap — say so up front.
  const isFlexible = weekOffPatternOn(member.weekOff, orgToday()).kind === "flexible";
  const [error, setError] = React.useState<string | null>(isFlexible ? FLEXIBLE_SWAP_ERROR : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!offDate) return setError("Choose the replacement off day.");
    // Same check the server re-runs with fresh data — this is just instant feedback.
    const invalid = validateWeekOffSwap(member.weekOff, workedDate, offDate, holidays, member.isOffice);
    if (invalid) return setError(invalid);
    setSaving(true);
    setError(null);
    const res = await createWeekOffSwapAction({ userId: member.userId, workedDate, offDate, note });
    setSaving(false);
    if (res.error) return setError(res.error);
    onSaved();
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Swap Weekly Off"
      description={`${member.name} works a weekly off day and takes another day in the same week off instead. Saved swaps apply immediately.`}
      className="max-w-md"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="wo-worked">Works on (off day)</Label>
            <Input
              id="wo-worked"
              type="date"
              value={workedDate}
              onChange={(e) => {
                setWorkedDate(e.target.value);
                setOffDate("");
              }}
              required
            />
            {workedDate && <p className="text-xs text-muted-foreground">{longDate(workedDate)}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wo-off">Takes off instead</Label>
            <Input
              id="wo-off"
              type="date"
              value={offDate}
              min={workedDate ? addDays(workedDate, -6) : undefined}
              max={workedDate ? addDays(workedDate, 6) : undefined}
              onChange={(e) => setOffDate(e.target.value)}
              required
            />
            {offDate ? (
              <p className="text-xs text-muted-foreground">{longDate(offDate)}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Within 6 days either side</p>
            )}
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="wo-note">Note (optional)</Label>
            <Textarea
              id="wo-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Sunday concrete pour at site."
            />
          </div>
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || isFlexible}>{saving ? "Saving…" : "Save Swap"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
