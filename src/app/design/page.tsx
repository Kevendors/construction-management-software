import { Upload, FileBox, CheckCircle2, Clock, FileEdit } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { DrawingList } from "@/components/design/drawing-list";
import { getDesignBoard } from "@/lib/data/design";

export default async function DesignPage() {
  const { groups: byProject, counts } = await getDesignBoard();
  const { total, approved, forReview, drafts } = counts;

  return (
    <>
      <PageHeader
        title="Design Management"
        description="Drawings, revisions & approvals across projects"
        action={
          <Button>
            <Upload /> Upload Drawing
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Drawings" value={String(total)} icon={FileBox} accent="primary" />
        <StatCard label="Approved" value={String(approved)} icon={CheckCircle2} accent="success" />
        <StatCard label="For Review" value={String(forReview)} icon={Clock} accent="accent" />
        <StatCard label="Drafts" value={String(drafts)} icon={FileEdit} accent="info" />
      </div>

      <div className="space-y-6">
        {byProject.map((g) => (
          <section key={g.project.id}>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              {g.project.code} · {g.project.name}
            </h2>
            <DrawingList drawings={g.items} />
          </section>
        ))}
      </div>
    </>
  );
}
