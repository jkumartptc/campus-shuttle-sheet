import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  MapPin,
  Bus,
  ShieldCheck,
  LogOut,
  Menu,
  Inbox,
  Receipt,
  ScanLine,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrentUser, useUserRoles } from "@/lib/use-role";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, admin: false },
  { to: "/students", label: "Students", icon: Users, admin: false },
  { to: "/fees", label: "Fees Collection", icon: Receipt, admin: false },
  { to: "/requests", label: "Requests", icon: Inbox, admin: false },
  { to: "/routes", label: "Routes & Stops", icon: MapPin, admin: false },
  { to: "/buses", label: "Buses", icon: Bus, admin: false },
  { to: "/staff", label: "Staff", icon: ShieldCheck, admin: false },
  { to: "/attendance", label: "Bus Attendance", icon: ScanLine, admin: false },
] as const;

const driverNav = [
  { to: "/attendance/scan", label: "Scan QR", icon: ScanLine },
  { to: "/attendance", label: "Today's Attendance", icon: LayoutDashboard },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { user } = useCurrentUser();
  const roles = useUserRoles(user?.id);
  const isDriverOnly = !!roles && roles.length > 0 && roles.every((r) => r === "driver");
  const items = isDriverOnly ? driverNav : nav;

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const NavItems = () => (
    <>
      {items.map((n) => {
        const Icon = n.icon;
        const active = pathname === n.to || pathname.startsWith(n.to + "/");
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="border-b px-5 py-4">
          <div className="flex items-center gap-2">
            <Bus className="h-5 w-5 text-primary" />
            <span className="font-semibold">Transport Admin</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavItems />
        </nav>
        <div className="border-t p-3">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <Bus className="h-5 w-5 text-primary" />
            <span className="font-semibold">Transport</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen((v) => !v)}>
            <Menu className="h-5 w-5" />
          </Button>
        </header>
        {open && (
          <nav className="space-y-1 border-b bg-card p-3 md:hidden">
            <NavItems />
            <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </nav>
        )}

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
