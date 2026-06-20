"use client";

import { ChevronRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { GanttChart } from "@/components/charts/gantt-chart";
import { getProjectTasks, getUser, taskProgressPercent } from "@/lib/mock/selectors";
import { taskStatusMeta } from "@/lib/labels";
import type { Task } from "@/lib/types";

function progressLabel(t: Task) {
  if (t.unit === "percent" || t.unit === "lumpsum")
    return `${Math.round(taskProgressPercent(t))}%`;
  return `${t.progressValue} / ${t.progressTarget} ${t.unit}`;
}

function TaskRow({ task, child }: { task: Task; child?: boolean }) {
  const meta = taskStatusMeta[task.status];
  const assignee = getUser(task.assigneeId);
  const pct = taskProgressPercent(task);
  return (
    <div
      className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center ${
        child ? "bg-secondary/30 pl-10" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {child && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{task.name}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(task.startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} –{" "}
            {new Date(task.endDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {assignee && (
          <Avatar
            initials={assignee.initials}
            color={assignee.avatarColor}
            className="h-7 w-7"
            title={assignee.name}
          />
        )}
        <div className="w-32">
          <Progress
            value={pct}
            indicatorClassName={task.status === "delayed" ? "bg-destructive" : undefined}
          />
          <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
            {progressLabel(task)}
          </p>
        </div>
        <div className="w-28 text-right">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {task.delayDays > 0 && (
            <p className="mt-0.5 text-[11px] font-medium text-destructive">
              Delayed by {task.delayDays}d
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function TasksTab({ projectId }: { projectId: string }) {
  const all = getProjectTasks(projectId);
  const parents = all.filter((t) => t.parentId === null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <GanttChart tasks={parents} />
        </CardContent>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium">
            {all.length} tasks · {parents.length} top-level
          </p>
          <Button size="sm" variant="outline">
            <Plus /> Add Task
          </Button>
        </div>
        <CardContent className="divide-y divide-border p-0">
          {parents.map((parent) => {
            const children = all.filter((t) => t.parentId === parent.id);
            return (
              <div key={parent.id} className="divide-y divide-border">
                <TaskRow task={parent} />
                {children.map((c) => (
                  <TaskRow key={c.id} task={c} child />
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
