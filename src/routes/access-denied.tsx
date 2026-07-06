import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useCurrentUser, useUserRoles, useDriverType, primaryRole } from "@/lib/use-role";

export const Route = createFileRoute("/access-denied")({
  head: () => ({ meta: [{ title: "Access Denied — Transport Admin" }] }),
  ssr: false,
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  const { user } = useCurrentUser();
  const roles = useUserRoles(user?.id);
  const driverType = useDriverType(user?.id);
  const role = primaryRole(roles);
  const driverNoType = role === "driver" && driverType === null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-xl font-bold">Access Denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {driverNoType
            ? "Your driver type isn't set yet. Ask an admin to mark you as a Bus or Car driver on the Staff page."
            : "You don't have permission to view this page. Please contact an administrator if you believe this is a mistake."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="default">
            <Link to="/dashboard">Go home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/auth">Sign in as different user</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

