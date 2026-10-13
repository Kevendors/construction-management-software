"use client";

import * as React from "react";
import { CalendarDays, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import {
  addHolidayAction,
  deleteHolidayAction,
  getOrgHolidaysAction,
} from "@/app/attendance/actions";

type Holiday = { date: string; label: string; appliesTo: "all" | "office" };

/**
 * Super_admin/hr-only (server-enforced — see addHolidayAction/deleteHolidayAction):
 * declares company holidays. "Office staff only" excuses office-flow
 * employees from that day's attendance without affecting site/project staff,
 * who are evaluated normally — see isHolidayFor in lib/attendance/compute.
 */
export function HolidaysCard() {
  const [holidays, setHolidays] = React.useState<Holiday[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [date, setDate] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [appliesTo, setAppliesTo] = React.useState<"all" | "office">("office");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    getOrgHolidaysAction().then((h) => {
      setHolidays(h);
      setLoaded(true);
    });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function add() {
    setSaving(true);
    setError(null);
    const res = await addHolidayAction({ date, label, appliesTo });
    setSaving(false);
    if (res.error) return setError(res.error);
    setDate("");
    setLabel("");
    setAppliesTo("office");
    load();
  }

  async function remove(d: string) {
    setSaving(true);
    await deleteHolidayAction(d);
    setSaving(false);
    load();
  }

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" /> Company Holidays
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          A declared holiday excuses attendance for that date — it won&apos;t show as Missed/Absent or
          count against late arrivals. Office staff-only holidays don&apos;t affect site/project staff,
          who are evaluated normally.
        </p>

        {holidays.length > 0 && (
          <div className="space-y-1.5">
            {holidays.map((h) => (
              <div
                key={h.date}
                className="flex items-center justify-between rounded-md border border-border/70 bg-secondary/30 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-medium tabular-nums">
                    {new Date(`${h.date}T00:00:00`).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="ml-2 text-foreground">{h.label}</span>
                  <span className="ml-2 text-muted-foreground">
                    ({h.appliesTo === "office" ? "Office staff only" : "Everyone"})
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${h.label}`}
                  disabled={saving}
                  onClick={() => remove(h.date)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="hol-date">Date</Label>
            <Input id="hol-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hol-label">Label</Label>
            <Input
              id="hol-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Gandhi Jayanti"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hol-applies">Applies to</Label>
            <Select
              id="hol-applies"
              value={appliesTo}
              onChange={(e) => setAppliesTo(e.target.value as "all" | "office")}
              className="h-9"
            >
              <option value="office">Office staff only</option>
              <option value="all">Everyone</option>
            </Select>
          </div>
          <Button size="sm" onClick={add} disabled={saving || !date || !label.trim()}>
            {saving ? "Saving…" : "Add"}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
