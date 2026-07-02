"use client";

import { useAuth } from "@/lib/auth/auth-context";
import type { AppRole } from "@/lib/auth/roles";

interface RoleGateProps {
  allow: AppRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/** Renders children only if the current user's role is in the allow list. */
export function RoleGate({ allow, children, fallback = null }: RoleGateProps) {
  const { role } = useAuth();
  if (!allow.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
