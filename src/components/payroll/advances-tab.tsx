"use client";

import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { advances } from "@/lib/mock/data";
import { advanceOutstanding, getContractor, getEmployee } from "@/lib/mock/selectors";
import { advanceStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export function AdvancesTab() {
  const partyName = (a: (typeof advances)[number]) =>
    a.partyType === "employee"
      ? getEmployee(a.partyId)?.name
      : getContractor(a.partyId)?.company;

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{advances.length} advances</p>
        <Button size="sm">
          <Plus /> New Advance
        </Button>
      </div>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Party</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Advance</TableHead>
              <TableHead className="w-40">Recovered</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {advances.map((a) => {
              const meta = advanceStatusMeta[a.status];
              const pct = a.amount > 0 ? (a.recovered / a.amount) * 100 : 0;
              return (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium">{partyName(a)}</div>
                    <div className="text-xs text-muted-foreground">{a.note}</div>
                  </TableCell>
                  <TableCell className="capitalize text-muted-foreground">{a.partyType}</TableCell>
                  <TableCell className="tabular-nums">
                    {new Date(a.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(a.amount)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="flex-1" />
                      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatINR(advanceOutstanding(a))}
                  </TableCell>
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
}
