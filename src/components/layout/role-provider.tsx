"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { currentUser } from "@/lib/mock/data";
import type { Role } from "@/lib/types";

interface RoleContextValue {
  loading: boolean;
  userId: string | null;
  name: string;
  email: string;
  role: Role | null;
  /** Explicit Purchase Orders grant (super admins always effectively true). */
  canViewPurchaseOrders: boolean;
}

const RoleContext = React.createContext<RoleContextValue>({
  loading: true,
  userId: null,
  name: "",
  email: "",
  role: null,
  canViewPurchaseOrders: false,
});

const supaConfigured = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

function getInitialRoleValue(): RoleContextValue {
  if (!supaConfigured) {
    return {
      loading: false,
      userId: null,
      name: currentUser.name,
      email: "",
      role: "super_admin",
      canViewPurchaseOrders: true,
    };
  }
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem("sh_cached_role");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object" && parsed.role) {
          return { ...parsed, loading: false };
        }
      }
    } catch {}
  }
  return {
    loading: true,
    userId: null,
    name: "",
    email: "",
    role: null,
    canViewPurchaseOrders: false,
  };
}

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = React.useState<RoleContextValue>(getInitialRoleValue);

  React.useEffect(() => {
    if (!supaConfigured) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        try {
          sessionStorage.removeItem("sh_cached_role");
        } catch {}
        if (!cancelled) {
          setValue({
            loading: false,
            userId: null,
            name: "",
            email: "",
            role: null,
            canViewPurchaseOrders: false,
          });
        }
        return;
      }
      const { data: m } = await supabase
        .from("memberships")
        .select("role, can_view_purchase_orders")
        .eq("user_id", user.id)
        .maybeSingle();
      const role = (m?.role as Role | undefined) ?? null;
      const meta = user.user_metadata ?? {};
      const name = (meta.name as string | undefined) || user.email?.split("@")[0] || "User";
      if (!cancelled) {
        const nextVal = {
          loading: false,
          userId: user.id,
          name,
          email: user.email ?? "",
          role,
          // super admins always see POs; others only with the explicit grant
          canViewPurchaseOrders: role === "super_admin" || Boolean(m?.can_view_purchase_orders),
        };
        setValue(nextVal);
        try {
          sessionStorage.setItem("sh_cached_role", JSON.stringify(nextVal));
        } catch {}
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return React.useContext(RoleContext);
}
