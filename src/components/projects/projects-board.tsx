"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MapPin, CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select } from "@/components/ui/dialog";
import { useClients, useStore, useUsers } from "@/lib/store/project-store";
import { useRole } from "@/components/layout/role-provider";
import { projectStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import type { Client, Project, ProjectStatus, TaskStatus } from "@/lib/types";

export interface OverviewItem {
  project: Project;
  client: Client | null;
  margin: number;
  counts: Record<TaskStatus, number>;
}

function ProjectCard({ item }: { item: OverviewItem }) {
  const { project: p, client, margin, counts } = item;
  const meta = projectStatusMeta[p.status];
  const { role } = useRole();
  const canSeeValue = role === "super_admin";
  return (
    <Link href={`/projects/${p.id}`} className="group">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{p.code}</p>
              <h3 className="truncate font-semibold group-hover:text-primary">{p.name}</h3>
            </div>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>

          <p className="mt-1 text-sm text-muted-foreground">{client?.company}</p>

          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium tabular-nums">{p.percentComplete}%</span>
            </div>
            <Progress value={p.percentComplete} indicatorClassName="bg-accent" />
          </div>

          {canSeeValue && (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Value</dt>
                <dd className="font-semibold tabular-nums">{formatINR(p.value, { compact: true })}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Margin</dt>
                <dd
                  className={`font-semibold tabular-nums ${
                    margin >= 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {formatINR(margin, { compact: true })}
                </dd>
              </div>
            </dl>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5">
            {counts.ongoing > 0 && <Badge variant="info">{counts.ongoing} ongoing</Badge>}
            {counts.delayed > 0 && <Badge variant="destructive">{counts.delayed} delayed</Badge>}
            {counts.completed > 0 && <Badge variant="success">{counts.completed} done</Badge>}
          </div>

          <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {p.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarRange className="h-3.5 w-3.5" />
              {new Date(p.endDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

const STATUSES: ProjectStatus[] = ["planning", "ongoing", "on_hold", "completed"];

interface ProjectPrefill {
  name: string;
  value: number;
  location: string;
}

function NewProjectDialog({
  open,
  onClose,
  nextCode,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  nextCode: string;
  prefill?: ProjectPrefill | null;
}) {
  const { addProject } = useStore();
  const clients = useClients();
  const users = useUsers();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);

  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState(nextCode);
  const [clientId, setClientId] = React.useState("");
  const [value, setValue] = React.useState("10000000");
  const [status, setStatus] = React.useState<ProjectStatus>("planning");
  const [location, setLocation] = React.useState("");
  const [startDate, setStartDate] = React.useState(today);
  const [endDate, setEndDate] = React.useState(nextYear);
  const [pmId, setPmId] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setCode(nextCode);
    setClientId((c) => c || clients[0]?.id || "");
    setPmId((p) => p || users[0]?.id || "");
    if (prefill) {
      setName(prefill.name);
      setValue(String(prefill.value));
      setLocation(prefill.location);
      setStatus("planning");
    }
  }, [open, nextCode, prefill, clients, users]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const project = await addProject({
      code: code.trim() || nextCode,
      name: name.trim(),
      clientId,
      value: Number(value) || 0,
      status,
      startDate,
      endDate,
      percentComplete: 0,
      location: location.trim() || "—",
      pmId,
    });
    onClose();
    if (project) router.push(`/projects/${project.id}`);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Project"
      description="Saved to your workspace — synced across devices."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Project name</Label>
            <Input
              id="p-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mehta Office Complex"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-code">Code</Label>
            <Input id="p-code" value={code} onChange={(e) => setCode(e.target.value)} className="w-28" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-client">Client</Label>
            <Select id="p-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-pm">Project Manager</Label>
            <Select id="p-pm" value={pmId} onChange={(e) => setPmId(e.target.value)}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-value">Value (₹)</Label>
            <Input id="p-value" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-status">Status</Label>
            <Select id="p-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {projectStatusMeta[s].label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-loc">Location</Label>
          <Input
            id="p-loc"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Andheri, Mumbai"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-start">Start date</Label>
            <Input id="p-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-end">End date</Label>
            <Input id="p-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create Project</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ProjectsBoard({ initial }: { initial: OverviewItem[] }) {
  const { addedProjects, tasks, transactions, clients } = useStore();
  const { role } = useRole();
  const canCreate = role === "super_admin" || role === "pm";
  const [open, setOpen] = React.useState(false);
  const [prefill, setPrefill] = React.useState<ProjectPrefill | null>(null);

  // "Convert to Project" from a quotation drops a prefill payload here.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("sitehub:newProjectPrefill");
      if (raw) {
        setPrefill(JSON.parse(raw) as ProjectPrefill);
        setOpen(true);
        localStorage.removeItem("sitehub:newProjectPrefill");
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Build cards for user-created projects, deriving margin/counts/progress live.
  const addedItems: OverviewItem[] = addedProjects.map((p) => {
    const projTasks = tasks.filter((t) => t.projectId === p.id);
    const spent = transactions
      .filter((t) => t.projectId === p.id && t.direction === "out")
      .reduce((s, t) => s + t.amount, 0);
    const parents = projTasks.filter((t) => t.parentId === null);
    const counts: Record<TaskStatus, number> = {
      not_started: 0,
      ongoing: 0,
      delayed: 0,
      completed: 0,
    };
    for (const t of projTasks) counts[t.status]++;
    const pct = parents.length
      ? Math.round(
          parents.reduce(
            (s, t) => s + (t.progressTarget > 0 ? Math.min(100, (t.progressValue / t.progressTarget) * 100) : 0),
            0
          ) / parents.length
        )
      : 0;
    return {
      project: { ...p, percentComplete: pct },
      client: clients.find((c) => c.id === p.clientId) ?? null,
      margin: p.value - spent, // live: value minus recorded expenses
      counts,
    };
  });

  // After a refresh the server-rendered `initial` already includes any project
  // created this session, so dedupe by id to avoid showing it twice.
  const seen = new Set(initial.map((it) => it.project.id));
  const allItems = [...initial, ...addedItems.filter((it) => !seen.has(it.project.id))];

  // Suggest the next SH-### code based on the highest existing one.
  const maxNum = allItems.reduce((max, it) => {
    const m = /SH-(\d+)/.exec(it.project.code);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const nextCode = `SH-${String(maxNum + 1).padStart(3, "0")}`;

  return (
    <>
      <PageHeader
        title="Projects"
        description="All construction & design projects"
        action={
          canCreate ? (
            <Button onClick={() => setOpen(true)}>
              <Plus /> New Project
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {allItems.map((item) => (
          <ProjectCard key={item.project.id} item={item} />
        ))}
      </div>

      <NewProjectDialog
        open={open}
        onClose={() => {
          setOpen(false);
          setPrefill(null);
        }}
        nextCode={nextCode}
        prefill={prefill}
      />
    </>
  );
}
