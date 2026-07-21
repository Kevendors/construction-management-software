"use client";

import Link from "next/link";
import { ArrowLeft, MapPin, CalendarRange, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "./overview-tab";
import { TasksTab } from "./tasks-tab";
import { UpdatesTab } from "./updates-tab";
import { FilesTab } from "./files-tab";
import { CommercialTab } from "./commercial-tab";
import { AlertsTab, useProjectAlerts } from "./alerts-tab";
import { HistoryTab } from "./history-tab";
import { TeamTab } from "./team-tab";
import { SettingsTab } from "./settings-tab";
import { useRole } from "@/components/layout/role-provider";
import { DrawingList } from "@/components/design/drawing-list";
import { getProjectDrawings } from "@/lib/mock/selectors";
import {
  ProjectStoreProvider,
  useClients,
  useProject,
  useProjectTeam,
  useStore,
} from "@/lib/store/project-store";
import { projectStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export function ProjectDetail({ projectId }: { projectId: string }) {
  return (
    <ProjectStoreProvider>
      <ProjectDetailInner projectId={projectId} />
    </ProjectStoreProvider>
  );
}

function ProjectDetailInner({ projectId }: { projectId: string }) {
  // Projects are loaded from Supabase into the store on mount (RLS-scoped to
  // the org); resolve this one by id once the load settles.
  const { loading } = useStore();
  const project = useProject(projectId);
  const clients = useClients();
  // The Team tab roster is the source of truth for people on a project —
  // show its Project Manager, not the legacy projects.pm_id label.
  const team = useProjectTeam(projectId);
  const pm = team.find((t) => t.member.role === "pm")?.user ?? null;
  const alerts = useProjectAlerts(projectId);
  const highCount = alerts.filter((a) => a.severity === "high").length;
  const { role } = useRole();
  const canSeeValue = role === "super_admin";

  if (loading && !project) {
    return (
      <div>
        <Link
          href="/projects"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Projects
        </Link>
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">Loading project…</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div>
        <Link
          href="/projects"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Projects
        </Link>
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            This project could not be found. It may have been created in a different browser, or the
            link is invalid.
          </p>
        </div>
      </div>
    );
  }

  const client = clients.find((c) => c.id === project.clientId) ?? null;
  const meta = projectStatusMeta[project.status];
  const drawings = getProjectDrawings(projectId);

  return (
    <div>
      <Link
        href="/projects"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{project.code}</span>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{project.name}</h1>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> {client?.company}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {project.location}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarRange className="h-3.5 w-3.5" />
              {new Date(project.startDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })} –{" "}
              {new Date(project.endDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
            </span>
            {pm && <span>PM: {pm.name}</span>}
          </div>
        </div>
        <div className={`shrink-0 text-left sm:text-right ${canSeeValue ? "" : "hidden"}`}>
          <p className="text-xs text-muted-foreground">Project Value</p>
          <p className="text-2xl font-bold tabular-nums">{formatINR(project.value, { compact: true })}</p>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {alerts.length > 0 && (
              <span
                className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white ${
                  highCount > 0 ? "bg-destructive" : "bg-amber-500"
                }`}
              >
                {alerts.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="design" disabled className="opacity-40 cursor-not-allowed" title="Coming soon">
            Design
          </TabsTrigger>
          <TabsTrigger value="commercial" disabled className="opacity-40 cursor-not-allowed" title="Coming soon">
            Commercial
          </TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          {role === "super_admin" && <TabsTrigger value="settings">Settings</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="updates">
          <UpdatesTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="design">
          <DrawingList drawings={drawings} />
        </TabsContent>
        <TabsContent value="commercial">
          <CommercialTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="files">
          <FilesTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="team">
          <TeamTab projectId={projectId} />
        </TabsContent>
        {role === "super_admin" && (
          <TabsContent value="settings">
            <SettingsTab project={project} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
