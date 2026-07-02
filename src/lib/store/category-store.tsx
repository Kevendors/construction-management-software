"use client";

import * as React from "react";

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

export function CategoryStoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState<CategoryData>(EMPTY);

  React.useEffect(() => {
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

export function useCategoryStore() {
  const ctx = React.useContext(CategoryContext);
  if (!ctx) throw new Error("useCategoryStore must be used within <CategoryStoreProvider>");
  return ctx;
}
