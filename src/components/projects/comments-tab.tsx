"use client";

import * as React from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/dialog";
import { useRole } from "@/components/layout/role-provider";
import {
  addProjectCommentAction,
  deleteProjectCommentAction,
  listProjectDiscussionAction,
  type ProjectComment,
} from "@/app/projects/comment-actions";

function initials(name: string | null) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return (((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase());
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Day heading for the divider between groups, e.g. "Today" / "05 Aug 2026". */
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function CommentsTab({ projectId }: { projectId: string }) {
  const { userId, role } = useRole();
  const [comments, setComments] = React.useState<ProjectComment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [body, setBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listProjectDiscussionAction(projectId).then((rows) => {
      if (cancelled) return;
      setComments(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    const res = await addProjectCommentAction(projectId, body);
    setSending(false);
    if (res.error) return setError(res.error);
    if (res.comment) {
      setComments((prev) => [...prev, res.comment as ProjectComment]);
      setBody("");
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    const res = await deleteProjectCommentAction(id);
    setBusyId(null);
    if (res.error) return setError(res.error);
    setComments((prev) => prev.filter((c) => c.id !== id));
  }

  // Ctrl/Cmd+Enter posts, so a long comment doesn't need a trip to the mouse.
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit(e as unknown as React.FormEvent);
    }
  }

  const canDelete = (c: ProjectComment) => role === "super_admin" || (!!userId && c.authorId === userId);

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> Comments
          {comments.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">({comments.length})</span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 pt-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading conversation…</p>
        ) : comments.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium">No comments yet</p>
            <p className="text-sm text-muted-foreground">
              Start the conversation — everyone on this project&apos;s team can read and reply.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {comments.map((c, i) => {
              const newDay = i === 0 || dayLabel(c.createdAt) !== dayLabel(comments[i - 1].createdAt);
              return (
                <React.Fragment key={c.id}>
                  {newDay && (
                    <li className="flex items-center gap-3" aria-hidden>
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {dayLabel(c.createdAt)}
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </li>
                  )}
                  <li className="group flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(c.authorName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium">{c.authorName ?? "Someone"}</span>
                        <span className="text-xs text-muted-foreground">{fmtTime(c.createdAt)}</span>
                        {canDelete(c) && (
                          <button
                            type="button"
                            onClick={() => remove(c.id)}
                            disabled={busyId === c.id}
                            aria-label="Delete comment"
                            className="ml-auto rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      {/* whitespace-pre-wrap keeps the line breaks people type */}
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.body}</p>
                    </div>
                  </li>
                </React.Fragment>
              );
            })}
          </ul>
        )}

        <form onSubmit={submit} className="space-y-2 border-t border-border pt-4">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            placeholder="Write a comment…"
            aria-label="Write a comment"
          />
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Ctrl + Enter to post</p>
            <Button type="submit" size="sm" disabled={sending || !body.trim()}>
              <Send className="h-3.5 w-3.5" /> {sending ? "Posting…" : "Post Comment"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
