"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImagePlus, Printer, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select, Textarea } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkProgressReportDocument } from "./work-progress-report-document";
import {
  getWorkProgressReportPayloadAction,
  saveWorkProgressReportAction,
  type WorkProgressReportState,
} from "@/app/reports/work-progress/actions";
import { DEFAULT_SIGNATURE } from "@/lib/quotation/company";
import { fileToResizedDataUrl } from "@/lib/image";
import { todayISO } from "@/lib/utils";

const MAX_PHOTOS = 8;

const emptyState = (): WorkProgressReportState => ({
  number: `WPR-${Math.floor(Math.random() * 900) + 100}`,
  projectId: "",
  date: todayISO(),
  periodStart: "",
  periodEnd: "",
  percentComplete: 0,
  workCompleted: "",
  nextPlan: "",
  issues: "",
  photoUrls: [],
  signatureUrl: "",
});

export function WorkProgressReportBuilder({ projects }: { projects: { id: string; name: string }[] }) {
  const router = useRouter();
  const [s, setS] = React.useState<WorkProgressReportState>(emptyState);
  const [saving, setSaving] = React.useState(false);
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const reportId = React.useRef<string | null>(null);

  React.useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    reportId.current = id;
    getWorkProgressReportPayloadAction(id).then((payload) => {
      if (payload) setS(payload);
    });
  }, []);

  function set<K extends keyof WorkProgressReportState>(k: K, v: WorkProgressReportState[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  const sigRef = React.useRef<HTMLInputElement>(null);
  async function handleSignature(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    try {
      const url = await fileToResizedDataUrl(file, 600, 0.9);
      set("signatureUrl", url);
    } catch {
      /* ignore decode errors */
    } finally {
      if (sigRef.current) sigRef.current.value = "";
    }
  }

  const photoRef = React.useRef<HTMLInputElement>(null);
  async function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const room = MAX_PHOTOS - s.photoUrls.length;
    const toAdd = files.slice(0, Math.max(room, 0));
    try {
      const urls = await Promise.all(toAdd.map((f) => fileToResizedDataUrl(f, 1000, 0.6)));
      setS((prev) => ({ ...prev, photoUrls: [...prev.photoUrls, ...urls] }));
    } catch {
      /* ignore decode errors */
    } finally {
      if (photoRef.current) photoRef.current.value = "";
    }
  }
  function removePhoto(i: number) {
    setS((prev) => ({ ...prev, photoUrls: prev.photoUrls.filter((_, idx) => idx !== i) }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    const res = await saveWorkProgressReportAction(s, reportId.current);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.id && !reportId.current) {
      reportId.current = res.id;
      window.history.replaceState(null, "", `/reports/work-progress/new?id=${res.id}`);
    }
    setSavedMsg("Saved to database ✓");
  }

  const projectName = projects.find((p) => p.id === s.projectId)?.name ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/reports/work-progress" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Work Progress Reports
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
              <CardTitle className="text-base">Report Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Project</Label>
                <Select value={s.projectId} onChange={(e) => set("projectId", e.target.value)}>
                  <option value="">Choose a project…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Report Number</Label>
                <Input value={s.number} onChange={(e) => set("number", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={s.date} onChange={(e) => set("date", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Period Start</Label>
                <Input type="date" value={s.periodStart} onChange={(e) => set("periodStart", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Period End</Label>
                <Input type="date" value={s.periodEnd} onChange={(e) => set("periodEnd", e.target.value)} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>% Complete</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={s.percentComplete}
                  onChange={(e) => set("percentComplete", Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress Narrative</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Work Completed</Label>
                <Textarea rows={4} value={s.workCompleted} onChange={(e) => set("workCompleted", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Plan for Next Period</Label>
                <Textarea rows={3} value={s.nextPlan} onChange={(e) => set("nextPlan", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Issues / Delays</Label>
                <Textarea rows={3} value={s.issues} onChange={(e) => set("issues", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Site Photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {s.photoUrls.map((url, i) => (
                  <div key={i} className="relative h-20 w-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Site photo ${i + 1}`} className="h-full w-full rounded border border-border object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label="Remove photo"
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {s.photoUrls.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => photoRef.current?.click()}
                    className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded border border-dashed border-border text-muted-foreground hover:border-primary/50"
                  >
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px]">Add</span>
                  </button>
                )}
              </div>
              <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotos} />
              <p className="text-xs text-muted-foreground">Up to {MAX_PHOTOS} photos.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business Signature</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.signatureUrl || DEFAULT_SIGNATURE} alt="Business signature" className="h-24 w-auto rounded border border-border bg-white object-contain px-2" />
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{s.signatureUrl ? "Custom signature" : "Default Keyvendors signature"}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => sigRef.current?.click()}>Replace</Button>
                  {s.signatureUrl && (
                    <Button size="sm" variant="outline" className="text-destructive" onClick={() => set("signatureUrl", "")}>Use default</Button>
                  )}
                </div>
                <input ref={sigRef} type="file" accept="image/*" className="hidden" onChange={handleSignature} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:sticky lg:top-20 lg:h-fit">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Live preview</p>
          <div className="overflow-auto rounded-lg border border-border bg-slate-100 p-3">
            <WorkProgressReportDocument s={s} projectName={projectName} />
          </div>
        </div>
      </div>

      {/* print target — only this prints */}
      <div className="hidden print:block">
        <WorkProgressReportDocument s={s} projectName={projectName} />
      </div>
    </div>
  );
}
