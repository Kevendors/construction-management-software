"use client";

import { Plus, Mail, Phone, MapPin, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import type { MaterialBoard } from "@/lib/data/material";

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export function SuppliersTab({ board }: { board: MaterialBoard }) {
  const { suppliers } = board;
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm">
          <Plus /> New Supplier
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {suppliers.map((s) => (
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
                <p className="flex items-center gap-2 truncate">
                  <Mail className="h-3.5 w-3.5 shrink-0" /> {s.email}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0" /> {s.phone}
                </p>
                <p className="flex items-center gap-2 truncate">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> {s.address}
                </p>
                <p className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 shrink-0" /> {s.gst}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
