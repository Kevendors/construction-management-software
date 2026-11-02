"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Briefcase, LocateFixed, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { formatTime } from "@/lib/attendance/compute";
import { MAX_CLIENT_NAME, MAX_VISIT_PURPOSE, OTHER_PURPOSE, VISIT_PURPOSES } from "@/lib/attendance/client-visits";
import { endClientVisitAction, startClientVisitAction } from "@/app/attendance/client-visit-actions";
import type { ClientVisit } from "@/lib/types";
import { ClientVisitList } from "./client-visit-list";
import { useGeolocation } from "./use-geolocation";

/**
 * Start / End Visit (0052) for Office staff with "Client visits allowed":
 * logs who they visited, where and for how long during an open shift. A
 * record only — no effect on pay, late or early check-out rules.
 */
export function ClientVisitCard({ visits, shiftOpen }: { visits: ClientVisit[]; shiftOpen: boolean }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const openVisit = shiftOpen ? visits.find((v) => !v.endedAt) ?? null : null;

  if (!shiftOpen && visits.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Briefcase className="h-4 w-4 text-muted-foreground" /> Client visits
        </p>
        {openVisit && (
          <p className="text-sm">
            At <span className="font-medium">{openVisit.clientName}</span>{" "}
            <span className="text-muted-foreground">
              since <span className="tabular-nums">{formatTime(openVisit.startedAt)}</span>
            </span>
          </p>
        )}
        {shiftOpen && (
          <Button
            variant={openVisit ? "accent" : "outline"}
            className="h-12 w-full"
            onClick={() => setDialogOpen(true)}
          >
            {openVisit ? <LogOut /> : <Briefcase />} {openVisit ? "End Visit" : "Start Visit"}
          </Button>
        )}
        {visits.length > 0 && <ClientVisitList visits={visits} />}
      </CardContent>
      {dialogOpen && (
        <ClientVisitDialog
          openVisit={openVisit}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            router.refresh();
          }}
        />
      )}
    </Card>
  );
}

/** Mounted only while open, so each open starts fresh with a new GPS fix. */
function ClientVisitDialog({
  openVisit,
  onClose,
  onSaved,
}: {
  openVisit: ClientVisit | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientName, setClientName] = React.useState("");
  const [purposeChoice, setPurposeChoice] = React.useState("");
  const [purposeOther, setPurposeOther] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const geo = useGeolocation();
  const geoRequest = geo.request;
  React.useEffect(() => {
    geoRequest();
  }, [geoRequest]);

  const purpose = purposeChoice === OTHER_PURPOSE ? purposeOther.trim() : purposeChoice;
  const located = geo.status === "success" && geo.position;
  const canSave = Boolean(located) && !saving && (openVisit || (clientName.trim() && purpose));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || !geo.position) return;
    setSaving(true);
    setError(null);
    const { lat, lng, accuracy } = geo.position;
    const res = openVisit
      ? await endClientVisitAction({ visitId: openVisit.id, lat, lng, accuracy })
      : await startClientVisitAction({ clientName, purpose, lat, lng, accuracy });
    setSaving(false);
    if (res.error) return setError(res.error);
    onSaved();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={openVisit ? "End Visit" : "Start Visit"}
      description={
        openVisit
          ? `Your location and the time are saved as the end of your visit to ${openVisit.clientName}.`
          : "Tap this when you reach the client. Your location and the time are saved. Admin/HR can see this."
      }
      className="max-w-md"
    >
      <form onSubmit={submit} className="space-y-4">
        {!openVisit && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="cv-client">Client name</Label>
              <Input
                id="cv-client"
                value={clientName}
                maxLength={MAX_CLIENT_NAME}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. ABC Builders"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Purpose</Label>
              <div className="grid gap-2">
                {[...VISIT_PURPOSES, OTHER_PURPOSE].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPurposeChoice(p)}
                    className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                      purposeChoice === p ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-secondary"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              {purposeChoice === OTHER_PURPOSE && (
                <Input
                  value={purposeOther}
                  maxLength={MAX_VISIT_PURPOSE}
                  onChange={(e) => setPurposeOther(e.target.value)}
                  placeholder="Type the purpose"
                  aria-label="Purpose"
                />
              )}
            </div>
          </>
        )}

        {!located && (
          <div className="flex items-start gap-2 rounded-lg bg-secondary/60 p-3 text-sm">
            <LocateFixed className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-2">
              <p>{geo.status === "error" ? geo.error : "Getting your location…"}</p>
              {geo.status === "error" && (
                <Button type="button" size="sm" variant="outline" onClick={geoRequest}>
                  Retry
                </Button>
              )}
            </div>
          </div>
        )}

        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSave}>
            {saving ? "Saving…" : openVisit ? "End Visit" : "Start Visit"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
