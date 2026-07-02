"use client";

import { MapPin } from "lucide-react";
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
import { AttendanceChart } from "@/components/charts/bar-charts";
import { labourAttendance } from "@/lib/mock/data";
import { getContractor, labourAttendanceByDay } from "@/lib/mock/selectors";
import { shiftLabel } from "@/lib/labels";

export function AttendanceTab() {
  const byDay = labourAttendanceByDay();
  const rows = [...labourAttendance].sort(
    (a, b) => +new Date(b.date) - +new Date(a.date)
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Labour Attendance — Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceChart data={byDay} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">GPS Attendance Log</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Contractor</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">Absent</TableHead>
                <TableHead>Geo-fence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => {
                const c = getContractor(a.contractorId);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="tabular-nums">
                      {new Date(a.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </TableCell>
                    <TableCell className="font-medium">{c?.company}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{shiftLabel[a.shift]}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-success">
                      {a.present}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {a.absent}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {a.gps}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
