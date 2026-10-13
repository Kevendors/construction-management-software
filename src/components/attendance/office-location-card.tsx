"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { getOfficeGeofenceAction, setOfficeGeofenceAction } from "@/app/attendance/actions";

/**
 * Super_admin-only setting (server-enforced — see setOfficeGeofenceAction):
 * the single shared office location office-flow punches are checked against.
 * Visible to the whole admin attendance audience (already super_admin/hr
 * only); a non-super_admin Save attempt is caught server-side with a clear
 * "Not authorized" error rather than a new role prop threaded down here.
 */
export function OfficeLocationCard() {
  const [lat, setLat] = React.useState("");
  const [lng, setLng] = React.useState("");
  const [radiusM, setRadiusM] = React.useState("");
  const [loaded, setLoaded] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    getOfficeGeofenceAction().then((g) => {
      setLat(g.lat != null ? String(g.lat) : "");
      setLng(g.lng != null ? String(g.lng) : "");
      setRadiusM(g.radiusM != null ? String(g.radiusM) : "");
      setLoaded(true);
    });
  }, []);

  const isEnabled = lat.trim() !== "" && lng.trim() !== "" && radiusM.trim() !== "";

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await setOfficeGeofenceAction(
      lat.trim() ? Number(lat) : null,
      lng.trim() ? Number(lng) : null,
      radiusM.trim() ? Number(radiusM) : null
    );
    setSaving(false);
    setMsg(res.error ?? "Saved ✓");
  }

  function clear() {
    setLat("");
    setLng("");
    setRadiusM("");
  }

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" /> Office Location
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Used by the office punch flow (employees with no project assignment). Leave blank to
          accept a punch from anywhere.
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="off-lat">Latitude</Label>
            <Input id="off-lat" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="28.6139" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="off-lng">Longitude</Label>
            <Input id="off-lng" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="77.2090" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="off-radius">Radius (m)</Label>
            <Input id="off-radius" value={radiusM} onChange={(e) => setRadiusM(e.target.value)} placeholder="150" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {isEnabled ? "Fence enabled — punches must be within range." : "Fence disabled — attendance accepted from anywhere."}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={clear} disabled={saving}>
            Clear
          </Button>
          {msg && (
            <span className={`text-xs ${msg === "Saved ✓" ? "text-success" : "text-destructive"}`}>{msg}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
