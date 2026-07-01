"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Mail, Phone, MapPin, Search, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ClientDialog } from "./client-dialog";
import { formatINR } from "@/lib/utils";
import type { Client } from "@/lib/types";

export interface ClientItem {
  client: Client;
  projectCount: number;
  totalValue: number;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export function ClientsBoard({ items }: { items: ClientItem[] }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = items.filter(({ client: c }) => {
    if (!terms.length) return true;
    const hay = [c.company, c.name, c.email, c.phone, c.address, c.gst].filter(Boolean).join(" ").toLowerCase();
    return terms.every((t) => hay.includes(t));
  });

  return (
    <>
      <PageHeader
        title="Clients / CRM"
        description="Parties, contacts & their projects"
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus /> New Client
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients by name, company, email…"
            className="pl-9 pr-9"
            aria-label="Search clients"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{rows.length} of {items.length}</span>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {items.length === 0 ? "No clients yet — add your first one." : "No clients match your search."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ client: c, projectCount, totalValue }) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar initials={initials(c.company || c.name)} className="h-11 w-11 text-sm" />
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold group-hover:text-primary">{c.company || c.name}</h3>
                      <p className="truncate text-sm text-muted-foreground">{c.name}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                    {c.email && <p className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5 shrink-0" /> {c.email}</p>}
                    {c.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" /> {c.phone}</p>}
                    {c.address && <p className="flex items-center gap-2 truncate"><MapPin className="h-3.5 w-3.5 shrink-0" /> {c.address}</p>}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <Badge variant="secondary">{projectCount} project{projectCount === 1 ? "" : "s"}</Badge>
                    <span className="text-sm font-semibold tabular-nums">{formatINR(totalValue, { compact: true })}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ClientDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
