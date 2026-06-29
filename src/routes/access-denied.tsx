import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/access-denied")({
  head: () => ({ meta: [{ title: "Access Denied — Transport Admin" }] }),
  ssr: false,
  component: AccessDeniedPage,
});

function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="mt-4 text-xl font-bold">Access Denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don&apos;t have permission to view this page. Please contact an administrator if you believe this is a mistake.
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
