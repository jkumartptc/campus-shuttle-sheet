import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ScanLine, ClipboardEdit, FileBarChart, LayoutDashboard } from "lucide-react";
import { getPending, flushPending } from "@/lib/attendance-offline";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Bus Attendance — Transport Admin" }] }),
  component: AttendancePage,
});

type Stats = {
  morning: number;
  evening: number;
  lastScan: string | null;
  onBoard: number;
  absent: number;
};

function todayKolkata() {
  const tz = new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
  return tz; // YYYY-MM-DD
}

function AttendancePage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isIndex = pathname === "/attendance";
  const [stats, setStats] = useState<Stats>({ morning: 0, evening: 0, lastScan: null, onBoard: 0, absent: 0 });
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const load = async () => {
    const today = todayKolkata();
    const { data: att } = await supabase
      .from("attendance")
      .select("trip, attendance_time")
      .eq("attendance_date", today);
    const morning = (att ?? []).filter((a) => a.trip === "morning").length;
    const evening = (att ?? []).filter((a) => a.trip === "evening").length;
    const lastScan = (att ?? []).reduce<string | null>((m, a) => (!m || a.attendance_time > m ? a.attendance_time : m), null);
    const hour = new Date().getHours();
    const currentTrip = hour < 12 ? "morning" : "evening";
    const onBoard = (att ?? []).filter((a) => a.trip === currentTrip).length;
    const { count: totalActive } = await supabase.from("students").select("id", { count: "exact", head: true });
    const absent = Math.max(0, (totalActive ?? 0) - onBoard);
    setStats({ morning, evening, lastScan, onBoard, absent });
    setPending(getPending().length);
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 15000);
    const onOnline = async () => { setOnline(true); const r = await flushPending(); if (r.flushed) load(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { clearInterval(i); window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bus Attendance</h1>
          <p className="text-sm text-muted-foreground">QR scanning and trip-wise attendance reports.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={online ? "default" : "destructive"}>{online ? "Online" : "Offline"}</Badge>
          {pending > 0 && <Badge variant="secondary">Sync pending: {pending}</Badge>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b">
        <Tab to="/attendance" active={pathname === "/attendance"} icon={LayoutDashboard} label="Overview" />
        <Tab to="/attendance/scan" active={pathname.startsWith("/attendance/scan")} icon={ScanLine} label="Scan QR" />
        <Tab to="/attendance/manual" active={pathname.startsWith("/attendance/manual")} icon={ClipboardEdit} label="Manual" />
        <Tab to="/attendance/reports" active={pathname.startsWith("/attendance/reports")} icon={FileBarChart} label="Reports" />
      </div>

      {isIndex ? (
        <div className="grid gap-4 md:grid-cols-5">
          <Stat label="Today's Morning" value={stats.morning} />
          <Stat label="Today's Evening" value={stats.evening} />
          <Stat label="Students on Board" value={stats.onBoard} hint="(current trip)" />
          <Stat label="Absent Students" value={stats.absent} />
          <Stat label="Last Scan" value={stats.lastScan ? new Date(stats.lastScan).toLocaleTimeString() : "—"} />
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  );
}

function Tab({ to, active, icon: Icon, label }: { to: string; active: boolean; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px",
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </Link>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label} {hint && <span className="opacity-70">{hint}</span>}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
