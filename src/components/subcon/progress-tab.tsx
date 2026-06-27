"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select, Textarea } from "@/components/ui/dialog";
import { logProgress } from "@/app/subcon/actions";
import type { SubconBoard } from "@/lib/data/subcon";
import { woStatusMeta } from "@/lib/labels";

const today = () => new Date().toISOString().slice(0, 10);

function LogProgressDialog({
  board,
  open,
  onClose,
  presetWorkOrderId,
}: {
  board: SubconBoard;
  open: boolean;
  onClose: () => void;
  presetWorkOrderId?: string;
}) {
  const router = useRouter();
  const { workOrders, subcontractors } = board;
  const subById = new Map(subcontractors.map((s) => [s.id, s]));

  const [workOrderId, setWorkOrderId] = React.useState("");
  const [percent, setPercent] = React.useState("");
  const [note, setNote] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setWorkOrderId(presetWorkOrderId || workOrders[0]?.id || "");
  }, [open, presetWorkOrderId, workOrders]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!workOrderId || percent === "") return;
    setSaving(true);
    setError(null);
    const res = await logProgress({
      workOrderId,
      date,
      percent: Math.min(100, Math.max(0, Number(percent) || 0)),
      note: note.trim(),
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
    setPercent("");
    setNote("");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Log Progress" description="Record a progress update against a work order.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="pr-wo">Work Order</Label>
          <Select id="pr-wo" value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)}>
            {workOrders.map((w) => (
              <option key={w.id} value={w.id}>
                {w.number} · {subById.get(w.subcontractorId)?.company ?? ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pr-pct">% Complete</Label>
            <Input id="pr-pct" type="number" min={0} max={100} value={percent} onChange={(e) => setPercent(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-date">Date</Label>
            <Input id="pr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pr-note">Note</Label>
          <Textarea id="pr-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was completed?" />
        </div>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Log Progress"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ProgressTab({ board }: { board: SubconBoard }) {
  const { workOrders, subcontractors, projects, progress } = board;
  const subById = new Map(subcontractors.map((s) => [s.id, s]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const [open, setOpen] = React.useState(false);
  const [presetWo, setPresetWo] = React.useState<string | undefined>(undefined);

  function openFor(woId?: string) {
    setPresetWo(woId);
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => openFor(undefined)} disabled={workOrders.length === 0}>
          <Plus /> Log Progress
        </Button>
      </div>
      {workOrders.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No work orders yet — create one to track progress.
          </CardContent>
        </Card>
      )}
      {workOrders.map((wo) => {
        const sc = subById.get(wo.subcontractorId) ?? null;
        const project = projectById.get(wo.projectId) ?? null;
        const history = progress
          .filter((p) => p.workOrderId === wo.id)
          .sort((a, b) => +new Date(b.date) - +new Date(a.date));
        const latest = history[0]?.percent ?? 0;
        const meta = woStatusMeta[wo.status];
        return (
          <Card key={wo.id}>
            <CardHeader className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">
                  {wo.number} · {sc?.company}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{project?.code}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={meta.variant}>{meta.label}</Badge>
                <Button size="sm" variant="outline" onClick={() => openFor(wo.id)}>
                  <Plus /> Update
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-3">
                <Progress value={latest} indicatorClassName="bg-accent" className="flex-1" />
                <span className="w-12 text-right text-sm font-semibold tabular-nums">{latest}%</span>
              </div>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No progress logged yet.</p>
              ) : (
                <ol className="space-y-3 border-l border-border pl-4">
                  {history.map((p) => (
                    <li key={p.id} className="relative">
                      <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-accent" />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{p.percent}% complete</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{p.note}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        );
      })}
      <LogProgressDialog board={board} open={open} onClose={() => setOpen(false)} presetWorkOrderId={presetWo} />
    </div>
  );
}
