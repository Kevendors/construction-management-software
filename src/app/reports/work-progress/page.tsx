import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getWorkProgressReportsBoard } from "@/lib/data/reports";
import { WorkProgressReportsList } from "@/components/reports/work-progress-list";
import { getAuthContext } from "@/lib/auth/context";
import type { Role } from "@/lib/types";

const CAN_WRITE: Role[] = ["super_admin", "pm", "supervisor"];

export default async function WorkProgressReportsPage() {
  const [board, ctx] = await Promise.all([getWorkProgressReportsBoard(), getAuthContext()]);
  // No auth context = mock/demo mode, where the current user is a super_admin.
  const canWrite = ctx ? !!ctx.role && CAN_WRITE.includes(ctx.role) : true;

  return (
    <>
      <PageHeader
        title="Work Progress Reports"
        description="Site progress reports sent to clients — a formatted record, not derived from DPRs"
        action={
          canWrite ? (
            <Link href="/reports/work-progress/new">
              <Button>
                <Plus /> New Report
              </Button>
            </Link>
          ) : undefined
        }
      />

      <WorkProgressReportsList reports={board.reports} projects={board.projects} canWrite={canWrite} />
    </>
  );
}
