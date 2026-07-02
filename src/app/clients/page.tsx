import Link from "next/link";
import { Plus, Mail, Phone, MapPin } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getClientsWithStats } from "@/lib/data/crm";
import { formatINR } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function ClientsPage() {
  const rows = await getClientsWithStats();
  return (
    <>
      <PageHeader
        title="Clients / CRM"
        description="Parties, contacts & their projects"
        action={
          <Button>
            <Plus /> New Client
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ client: c, projectCount, totalValue }) => {
          return (
            <Link key={c.id} href={`/clients/${c.id}`} className="group">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar initials={initials(c.name)} className="h-11 w-11 text-sm" />
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold group-hover:text-primary">
                        {c.company}
                      </h3>
                      <p className="truncate text-sm text-muted-foreground">{c.name}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2 truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> {c.email}
                    </p>
                    <p className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" /> {c.phone}
                    </p>
                    <p className="flex items-center gap-2 truncate">
                      <MapPin className="h-3.5 w-3.5 shrink-0" /> {c.address}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                    <Badge variant="secondary">
                      {projectCount} project{projectCount === 1 ? "" : "s"}
                    </Badge>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatINR(totalValue, { compact: true })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
