"use client";

import * as React from "react";
import { Dialog, Select } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/dialog";
import { ORG_TIMEZONE, orgToday, type AttendanceMember } from "@/lib/attendance/compute";
import { adminMarkAttendanceAction } from "@/app/attendance/actions";
import type { EmployeeAttendance, Project } from "@/lib/types";

function isoToHHMM(iso: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ORG_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/**
 * Super_admin/hr only: manually mark or correct an attendance record — no
 * GPS/selfie required. Always requires a reason; the server tags the row
 * source="admin" so it stays visibly distinct from self-verified attendance.
 */
export function AdminMarkAttendanceDialog({
  open,
  onClose,
  onSaved,
  members,
  projects,
  defaultUserId,
  defaultDate,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  members: AttendanceMember[];
  projects: Project[];
  defaultUserId?: string;
  defaultDate: string;
  existing?: EmployeeAttendance | null;
}) {
  const [userId, setUserId] = React.useState("");
  const [date, setDate] = React.useState(defaultDate);
  const [projectId, setProjectId] = React.useState("");
  const [checkInTime, setCheckInTime] = React.useState("09:00");
  const [checkOutTime, setCheckOutTime] = React.useState("");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setUserId(existing?.userId ?? defaultUserId ?? "");
    setDate(existing?.date ?? defaultDate);
    setProjectId(existing?.projectId ?? "");
    setCheckInTime(existing ? isoToHHMM(existing.checkInAt) || "09:00" : "09:00");
    setCheckOutTime(existing ? isoToHHMM(existing.checkOutAt) : "");
    setNote(existing?.note ?? "");
    setError(null);
  }, [open, existing, defaultUserId, defaultDate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return setError("Choose an employee.");
    setSaving(true);
    setError(null);
    const res = await adminMarkAttendanceAction({
      userId,
      date,
      projectId: projectId || null,
      checkInTime,
      checkOutTime,
      note,
    });
    setSaving(false);
    if (res.error) return setError(res.error);
    onSaved();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={existing ? "Correct Attendance" : "Mark Attendance Manually"}
      description="No GPS or selfie required — use this only when the employee genuinely couldn't self check-in. A reason is required and this stays visibly flagged as a manual entry."
      className="max-w-lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="am-user">Employee</Label>
            <Select id="am-user" value={userId} onChange={(e) => setUserId(e.target.value)} required>
              <option value="">Select an employee</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                  {m.employeeId ? ` (${m.employeeId})` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="am-date">Date</Label>
            <Input id="am-date" type="date" value={date} max={orgToday()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="am-project">Project</Label>
            <Select id="am-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="am-in">Check-in time</Label>
            <Input id="am-in" type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="am-out">Check-out time (optional)</Label>
            <Input id="am-out" type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="am-note">Reason (required)</Label>
            <Textarea
              id="am-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Phone died on site — confirmed present by supervisor call."
              required
            />
          </div>
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
