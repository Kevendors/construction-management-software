import { projects } from "@/lib/mock/data";
import { ProjectDetail } from "@/components/projects/project-detail";

export function generateStaticParams() {
  return projects.map((p) => ({ id: p.id }));
}

// User-created projects live in the browser (localStorage), so the server can't
// know their ids — render on demand and let the client resolve them.
export const dynamicParams = true;

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectDetail projectId={id} />;
}
