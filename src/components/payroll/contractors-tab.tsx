"use client";

import { Plus, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { labourContractors } from "@/lib/mock/data";
import { getContractorAttendance } from "@/lib/mock/selectors";
import { tradeLabel } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

export function ContractorsTab() {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{labourContractors.length} labour contractors</p>
        <Button size="sm">
          <Plus /> Add Contractor
        </Button>
      </div>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {labourContractors.map((c) => {
          const att = getContractorAttendance(c.id);
          const lastPresent = att[0]?.present ?? 0;
          return (
            <div key={c.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.company}</p>
                  <p className="text-sm text-muted-foreground">{c.name}</p>
                </div>
                <Badge variant="outline">{tradeLabel[c.trade]}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Headcount</p>
                  <p className="font-medium tabular-nums">{c.headcount}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg day rate</p>
                  <p className="font-medium tabular-nums">{formatINR(c.dayRate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last present</p>
                  <p className="font-medium tabular-nums text-success">{lastPresent}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Est. daily cost</p>
                  <p className="font-medium tabular-nums">{formatINR(c.headcount * c.dayRate, { compact: true })}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" /> {c.phone}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
