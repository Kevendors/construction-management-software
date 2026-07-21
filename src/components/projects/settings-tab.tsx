"use client";

import * as React from "react";
import { LocateFixed, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { useGeolocation } from "@/components/attendance/use-geolocation";
import { useStore } from "@/lib/store/project-store";
import type { Project } from "@/lib/types";

const DEFAULT_RADIUS_M = 200;

/** Project settings (super_admin): the attendance geo-fence for the site. */
export function SettingsTab({ project }: { project: Project }) {
  const { setProjectGeofence } = useStore();
  const [lat, setLat] = React.useState(project.geofenceLat?.toString() ?? "");
  const [lng, setLng] = React.useState(project.geofenceLng?.toString() ?? "");
  const [radius, setRadius] = React.useState(
    project.geofenceRadiusM?.toString() ?? String(DEFAULT_RADIUS_M)
  );
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ text: string; isError: boolean } | null>(null);
  const geo = useGeolocation();

  React.useEffect(() => {
    if (geo.status === "success" && geo.position) {
      setLat(geo.position.lat.toFixed(6));
      setLng(geo.position.lng.toFixed(6));
    }
  }, [geo.status, geo.position]);

  const isEnabled = project.geofenceLat != null && project.geofenceLng != null && project.geofenceRadiusM != null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const radiusNum = Number(radius);
    if (!lat.trim() || !lng.trim() || !Number.isFinite(latNum) || !Number.isFinite(lngNum) || Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) {
      setMessage({ text: "Enter a valid latitude and longitude.", isError: true });
      return;
    }
    if (!Number.isFinite(radiusNum) || radiusNum < 10) {
      setMessage({ text: "Radius must be at least 10 m.", isError: true });
      return;
    }
    setSaving(true);
    setMessage(null);
    const error = await setProjectGeofence(project.id, latNum, lngNum, Math.round(radiusNum));
    setSaving(false);
    setMessage(
      error
        ? { text: error, isError: true }
        : { text: "Geo-fence saved — check-ins are now limited to the site area.", isError: false }
    );
  }

  async function clearFence() {
    setSaving(true);
    setMessage(null);
    const error = await setProjectGeofence(project.id, null, null, null);
    setSaving(false);
    if (error) {
      setMessage({ text: error, isError: true });
    } else {
      setLat("");
      setLng("");
      setRadius(String(DEFAULT_RADIUS_M));
      setMessage({ text: "Geo-fence cleared — attendance works from anywhere.", isError: false });
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPinned className="h-4 w-4" /> Site Geo-fence
        </CardTitle>
        <CardDescription>
          When set, employees can check in/out on the Attendance page only within this radius of
          the site. {isEnabled ? "Currently enabled." : "Currently disabled."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="gf-lat">Latitude</Label>
              <Input
                id="gf-lat"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="28.6273"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gf-lng">Longitude</Label>
              <Input
                id="gf-lng"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="77.3714"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gf-radius">Radius (meters)</Label>
              <Input
                id="gf-radius"
                type="number"
                min={10}
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={geo.request}
                disabled={geo.status === "locating"}
              >
                <LocateFixed />
                {geo.status === "locating" ? "Locating…" : "Use my current location"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: set this while standing on site. Use a radius of at least 100 m — GPS is
            imprecise indoors and between tall buildings.
          </p>
          {geo.status === "error" && <p className="text-sm text-destructive">{geo.error}</p>}
          {message && (
            <p
              className={
                message.isError
                  ? "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  : "rounded-md bg-success/10 px-3 py-2 text-sm text-success"
              }
            >
              {message.text}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {isEnabled && (
              <Button type="button" variant="outline" onClick={clearFence} disabled={saving}>
                Clear fence
              </Button>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Geo-fence"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
