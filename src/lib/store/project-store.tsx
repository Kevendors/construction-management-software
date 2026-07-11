"use client";

import * as React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
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
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { getActiveOrg, type ActiveOrg } from "@/lib/supabase/active-org";
import {
  mapActivity,
  mapAttendance,
  mapDpr,
  mapEmployee,
  mapExpense,
  mapInstruction,
  mapInvoice,
  mapProject,
  mapTask,
  mapTransaction,
  toActivityRow,
  toAttendanceRow,
  toDprRow,
  toEmployeePatch,
  toEmployeeRow,
  toExpenseRow,
  toInstructionRow,
  toInvoiceItemRows,
  toInvoiceRow,
  toProjectRow,
  toTaskPatch,
  toTaskRow,
  toTransactionRow,
  type ActivityLogRow,
  type DprRow,
  type EmployeeRow,
  type ExpenseRow,
  type InvoiceRow,
  type LabourAttendanceRow,
  type ProjectRow,
  type SiteInstructionRow,
  type TaskRow,
  type TransactionRow,
} from "@/lib/data/mappers";

/**
 * Client-side data store for the interactive modules (Projects, Payroll,
 * Expenses). Two interchangeable backends behind one identical hook API:
 *
 *  - Supabase not configured → localStorage over the mock seed (demo mode,
 *    single device). Unchanged from the original implementation.
 *  - Supabase configured → live Postgres reads/writes + Realtime, so a change
 *    on one device streams to every other device/user within ~1s.
 *
 * Consumers use `useStore()` / the `useProject*` selectors and never learn
 * which backend is active.
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

/* ======================================================================== *
 * Provider selector — pick the backend once (env is constant at runtime).
 * ======================================================================== */
export function ProjectStoreProvider({ children }: { children: React.ReactNode }) {
  if (isSupabaseConfigured()) {
    return <SupabaseProjectStore>{children}</SupabaseProjectStore>;
  }
  return <LocalProjectStore>{children}</LocalProjectStore>;
}

/* ======================================================================== *
 * Backend A — localStorage over mock seed (demo mode). Unchanged behavior.
 * ======================================================================== */

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

function LocalProjectStore({ children }: { children: React.ReactNode }) {
  // Start empty so server and first client render match; hydrate after mount.
  const [added, setAdded] = React.useState<AddedData>(EMPTY);

  React.useEffect(() => {
    // Hydrate from localStorage after mount so SSR and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

/* ======================================================================== *
 * Backend B — Supabase + Realtime (live multi-device).
 * ======================================================================== */

interface Lists {
  projects: Project[];
  tasks: Task[];
  dprs: Dpr[];
  instructions: SiteInstruction[];
  transactions: Transaction[];
  invoices: SalesInvoice[];
  attendance: LabourAttendance[];
  employees: Employee[];
  expenses: Expense[];
  activityLog: ActivityLogEntry[];
}

type ListsKey = keyof Lists;

const EMPTY_LISTS: Lists = {
  projects: [],
  tasks: [],
  dprs: [],
  instructions: [],
  transactions: [],
  invoices: [],
  attendance: [],
  employees: [],
  expenses: [],
  activityLog: [],
};

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...list];
  const copy = list.slice();
  copy[i] = item;
  return copy;
}

function withList(prev: Lists, key: ListsKey, list: Array<{ id: string }>): Lists {
  return { ...prev, [key]: list } as Lists;
}

// Tables whose Realtime + fetch map 1:1 to a Lists key (invoices are special —
// they carry line items and are refetched on change).
const SIMPLE_TABLES: Array<{ table: string; key: ListsKey; map: (r: unknown) => { id: string } }> = [
  { table: "projects", key: "projects", map: (r) => mapProject(r as ProjectRow) },
  { table: "tasks", key: "tasks", map: (r) => mapTask(r as TaskRow) },
  { table: "dprs", key: "dprs", map: (r) => mapDpr(r as DprRow) },
  { table: "site_instructions", key: "instructions", map: (r) => mapInstruction(r as SiteInstructionRow) },
  { table: "transactions", key: "transactions", map: (r) => mapTransaction(r as TransactionRow) },
  { table: "labour_attendance", key: "attendance", map: (r) => mapAttendance(r as LabourAttendanceRow) },
  { table: "employees", key: "employees", map: (r) => mapEmployee(r as EmployeeRow) },
  { table: "expenses", key: "expenses", map: (r) => mapExpense(r as ExpenseRow) },
  { table: "activity_log", key: "activityLog", map: (r) => mapActivity(r as ActivityLogRow) },
];

function SupabaseProjectStore({ children }: { children: React.ReactNode }) {
  const [lists, setLists] = React.useState<Lists>(EMPTY_LISTS);
  const [org, setOrg] = React.useState<ActiveOrg | null>(null);

  // Latest snapshots for callbacks that need to read current data without
  // re-subscribing (activity lookups, payment base amounts, etc.). Synced via
  // effects (commit-time) so callbacks — which fire after commit — see current
  // values without writing refs during render.
  const orgRef = React.useRef<ActiveOrg | null>(null);
  const listsRef = React.useRef<Lists>(lists);
  React.useEffect(() => {
    orgRef.current = org;
  }, [org]);
  React.useEffect(() => {
    listsRef.current = lists;
  }, [lists]);

  // One browser client for the provider's lifetime; built lazily in-browser.
  const supabaseRef = React.useRef<SupabaseClient | null>(null);
  const getSb = React.useCallback((): SupabaseClient => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }, []);

  // ---- initial identity + data load ----
  React.useEffect(() => {
    let active = true;
    const sb = getSb();
    (async () => {
      const ident = await getActiveOrg(sb);
      if (!active) return;
      if (!ident) {
        console.warn(
          "SiteHub: signed-in user has no org membership — the store stays empty. " +
            "Link the user to an org (insert into memberships)."
        );
        return;
      }
      setOrg(ident);
      const [pr, ts, dp, si, tx, inv, at, em, ex, al] = await Promise.all([
        sb.from("projects").select("*").order("code"),
        sb.from("tasks").select("*"),
        sb.from("dprs").select("*"),
        sb.from("site_instructions").select("*"),
        sb.from("transactions").select("*"),
        sb.from("sales_invoices").select("*, invoice_items(*)"),
        sb.from("labour_attendance").select("*"),
        sb.from("employees").select("*").order("name"),
        sb.from("expenses").select("*"),
        sb.from("activity_log").select("*").order("logged_at", { ascending: false }),
      ]);
      if (!active) return;
      setLists({
        projects: (pr.data ?? []).map((r) => mapProject(r as ProjectRow)),
        tasks: (ts.data ?? []).map((r) => mapTask(r as TaskRow)),
        dprs: (dp.data ?? []).map((r) => mapDpr(r as DprRow)),
        instructions: (si.data ?? []).map((r) => mapInstruction(r as SiteInstructionRow)),
        transactions: (tx.data ?? []).map((r) => mapTransaction(r as TransactionRow)),
        invoices: (inv.data ?? []).map((r) => mapInvoice(r as InvoiceRow)),
        attendance: (at.data ?? []).map((r) => mapAttendance(r as LabourAttendanceRow)),
        employees: (em.data ?? []).map((r) => mapEmployee(r as EmployeeRow)),
        expenses: (ex.data ?? []).map((r) => mapExpense(r as ExpenseRow)),
        activityLog: (al.data ?? []).map((r) => mapActivity(r as ActivityLogRow)),
      });
    })();
    return () => {
      active = false;
    };
  }, [getSb]);

  // Refetch a single invoice (with its line items) after a Realtime change.
  const refetchInvoice = React.useCallback(
    async (id: string) => {
      const { data, error } = await getSb()
        .from("sales_invoices")
        .select("*, invoice_items(*)")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) return;
      const inv = mapInvoice(data as InvoiceRow);
      setLists((prev) => ({ ...prev, invoices: upsertById(prev.invoices, inv) }));
    },
    [getSb]
  );

  // ---- Realtime subscription (scoped to the org) ----
  React.useEffect(() => {
    if (!org) return;
    const sb = getSb();
    const channel = sb.channel(`sitehub-store-${org.orgId}`);

    for (const cfg of SIMPLE_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: cfg.table, filter: `org_id=eq.${org.orgId}` },
        (payload) => {
          setLists((prev) => {
            const list = prev[cfg.key] as Array<{ id: string }>;
            if (payload.eventType === "DELETE") {
              const id = (payload.old as { id?: string }).id;
              if (!id) return prev;
              return withList(prev, cfg.key, list.filter((x) => x.id !== id));
            }
            return withList(prev, cfg.key, upsertById(list, cfg.map(payload.new)));
          });
        }
      );
    }

    // Invoices: header + line items. Refetch the affected invoice so items stay
    // in sync; delete removes it locally.
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "sales_invoices", filter: `org_id=eq.${org.orgId}` },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const id = (payload.old as { id?: string }).id;
          if (id) setLists((prev) => ({ ...prev, invoices: prev.invoices.filter((i) => i.id !== id) }));
          return;
        }
        const id = (payload.new as { id?: string }).id;
        if (id) void refetchInvoice(id);
      }
    );
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "invoice_items", filter: `org_id=eq.${org.orgId}` },
      (payload) => {
        const invId =
          (payload.new as { invoice_id?: string }).invoice_id ??
          (payload.old as { invoice_id?: string }).invoice_id;
        if (invId) void refetchInvoice(invId);
      }
    );

    channel.subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [org, getSb, refetchInvoice]);

  // ---- shared write helpers ----
  const logActivity = React.useCallback(
    (
      projectId: string,
      action: ActivityLogEntry["action"],
      entity: ActivityLogEntry["entity"],
      entityId: string,
      details: string
    ) => {
      const o = orgRef.current;
      if (!o) return;
      const id = crypto.randomUUID();
      const entry: ActivityLogEntry = {
        id,
        projectId,
        action,
        entity,
        entityId,
        timestamp: new Date().toISOString(),
        userId: o.userId,
        details,
      };
      setLists((prev) => ({ ...prev, activityLog: [entry, ...prev.activityLog] }));
      getSb()
        .from("activity_log")
        .insert({ id, ...toActivityRow({ projectId, action, entity, entityId, userId: o.userId, details }, o.orgId) })
        .then(({ error }) => {
          if (error) console.error("activity_log insert failed", error);
        });
    },
    [getSb]
  );

  // Optimistic insert with rollback on error. `item` is the resolved domain
  // object; `row` is the snake_case insert payload (without id).
  const insertRow = React.useCallback(
    (key: ListsKey, item: { id: string }, table: string, row: Record<string, unknown>) => {
      setLists((prev) => withList(prev, key, upsertById(prev[key] as Array<{ id: string }>, item)));
      getSb()
        .from(table)
        .insert({ id: item.id, ...row })
        .then(({ error }) => {
          if (error) {
            console.error(`${table} insert failed`, error);
            setLists((prev) =>
              withList(prev, key, (prev[key] as Array<{ id: string }>).filter((x) => x.id !== item.id))
            );
          }
        });
    },
    [getSb]
  );

  // ---- mutations ----
  const addProject = React.useCallback(
    (p: Omit<Project, "id">): Project => {
      const project: Project = { ...p, id: crypto.randomUUID() };
      const o = orgRef.current;
      if (o) insertRow("projects", project, "projects", toProjectRow(p, o.orgId));
      return project;
    },
    [insertRow]
  );

  const addTask = React.useCallback(
    (t: Omit<Task, "id">) => {
      const o = orgRef.current;
      if (!o) return;
      const id = crypto.randomUUID();
      insertRow("tasks", { ...t, id }, "tasks", toTaskRow(t, o.orgId));
      logActivity(t.projectId, "created", "task", id, `Task "${t.name}" created`);
    },
    [insertRow, logActivity]
  );

  const updateTask = React.useCallback(
    (id: string, patch: Partial<Task>) => {
      setLists((prev) => ({ ...prev, tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
      getSb()
        .from("tasks")
        .update(toTaskPatch(patch))
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("task update failed", error);
        });
      const action = patch.status === "completed" ? ("completed" as const) : ("updated" as const);
      const detail = patch.status ? `Task status changed to ${patch.status}` : "Task updated";
      const task = listsRef.current.tasks.find((t) => t.id === id);
      if (task) logActivity(task.projectId, action, "task", id, detail);
    },
    [getSb, logActivity]
  );

  const deleteTask = React.useCallback(
    (id: string) => {
      const task = listsRef.current.tasks.find((t) => t.id === id);
      setLists((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));
      getSb()
        .from("tasks")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("task delete failed", error);
        });
      if (task) logActivity(task.projectId, "deleted", "task", id, `Task "${task.name}" deleted`);
    },
    [getSb, logActivity]
  );

  const addDpr = React.useCallback(
    (d: Omit<Dpr, "id">) => {
      const o = orgRef.current;
      if (!o) return;
      const id = crypto.randomUUID();
      insertRow("dprs", { ...d, id }, "dprs", toDprRow(d, o.orgId, o.userId));
      logActivity(d.projectId, "filed", "dpr", id, `DPR filed for ${d.date}`);
    },
    [insertRow, logActivity]
  );

  const addInstruction = React.useCallback(
    (s: Omit<SiteInstruction, "id">) => {
      const o = orgRef.current;
      if (!o) return;
      const id = crypto.randomUUID();
      insertRow("instructions", { ...s, id }, "site_instructions", toInstructionRow(s, o.orgId, o.userId));
      logActivity(s.projectId, "created", "instruction", id, `Site instruction added (${s.priority} priority)`);
    },
    [insertRow, logActivity]
  );

  const addTransaction = React.useCallback(
    (t: Omit<Transaction, "id">) => {
      const o = orgRef.current;
      if (!o) return;
      const id = crypto.randomUUID();
      insertRow("transactions", { ...t, id }, "transactions", toTransactionRow(t, o.orgId));
      const dir = t.direction === "in" ? "received" : "spent";
      logActivity(t.projectId, "created", "transaction", id, `Transaction ${dir}: ${t.amount}`);
    },
    [insertRow, logActivity]
  );

  const addInvoice = React.useCallback(
    (i: Omit<SalesInvoice, "id">) => {
      const o = orgRef.current;
      if (!o) return;
      const id = crypto.randomUUID();
      setLists((prev) => ({ ...prev, invoices: upsertById(prev.invoices, { ...i, id }) }));
      void (async () => {
        const sb = getSb();
        const { error: e1 } = await sb.from("sales_invoices").insert({ id, ...toInvoiceRow(i, o.orgId) });
        if (e1) {
          console.error("invoice insert failed", e1);
          setLists((prev) => ({ ...prev, invoices: prev.invoices.filter((x) => x.id !== id) }));
          return;
        }
        if (i.items.length) {
          const { error: e2 } = await sb.from("invoice_items").insert(toInvoiceItemRows(i.items, o.orgId, id));
          if (e2) console.error("invoice_items insert failed", e2);
        }
      })();
      logActivity(i.projectId, "created", "invoice", id, `Invoice ${i.number} created`);
    },
    [getSb, logActivity]
  );

  const recordPayment = React.useCallback(
    (invoiceId: string, amount: number) => {
      const inv = listsRef.current.invoices.find((i) => i.id === invoiceId);
      if (!inv) return;
      const received = inv.received + amount;
      setLists((prev) => ({
        ...prev,
        invoices: prev.invoices.map((i) => (i.id === invoiceId ? { ...i, received } : i)),
      }));
      getSb()
        .from("sales_invoices")
        .update({ received })
        .eq("id", invoiceId)
        .then(({ error }) => {
          if (error) console.error("payment update failed", error);
        });
      logActivity(inv.projectId, "created", "payment", invoiceId, `Payment of ${amount} recorded for ${inv.number}`);
    },
    [getSb, logActivity]
  );

  const addAttendance = React.useCallback(
    (a: Omit<LabourAttendance, "id">) => {
      const o = orgRef.current;
      if (!o) return;
      const id = crypto.randomUUID();
      insertRow("attendance", { ...a, id }, "labour_attendance", toAttendanceRow(a, o.orgId));
      logActivity(a.projectId, "filed", "attendance", id, `Attendance logged: ${a.present} present, ${a.absent} absent`);
    },
    [insertRow, logActivity]
  );

  const addEmployee = React.useCallback(
    (e: Omit<Employee, "id">) => {
      const o = orgRef.current;
      if (!o) return;
      const id = crypto.randomUUID();
      insertRow("employees", { ...e, id }, "employees", toEmployeeRow(e, o.orgId));
    },
    [insertRow]
  );

  const updateEmployee = React.useCallback(
    (id: string, patch: Partial<Employee>) => {
      setLists((prev) => ({
        ...prev,
        employees: prev.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
      }));
      getSb()
        .from("employees")
        .update(toEmployeePatch(patch))
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("employee update failed", error);
        });
    },
    [getSb]
  );

  const deleteEmployee = React.useCallback(
    (id: string) => {
      setLists((prev) => ({ ...prev, employees: prev.employees.filter((e) => e.id !== id) }));
      getSb()
        .from("employees")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("employee delete failed", error);
        });
    },
    [getSb]
  );

  const addExpense = React.useCallback(
    (e: Omit<Expense, "id">) => {
      const o = orgRef.current;
      if (!o) return;
      const id = crypto.randomUUID();
      insertRow("expenses", { ...e, id }, "expenses", toExpenseRow(e, o.orgId, o.userId));
      logActivity(e.projectId, "created", "expense", id, `Expense of ${e.amount} added (${e.category})`);
    },
    [insertRow, logActivity]
  );

  const value = React.useMemo<StoreValue>(
    () => ({
      addedProjects: lists.projects,
      tasks: lists.tasks,
      dprs: lists.dprs,
      instructions: lists.instructions,
      transactions: lists.transactions,
      invoices: lists.invoices,
      attendance: lists.attendance,
      activityLog: lists.activityLog,
      employees: lists.employees,
      expenses: lists.expenses,
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
    }),
    [
      lists,
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
    ]
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
