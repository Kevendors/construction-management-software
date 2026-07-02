"use client";

import { Plus, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import type { MaterialBoard } from "@/lib/data/material";
import { approvalMeta } from "@/lib/labels";

export function RequestsTab({ board }: { board: MaterialBoard }) {
  const { requests: materialRequests, items, projects, users } = board;
  const itemById = new Map(items.map((i) => [i.id, i]));
  const projectById = new Map(projects.map((p) => [p.id, p]));
  const userById = new Map(users.map((u) => [u.id, u]));

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{materialRequests.length} material requests</p>
        <Button size="sm">
          <Plus /> New Request
        </Button>
      </div>
      <CardContent className="space-y-3 p-4">
        {materialRequests.map((r) => {
          const by = userById.get(r.byId) ?? null;
          const project = projectById.get(r.projectId) ?? null;
          const meta = approvalMeta[r.status];
          return (
            <div key={r.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.number}</span>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {by && <Avatar initials={by.initials} color={by.avatarColor} className="h-6 w-6 text-[10px]" />}
                  <span className="text-xs text-muted-foreground">
                    {project?.code} ·{" "}
                    {new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{r.note}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {r.lines.map((l) => {
                  const item = itemById.get(l.materialItemId) ?? null;
                  return (
                    <li key={l.materialItemId} className="flex justify-between border-b border-border/60 py-1 last:border-0">
                      <span>{item?.name}</span>
                      <span className="tabular-nums font-medium">
                        {l.qty} {item?.unit}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {r.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline">
                    <Check /> Approve
                  </Button>
                  <Button size="sm" variant="ghost">
                    <X /> Reject
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
