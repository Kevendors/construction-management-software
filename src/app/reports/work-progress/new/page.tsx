import { getReportableProjects } from "@/lib/data/reports";
import { WorkProgressReportBuilder } from "@/components/reports/work-progress-report-builder";

export default async function NewWorkProgressReportPage() {
  const projects = await getReportableProjects();
  return <WorkProgressReportBuilder projects={projects} />;
}
