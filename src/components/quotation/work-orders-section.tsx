"use client";

import * as React from "react";
import { ExternalLink, FileSignature, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import {
  deleteQuotationWorkOrderAction,
  getQuotationWorkOrdersAction,
  uploadClientWorkOrderAction,
  type QuotationWorkOrder,
} from "@/app/quotations/upload-actions";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";

function AttachWorkOrderDialog({
  quotationId,
  open,
  onClose,
  onAttached,
}: {
  quotationId: string;
  open: boolean;
  onClose: () => void;
  onAttached: (wo: QuotationWorkOrder) => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [referenceNumber, setReferenceNumber] = React.useState("");
  const [date, setDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setFile(null);
      setReferenceNumber("");
      setDate("");
      setNote("");
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose the client's work order file first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await uploadClientWorkOrderAction(quotationId, file.name, dataUrl, referenceNumber, date, note);
      if (res.error || !res.workOrder) {
        setError(res.error ?? "Could not attach that file.");
        setBusy(false);
        return;
      }
      onAttached(res.workOrder);
    } catch {
      setError("Could not read that file.");
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Attach Client Work Order"
      description="Record proof the client authorized this work. This is a record only — it doesn't change the quotation's status."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="wo-file">Work order file</Label>
          <Input
            id="wo-file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="wo-ref">Reference number</Label>
            <Input
              id="wo-ref"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. WO-104"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wo-date">Date</Label>
            <Input id="wo-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wo-note">Note (optional)</Label>
          <Input id="wo-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any context worth recording" />
        </div>

        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Attaching…" : "Attach Work Order"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Attached client Work Orders for one quotation — a chip list + an attach dialog. */
export function WorkOrdersSection({ quotationId }: { quotationId: string }) {
  const [workOrders, setWorkOrders] = React.useState<QuotationWorkOrder[] | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    getQuotationWorkOrdersAction(quotationId).then((wos) => {
      if (!cancelled) setWorkOrders(wos);
    });
    return () => {
      cancelled = true;
    };
  }, [quotationId]);

  async function remove(id: string) {
    if (!window.confirm("Remove this attached work order?")) return;
    const res = await deleteQuotationWorkOrderAction(id);
    if (res.error) {
      window.alert(res.error);
      return;
    }
    setWorkOrders((prev) => (prev ? prev.filter((w) => w.id !== id) : prev));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {workOrders?.map((wo) => (
        <span
          key={wo.id}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs"
        >
          <FileSignature className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{wo.referenceNumber || wo.fileName}</span>
          {wo.date && <span className="text-muted-foreground">· {fmtDate(wo.date)}</span>}
          {wo.fileUrl && (
            <a href={wo.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => remove(wo.id)}
            aria-label="Remove work order"
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => setDialogOpen(true)}>
        <FileSignature /> Attach Work Order
      </Button>
      <AttachWorkOrderDialog
        quotationId={quotationId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAttached={(wo) => {
          setWorkOrders((prev) => [wo, ...(prev ?? [])]);
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
