"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AttendanceChart } from "@/components/charts/bar-charts";
import type { PayrollBoard } from "@/lib/payroll/compute";
import { labourAttendanceByDay } from "@/lib/payroll/compute";
import { markAttendanceAction } from "@/app/payroll/actions";
import { shiftLabel } from "@/lib/labels";
import { todayISO } from "@/lib/utils";
import type { Shift } from "@/lib/types";

const SHIFTS: Shift[] = ["general", "first", "second"];
const today = () => new Date().toISOString().slice(0, 10);

export function AttendanceTab({ board }: { board: PayrollBoard }) {
  const { attendance, contractors } = board;
  const [open, setOpen] = React.useState(false);
  const byDay = labourAttendanceByDay(attendance);
  const contractorById = new Map(contractors.map((c) => [c.id, c]));
  const rows = [...attendance].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={() => setOpen(true)} disabled={contractors.length === 0}>
          <Plus /> Mark Attendance
        </Button>
      </div>

      {byDay.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Labour Attendance — Recent Days</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceChart data={byDay} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">GPS Attendance Log</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Contractor</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">Absent</TableHead>
                <TableHead>Geo-fence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No attendance recorded yet.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((a) => {
                const c = contractorById.get(a.contractorId);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="tabular-nums">
                      {new Date(a.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </TableCell>
                    <TableCell className="font-medium">{c?.company || c?.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{shiftLabel[a.shift]}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-success">{a.present}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{a.absent}</TableCell>
                    <TableCell>
                      {a.gps && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {a.gps}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <MarkAttendanceDialog board={board} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function MarkAttendanceDialog({ board, open, onClose }: { board: PayrollBoard; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { contractors, projects } = board;
  const [contractorId, setContractorId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [shift, setShift] = React.useState<Shift>("general");
  const [present, setPresent] = React.useState("");
  const [absent, setAbsent] = React.useState("");
  const [gps, setGps] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setContractorId((v) => v || contractors[0]?.id || "");
    setProjectId((v) => v || projects[0]?.id || "");
  }, [open, contractors, projects]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!contractorId) return setError("Contractor is required.");
    setSaving(true);
    setError(null);
    const res = await markAttendanceAction({
      contractorId,
      projectId,
      date,
      shift,
      present: Number(present) || 0,
      absent: Number(absent) || 0,
      gps: gps.trim(),
    });
    setSaving(false);
    if (res.error) return setError(res.error);
    onClose();
    setPresent(""); setAbsent(""); setGps("");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Mark Attendance" description="Record a contractor's daily labour headcount." className="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="a-con">Contractor</Label>
            <Select id="a-con" value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
              {contractors.map((c) => <option key={c.id} value={c.id}>{c.company || c.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-proj">Project</Label>
            <Select id="a-proj" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">—</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-date">Date</Label>
            <Input id="a-date" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-shift">Shift</Label>
            <Select id="a-shift" value={shift} onChange={(e) => setShift(e.target.value as Shift)}>
              {SHIFTS.map((s) => <option key={s} value={s}>{shiftLabel[s]}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-present">Present</Label>
            <Input id="a-present" type="number" value={present} onChange={(e) => setPresent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-absent">Absent</Label>
            <Input id="a-absent" type="number" value={absent} onChange={(e) => setAbsent(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="a-gps">Geo-fence (lat, long)</Label>
            <Input id="a-gps" value={gps} onChange={(e) => setGps(e.target.value)} placeholder="28.6139, 77.2090" />
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
