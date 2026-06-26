import { projects } from "@/lib/mock/data";
import { ProjectDetail } from "@/components/projects/project-detail";

export function generateStaticParams() {
  return projects.map((p) => ({ id: p.id }));
}

// Projects are loaded from Supabase in the client store, which resolves the id
// on mount — render any id on demand rather than only the prerendered ones.
export const dynamicParams = true;

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectDetail projectId={id} />;
}
