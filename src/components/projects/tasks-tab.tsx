"use client";

import * as React from "react";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { Input, Label } from "@/components/ui/input";
import { Dialog, Select } from "@/components/ui/dialog";
import { GanttChart } from "@/components/charts/gantt-chart";
import { taskProgressPercent } from "@/lib/mock/selectors";
import { useProjectTasks, useStore, useUser, useUsers } from "@/lib/store/project-store";
import { taskStatusMeta } from "@/lib/labels";
import type { ProgressUnit, Task, TaskStatus } from "@/lib/types";

function progressLabel(t: Task) {
  if (t.unit === "percent" || t.unit === "lumpsum")
    return `${Math.round(taskProgressPercent(t))}%`;
  return `${t.progressValue} / ${t.progressTarget} ${t.unit}`;
}

function TaskRow({
  task,
  child,
  onEdit,
  onDelete,
}: {
  task: Task;
  child?: boolean;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const meta = taskStatusMeta[task.status];
  const assignee = useUser(task.assigneeId);
  const pct = taskProgressPercent(task);
  return (
    <div
      className={`group flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center ${
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
        <div className="flex items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit task" onClick={() => onEdit(task)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            aria-label="Delete task"
            onClick={() => onDelete(task)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

const UNITS: ProgressUnit[] = ["percent", "numbers", "meter", "sqft", "lumpsum"];
const STATUSES: TaskStatus[] = ["not_started", "ongoing", "delayed", "completed"];

function TaskDialog({
  projectId,
  open,
  onClose,
  editing,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  editing: Task | null;
}) {
  const { addTask, updateTask } = useStore();
  const users = useUsers();
  const today = new Date().toISOString().slice(0, 10);

  const [name, setName] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState(users[0]?.id ?? "");
  const [startDate, setStartDate] = React.useState(today);
  const [endDate, setEndDate] = React.useState(today);
  const [status, setStatus] = React.useState<TaskStatus>("ongoing");
  const [unit, setUnit] = React.useState<ProgressUnit>("percent");
  const [progressValue, setProgressValue] = React.useState("0");
  const [progressTarget, setProgressTarget] = React.useState("100");

  // Load the editing task's values when the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setAssigneeId(editing.assigneeId ?? users[0]?.id ?? "");
      setStartDate(editing.startDate);
      setEndDate(editing.endDate);
      setStatus(editing.status);
      setUnit(editing.unit);
      setProgressValue(String(editing.progressValue));
      setProgressTarget(String(editing.progressTarget));
    } else {
      setName("");
      setStatus("ongoing");
      setUnit("percent");
      setProgressValue("0");
      setProgressTarget("100");
      setStartDate(today);
      setEndDate(today);
    }
  }, [open, editing, today]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const fields = {
      name: name.trim(),
      assigneeId: assigneeId || null,
      startDate,
      endDate,
      status,
      progressValue: Number(progressValue) || 0,
      progressTarget: Number(progressTarget) || 0,
      unit,
    };
    if (editing) updateTask(editing.id, fields);
    else addTask({ projectId, parentId: null, delayDays: 0, ...fields });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Edit Task" : "Add Task"}
      description="Saved to this browser — updates the completion gauge live."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="t-name">Task name</Label>
          <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Roof waterproofing" autoFocus required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-assignee">Assignee</Label>
            <Select id="t-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-status">Status</Label>
            <Select id="t-status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{taskStatusMeta[s].label}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-start">Start date</Label>
            <Input id="t-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-end">End date</Label>
            <Input id="t-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="t-unit">Unit</Label>
            <Select id="t-unit" value={unit} onChange={(e) => setUnit(e.target.value as ProgressUnit)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-val">Progress</Label>
            <Input id="t-val" type="number" value={progressValue} onChange={(e) => setProgressValue(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-target">Target</Label>
            <Input id="t-target" type="number" value={progressTarget} onChange={(e) => setProgressTarget(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">{editing ? "Save Changes" : "Add Task"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function TasksTab({ projectId }: { projectId: string }) {
  const all = useProjectTasks(projectId);
  const { deleteTask } = useStore();
  const parents = all.filter((t) => t.parentId === null);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Task | null>(null);

  function openAdd() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(t: Task) {
    setEditing(t);
    setOpen(true);
  }
  function remove(t: Task) {
    if (window.confirm(`Delete task “${t.name}”?`)) deleteTask(t.id);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {parents.length ? (
            <GanttChart tasks={parents} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">No tasks yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium">
            {all.length} tasks · {parents.length} top-level
          </p>
          <Button size="sm" variant="outline" onClick={openAdd}>
            <Plus /> Add Task
          </Button>
        </div>
        <CardContent className="divide-y divide-border p-0">
          {parents.map((parent) => {
            const children = all.filter((t) => t.parentId === parent.id);
            return (
              <div key={parent.id} className="divide-y divide-border">
                <TaskRow task={parent} onEdit={openEdit} onDelete={remove} />
                {children.map((c) => (
                  <TaskRow key={c.id} task={c} child onEdit={openEdit} onDelete={remove} />
                ))}
              </div>
            );
          })}
          {parents.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tasks yet — click “Add Task” to create one.
            </p>
          )}
        </CardContent>
      </Card>

      <TaskDialog projectId={projectId} open={open} onClose={() => setOpen(false)} editing={editing} />
    </div>
  );
}
