"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { issueMaterial } from "@/app/subcon/actions";
import type { SubconBoard } from "@/lib/data/subcon";
import { formatINR, formatNumber } from "@/lib/utils";

const today = () => new Date().toISOString().slice(0, 10);

function IssueMaterialDialog({
  board,
  open,
  onClose,
}: {
  board: SubconBoard;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { subcontractors, materialItems, projects } = board;
  const [subcontractorId, setSubcontractorId] = React.useState("");
  const [materialItemId, setMaterialItemId] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [date, setDate] = React.useState(today());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSubcontractorId((v) => v || subcontractors[0]?.id || "");
    setMaterialItemId((v) => v || materialItems[0]?.id || "");
    setProjectId((v) => v || projects[0]?.id || "");
  }, [open, subcontractors, materialItems, projects]);

  const item = materialItems.find((i) => i.id === materialItemId);
  const value = (Number(qty) || 0) * (item?.rate ?? 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!subcontractorId || !materialItemId || !Number(qty)) return;
    setSaving(true);
    setError(null);
    const res = await issueMaterial({
      subcontractorId,
      projectId,
      materialItemId,
      qty: Number(qty),
      date,
    });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    onClose();
    setQty("");
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Issue Material" description="Record material issued to a subcontractor.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="mi-sub">Subcontractor</Label>
          <Select id="mi-sub" value={subcontractorId} onChange={(e) => setSubcontractorId(e.target.value)}>
            {subcontractors.map((s) => (
              <option key={s.id} value={s.id}>{s.company}</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mi-item">Material</Label>
          <Select id="mi-item" value={materialItemId} onChange={(e) => setMaterialItemId(e.target.value)}>
            {materialItems.map((i) => (
              <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mi-project">Project</Label>
          <Select id="mi-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="mi-qty">Quantity {item ? `(${item.unit})` : ""}</Label>
            <Input id="mi-qty" type="number" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mi-date">Date</Label>
            <Input id="mi-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Value: <span className="font-medium text-foreground tabular-nums">{formatINR(value)}</span>
        </p>
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Issue Material"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function MaterialIssuesTab({ board }: { board: SubconBoard }) {
  const { materialIssues, subcontractors, materialItems, projects } = board;
  const subById = new Map(subcontractors.map((s) => [s.id, s]));
  const itemById = new Map(materialItems.map((i) => [i.id, i]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const [open, setOpen] = React.useState(false);

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{materialIssues.length} material issues to subcontractors</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> Issue Material
        </Button>
      </div>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Subcontractor</TableHead>
              <TableHead>Material</TableHead>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materialIssues.map((mi) => {
              const sc = subById.get(mi.subcontractorId) ?? null;
              const item = itemById.get(mi.materialItemId) ?? null;
              const project = projectById.get(mi.projectId) ?? null;
              return (
                <TableRow key={mi.id}>
                  <TableCell className="text-muted-foreground">
                    {new Date(mi.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </TableCell>
                  <TableCell className="font-medium">{sc?.company}</TableCell>
                  <TableCell>{item?.name}</TableCell>
                  <TableCell>{project?.code}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(mi.qty, 1)} {item?.unit}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatINR(mi.qty * (item?.rate ?? 0))}
                  </TableCell>
                </TableRow>
              );
            })}
            {materialIssues.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No material issued yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <IssueMaterialDialog board={board} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
