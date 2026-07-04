"use client";

import * as React from "react";
import { FileImage, FileText, FileBox, File as FileIcon, UploadCloud, Download, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProjectDprs } from "@/lib/store/project-store";
import { useRole } from "@/components/layout/role-provider";
import { fileToResizedDataUrl } from "@/lib/image";
import {
  listProjectFilesAction,
  uploadProjectFileAction,
  deleteProjectFileAction,
  type ProjectFileView,
} from "@/app/projects/file-actions";

const iconFor = (kind: ProjectFileView["kind"]) =>
  kind === "photo" ? FileImage : kind === "pdf" ? FileText : kind === "dwg" ? FileBox : FileIcon;

async function fileToDataUrl(file: File): Promise<string> {
  if (file.type.startsWith("image/")) return fileToResizedDataUrl(file, 1600, 0.75);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export function FilesTab({ projectId }: { projectId: string }) {
  const dprs = useProjectDprs(projectId);
  const { role } = useRole();
  const canDelete = role === "super_admin" || role === "pm";
  const [files, setFiles] = React.useState<ProjectFileView[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const dprPhotos = dprs.flatMap((d) =>
    (d.photoUrls ?? []).map((url, i) => ({ id: `${d.id}-${i}`, url, date: d.date }))
  );

  React.useEffect(() => {
    let cancelled = false;
    listProjectFilesAction(projectId)
      .then((rows) => !cancelled && setFiles(rows))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [projectId]);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await uploadProjectFileAction(projectId, file.name, dataUrl);
      if (res.error) setError(res.error);
      else if (res.file) setFiles((prev) => [res.file!, ...prev]);
    } catch {
      setError("Could not read that file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    const prev = files;
    setFiles((f) => f.filter((x) => x.id !== id));
    const res = await deleteProjectFileAction(id);
    if (res.error) { setError(res.error); setFiles(prev); }
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf,.dwg,.dxf,.doc,.docx,.xls,.xlsx"
        className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
      />

      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium">{files.length} uploaded file{files.length === 1 ? "" : "s"}</p>
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <UploadCloud />} Upload
          </Button>
        </div>
        <CardContent className="p-0">
          {error && <p className="border-b border-border bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>}
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading files…</p>
          ) : files.length === 0 ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
              className={`flex w-full flex-col items-center justify-center gap-1.5 py-12 text-center transition ${dragging ? "bg-primary/5" : ""}`}
            >
              <UploadCloud className={`h-7 w-7 ${dragging ? "text-primary" : "text-muted-foreground"}`} />
              <span className="text-sm font-medium">Click to upload or drag &amp; drop</span>
              <span className="text-xs text-muted-foreground">Images, PDF, DWG or documents</span>
            </button>
          ) : (
            <ul className="divide-y divide-border">
              {files.map((f) => {
                const Icon = iconFor(f.kind);
                return (
                  <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.sizeKb} KB · {new Date(f.uploadedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        {f.uploadedByName ? ` · ${f.uploadedByName}` : ""}
                      </p>
                    </div>
                    {f.url && (
                      <a href={f.url} target="_blank" rel="noreferrer" className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Download / view">
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                    {canDelete && (
                      <button type="button" onClick={() => remove(f.id)} className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {dprPhotos.length > 0 && (
        <Card>
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-medium">Site photos from DPRs ({dprPhotos.length})</p>
          </div>
          <CardContent className="grid grid-cols-3 gap-2 p-4 sm:grid-cols-4 md:grid-cols-6">
            {dprPhotos.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="group relative aspect-square overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`Site photo ${p.date}`} className="h-full w-full object-cover transition group-hover:scale-105" />
              </a>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
