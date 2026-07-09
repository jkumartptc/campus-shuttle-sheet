import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "staff" | "driver" | "accounts";
export type DriverType = "bus" | "car";

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

export function useDriverType(userId: string | undefined) {
  const [type, setType] = useState<DriverType | null | undefined>(undefined); // undefined = loading
  useEffect(() => {
    if (!userId) { setType(undefined); return; }
    supabase
      .from("user_roles")
      .select("driver_type")
      .eq("user_id", userId)
      .eq("role", "driver")
      .maybeSingle()
      .then(({ data }) => setType(((data as { driver_type: DriverType | null } | null)?.driver_type) ?? null));
  }, [userId]);
  return type;
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
export function landingPathForRole(role: AppRole | null, driverType?: DriverType | null): string {
  switch (role) {
    case "driver":
      return driverType === "car" ? "/maintenance" : "/attendance/scan";
    case "accounts": return "/fees";
    default: return "/dashboard";
  }
}

/** Whether a given role is allowed to access a given pathname. */
export function isPathAllowedForRole(
  pathname: string,
  role: AppRole | null,
  driverType?: DriverType | null,
): boolean {
  if (!role) return false;
  if (role === "admin" || role === "staff") return true;
  if (role === "accounts") return pathname === "/fees" || pathname.startsWith("/fees/");
  if (role === "driver") {
    const fuelOk = pathname === "/fuel-log" || pathname.startsWith("/fuel-log/");
    const vehiclesOk = pathname === "/vehicles" || pathname.startsWith("/vehicles/");
    if (driverType === "bus") {
      return (
        pathname === "/attendance" || pathname.startsWith("/attendance/") ||
        pathname === "/maintenance" || pathname.startsWith("/maintenance/") ||
        fuelOk || vehiclesOk
      );
    }
    if (driverType === "car") {
      return pathname === "/maintenance" || pathname.startsWith("/maintenance/") || fuelOk || vehiclesOk;
    }
    return false; // driver with no type set — deny until admin assigns
  }
  return false;
}
