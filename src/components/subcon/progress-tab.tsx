"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { SubconBoard } from "@/lib/data/subcon";
import { woStatusMeta } from "@/lib/labels";

export function ProgressTab({ board }: { board: SubconBoard }) {
  const { workOrders, subcontractors, projects, progress } = board;
  const subById = new Map(subcontractors.map((s) => [s.id, s]));
  const projectById = new Map(projects.map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
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
              <Badge variant={meta.variant}>{meta.label}</Badge>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center gap-3">
                <Progress value={latest} indicatorClassName="bg-accent" className="flex-1" />
                <span className="w-12 text-right text-sm font-semibold tabular-nums">{latest}%</span>
              </div>
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
