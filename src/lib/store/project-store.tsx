"use client";

import * as React from "react";
import {
  dprs as seedDprs,
  employees as seedEmployees,
  labourAttendance as seedAttendance,
  salesInvoices as seedInvoices,
  siteInstructions as seedInstructions,
  tasks as seedTasks,
  transactions as seedTxns,
} from "@/lib/mock/data";
import type {
  ActivityLogEntry,
  Dpr,
  Employee,
  Expense,
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
  activityLog: ActivityLogEntry[];
  employees: Employee[];
  employeeDeletes: string[];
  expenses: Expense[];
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
  activityLog: [],
  employees: [],
  employeeDeletes: [],
  expenses: [],
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
  activityLog: ActivityLogEntry[];
  employees: Employee[];
  addEmployee: (e: Omit<Employee, "id">) => void;
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  expenses: Expense[];
  addExpense: (e: Omit<Expense, "id">) => void;
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
      activityLog: p.activityLog ?? [],
      employees: p.employees ?? [],
      employeeDeletes: p.employeeDeletes ?? [],
      expenses: p.expenses ?? [],
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

  const logActivity = React.useCallback(
    (projectId: string, action: ActivityLogEntry["action"], entity: ActivityLogEntry["entity"], entityId: string, details: string) => {
      update((prev) => ({
        ...prev,
        activityLog: [
          { id: genId("log"), projectId, action, entity, entityId, timestamp: new Date().toISOString(), userId: "", details },
          ...prev.activityLog,
        ],
      }));
    },
    [update]
  );

  const addProject = React.useCallback(
    (p: Omit<Project, "id">): Project => {
      const project: Project = { ...p, id: genId("proj") };
      update((prev) => ({ ...prev, projects: [...prev.projects, project] }));
      return project;
    },
    [update]
  );

  const addTask = React.useCallback(
    (t: Omit<Task, "id">) => {
      const id = genId("task");
      update((prev) => ({ ...prev, tasks: [...prev.tasks, { ...t, id }] }));
      logActivity(t.projectId, "created", "task", id, `Task "${t.name}" created`);
    },
    [update, logActivity]
  );

  const updateTask = React.useCallback(
    (id: string, patch: Partial<Task>) => {
      update((prev) => ({
        ...prev,
        taskEdits: { ...prev.taskEdits, [id]: { ...prev.taskEdits[id], ...patch } },
      }));
      const action = patch.status === "completed" ? "completed" as const : "updated" as const;
      const detail = patch.status ? `Task status changed to ${patch.status}` : "Task updated";
      // Find the task's projectId from seed or added tasks
      const task = [...seedTasks, ...added.tasks].find((t) => t.id === id);
      if (task) logActivity(task.projectId, action, "task", id, detail);
    },
    [update, logActivity, added.tasks]
  );

  const deleteTask = React.useCallback(
    (id: string) => {
      const task = [...seedTasks, ...added.tasks].find((t) => t.id === id);
      update((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== id),
        taskDeletes: prev.taskDeletes.includes(id) ? prev.taskDeletes : [...prev.taskDeletes, id],
      }));
      if (task) logActivity(task.projectId, "deleted", "task", id, `Task "${task.name}" deleted`);
    },
    [update, logActivity, added.tasks]
  );

  const addDpr = React.useCallback(
    (d: Omit<Dpr, "id">) => {
      const id = genId("dpr");
      update((prev) => ({ ...prev, dprs: [{ ...d, id }, ...prev.dprs] }));
      logActivity(d.projectId, "filed", "dpr", id, `DPR filed for ${d.date}`);
    },
    [update, logActivity]
  );

  const addInstruction = React.useCallback(
    (s: Omit<SiteInstruction, "id">) => {
      const id = genId("si");
      update((prev) => ({
        ...prev,
        instructions: [{ ...s, id }, ...prev.instructions],
      }));
      logActivity(s.projectId, "created", "instruction", id, `Site instruction added (${s.priority} priority)`);
    },
    [update, logActivity]
  );

  const addTransaction = React.useCallback(
    (t: Omit<Transaction, "id">) => {
      const id = genId("txn");
      update((prev) => ({
        ...prev,
        transactions: [{ ...t, id }, ...prev.transactions],
      }));
      const dir = t.direction === "in" ? "received" : "spent";
      logActivity(t.projectId, "created", "transaction", id, `Transaction ${dir}: ${t.amount}`);
    },
    [update, logActivity]
  );

  const addInvoice = React.useCallback(
    (i: Omit<SalesInvoice, "id">) => {
      const id = genId("inv");
      update((prev) => ({ ...prev, invoices: [{ ...i, id }, ...prev.invoices] }));
      logActivity(i.projectId, "created", "invoice", id, `Invoice ${i.number} created`);
    },
    [update, logActivity]
  );

  const recordPayment = React.useCallback(
    (invoiceId: string, amount: number) => {
      update((prev) => ({
        ...prev,
        invoiceReceipts: {
          ...prev.invoiceReceipts,
          [invoiceId]: (prev.invoiceReceipts[invoiceId] ?? 0) + amount,
        },
      }));
      const inv = [...seedInvoices, ...added.invoices].find((i) => i.id === invoiceId);
      if (inv) logActivity(inv.projectId, "created", "payment", invoiceId, `Payment of ${amount} recorded for ${inv.number}`);
    },
    [update, logActivity, added.invoices]
  );

  const addAttendance = React.useCallback(
    (a: Omit<LabourAttendance, "id">) => {
      const id = genId("la");
      update((prev) => ({
        ...prev,
        attendance: [{ ...a, id }, ...prev.attendance],
      }));
      logActivity(a.projectId, "filed", "attendance", id, `Attendance logged: ${a.present} present, ${a.absent} absent`);
    },
    [update, logActivity]
  );

  const addEmployee = React.useCallback(
    (e: Omit<Employee, "id">) => {
      const id = genId("emp");
      update((prev) => ({ ...prev, employees: [...prev.employees, { ...e, id }] }));
    },
    [update]
  );

  const updateEmployee = React.useCallback(
    (id: string, patch: Partial<Employee>) =>
      update((prev) => ({
        ...prev,
        employees: prev.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      })),
    [update]
  );

  const deleteEmployee = React.useCallback(
    (id: string) =>
      update((prev) => ({
        ...prev,
        employees: prev.employees.filter((e) => e.id !== id),
        employeeDeletes: [...prev.employeeDeletes, id],
      })),
    [update]
  );

  const addExpense = React.useCallback(
    (e: Omit<Expense, "id">) => {
      const id = genId("exp");
      update((prev) => ({ ...prev, expenses: [{ ...e, id }, ...prev.expenses] }));
      logActivity(e.projectId, "created", "expense", id, `Expense of ${e.amount} added (${e.category})`);
    },
    [update, logActivity]
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
      activityLog: added.activityLog,
      employees: [...seedEmployees, ...added.employees].filter((e) => !added.employeeDeletes.includes(e.id)),
      expenses: added.expenses,
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
      addEmployee,
      updateEmployee,
      deleteEmployee,
      addExpense,
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
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addExpense,
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

/** Petty expenses for a specific project, most recent first. */
export function useProjectExpenses(projectId: string) {
  const { expenses } = useStore();
  return expenses
    .filter((e) => e.projectId === projectId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

/** Activity log entries for a specific project, most recent first. */
export function useProjectActivityLog(projectId: string) {
  const { activityLog } = useStore();
  return activityLog
    .filter((e) => e.projectId === projectId)
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}
