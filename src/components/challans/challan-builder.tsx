"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Printer, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChallanDocument } from "./challan-document";
import {
  getChallanPayloadAction,
  saveChallanAction,
  type ChallanLineState,
  type ChallanState,
} from "@/app/challans/actions";
import type { MaterialItem } from "@/lib/types";
import { todayISO } from "@/lib/utils";

const uid = () => Math.random().toString(36).slice(2, 9);

const emptyState = (): ChallanState => ({
  number: `CH-${Math.floor(Math.random() * 900) + 100}`,
  projectId: "",
  date: todayISO(),
  vehicleNumber: "",
  transporterName: "",
  purposeNote: "",
  lines: [],
});

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function ChallanBuilder({
  projects,
  materialItems,
}: {
  projects: { id: string; name: string; location: string }[];
  materialItems: MaterialItem[];
}) {
  const router = useRouter();
  const [s, setS] = React.useState<ChallanState>(emptyState);
  const [pick, setPick] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const challanId = React.useRef<string | null>(null);

  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    challanId.current = id;
    getChallanPayloadAction(id).then((payload) => {
      if (payload) setS(payload);
    });
  }, []);

  function set<K extends keyof ChallanState>(k: K, v: ChallanState[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }
  function updateLine(id: string, patch: Partial<ChallanLineState>) {
    setS((prev) => ({ ...prev, lines: prev.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
  }
  function removeLine(id: string) {
    setS((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.id !== id) }));
  }
  function addFromMaterial(itemId: string) {
    const m = materialItems.find((i) => i.id === itemId);
    if (!m) return;
    setS((prev) => ({
      ...prev,
      lines: [...prev.lines, { id: uid(), materialItemId: m.id, description: m.name, unit: m.unit, qty: 1 }],
    }));
    setPick("");
  }
  function addCustom() {
    setS((prev) => ({
      ...prev,
      lines: [...prev.lines, { id: uid(), materialItemId: null, description: "", unit: "NOS", qty: 1 }],
    }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    const res = await saveChallanAction(s, challanId.current);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.id && !challanId.current) {
      challanId.current = res.id;
      window.history.replaceState(null, "", `/challans/new?id=${res.id}`);
    }
    setSavedMsg("Saved to database ✓");
  }

  const project = projects.find((p) => p.id === s.projectId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/challans" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Challans
        </Link>
        <div className="flex items-center gap-2">
          {savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
          {error && <span className="text-sm text-destructive">{error}</span>}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer /> Print / PDF
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            <Save /> {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 print:hidden lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Challan Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="Project" full>
                <Select value={s.projectId} onChange={(e) => set("projectId", e.target.value)}>
                  <option value="">Choose a project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Challan Number">
                <Input value={s.number} onChange={(e) => set("number", e.target.value)} />
              </Field>
              <Field label="Date">
                <Input type="date" value={s.date} onChange={(e) => set("date", e.target.value)} />
              </Field>
              <Field label="Vehicle Number">
                <Input value={s.vehicleNumber} onChange={(e) => set("vehicleNumber", e.target.value)} placeholder="e.g. DL 1AB 1234" />
              </Field>
              <Field label="Transporter Name">
                <Input value={s.transporterName} onChange={(e) => set("transporterName", e.target.value)} />
              </Field>
              <Field label="Purpose" full>
                <Input value={s.purposeNote} onChange={(e) => set("purposeNote", e.target.value)} placeholder="e.g. site use, return to store" />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Items</CardTitle>
              <div className="flex gap-2">
                <Select
                  value={pick}
                  onChange={(e) => addFromMaterial(e.target.value)}
                  className="h-8 w-56 text-xs"
                >
                  <option value="">+ Add from material list…</option>
                  {materialItems.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
                <Button size="sm" variant="outline" onClick={addCustom}>
                  <Plus /> Custom
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {s.lines.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No items yet — pick from the material list or add a custom line.
                </p>
              )}
              {s.lines.map((l, i) => (
                <div key={l.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
                  <span className="text-xs font-medium text-muted-foreground">{i + 1}.</span>
                  <Input
                    value={l.description}
                    onChange={(e) => updateLine(l.id, { description: e.target.value })}
                    placeholder="Item description"
                    className="h-8 flex-1 text-xs"
                  />
                  <Input
                    value={l.unit}
                    onChange={(e) => updateLine(l.id, { unit: e.target.value })}
                    placeholder="Unit"
                    className="h-8 w-20 text-xs"
                  />
                  <Input
                    type="number"
                    value={l.qty}
                    onChange={(e) => updateLine(l.id, { qty: Number(e.target.value) })}
                    placeholder="Qty"
                    className="h-8 w-20 text-xs"
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeLine(l.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:h-fit">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Live preview</p>
          <div className="overflow-auto rounded-lg border border-border bg-slate-100 p-3">
            <ChallanDocument s={s} projectName={project?.name ?? ""} projectLocation={project?.location ?? ""} />
          </div>
        </div>
      </div>

      <div className="hidden print:block">
        <ChallanDocument s={s} projectName={project?.name ?? ""} projectLocation={project?.location ?? ""} />
      </div>
    </div>
  );
}
