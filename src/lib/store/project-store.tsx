"use client";

import * as React from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { getDprPhotoUrls, uploadDprPhotos } from "@/app/projects/dpr-actions";
import {
  addProjectMemberAction,
  removeProjectMemberAction,
  setProjectMemberRoleAction,
} from "@/app/projects/team-actions";
import {
  mapClient,
  mapExpense,
  mapInvoice,
  mapProject,
  mapProjectMember,
  mapTask,
  mapTransaction,
  mapUser,
  type ClientRow,
  type ExpenseRow,
  type InvoiceRow,
  type ProjectMemberRow,
  type ProjectRow,
  type TaskRow,
  type TransactionRow,
  type UserRow,
} from "@/lib/data/mappers";
import { lineTotalWithTax, getProject as getMockProject } from "@/lib/mock/selectors";
import {
  clients as seedClients,
  dprs as seedDprs,
  expenses as seedExpenses,
  labourAttendance as seedAttendance,
  projectMembers as seedProjectMembers,
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
  Expense,
  LabourAttendance,
  Project,
  ProjectMember,
  Role,
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
  /** The signed-in user's org role (null until the membership loads). */
  currentRole: Role | null;
  /** Per-project assignments — projects are pre-filtered by these for non-admins. */
  projectMembers: ProjectMember[];
  projects: Project[];
  addedProjects: Project[];
  clients: Client[];
  users: User[];
  tasks: Task[];
  dprs: Dpr[];
  instructions: SiteInstruction[];
  transactions: Transaction[];
  expenses: Expense[];
  invoices: SalesInvoice[];
  attendance: LabourAttendance[];
  expenseCategories: CodeOption[];
  costCodes: CodeOption[];
}

export interface CodeOption {
  slug: string;
  label: string;
}

const DEFAULT_EXPENSE_CATEGORIES: CodeOption[] = [
  { slug: "material", label: "Material" },
  { slug: "salary", label: "Salary" },
  { slug: "site", label: "Site" },
  { slug: "subcon", label: "Subcon" },
  { slug: "other", label: "Other" },
];
const DEFAULT_COST_CODES: CodeOption[] = [
  { slug: "material", label: "Material" },
  { slug: "machinery", label: "Machinery" },
  { slug: "diesel", label: "Diesel" },
  { slug: "labour", label: "Labour" },
  { slug: "other", label: "Other" },
];

const EMPTY: StoreData = {
  loading: true,
  source: "mock",
  orgId: null,
  currentUserId: null,
  currentRole: null,
  projectMembers: [],
  projects: [],
  addedProjects: [],
  clients: [],
  users: [],
  tasks: [],
  dprs: [],
  instructions: [],
  transactions: [],
  expenses: [],
  invoices: [],
  attendance: [],
  expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
  costCodes: DEFAULT_COST_CODES,
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
  /** Team assignment (super admin only) — resolve to an error message or null. */
  addProjectMember: (projectId: string, userId: string, role: Role) => Promise<string | null>;
  setProjectMemberRole: (projectId: string, userId: string, role: Role) => Promise<string | null>;
  removeProjectMember: (projectId: string, userId: string) => Promise<string | null>;
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
    currentRole: seedUsers[0]?.role ?? null,
    projectMembers: seedProjectMembers,
    projects: seedProjects,
    addedProjects: [],
    clients: seedClients,
    users: seedUsers,
    tasks: seedTasks,
    dprs: seedDprs,
    instructions: seedInstructions,
    transactions: seedTxns,
    expenses: seedExpenses,
    invoices: seedInvoices,
    attendance: seedAttendance,
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
    costCodes: DEFAULT_COST_CODES,
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
        .select("org_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      const orgId = (membership?.org_id as string | undefined) ?? null;
      const currentRole = (membership?.role as Role | undefined) ?? null;

      const [proj, cli, prof, tsk, dpr, ins, txn, inv, att, exp, cat, cc, pmem] = await Promise.all([
        // Value privacy is enforced server-side: this RPC returns value=0 for
        // non-super-admins, so the real figure never reaches their client.
        supabase.rpc("list_org_projects"),
        supabase.from("clients").select("*"),
        supabase.from("profiles").select("*"),
        supabase.from("tasks").select("*"),
        supabase.from("dprs").select("*"),
        supabase.from("site_instructions").select("*"),
        supabase.from("transactions").select("*"),
        supabase.from("sales_invoices").select("*, invoice_items(*)"),
        supabase.from("labour_attendance").select("*"),
        supabase.from("expenses").select("*"),
        supabase.from("expense_categories").select("slug,label").order("label"),
        supabase.from("cost_codes").select("slug,label").order("label"),
        supabase.from("project_members").select("*"),
      ]);

      if (cancelled) return;

      // Mint signed URLs for any DPR photos (private bucket, keyed by dpr id).
      let dprList = ((dpr.data as DprRow[] | null) ?? []).map(mapDpr);
      const photoMap = await getDprPhotoUrls(
        dprList.filter((d) => d.photos > 0).map((d) => ({ id: d.id, photos: d.photos }))
      );
      if (Object.keys(photoMap).length) {
        dprList = dprList.map((d) =>
          photoMap[d.id] ? { ...d, photoUrls: photoMap[d.id] } : d
        );
      }

      if (cancelled) return;

      // Visibility: non-super-admins only see projects they're assigned to.
      // RLS (migration 0010) enforces this server-side too; filtering here
      // keeps behavior correct before that migration is applied.
      const memberList = ((pmem.data as ProjectMemberRow[] | null) ?? []).map(mapProjectMember);
      let projectList = ((proj.data as ProjectRow[] | null) ?? []).map(mapProject);
      // If the table hasn't been migrated yet (0009 pending), keep today's
      // org-wide visibility instead of locking everyone out. RLS (0010) is the
      // hard gate; this keeps client state consistent before it's applied.
      // scoped() filters project-keyed rows; rows without a project stay.
      let scoped = <T,>(rows: T[], pid: (row: T) => string | null | undefined): T[] => rows;
      if (currentRole !== "super_admin" && !pmem.error) {
        const mine = new Set(
          memberList.filter((m) => m.userId === user.id).map((m) => m.projectId)
        );
        projectList = projectList.filter((p) => mine.has(p.id));
        scoped = (rows, pid) =>
          rows.filter((row) => {
            const id = pid(row);
            return id ? mine.has(id) : true;
          });
      }

      setData({
        loading: false,
        source: "supabase",
        orgId,
        currentUserId: user.id,
        currentRole,
        projectMembers: memberList,
        projects: projectList,
        addedProjects: [],
        clients: ((cli.data as ClientRow[] | null) ?? []).map(mapClient),
        users: ((prof.data as UserRow[] | null) ?? []).map(mapUser),
        tasks: scoped(((tsk.data as TaskRow[] | null) ?? []).map(mapTask), (t) => t.projectId),
        dprs: scoped(dprList, (d) => d.projectId),
        instructions: scoped(
          ((ins.data as InstructionRow[] | null) ?? []).map(mapInstruction), (s) => s.projectId),
        transactions: scoped(
          ((txn.data as TransactionRow[] | null) ?? []).map(mapTransaction), (t) => t.projectId),
        expenses: scoped(
          ((exp.data as ExpenseRow[] | null) ?? []).map(mapExpense), (e) => e.projectId),
        invoices: scoped(
          ((inv.data as InvoiceRow[] | null) ?? []).map(mapInvoice), (i) => i.projectId),
        attendance: scoped(
          ((att.data as AttendanceRow[] | null) ?? []).map(mapAttendance), (a) => a.projectId),
        expenseCategories: (cat.data as CodeOption[] | null)?.length ? (cat.data as CodeOption[]) : DEFAULT_EXPENSE_CATEGORIES,
        costCodes: (cc.data as CodeOption[] | null)?.length ? (cc.data as CodeOption[]) : DEFAULT_COST_CODES,
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
        .then(async ({ data: row, error }) => {
          if (error || !row) return console.error("[project-store] addDpr failed", error);
          // Upload photos to the private bucket; fall back to the local data
          // URLs for instant display if the upload returns nothing.
          let photoUrls = d.photoUrls;
          if (d.photoUrls?.length) {
            const signed = await uploadDprPhotos((row as DprRow).id, d.photoUrls);
            if (signed.length) photoUrls = signed;
          }
          const real = { ...mapDpr(row as DprRow), photoUrls };
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

  /* ---------------- team assignment (super admin only) ---------------- */

  const addProjectMember = React.useCallback(
    async (projectId: string, userId: string, role: Role): Promise<string | null> => {
      const upsert = (prev: StoreData, member: ProjectMember): StoreData => ({
        ...prev,
        projectMembers: [
          ...prev.projectMembers.filter(
            (m) => !(m.projectId === projectId && m.userId === userId)
          ),
          member,
        ],
      });
      if (!live()) {
        patch((prev) => upsert(prev, { id: genId("pmem"), projectId, userId, role }));
        return null;
      }
      const res = await addProjectMemberAction(projectId, userId, role);
      if (res.error) return res.error;
      patch((prev) => upsert(prev, { id: res.id ?? genId("pmem"), projectId, userId, role }));
      return null;
    },
    // data.orgId keeps live() fresh once the Supabase load settles (same as the
    // other mutations) — with [patch] alone the closure would pin the EMPTY state.
    [data.orgId, patch]
  );

  const setProjectMemberRole = React.useCallback(
    async (projectId: string, userId: string, role: Role): Promise<string | null> => {
      const apply = (prev: StoreData): StoreData => ({
        ...prev,
        projectMembers: prev.projectMembers.map((m) =>
          m.projectId === projectId && m.userId === userId ? { ...m, role } : m
        ),
      });
      if (!live()) {
        patch(apply);
        return null;
      }
      const res = await setProjectMemberRoleAction(projectId, userId, role);
      if (res.error) return res.error;
      patch(apply);
      return null;
    },
    [data.orgId, patch]
  );

  const removeProjectMember = React.useCallback(
    async (projectId: string, userId: string): Promise<string | null> => {
      const apply = (prev: StoreData): StoreData => ({
        ...prev,
        projectMembers: prev.projectMembers.filter(
          (m) => !(m.projectId === projectId && m.userId === userId)
        ),
      });
      if (!live()) {
        patch(apply);
        return null;
      }
      const res = await removeProjectMemberAction(projectId, userId);
      if (res.error) return res.error;
      patch(apply);
      return null;
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
      addProjectMember,
      setProjectMemberRole,
      removeProjectMember,
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
      addProjectMember,
      setProjectMemberRole,
      removeProjectMember,
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

export function useProjectExpenses(projectId: string) {
  const { expenses } = useStore();
  return expenses
    .filter((e) => e.projectId === projectId)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export function useExpenseCategories() {
  return useStore().expenseCategories;
}

export function useCostCodes() {
  return useStore().costCodes;
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

/** Resolve a project by id from the store; the mock fallback only applies in
 *  mock mode so scoped-out projects can't resurface from seed data. */
export function useProject(projectId: string): Project | null {
  const { projects, source } = useStore();
  return (
    projects.find((p) => p.id === projectId) ??
    (source === "mock" ? (getMockProject(projectId) ?? null) : null)
  );
}

/** Roster of one project, joined with user profiles for display. */
export function useProjectTeam(projectId: string) {
  const { projectMembers, users } = useStore();
  return projectMembers
    .filter((m) => m.projectId === projectId)
    .map((member) => ({
      member,
      user: users.find((u) => u.id === member.userId) ?? null,
    }));
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
