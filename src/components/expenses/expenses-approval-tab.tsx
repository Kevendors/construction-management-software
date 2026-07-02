"use client";

import { Plus, Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { expenses } from "@/lib/mock/data";
import { getProject, getUser } from "@/lib/mock/selectors";
import { approvalMeta, categoryLabel, costCodeLabel } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export function ExpensesApprovalTab() {
  const rows = [...expenses].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{expenses.length} expenses logged</p>
        <Button size="sm">
          <Plus /> Log Expense
        </Button>
      </div>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>By</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((e) => {
              const by = getUser(e.byId);
              const project = getProject(e.projectId);
              const meta = approvalMeta[e.status];
              return (
                <TableRow key={e.id}>
                  <TableCell className="tabular-nums">
                    {new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </TableCell>
                  <TableCell className="max-w-[18rem]">
                    <div className="font-medium">{e.note}</div>
                    <div className="text-xs text-muted-foreground">{costCodeLabel[e.costCode]}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{project?.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{categoryLabel[e.category]}</Badge>
                  </TableCell>
                  <TableCell>
                    {by && (
                      <div className="flex items-center gap-2">
                        <Avatar initials={by.initials} color={by.avatarColor} className="h-6 w-6 text-[10px]" />
                        <span className="text-xs text-muted-foreground">{by.name}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatINR(e.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {e.status === "pending" ? (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline">
                          <Check /> Approve
                        </Button>
                        <Button size="sm" variant="ghost">
                          <X /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
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
