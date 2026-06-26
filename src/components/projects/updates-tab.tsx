"use client";

import * as React from "react";
import { CloudSun, Users, Image as ImageIcon, Plus, AlertTriangle, Upload, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select, Textarea } from "@/components/ui/dialog";
import { fileToResizedDataUrl } from "@/lib/image";
import {
  useProjectDprs,
  useProjectInstructions,
  useStore,
  useUsers,
} from "@/lib/store/project-store";
import type { SiteInstruction } from "@/lib/types";

const MAX_PHOTOS = 8;

const priorityVariant = { low: "muted", medium: "warning", high: "destructive" } as const;
const PRIORITIES: SiteInstruction["priority"][] = ["low", "medium", "high"];

function NewDprDialog({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { addDpr } = useStore();
  const users = useUsers();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = React.useState(today);
  const [authorId, setAuthorId] = React.useState(users[0]?.id ?? "");
  const [weather, setWeather] = React.useState("Clear, 34°C");
  const [workDone, setWorkDone] = React.useState("");
  const [labourCount, setLabourCount] = React.useState("0");
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setUploading(true);
    try {
      const room = Math.max(0, MAX_PHOTOS - photos.length);
      const urls = await Promise.all(files.slice(0, room).map((f) => fileToResizedDataUrl(f)));
      setPhotos((prev) => [...prev, ...urls].slice(0, MAX_PHOTOS));
    } catch {
      /* skip files that fail to decode */
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removePhoto(i: number) {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!workDone.trim()) return;
    addDpr({
      projectId,
      date,
      authorId,
      weather: weather.trim(),
      workDone: workDone.trim(),
      labourCount: Number(labourCount) || 0,
      photos: photos.length,
      photoUrls: photos,
    });
    setWorkDone("");
    setLabourCount("0");
    setPhotos([]);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Daily Progress Report"
      description="Saved to your workspace — synced across devices."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="d-date">Date</Label>
            <Input id="d-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-author">Reported by</Label>
            <Select id="d-author" value={authorId} onChange={(e) => setAuthorId(e.target.value)}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d-weather">Weather</Label>
          <Input id="d-weather" value={weather} onChange={(e) => setWeather(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d-work">Work done</Label>
          <Textarea
            id="d-work"
            value={workDone}
            onChange={(e) => setWorkDone(e.target.value)}
            placeholder="Describe the day's progress…"
            autoFocus
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="d-labour">Labour count</Label>
          <Input id="d-labour" type="number" value={labourCount} onChange={(e) => setLabourCount(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="d-photos">Site photos</Label>
            <span className="text-xs text-muted-foreground">
              {photos.length}/{MAX_PHOTOS}
            </span>
          </div>
          <input
            ref={fileRef}
            id="d-photos"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFiles}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || photos.length >= MAX_PHOTOS}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-input bg-card px-3 py-4 text-sm text-muted-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading
              ? "Processing…"
              : photos.length >= MAX_PHOTOS
                ? "Maximum photos added"
                : "Click to upload photos"}
          </button>
          {photos.length > 0 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {photos.map((src, i) => (
                <div key={i} className="group relative aspect-square overflow-hidden rounded-md border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Site photo ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    aria-label="Remove photo"
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save DPR</Button>
        </div>
      </form>
    </Dialog>
  );
}

function NewInstructionDialog({
  projectId,
  open,
  onClose,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
}) {
  const { addInstruction } = useStore();
  const users = useUsers();
  const today = new Date().toISOString().slice(0, 10);
  const [byId, setById] = React.useState(users[0]?.id ?? "");
  const [priority, setPriority] = React.useState<SiteInstruction["priority"]>("medium");
  const [text, setText] = React.useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    addInstruction({ projectId, date: today, byId, text: text.trim(), priority });
    setText("");
    setPriority("medium");
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="New Site Instruction">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-by">Issued by</Label>
            <Select id="s-by" value={byId} onChange={(e) => setById(e.target.value)}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-priority">Priority</Label>
            <Select
              id="s-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as SiteInstruction["priority"])}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="s-text">Instruction</Label>
          <Textarea
            id="s-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Use M30 grade concrete for the floor 9 slab…"
            autoFocus
            required
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add Instruction</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function UpdatesTab({ projectId }: { projectId: string }) {
  const dprs = useProjectDprs(projectId);
  const instructions = useProjectInstructions(projectId);
  const users = useUsers();
  const userById = (id: string) => users.find((u) => u.id === id) ?? null;
  const [dprOpen, setDprOpen] = React.useState(false);
  const [siOpen, setSiOpen] = React.useState(false);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* DPR feed */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Daily Progress Reports</CardTitle>
            <Button size="sm" onClick={() => setDprOpen(true)}>
              <Plus /> New DPR
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {dprs.map((d) => {
              const author = userById(d.authorId);
              return (
                <div key={d.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2">
                    {author && <Avatar initials={author.initials} color={author.avatarColor} className="h-7 w-7" />}
                    <div>
                      <p className="text-sm font-medium">{author?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(d.date).toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm">{d.workDone}</p>
                  {d.photoUrls && d.photoUrls.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {d.photoUrls.map((src, i) => (
                        <a
                          key={i}
                          href={src}
                          target="_blank"
                          rel="noreferrer"
                          className="h-16 w-16 overflow-hidden rounded-md border border-border"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`DPR photo ${i + 1}`} className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CloudSun className="h-3.5 w-3.5" /> {d.weather}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {d.labourCount} labour
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5" /> {d.photoUrls?.length ?? d.photos} photos
                    </span>
                  </div>
                </div>
              );
            })}
            {dprs.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No DPRs yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Site instructions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Site Instructions</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setSiOpen(true)}>
            <Plus />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {instructions.map((s) => {
            const by = userById(s.byId);
            return (
              <div key={s.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <Badge variant={priorityVariant[s.priority]}>
                    {s.priority === "high" && <AlertTriangle className="h-3 w-3" />}
                    {s.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </span>
                </div>
                <p className="mt-2 text-sm">{s.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">— {by?.name}</p>
              </div>
            );
          })}
          {instructions.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No instructions.</p>
          )}
        </CardContent>
      </Card>

      <NewDprDialog projectId={projectId} open={dprOpen} onClose={() => setDprOpen(false)} />
      <NewInstructionDialog projectId={projectId} open={siOpen} onClose={() => setSiOpen(false)} />
    </div>
  );
}
