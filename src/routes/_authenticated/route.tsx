import { createFileRoute, Outlet, redirect, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useCurrentUser, useUserRoles, primaryRole, isPathAllowedForRole } from "@/lib/use-role";

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

  useEffect(() => {
    if (!roles) return; // wait until roles are loaded
    const role = primaryRole(roles);
    if (!isPathAllowedForRole(pathname, role)) {
      navigate({ to: "/access-denied", replace: true });
    }
  }, [roles, pathname, navigate]);

  const role = roles ? primaryRole(roles) : null;
  const allowed = roles ? isPathAllowedForRole(pathname, role) : true;

  return (
    <AppShell>
      {roles && allowed ? <Outlet /> : roles ? null : <Outlet />}
    </AppShell>
  );
}
