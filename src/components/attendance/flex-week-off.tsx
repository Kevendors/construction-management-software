"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import {
  addDaysIso,
  flexWeekOffProblem,
  mondayOf,
  orgToday,
  weekOffPatternOn,
  type OrgHoliday,
  type WeekOffRule,
} from "@/lib/attendance/compute";
import { removeFlexWeekOffAction, setFlexWeekOffAction } from "@/app/attendance/week-off-actions";

export const longDay = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });

/** The chosen Flexible off in `date`'s Monday–Sunday week, if any. */
export function chosenOffInWeek(rule: WeekOffRule, date: string): string | undefined {
  const week = mondayOf(date);
  return rule.flexOffs?.find((d) => mondayOf(d) === week);
}

/**
 * Choose / move a Flexible weekly off (0055). `userId` set = HR/Super Admin
 * acting for that member; omitted = the signed-in employee's own pick. The
 * server re-checks everything; this only gives instant feedback.
 */
export function FlexWeekOffDialog({
  userId,
  rule,
  holidays,
  isOffice,
  initialDate,
  minDate,
  maxDate,
  onClose,
  onSaved,
}: {
  userId?: string;
  rule: WeekOffRule;
  holidays: OrgHoliday[];
  isOffice: boolean;
  initialDate: string;
  minDate?: string;
  maxDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = React.useState(initialDate);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const replacing = date ? chosenOffInWeek(rule, date) : undefined;
  const problem = date ? flexWeekOffProblem(rule, date, holidays, isOffice, replacing) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || problem) return;
    setSaving(true);
    setError(null);
    const res = await setFlexWeekOffAction({ userId, date });
    setSaving(false);
    if (res.error) return setError(res.error);
    onSaved();
    onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Choose weekly off"
      description="One weekly off per week (Monday to Sunday). Days missed without a chosen weekly off count as Absent."
      className="max-w-sm"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="flex-off-date">Weekly off day</Label>
          <Input
            id="flex-off-date"
            type="date"
            value={date}
            min={minDate}
            max={maxDate}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          {date && <p className="text-xs text-muted-foreground">{longDay(date)}</p>}
          {replacing && replacing !== date && !problem && (
            <p className="text-xs text-muted-foreground">Replaces this week&apos;s weekly off on {longDay(replacing)}.</p>
          )}
        </div>
        {(problem || error) && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{problem || error}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !date || Boolean(problem)}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Employee's own card: this week's and next week's chosen weekly off. Shown only on Flexible weekly off. */
export function MyFlexWeekOffCard({
  rule,
  holidays,
  isOffice,
}: {
  rule: WeekOffRule;
  holidays: OrgHoliday[];
  isOffice: boolean;
}) {
  const router = useRouter();
  const today = orgToday();
  const thisWeek = mondayOf(today);
  const weeks = [thisWeek, addDaysIso(thisWeek, 7)].filter((w) =>
    [0, 1, 2, 3, 4, 5, 6].some((i) => weekOffPatternOn(rule, addDaysIso(w, i)).kind === "flexible")
  );
  const [choosing, setChoosing] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  if (weeks.length === 0) return null;
  const lastDay = addDaysIso(thisWeek, 13);

  async function remove(date: string) {
    setBusy(true);
    setError(null);
    const res = await removeFlexWeekOffAction({ date });
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <CalendarCheck className="h-4 w-4 text-muted-foreground" /> My weekly off
        </p>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {weeks.map((w) => {
            const chosen = chosenOffInWeek(rule, w);
            const canChange = !chosen || chosen >= today;
            return (
              <li key={w} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {w === thisWeek ? "This week" : "Next week"} · {longDay(w)} – {longDay(addDaysIso(w, 6))}
                  </p>
                  <p className={chosen ? "font-medium" : "text-amber-700 dark:text-amber-400"}>
                    {chosen ? longDay(chosen) : "Not chosen. Missed days count as Absent."}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {canChange && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => setChoosing(w)}>
                      {chosen ? "Change" : "Choose"}
                    </Button>
                  )}
                  {chosen && chosen >= today && (
                    <Button size="icon" variant="ghost" aria-label="Remove weekly off" disabled={busy} onClick={() => remove(chosen)}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
      {choosing && (
        <FlexWeekOffDialog
          rule={rule}
          holidays={holidays}
          isOffice={isOffice}
          initialDate={chosenOffInWeek(rule, choosing) ?? (choosing > today ? choosing : today)}
          minDate={choosing > today ? choosing : today}
          maxDate={choosing === thisWeek ? addDaysIso(thisWeek, 6) : lastDay}
          onClose={() => setChoosing(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </Card>
  );
}

/** Admin employee view: chosen Flexible offs in the range, with remove. Renders nothing when there are none. */
export function FlexWeekOffList({
  userId,
  rule,
  from,
  to,
  onChanged,
}: {
  userId: string;
  rule: WeekOffRule;
  from: string;
  to: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const today = orgToday();
  // The range plus any upcoming picks (the range stops at today).
  const offs = (rule.flexOffs ?? []).filter((d) => (d >= from && d <= to) || d > today).sort((a, b) => b.localeCompare(a));
  if (offs.length === 0) return null;

  async function remove(date: string) {
    setBusy(date);
    setError(null);
    const res = await removeFlexWeekOffAction({ userId, date });
    setBusy(null);
    if (res.error) return setError(res.error);
    onChanged();
  }

  return (
    <div className="rounded-md border border-border">
      <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
        Chosen weekly offs (Flexible) — this range + upcoming
      </p>
      <ul className="divide-y divide-border">
        {offs.map((d) => (
          <li key={d} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="tabular-nums">{longDay(d)}</span>
            <Button size="icon" variant="ghost" aria-label="Remove weekly off" disabled={busy === d} onClick={() => remove(d)}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      {error && <p className="px-3 pb-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
