"use client";

import { FileImage, FileText, FileBox, File, Upload, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getProjectFiles, getUser } from "@/lib/mock/selectors";
import type { ProjectFile } from "@/lib/types";

const iconFor = (kind: ProjectFile["kind"]) => {
  switch (kind) {
    case "photo":
      return FileImage;
    case "pdf":
      return FileText;
    case "dwg":
      return FileBox;
    default:
      return File;
  }
};

export function FilesTab({ projectId }: { projectId: string }) {
  const files = getProjectFiles(projectId);

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-sm font-medium">{files.length} files & photos</p>
        <Button size="sm">
          <Upload /> Upload
        </Button>
      </div>
      <CardContent className="p-0">
        {files.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No files yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {files.map((f) => {
              const Icon = iconFor(f.kind);
              const by = getUser(f.uploadedById);
              return (
                <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{f.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(f.sizeKb / 1024).toFixed(1)} MB · {by?.name} ·{" "}
                      {new Date(f.uploadedAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" aria-label="Download">
                    <Download />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
