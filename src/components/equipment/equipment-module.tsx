import { Wrench, Activity, PauseCircle, Hammer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { equipmentKindLabel, equipmentStatusMeta, ownershipMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";
import type { EquipmentKind } from "@/lib/types";
import type { EquipmentBoard } from "@/lib/data/operations";

const SECTIONS: { kind: EquipmentKind; title: string }[] = [
  { kind: "machinery", title: "Plant & Machinery" },
  { kind: "tool", title: "Tools" },
  { kind: "asset", title: "Assets" },
];

export function EquipmentModule({ board }: { board: EquipmentBoard }) {
  const { items: equipment, counts, projects } = board;
  const projectById = new Map(projects.map((p) => [p.id, p]));

  return (
    <>
      <PageHeader
        title="Equipment & Assets"
        description="Plant, tools & assets — deployment, status & monthly running cost"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Items" value={String(counts.total)} icon={Wrench} accent="primary" hint={`${formatINR(counts.monthlyCost, { compact: true })}/mo`} />
        <StatCard label="In Use" value={String(counts.inUse)} icon={Activity} accent="success" />
        <StatCard label="Idle" value={String(counts.idle)} icon={PauseCircle} accent="info" />
        <StatCard label="Maintenance" value={String(counts.maintenance)} icon={Hammer} accent="destructive" />
      </div>

      <div className="space-y-4">
        {SECTIONS.map(({ kind, title }) => {
          const items = equipment.filter((e) => e.kind === kind);
          if (items.length === 0) return null;
          return (
            <Card key={kind}>
              <CardHeader>
                <CardTitle className="text-base">
                  {title} <span className="text-muted-foreground">· {items.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>{equipmentKindLabel[kind]}</TableHead>
                      <TableHead>Ownership</TableHead>
                      <TableHead>Deployed At</TableHead>
                      <TableHead className="text-right">Monthly Cost</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((e) => {
                      const meta = equipmentStatusMeta[e.status];
                      const own = ownershipMeta[e.ownership];
                      const project = e.projectId ? projectById.get(e.projectId) ?? null : null;
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{e.code}</TableCell>
                          <TableCell className="font-medium">{e.name}</TableCell>
                          <TableCell>
                            <Badge variant={own.variant}>{own.label}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {project ? project.code : <span className="text-xs">Stores</span>}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatINR(e.monthlyRate)}</TableCell>
                          <TableCell>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
