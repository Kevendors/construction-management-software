"use client";

import * as React from "react";
import {
  dprs as seedDprs,
  labourAttendance as seedAttendance,
  salesInvoices as seedInvoices,
  siteInstructions as seedInstructions,
  tasks as seedTasks,
  transactions as seedTxns,
} from "@/lib/mock/data";
import type {
  Dpr,
  LabourAttendance,
  Project,
  SalesInvoice,
  SiteInstruction,
  Task,
  Transaction,
} from "@/lib/types";

/**
 * Client-side data store backed by localStorage. Seed data (from the mock
 * layer) provides the baseline; every create/edit in the Projects module is
 * persisted to the browser so all project data — tasks, expenses, invoices,
 * payments, attendance — updates live and survives a page refresh.
 * Swappable for Supabase later without changing the consuming UI.
 */

const LS_KEY = "sitehub:store:v1";

interface AddedData {
  projects: Project[];
  tasks: Task[];
  taskEdits: Record<string, Partial<Task>>;
  taskDeletes: string[];
  dprs: Dpr[];
  instructions: SiteInstruction[];
  transactions: Transaction[];
  invoices: SalesInvoice[];
  invoiceReceipts: Record<string, number>;
  attendance: LabourAttendance[];
}

const EMPTY: AddedData = {
  projects: [],
  tasks: [],
  taskEdits: {},
  taskDeletes: [],
  dprs: [],
  instructions: [],
  transactions: [],
  invoices: [],
  invoiceReceipts: {},
  attendance: [],
};

interface StoreValue {
  addedProjects: Project[];
  tasks: Task[];
  dprs: Dpr[];
  instructions: SiteInstruction[];
  transactions: Transaction[];
  invoices: SalesInvoice[];
  attendance: LabourAttendance[];
  addProject: (p: Omit<Project, "id">) => Project;
  addTask: (t: Omit<Task, "id">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addDpr: (d: Omit<Dpr, "id">) => void;
  addInstruction: (s: Omit<SiteInstruction, "id">) => void;
  addTransaction: (t: Omit<Transaction, "id">) => void;
  addInvoice: (i: Omit<SalesInvoice, "id">) => void;
  recordPayment: (invoiceId: string, amount: number) => void;
  addAttendance: (a: Omit<LabourAttendance, "id">) => void;
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
    const p = JSON.parse(raw) as Partial<AddedData>;
    return {
      projects: p.projects ?? [],
      tasks: p.tasks ?? [],
      taskEdits: p.taskEdits ?? {},
      taskDeletes: p.taskDeletes ?? [],
      dprs: p.dprs ?? [],
      instructions: p.instructions ?? [],
      transactions: p.transactions ?? [],
      invoices: p.invoices ?? [],
      invoiceReceipts: p.invoiceReceipts ?? {},
      attendance: p.attendance ?? [],
    };
  } catch {
    return EMPTY;
  }
}

export function ProjectStoreProvider({ children }: { children: React.ReactNode }) {
  // Start empty so server and first client render match; hydrate after mount.
  const [added, setAdded] = React.useState<AddedData>(EMPTY);

  React.useEffect(() => {
    setAdded(loadAdded());
  }, []);

  const update = React.useCallback((updater: (prev: AddedData) => AddedData) => {
    setAdded((prev) => {
      const next = updater(prev);
      try {
        window.localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in-memory */
      }
      return next;
    });
  }, []);

  const addProject = React.useCallback(
    (p: Omit<Project, "id">): Project => {
      const project: Project = { ...p, id: genId("proj") };
      update((prev) => ({ ...prev, projects: [...prev.projects, project] }));
      return project;
    },
    [update]
  );

  const addTask = React.useCallback(
    (t: Omit<Task, "id">) =>
      update((prev) => ({ ...prev, tasks: [...prev.tasks, { ...t, id: genId("task") }] })),
    [update]
  );

  const updateTask = React.useCallback(
    (id: string, patch: Partial<Task>) =>
      update((prev) => ({
        ...prev,
        taskEdits: { ...prev.taskEdits, [id]: { ...prev.taskEdits[id], ...patch } },
      })),
    [update]
  );

  const deleteTask = React.useCallback(
    (id: string) =>
      update((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== id),
        taskDeletes: prev.taskDeletes.includes(id) ? prev.taskDeletes : [...prev.taskDeletes, id],
      })),
    [update]
  );

  const addDpr = React.useCallback(
    (d: Omit<Dpr, "id">) =>
      update((prev) => ({ ...prev, dprs: [{ ...d, id: genId("dpr") }, ...prev.dprs] })),
    [update]
  );

  const addInstruction = React.useCallback(
    (s: Omit<SiteInstruction, "id">) =>
      update((prev) => ({
        ...prev,
        instructions: [{ ...s, id: genId("si") }, ...prev.instructions],
      })),
    [update]
  );

  const addTransaction = React.useCallback(
    (t: Omit<Transaction, "id">) =>
      update((prev) => ({
        ...prev,
        transactions: [{ ...t, id: genId("txn") }, ...prev.transactions],
      })),
    [update]
  );

  const addInvoice = React.useCallback(
    (i: Omit<SalesInvoice, "id">) =>
      update((prev) => ({ ...prev, invoices: [{ ...i, id: genId("inv") }, ...prev.invoices] })),
    [update]
  );

  const recordPayment = React.useCallback(
    (invoiceId: string, amount: number) =>
      update((prev) => ({
        ...prev,
        invoiceReceipts: {
          ...prev.invoiceReceipts,
          [invoiceId]: (prev.invoiceReceipts[invoiceId] ?? 0) + amount,
        },
      })),
    [update]
  );

  const addAttendance = React.useCallback(
    (a: Omit<LabourAttendance, "id">) =>
      update((prev) => ({
        ...prev,
        attendance: [{ ...a, id: genId("la") }, ...prev.attendance],
      })),
    [update]
  );

  const value = React.useMemo<StoreValue>(() => {
    const tasks = [...seedTasks, ...added.tasks]
      .filter((t) => !added.taskDeletes.includes(t.id))
      .map((t) => (added.taskEdits[t.id] ? { ...t, ...added.taskEdits[t.id] } : t));

    const invoices = [...seedInvoices, ...added.invoices].map((inv) => {
      const extra = added.invoiceReceipts[inv.id] ?? 0;
      return extra ? { ...inv, received: inv.received + extra } : inv;
    });

    return {
      addedProjects: added.projects,
      tasks,
      dprs: [...added.dprs, ...seedDprs],
      instructions: [...added.instructions, ...seedInstructions],
      transactions: [...added.transactions, ...seedTxns],
      invoices,
      attendance: [...added.attendance, ...seedAttendance],
      addProject,
      addTask,
      updateTask,
      deleteTask,
      addDpr,
      addInstruction,
      addTransaction,
      addInvoice,
      recordPayment,
      addAttendance,
    };
  }, [
    added,
    addProject,
    addTask,
    updateTask,
    deleteTask,
    addDpr,
    addInstruction,
    addTransaction,
    addInvoice,
    recordPayment,
    addAttendance,
  ]);

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

export function useProjectTransactions(projectId: string) {
  const { transactions } = useStore();
  return transactions.filter((t) => t.projectId === projectId);
}

export function useProjectInvoices(projectId: string) {
  const { invoices } = useStore();
  return invoices
    .filter((i) => i.projectId === projectId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

/** Project-scoped attendance aggregated per day, most recent 7 days. */
export function useProjectAttendance(projectId: string) {
  const { attendance } = useStore();
  const byDate = new Map<string, { date: string; present: number; absent: number }>();
  for (const a of attendance) {
    if (a.projectId !== projectId) continue;
    const cur = byDate.get(a.date) ?? { date: a.date, present: 0, absent: 0 };
    cur.present += a.present;
    cur.absent += a.absent;
    byDate.set(a.date, cur);
  }
  return Array.from(byDate.values())
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))
    .slice(-7);
}

/** Resolve a user-created project by id (returns null for seed/unknown ids). */
export function useAddedProject(projectId: string) {
  const { addedProjects } = useStore();
  return addedProjects.find((p) => p.id === projectId) ?? null;
}
