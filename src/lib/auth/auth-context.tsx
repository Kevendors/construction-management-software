"use client";

import * as React from "react";
import { type AppRole, PERMISSIONS, type RolePermissions } from "./roles";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  role: AppRole;
  permissions: RolePermissions;
  setRole: (role: AppRole) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

const LS_KEY = "sitehub:auth:role";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = React.useState<AppRole>("admin");

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(LS_KEY) as AppRole | null;
      if (stored && stored in PERMISSIONS) {
        setRoleState(stored);
      }
    } catch { /* ignore */ }
  }, []);

  const setRole = React.useCallback((newRole: AppRole) => {
    setRoleState(newRole);
    try {
      localStorage.setItem(LS_KEY, newRole);
    } catch { /* ignore */ }
  }, []);

  const value = React.useMemo<AuthContextValue>(() => ({
    user: { id: "u1", email: "admin@keyvendors.com", name: "Admin", role },
    role,
    permissions: PERMISSIONS[role],
    setRole,
  }), [role, setRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function usePermission(key: keyof RolePermissions) {
  const { permissions } = useAuth();
  return permissions[key];
}
