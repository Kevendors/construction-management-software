import Link from "next/link";
import { Plus, MapPin, CalendarRange } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getProjectsOverview } from "@/lib/data/projects";
import { projectStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export default async function ProjectsPage() {
  const overview = await getProjectsOverview();
  return (
    <>
      <PageHeader
        title="Projects"
        description="All construction & design projects"
        action={
          <Button>
            <Plus /> New Project
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {overview.map(({ project: p, client, pnl, taskCounts: counts }) => {
          const meta = projectStatusMeta[p.status];
          return (
            <Link key={p.id} href={`/projects/${p.id}`} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted-foreground">{p.code}</p>
                      <h3 className="truncate font-semibold group-hover:text-primary">
                        {p.name}
                      </h3>
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

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Value</dt>
                      <dd className="font-semibold tabular-nums">
                        {formatINR(p.value, { compact: true })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Margin</dt>
                      <dd
                        className={`font-semibold tabular-nums ${
                          pnl.margin >= 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {formatINR(pnl.margin, { compact: true })}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {counts.ongoing > 0 && (
                      <Badge variant="info">{counts.ongoing} ongoing</Badge>
                    )}
                    {counts.delayed > 0 && (
                      <Badge variant="destructive">{counts.delayed} delayed</Badge>
                    )}
                    {counts.completed > 0 && (
                      <Badge variant="success">{counts.completed} done</Badge>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" /> {p.location}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarRange className="h-3.5 w-3.5" />
                      {new Date(p.endDate).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
