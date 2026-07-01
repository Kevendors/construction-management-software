"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientDialog } from "./client-dialog";
import { deleteClientAction } from "@/app/clients/actions";
import type { Client } from "@/lib/types";

export function ClientDetailActions({ client }: { client: Client }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function remove() {
    if (!window.confirm(`Delete client "${client.company || client.name}"? Its projects and quotations will be unlinked (not deleted).`)) return;
    setDeleting(true);
    const res = await deleteClientAction(client.id);
    setDeleting(false);
    if (res.error) {
      window.alert(res.error);
      return;
    }
    router.push("/clients");
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil /> Edit
      </Button>
      <Button size="sm" variant="outline" className="text-destructive" disabled={deleting} onClick={remove}>
        <Trash2 /> {deleting ? "Deleting…" : "Delete"}
      </Button>
      <ClientDialog open={editOpen} onClose={() => setEditOpen(false)} client={client} />
    </div>
  );
}
