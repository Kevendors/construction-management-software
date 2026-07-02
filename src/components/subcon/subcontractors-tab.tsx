"use client";

import { Plus, Phone, Building2, Hammer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import type { SubconBoard } from "@/lib/data/subcon";
import { tradeLabel } from "@/lib/labels";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export function SubcontractorsTab({ board }: { board: SubconBoard }) {
  const { subcontractors, workOrders: subconWorkOrders } = board;
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm">
          <Plus /> New Subcontractor
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {subcontractors.map((s) => {
          const woCount = subconWorkOrders.filter((w) => w.subcontractorId === s.id).length;
          return (
            <Card key={s.id}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <Avatar initials={initials(s.company)} className="h-11 w-11 text-sm" />
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{s.company}</h3>
                    <p className="truncate text-sm text-muted-foreground">{s.contact}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Hammer className="h-3.5 w-3.5 shrink-0" />
                    <Badge variant="secondary">{tradeLabel[s.trade]}</Badge>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" /> {s.phone}
                  </p>
                  <p className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 shrink-0" /> {s.gst}
                  </p>
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <Badge variant="outline">
                    {woCount} work order{woCount === 1 ? "" : "s"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
