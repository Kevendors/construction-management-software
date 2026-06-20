"use client";

import { CloudSun, Users, Image as ImageIcon, Plus, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { getProjectDprs, getProjectInstructions, getUser } from "@/lib/mock/selectors";

const priorityVariant = { low: "muted", medium: "warning", high: "destructive" } as const;

export function UpdatesTab({ projectId }: { projectId: string }) {
  const dprs = getProjectDprs(projectId);
  const instructions = getProjectInstructions(projectId);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* DPR feed */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Daily Progress Reports</CardTitle>
            <Button size="sm">
              <Plus /> New DPR
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {dprs.map((d) => {
              const author = getUser(d.authorId);
              return (
                <div key={d.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2">
                    {author && <Avatar initials={author.initials} color={author.avatarColor} className="h-7 w-7" />}
                    <div>
                      <p className="text-sm font-medium">{author?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(d.date).toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm">{d.workDone}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CloudSun className="h-3.5 w-3.5" /> {d.weather}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {d.labourCount} labour
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ImageIcon className="h-3.5 w-3.5" /> {d.photos} photos
                    </span>
                  </div>
                </div>
              );
            })}
            {dprs.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No DPRs yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Site instructions */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Site Instructions</CardTitle>
          <Button size="sm" variant="outline">
            <Plus />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {instructions.map((s) => {
            const by = getUser(s.byId);
            return (
              <div key={s.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <Badge variant={priorityVariant[s.priority]}>
                    {s.priority === "high" && <AlertTriangle className="h-3 w-3" />}
                    {s.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </span>
                </div>
                <p className="mt-2 text-sm">{s.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">— {by?.name}</p>
              </div>
            );
          })}
          {instructions.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No instructions.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
