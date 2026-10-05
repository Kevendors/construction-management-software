"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Search, Trash2, Truck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/dialog";
import { deleteChallanAction } from "@/app/challans/actions";
import type { Challan } from "@/lib/types";

const fmtDate = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

export function ChallansList({
  challans,
  projects,
  canWrite,
}: {
  challans: Challan[];
  projects: { id: string; name: string; location: string }[];
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
    return challans.filter((c) => {
      if (projectFilter !== "all" && c.projectId !== projectFilter) return false;
      if (!terms.length) return true;
      const hay = [c.number, projectName(c.projectId), c.vehicleNumber, c.transporterName, fmtDate(c.date)]
        .join(" ")
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [challans, query, projectFilter, projectName]);

  async function remove(id: string, number: string) {
    if (!window.confirm(`Delete Challan ${number}? This can't be undone.`)) return;
    setDeleting(id);
    const res = await deleteChallanAction(id);
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
            placeholder="Search by challan no, project, vehicle, or transporter…"
            className="pl-9 pr-9"
            aria-label="Search challans"
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
        {filtered.length} of {challans.length} challan{challans.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No challans match your search.
          </CardContent>
        </Card>
      ) : (
        filtered.map((c) => (
          <Card key={c.id}>
            <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.number}</span>
                  <span className="text-sm text-muted-foreground">{projectName(c.projectId)}</span>
                </div>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                  <Truck className="h-3.5 w-3.5" />
                  {fmtDate(c.date)}
                  {c.vehicleNumber && ` · ${c.vehicleNumber}`}
                  {c.transporterName && ` · ${c.transporterName}`}
                  {` · ${c.items.length} item${c.items.length === 1 ? "" : "s"}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/challans/new?id=${c.id}`}>
                  <Button size="sm" variant="outline">
                    <Download /> Open / PDF
                  </Button>
                </Link>
                {canWrite && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={deleting === c.id}
                    onClick={() => remove(c.id, c.number)}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 /> Delete
                  </Button>
                )}
              </div>
            </CardHeader>
            {c.items.length > 0 && (
              <CardContent className="pt-0 text-sm text-muted-foreground">
                <p className="truncate">
                  {c.items.map((it) => `${it.description} (${it.qty} ${it.unit})`).join(", ")}
                </p>
              </CardContent>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
