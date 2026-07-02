import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioHealthChart } from "@/components/charts/portfolio-health-chart";
import { GanttChart } from "@/components/charts/gantt-chart";
import { MarginTrendChart } from "@/components/charts/trend-charts";
import { CashFlowChart } from "@/components/charts/cashflow-chart";
import { getCompanyAnalytics } from "@/lib/data/dashboard";
import type { ProjectStatus, Task, TaskStatus } from "@/lib/types";

/* Map a project's status onto the task-status palette so the portfolio
   timeline can reuse the Gantt component. */
const STATUS_MAP: Record<ProjectStatus, TaskStatus> = {
  planning: "not_started",
  ongoing: "ongoing",
  on_hold: "delayed",
  completed: "completed",
};

export default async function AnalyticsPage() {
  const { health, trend, flow, projects } = await getCompanyAnalytics();

  // project-level pseudo-tasks for the portfolio timeline
  const portfolioTasks: Task[] = projects.map((p) => ({
    id: p.id,
    projectId: p.id,
    parentId: null,
    name: `${p.code} · ${p.name}`,
    assigneeId: null,
    startDate: p.startDate,
    endDate: p.endDate,
    status: STATUS_MAP[p.status],
    progressValue: p.percentComplete,
    progressTarget: 100,
    unit: "percent",
    delayDays: 0,
  }));

  return (
    <>
      <PageHeader
        title="Company Analytics"
        description="Portfolio health, delivery timeline & financial trends across all projects"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portfolio Health — Task Status Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <PortfolioHealthChart data={health} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Margin Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <MarginTrendChart data={trend} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Portfolio Delivery Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <GanttChart tasks={portfolioTasks} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Cash Flow — In / Out & Running Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <CashFlowChart data={flow} />
        </CardContent>
      </Card>
    </>
  );
}
