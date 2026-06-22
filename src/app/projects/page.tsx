import { getProjectsOverview } from "@/lib/data/projects";
import { ProjectStoreProvider } from "@/lib/store/project-store";
import { ProjectsBoard, type OverviewItem } from "@/components/projects/projects-board";

export default async function ProjectsPage() {
  const overview = await getProjectsOverview();
  const initial: OverviewItem[] = overview.map(({ project, client, pnl, taskCounts }) => ({
    project,
    client,
    margin: pnl.margin,
    counts: taskCounts,
  }));

  return (
    <ProjectStoreProvider>
      <ProjectsBoard initial={initial} />
    </ProjectStoreProvider>
  );
}
