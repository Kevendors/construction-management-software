"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import { deleteWorkProgressReportAction } from "@/app/reports/work-progress/actions";
import type { WorkProgressReport } from "@/lib/types";

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

export function WorkProgressReportsList({
  reports,
  projects,
  canWrite,
}: {
  reports: WorkProgressReport[];
  projects: { id: string; name: string }[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [projectFilter, setProjectFilter] = React.useState("all");
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const projectName = React.useCallback(
    (id: string) => projects.find((p) => p.id === id)?.name ?? "—",
    [projects]
  );

  const filtered = React.useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return reports.filter((r) => {
      if (projectFilter !== "all" && r.projectId !== projectFilter) return false;
      if (!terms.length) return true;
      const hay = [r.number, projectName(r.projectId), fmtDate(r.date)].join(" ").toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [reports, query, projectFilter, projectName]);

  async function remove(id: string, number: string) {
    if (!window.confirm(`Delete Work Progress Report ${number}? This can't be undone.`)) return;
    setDeleting(id);
    const res = await deleteWorkProgressReportAction(id);
    setDeleting(null);
    if (res.error) {
      window.alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by report no, project, or date…"
            className="pl-9 pr-9"
            aria-label="Search work progress reports"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          aria-label="Filter by project"
          className="sm:w-56"
        >
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} of {reports.length} report{reports.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No work progress reports match your search.
          </CardContent>
        </Card>
      ) : (
        filtered.map((r) => (
          <Card key={r.id}>
            <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{r.number}</span>
                  <span className="text-sm text-muted-foreground">{projectName(r.projectId)}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {fmtDate(r.date)}
                  {(r.periodStart || r.periodEnd) &&
                    ` · Period: ${fmtDate(r.periodStart)} – ${fmtDate(r.periodEnd)}`}
                  {typeof r.percentComplete === "number" && r.percentComplete > 0 && ` · ${r.percentComplete}% complete`}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/reports/work-progress/new?id=${r.id}`}>
                  <Button size="sm" variant="outline">
                    <Download /> Open / PDF
                  </Button>
                </Link>
                {canWrite && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deleting === r.id}
                    onClick={() => remove(r.id, r.number)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 /> Delete
                  </Button>
                )}
              </div>
            </CardHeader>
            {r.workCompleted && (
              <CardContent className="pt-0 text-sm text-muted-foreground">
                <p className="line-clamp-2 whitespace-pre-wrap">{r.workCompleted}</p>
              </CardContent>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
