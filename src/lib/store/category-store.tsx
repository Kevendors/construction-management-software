"use client";

import * as React from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";
import { getActiveOrg, type ActiveOrg } from "@/lib/supabase/active-org";

const LS_KEY = "sitehub:categories:v1";

interface CategoryData {
  expenseCategories: Record<string, string>; // key -> label
  costCodes: Record<string, string>;
  materialCategories: Record<string, string>;
}

const EMPTY: CategoryData = {
  expenseCategories: {},
  costCodes: {},
  materialCategories: {},
};

interface CategoryStoreValue {
  customExpenseCategories: Record<string, string>;
  customCostCodes: Record<string, string>;
  customMaterialCategories: Record<string, string>;
  addExpenseCategory: (label: string) => string;
  addCostCode: (label: string) => string;
  addMaterialCategory: (label: string) => string;
}

const CategoryContext = React.createContext<CategoryStoreValue | null>(null);

function toKey(label: string) {
  return label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

/* Supabase `categories.kind` <-> the three in-memory records. */
type CategoryKind = "expense" | "cost_code" | "material";
const FIELD_BY_KIND: Record<CategoryKind, keyof CategoryData> = {
  expense: "expenseCategories",
  cost_code: "costCodes",
  material: "materialCategories",
};

export function CategoryStoreProvider({ children }: { children: React.ReactNode }) {
  if (isSupabaseConfigured()) {
    return <SupabaseCategoryStore>{children}</SupabaseCategoryStore>;
  }
  return <LocalCategoryStore>{children}</LocalCategoryStore>;
}

/* ---------------- Backend A — localStorage (demo mode) ---------------- */

function load(): CategoryData {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<CategoryData>;
    return {
      expenseCategories: p.expenseCategories ?? {},
      costCodes: p.costCodes ?? {},
      materialCategories: p.materialCategories ?? {},
    };
  } catch {
    return EMPTY;
  }
}

function LocalCategoryStore({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<CategoryData>(EMPTY);

  React.useEffect(() => {
    // Hydrate from localStorage after mount so SSR and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(load());
  }, []);

  const persist = React.useCallback((next: CategoryData) => {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch { /* storage unavailable */ }
  }, []);

  const addExpenseCategory = React.useCallback(
    (label: string): string => {
      const key = toKey(label);
      setData((prev) => {
        const next = { ...prev, expenseCategories: { ...prev.expenseCategories, [key]: label } };
        persist(next);
        return next;
      });
      return key;
    },
    [persist]
  );

  const addCostCode = React.useCallback(
    (label: string): string => {
      const key = toKey(label);
      setData((prev) => {
        const next = { ...prev, costCodes: { ...prev.costCodes, [key]: label } };
        persist(next);
        return next;
      });
      return key;
    },
    [persist]
  );

  const addMaterialCategory = React.useCallback(
    (label: string): string => {
      const key = toKey(label);
      setData((prev) => {
        const next = { ...prev, materialCategories: { ...prev.materialCategories, [key]: label } };
        persist(next);
        return next;
      });
      return key;
    },
    [persist]
  );

  const value = React.useMemo<CategoryStoreValue>(
    () => ({
      customExpenseCategories: data.expenseCategories,
      customCostCodes: data.costCodes,
      customMaterialCategories: data.materialCategories,
      addExpenseCategory,
      addCostCode,
      addMaterialCategory,
    }),
    [data, addExpenseCategory, addCostCode, addMaterialCategory]
  );

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}

/* ---------------- Backend B — Supabase + Realtime (live) ---------------- */

interface CategoryRow {
  id: string;
  kind: CategoryKind;
  key: string;
  label: string;
}

function SupabaseCategoryStore({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<CategoryData>(EMPTY);
  const [org, setOrg] = React.useState<ActiveOrg | null>(null);
  const orgRef = React.useRef<ActiveOrg | null>(null);
  React.useEffect(() => {
    orgRef.current = org;
  }, [org]);

  const supabaseRef = React.useRef<SupabaseClient | null>(null);
  const getSb = React.useCallback((): SupabaseClient => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }, []);

  const applyRow = React.useCallback((row: CategoryRow) => {
    const field = FIELD_BY_KIND[row.kind];
    if (!field) return;
    setData((prev) => ({ ...prev, [field]: { ...prev[field], [row.key]: row.label } }));
  }, []);

  // initial load
  React.useEffect(() => {
    let active = true;
    const sb = getSb();
    (async () => {
      const ident = await getActiveOrg(sb);
      if (!active || !ident) return;
      setOrg(ident);
      const { data: rows, error } = await sb.from("categories").select("id, kind, key, label");
      if (!active || error || !rows) return;
      const next: CategoryData = { expenseCategories: {}, costCodes: {}, materialCategories: {} };
      for (const r of rows as CategoryRow[]) {
        const field = FIELD_BY_KIND[r.kind];
        if (field) next[field][r.key] = r.label;
      }
      setData(next);
    })();
    return () => {
      active = false;
    };
  }, [getSb]);

  // realtime
  React.useEffect(() => {
    if (!org) return;
    const sb = getSb();
    const channel = sb
      .channel(`sitehub-categories-${org.orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "categories", filter: `org_id=eq.${org.orgId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as Partial<CategoryRow>;
            if (!old.kind || !old.key) return;
            const field = FIELD_BY_KIND[old.kind];
            setData((prev) => {
              const copy = { ...prev[field] };
              delete copy[old.key as string];
              return { ...prev, [field]: copy };
            });
            return;
          }
          applyRow(payload.new as CategoryRow);
        }
      );
    channel.subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  }, [org, getSb, applyRow]);

  const addOfKind = React.useCallback(
    (kind: CategoryKind, label: string): string => {
      const key = toKey(label);
      const o = orgRef.current;
      // optimistic
      const field = FIELD_BY_KIND[kind];
      setData((prev) => ({ ...prev, [field]: { ...prev[field], [key]: label } }));
      if (o) {
        getSb()
          .from("categories")
          .insert({ id: crypto.randomUUID(), org_id: o.orgId, kind, key, label })
          .then(({ error }) => {
            // 23505 = unique violation → category already exists, which is fine.
            if (error && error.code !== "23505") console.error("category insert failed", error);
          });
      }
      return key;
    },
    [getSb]
  );

  const addExpenseCategory = React.useCallback((label: string) => addOfKind("expense", label), [addOfKind]);
  const addCostCode = React.useCallback((label: string) => addOfKind("cost_code", label), [addOfKind]);
  const addMaterialCategory = React.useCallback((label: string) => addOfKind("material", label), [addOfKind]);

  const value = React.useMemo<CategoryStoreValue>(
    () => ({
      customExpenseCategories: data.expenseCategories,
      customCostCodes: data.costCodes,
      customMaterialCategories: data.materialCategories,
      addExpenseCategory,
      addCostCode,
      addMaterialCategory,
    }),
    [data, addExpenseCategory, addCostCode, addMaterialCategory]
  );

  return <CategoryContext.Provider value={value}>{children}</CategoryContext.Provider>;
}

export function useCategoryStore() {
  const ctx = React.useContext(CategoryContext);
  if (!ctx) throw new Error("useCategoryStore must be used within <CategoryStoreProvider>");
  return ctx;
}
