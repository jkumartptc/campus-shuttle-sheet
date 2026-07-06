import { createFileRoute, Outlet, redirect, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser, useUserRoles, useDriverType, primaryRole, isPathAllowedForRole } from "@/lib/use-role";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const roles = useUserRoles(user?.id);
  const driverType = useDriverType(user?.id);

  const role = primaryRole(roles);
  const driverTypeLoaded = role !== "driver" || driverType !== undefined;

  useEffect(() => {
    if (!roles || !driverTypeLoaded) return;
    if (!isPathAllowedForRole(pathname, role, driverType ?? null)) {
      navigate({ to: "/access-denied", replace: true });
    }
  }, [roles, driverTypeLoaded, driverType, role, pathname, navigate]);

  const allowed = roles && driverTypeLoaded
    ? isPathAllowedForRole(pathname, role, driverType ?? null)
    : true;

  return (
    <AppShell>
      {allowed ? <Outlet /> : null}
    </AppShell>
  );
}

