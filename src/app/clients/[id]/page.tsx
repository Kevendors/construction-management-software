import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, Building2, FileText } from "lucide-react";
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
import {
  getClientById,
  getClientQuotations,
  getProjectsByClient,
} from "@/lib/data/crm";
import { lineTotalWithTax } from "@/lib/data/compute";
import { projectStatusMeta, quotationStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

// Rendered on-demand — the data layer reads request cookies (Supabase auth),
// which aren't available during build-time static generation.
export const dynamic = "force-dynamic";

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();

  const clientProjects = await getProjectsByClient(id);
  const quotations = await getClientQuotations(id);

  return (
    <div>
      <Link
        href="/clients"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Clients
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* profile */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{client.company}</CardTitle>
            <p className="text-sm text-muted-foreground">{client.name}</p>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" /> {client.email}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" /> {client.phone}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" /> {client.address}
            </p>
            <p className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" /> GST: {client.gst}
            </p>
          </CardContent>
        </Card>

        {/* projects + quotations */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Projects</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {clientProjects.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientProjects.map((p) => {
                      const meta = projectStatusMeta[p.status];
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                              {p.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatINR(p.value, { compact: true })}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.percentComplete}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No projects yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" /> Quotations
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {quotations.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Number</TableHead>
                      <TableHead>For</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotations.map((q) => {
                      const meta = quotationStatusMeta[q.status];
                      return (
                        <TableRow key={q.id}>
                          <TableCell>
                            <Link href={`/quotations`} className="font-medium hover:underline">
                              {q.number}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{q.projectName}</TableCell>
                          <TableCell>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatINR(lineTotalWithTax(q.items, q.taxRate), { compact: true })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No quotations.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
