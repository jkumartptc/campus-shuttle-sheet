import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "staff" | "driver" | "accounts";

export function useCurrentUser() {
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email ?? null } : null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? null } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, loading };
}

export function useIsAdmin(userId: string | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!userId) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [userId]);
  return isAdmin;
}

export function useUserRoles(userId: string | undefined) {
  const [roles, setRoles] = useState<AppRole[] | null>(null);
  useEffect(() => {
    if (!userId) { setRoles(null); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data }) => setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role)));
  }, [userId]);
  return roles;
}

/** Returns the highest-privilege role for the user. */
export function primaryRole(roles: AppRole[] | null | undefined): AppRole | null {
  if (!roles || roles.length === 0) return null;
  if (roles.includes("admin")) return "admin";
  if (roles.includes("staff")) return "staff";
  if (roles.includes("accounts")) return "accounts";
  if (roles.includes("driver")) return "driver";
  return roles[0];
}

/** Default landing path for a role after sign-in. */
export function landingPathForRole(role: AppRole | null): string {
  switch (role) {
    case "driver": return "/attendance/scan";
    case "accounts": return "/fees";
    default: return "/dashboard";
  }
}

/** Whether a given role is allowed to access a given pathname. */
export function isPathAllowedForRole(pathname: string, role: AppRole | null): boolean {
  if (!role) return false;
  if (role === "admin" || role === "staff") return true;
  if (role === "driver") return pathname === "/attendance" || pathname.startsWith("/attendance/");
  if (role === "accounts") return pathname === "/fees" || pathname.startsWith("/fees/");
  return false;
}
