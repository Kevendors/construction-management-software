"use client";

import * as React from "react";
import {
  dprs as seedDprs,
  siteInstructions as seedInstructions,
  tasks as seedTasks,
} from "@/lib/mock/data";
import type { Dpr, SiteInstruction, Task } from "@/lib/types";

/**
 * Client-side data store backed by localStorage. Seed data (from the mock
 * layer) provides the baseline; user-created rows are persisted to the browser
 * so Add Task / New DPR / Site Instruction survive a page refresh — no backend
 * required. Swappable for Supabase later without changing the consuming UI.
 */

const LS_KEY = "sitehub:store:v1";

interface AddedData {
  tasks: Task[];
  dprs: Dpr[];
  instructions: SiteInstruction[];
}

const EMPTY: AddedData = { tasks: [], dprs: [], instructions: [] };

interface StoreValue {
  tasks: Task[];
  dprs: Dpr[];
  instructions: SiteInstruction[];
  addTask: (t: Omit<Task, "id">) => void;
  addDpr: (d: Omit<Dpr, "id">) => void;
  addInstruction: (s: Omit<SiteInstruction, "id">) => void;
}

const StoreContext = React.createContext<StoreValue | null>(null);

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function loadAdded(): AddedData {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<AddedData>;
    return {
      tasks: parsed.tasks ?? [],
      dprs: parsed.dprs ?? [],
      instructions: parsed.instructions ?? [],
    };
  } catch {
    return EMPTY;
  }
}

export function ProjectStoreProvider({ children }: { children: React.ReactNode }) {
  // Start empty so server and first client render match (no hydration mismatch);
  // hydrate from localStorage right after mount.
  const [added, setAdded] = React.useState<AddedData>(EMPTY);

  React.useEffect(() => {
    setAdded(loadAdded());
  }, []);

  const persist = React.useCallback((next: AddedData) => {
    setAdded(next);
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* storage full / unavailable — keep in-memory state */
    }
  }, []);

  const addTask = React.useCallback(
    (t: Omit<Task, "id">) =>
      setAdded((prev) => {
        const next = { ...prev, tasks: [...prev.tasks, { ...t, id: genId("task") }] };
        try {
          window.localStorage.setItem(LS_KEY, JSON.stringify(next));
        } catch {}
        return next;
      }),
    []
  );

  const addDpr = React.useCallback(
    (d: Omit<Dpr, "id">) =>
      setAdded((prev) => {
        const next = { ...prev, dprs: [{ ...d, id: genId("dpr") }, ...prev.dprs] };
        try {
          window.localStorage.setItem(LS_KEY, JSON.stringify(next));
        } catch {}
        return next;
      }),
    []
  );

  const addInstruction = React.useCallback(
    (s: Omit<SiteInstruction, "id">) =>
      setAdded((prev) => {
        const next = {
          ...prev,
          instructions: [{ ...s, id: genId("si") }, ...prev.instructions],
        };
        try {
          window.localStorage.setItem(LS_KEY, JSON.stringify(next));
        } catch {}
        return next;
      }),
    []
  );

  // keep persist referenced (used by potential future bulk ops) without lint noise
  void persist;

  const value = React.useMemo<StoreValue>(
    () => ({
      tasks: [...seedTasks, ...added.tasks],
      dprs: [...added.dprs, ...seedDprs],
      instructions: [...added.instructions, ...seedInstructions],
      addTask,
      addDpr,
      addInstruction,
    }),
    [added, addTask, addDpr, addInstruction]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within <ProjectStoreProvider>");
  return ctx;
}

/* ---------- scoped selectors (mirror lib/mock/selectors) ---------- */

export function useProjectTasks(projectId: string) {
  const { tasks } = useStore();
  return tasks.filter((t) => t.projectId === projectId);
}

export function useProjectDprs(projectId: string) {
  const { dprs } = useStore();
  return dprs
    .filter((d) => d.projectId === projectId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export function useProjectInstructions(projectId: string) {
  const { instructions } = useStore();
  return instructions
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}
