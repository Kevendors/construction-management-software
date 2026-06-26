"use client";

import * as React from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import {
  mapClient,
  mapInvoice,
  mapProject,
  mapTask,
  mapTransaction,
  mapUser,
  type ClientRow,
  type InvoiceRow,
  type ProjectRow,
  type TaskRow,
  type TransactionRow,
  type UserRow,
} from "@/lib/data/mappers";
import { lineTotalWithTax, getProject as getMockProject } from "@/lib/mock/selectors";
import {
  clients as seedClients,
  dprs as seedDprs,
  labourAttendance as seedAttendance,
  projects as seedProjects,
  salesInvoices as seedInvoices,
  siteInstructions as seedInstructions,
  tasks as seedTasks,
  transactions as seedTxns,
  users as seedUsers,
} from "@/lib/mock/data";
import type {
  Client,
  Dpr,
  LabourAttendance,
  Project,
  SalesInvoice,
  SiteInstruction,
  Task,
  Transaction,
  User,
} from "@/lib/types";

/**
 * Client-side data store backed by Supabase. On mount the provider loads the
 * signed-in org's projects, tasks, DPRs, instructions, expenses, invoices and
 * attendance (RLS scopes everything to the caller's org); every create / edit
 * writes straight back to Postgres and updates local state so the UI stays
 * live. When Supabase isn't configured (local dev with no env) it falls back to
 * the in-repo mock so the app still runs with zero setup.
 */

/* ---------- row shapes for tables without a shared mapper ---------- */

interface DprRow {
  id: string;
  project_id: string;
  date: string;
  author_id: string | null;
  weather: string | null;
  work_done: string | null;
  labour_count: number;
  photos: number;
}
interface InstructionRow {
  id: string;
  project_id: string;
  date: string;
  by_id: string | null;
  text: string;
  priority: SiteInstruction["priority"];
}
interface AttendanceRow {
  id: string;
  contractor_id: string | null;
  project_id: string | null;
  date: string;
  shift: LabourAttendance["shift"];
  present: number;
  absent: number;
  gps: string | null;
}

const mapDpr = (r: DprRow): Dpr => ({
  id: r.id,
  projectId: r.project_id,
  date: r.date,
  authorId: r.author_id ?? "",
  weather: r.weather ?? "",
  workDone: r.work_done ?? "",
  labourCount: r.labour_count,
  photos: r.photos,
});
const mapInstruction = (r: InstructionRow): SiteInstruction => ({
  id: r.id,
  projectId: r.project_id,
  date: r.date,
  byId: r.by_id ?? "",
  text: r.text,
  priority: r.priority,
});
const mapAttendance = (r: AttendanceRow): LabourAttendance => ({
  id: r.id,
  contractorId: r.contractor_id ?? "",
  projectId: r.project_id ?? "",
  date: r.date,
  shift: r.shift,
  present: r.present,
  absent: r.absent,
  gps: r.gps ?? "",
});

/* ---------- store shape ---------- */

interface StoreData {
  loading: boolean;
  source: "supabase" | "mock";
  orgId: string | null;
  currentUserId: string | null;
  projects: Project[];
  addedProjects: Project[];
  clients: Client[];
  users: User[];
  tasks: Task[];
  dprs: Dpr[];
  instructions: SiteInstruction[];
  transactions: Transaction[];
  invoices: SalesInvoice[];
  attendance: LabourAttendance[];
}

const EMPTY: StoreData = {
  loading: true,
  source: "mock",
  orgId: null,
  currentUserId: null,
  projects: [],
  addedProjects: [],
  clients: [],
  users: [],
  tasks: [],
  dprs: [],
  instructions: [],
  transactions: [],
  invoices: [],
  attendance: [],
};

interface StoreValue extends StoreData {
  addProject: (p: Omit<Project, "id">) => Promise<Project | null>;
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

type Supabase = ReturnType<typeof createClient>;

/** The mock seed, used until Supabase responds and when env is absent. */
function mockData(): StoreData {
  return {
    loading: false,
    source: "mock",
    orgId: null,
    currentUserId: seedUsers[0]?.id ?? null,
    projects: seedProjects,
    addedProjects: [],
    clients: seedClients,
    users: seedUsers,
    tasks: seedTasks,
    dprs: seedDprs,
    instructions: seedInstructions,
    transactions: seedTxns,
    invoices: seedInvoices,
    attendance: seedAttendance,
  };
}

export function ProjectStoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<StoreData>(EMPTY);
  const supabaseRef = React.useRef<Supabase | null>(null);

  // Load everything for the signed-in org on mount.
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setData(mockData());
        return;
      }
      const supabase = createClient();
      supabaseRef.current = supabase;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setData(mockData());
        return;
      }

      const { data: membership } = await supabase
        .from("memberships")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      const orgId = (membership?.org_id as string | undefined) ?? null;

      const [proj, cli, prof, tsk, dpr, ins, txn, inv, att] = await Promise.all([
        supabase.from("projects").select("*"),
        supabase.from("clients").select("*"),
        supabase.from("profiles").select("*"),
        supabase.from("tasks").select("*"),
        supabase.from("dprs").select("*"),
        supabase.from("site_instructions").select("*"),
        supabase.from("transactions").select("*"),
        supabase.from("sales_invoices").select("*, invoice_items(*)"),
        supabase.from("labour_attendance").select("*"),
      ]);

      if (cancelled) return;
      setData({
        loading: false,
        source: "supabase",
        orgId,
        currentUserId: user.id,
        projects: ((proj.data as ProjectRow[] | null) ?? []).map(mapProject),
        addedProjects: [],
        clients: ((cli.data as ClientRow[] | null) ?? []).map(mapClient),
        users: ((prof.data as UserRow[] | null) ?? []).map(mapUser),
        tasks: ((tsk.data as TaskRow[] | null) ?? []).map(mapTask),
        dprs: ((dpr.data as DprRow[] | null) ?? []).map(mapDpr),
        instructions: ((ins.data as InstructionRow[] | null) ?? []).map(mapInstruction),
        transactions: ((txn.data as TransactionRow[] | null) ?? []).map(mapTransaction),
        invoices: ((inv.data as InvoiceRow[] | null) ?? []).map(mapInvoice),
        attendance: ((att.data as AttendanceRow[] | null) ?? []).map(mapAttendance),
      });
    }
    load().catch((e) => {
      console.error("[project-store] load failed, using mock", e);
      if (!cancelled) setData(mockData());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = React.useCallback(
    (updater: (prev: StoreData) => StoreData) => setData((prev) => updater(prev)),
    []
  );

  // Coerce a person id to a valid profile id (FK → profiles) or null.
  const profileId = React.useCallback(
    (id: string | null | undefined): string | null => {
      if (!id) return null;
      return data.users.some((u) => u.id === id) ? id : null;
    },
    [data.users]
  );

  const sb = () => supabaseRef.current;
  const live = () => data.source === "supabase" && sb() && data.orgId;

  /* ---------------- mutations ---------------- */

  const addProject = React.useCallback(
    async (p: Omit<Project, "id">): Promise<Project | null> => {
      if (!live()) {
        const project: Project = { ...p, id: genId("proj") };
        patch((prev) => ({
          ...prev,
          projects: [...prev.projects, project],
          addedProjects: [...prev.addedProjects, project],
        }));
        return project;
      }
      const { data: row, error } = await sb()!
        .from("projects")
        .insert({
          org_id: data.orgId,
          code: p.code,
          name: p.name,
          client_id: p.clientId || null,
          value: p.value,
          status: p.status,
          start_date: p.startDate || null,
          end_date: p.endDate || null,
          percent_complete: p.percentComplete,
          location: p.location || null,
          pm_id: profileId(p.pmId),
        })
        .select("*")
        .single();
      if (error || !row) {
        console.error("[project-store] addProject failed", error);
        return null;
      }
      const project = mapProject(row as ProjectRow);
      patch((prev) => ({
        ...prev,
        projects: [...prev.projects, project],
        addedProjects: [...prev.addedProjects, project],
      }));
      return project;
    },
    [data.orgId, patch, profileId]
  );

  const addTask = React.useCallback(
    (t: Omit<Task, "id">) => {
      const optimistic: Task = { ...t, id: genId("task") };
      patch((prev) => ({ ...prev, tasks: [...prev.tasks, optimistic] }));
      if (!live()) return;
      sb()!
        .from("tasks")
        .insert({
          org_id: data.orgId,
          project_id: t.projectId,
          parent_id: t.parentId,
          name: t.name,
          assignee_id: profileId(t.assigneeId),
          start_date: t.startDate || null,
          end_date: t.endDate || null,
          status: t.status,
          progress_value: t.progressValue,
          progress_target: t.progressTarget,
          unit: t.unit,
          delay_days: t.delayDays,
        })
        .select("*")
        .single()
        .then(({ data: row, error }) => {
          if (error || !row) return console.error("[project-store] addTask failed", error);
          const real = mapTask(row as TaskRow);
          patch((prev) => ({
            ...prev,
            tasks: prev.tasks.map((x) => (x.id === optimistic.id ? real : x)),
          }));
        });
    },
    [data.orgId, patch, profileId]
  );

  const updateTask = React.useCallback(
    (id: string, p: Partial<Task>) => {
      patch((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...p } : t)),
      }));
      if (!live()) return;
      const row: Record<string, unknown> = {};
      if (p.name !== undefined) row.name = p.name;
      if (p.assigneeId !== undefined) row.assignee_id = profileId(p.assigneeId);
      if (p.startDate !== undefined) row.start_date = p.startDate || null;
      if (p.endDate !== undefined) row.end_date = p.endDate || null;
      if (p.status !== undefined) row.status = p.status;
      if (p.progressValue !== undefined) row.progress_value = p.progressValue;
      if (p.progressTarget !== undefined) row.progress_target = p.progressTarget;
      if (p.unit !== undefined) row.unit = p.unit;
      if (p.delayDays !== undefined) row.delay_days = p.delayDays;
      sb()!
        .from("tasks")
        .update(row)
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("[project-store] updateTask failed", error);
        });
    },
    [patch, profileId]
  );

  const deleteTask = React.useCallback(
    (id: string) => {
      patch((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }));
      if (!live()) return;
      sb()!
        .from("tasks")
        .delete()
        .eq("id", id)
        .then(({ error }) => {
          if (error) console.error("[project-store] deleteTask failed", error);
        });
    },
    [patch]
  );

  const addDpr = React.useCallback(
    (d: Omit<Dpr, "id">) => {
      const optimistic: Dpr = { ...d, id: genId("dpr") };
      patch((prev) => ({ ...prev, dprs: [optimistic, ...prev.dprs] }));
      if (!live()) return;
      sb()!
        .from("dprs")
        .insert({
          org_id: data.orgId,
          project_id: d.projectId,
          date: d.date,
          author_id: profileId(d.authorId),
          weather: d.weather,
          work_done: d.workDone,
          labour_count: d.labourCount,
          photos: d.photos,
        })
        .select("*")
        .single()
        .then(({ data: row, error }) => {
          if (error || !row) return console.error("[project-store] addDpr failed", error);
          // Keep the locally-held photo data URLs (not yet persisted to Storage).
          const real = { ...mapDpr(row as DprRow), photoUrls: d.photoUrls };
          patch((prev) => ({
            ...prev,
            dprs: prev.dprs.map((x) => (x.id === optimistic.id ? real : x)),
          }));
        });
    },
    [data.orgId, patch, profileId]
  );

  const addInstruction = React.useCallback(
    (s: Omit<SiteInstruction, "id">) => {
      const optimistic: SiteInstruction = { ...s, id: genId("si") };
      patch((prev) => ({ ...prev, instructions: [optimistic, ...prev.instructions] }));
      if (!live()) return;
      sb()!
        .from("site_instructions")
        .insert({
          org_id: data.orgId,
          project_id: s.projectId,
          date: s.date,
          by_id: profileId(s.byId),
          text: s.text,
          priority: s.priority,
        })
        .select("*")
        .single()
        .then(({ data: row, error }) => {
          if (error || !row) return console.error("[project-store] addInstruction failed", error);
          const real = mapInstruction(row as InstructionRow);
          patch((prev) => ({
            ...prev,
            instructions: prev.instructions.map((x) => (x.id === optimistic.id ? real : x)),
          }));
        });
    },
    [data.orgId, patch, profileId]
  );

  const addTransaction = React.useCallback(
    (t: Omit<Transaction, "id">) => {
      const optimistic: Transaction = { ...t, id: genId("txn") };
      patch((prev) => ({ ...prev, transactions: [optimistic, ...prev.transactions] }));
      if (!live()) return;
      sb()!
        .from("transactions")
        .insert({
          org_id: data.orgId,
          project_id: t.projectId,
          party_id: t.partyId,
          date: t.date,
          direction: t.direction,
          amount: t.amount,
          cost_code: t.costCode,
          category: t.category,
          note: t.note,
        })
        .select("*")
        .single()
        .then(({ data: row, error }) => {
          if (error || !row) return console.error("[project-store] addTransaction failed", error);
          const real = mapTransaction(row as TransactionRow);
          patch((prev) => ({
            ...prev,
            transactions: prev.transactions.map((x) => (x.id === optimistic.id ? real : x)),
          }));
        });
    },
    [data.orgId, patch]
  );

  const addInvoice = React.useCallback(
    (i: Omit<SalesInvoice, "id">) => {
      const optimistic: SalesInvoice = { ...i, id: genId("inv") };
      patch((prev) => ({ ...prev, invoices: [optimistic, ...prev.invoices] }));
      if (!live()) return;
      (async () => {
        const { data: row, error } = await sb()!
          .from("sales_invoices")
          .insert({
            org_id: data.orgId,
            number: i.number,
            project_id: i.projectId || null,
            client_id: i.clientId || null,
            date: i.date,
            due_date: i.dueDate || null,
            tax_rate: i.taxRate,
            received: i.received,
            status: i.status,
          })
          .select("*")
          .single();
        if (error || !row) return console.error("[project-store] addInvoice failed", error);
        const invoiceId = (row as { id: string }).id;
        if (i.items.length) {
          await sb()!.from("invoice_items").insert(
            i.items.map((it) => ({
              org_id: data.orgId,
              invoice_id: invoiceId,
              description: it.description,
              qty: it.qty,
              unit: it.unit,
              rate: it.rate,
            }))
          );
        }
        const real = mapInvoice({ ...(row as InvoiceRow), invoice_items: [] });
        real.items = i.items; // keep the items we just wrote (with their ids)
        patch((prev) => ({
          ...prev,
          invoices: prev.invoices.map((x) => (x.id === optimistic.id ? real : x)),
        }));
      })();
    },
    [data.orgId, patch]
  );

  const recordPayment = React.useCallback(
    (invoiceId: string, amount: number) => {
      const inv = data.invoices.find((x) => x.id === invoiceId);
      if (!inv) return;
      const received = inv.received + amount;
      const total = lineTotalWithTax(inv.items, inv.taxRate);
      const status: SalesInvoice["status"] =
        received <= 0 ? inv.status : received >= total ? "paid" : "partial";
      patch((prev) => ({
        ...prev,
        invoices: prev.invoices.map((x) =>
          x.id === invoiceId ? { ...x, received, status } : x
        ),
      }));
      if (!live()) return;
      sb()!
        .from("sales_invoices")
        .update({ received, status })
        .eq("id", invoiceId)
        .then(({ error }) => {
          if (error) console.error("[project-store] recordPayment failed", error);
        });
    },
    [data.invoices, patch]
  );

  const addAttendance = React.useCallback(
    (a: Omit<LabourAttendance, "id">) => {
      const optimistic: LabourAttendance = { ...a, id: genId("la") };
      patch((prev) => ({ ...prev, attendance: [optimistic, ...prev.attendance] }));
      if (!live()) return;
      sb()!
        .from("labour_attendance")
        .insert({
          org_id: data.orgId,
          contractor_id: null, // manual entry — no contractor FK
          project_id: a.projectId,
          date: a.date,
          shift: a.shift,
          present: a.present,
          absent: a.absent,
          gps: a.gps || null,
        })
        .select("*")
        .single()
        .then(({ data: row, error }) => {
          if (error || !row) return console.error("[project-store] addAttendance failed", error);
          const real = mapAttendance(row as AttendanceRow);
          patch((prev) => ({
            ...prev,
            attendance: prev.attendance.map((x) => (x.id === optimistic.id ? real : x)),
          }));
        });
    },
    [data.orgId, patch]
  );

  const value = React.useMemo<StoreValue>(
    () => ({
      ...data,
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
    }),
    [
      data,
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

/** Resolve a project by id from the store (Supabase), falling back to mock. */
export function useProject(projectId: string): Project | null {
  const { projects } = useStore();
  return projects.find((p) => p.id === projectId) ?? getMockProject(projectId) ?? null;
}

/** Back-compat alias — resolves user-created (and now all) projects by id. */
export const useAddedProject = useProject;

/* ---------- people & clients (for dropdowns + name resolution) ---------- */

export function useUsers() {
  return useStore().users;
}

export function useUser(id: string | null) {
  const { users } = useStore();
  if (!id) return null;
  return users.find((u) => u.id === id) ?? null;
}

export function useClients() {
  return useStore().clients;
}
