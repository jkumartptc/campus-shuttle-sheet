import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, X, BellRing } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useUserRoles, useDriverType } from "@/lib/use-role";

const DEADLINE_HOUR = 10;
const CHECK_MS = 60_000;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function DriverOdoReminder() {
  const { user } = useCurrentUser();
  const roles = useUserRoles(user?.id);
  const driverType = useDriverType(user?.id);
  const isDriver = !!roles && roles.includes("driver");

  const [needsEntry, setNeedsEntry] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), CHECK_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isDriver || !driverType) return;
    let cancelled = false;

    async function check() {
      const { data: vs } = await supabase.from("vehicle_master").select("id,category");
      let vehicles = (vs ?? []) as { id: string; category: string }[];
      if (driverType === "bus") vehicles = vehicles.filter((v) => v.category === "Bus");
      else if (driverType === "car") vehicles = vehicles.filter((v) => v.category !== "Bus");
      const ids = vehicles.map((v) => v.id);
      if (ids.length === 0) { if (!cancelled) setNeedsEntry(false); return; }
      const { count } = await supabase
        .from("fuel_logs")
        .select("id", { count: "exact", head: true })
        .in("vehicle_id", ids)
        .eq("filled_on", todayKey());
      if (!cancelled) setNeedsEntry((count ?? 0) === 0);
    }

    check();
    const t = setInterval(check, 5 * 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [isDriver, driverType, now.toDateString()]);

  // Fire a browser notification once per day (before deadline) when a log is still missing.
  useEffect(() => {
    if (!isDriver || !needsEntry) return;
    if (now.getHours() >= DEADLINE_HOUR) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const key = `odo-notify-${todayKey()}`;
    if (localStorage.getItem(key)) return;

    const fire = () => {
      if (Notification.permission !== "granted") return;
      try {
        new Notification("Daily odometer reminder", {
          body: `Please record today's odometer reading before ${DEADLINE_HOUR}:00 AM.`,
          tag: "odo-reminder",
        });
        localStorage.setItem(key, "1");
      } catch { /* ignore */ }
    };

    if (Notification.permission === "granted") fire();
    else if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => { if (p === "granted") fire(); });
    }
  }, [isDriver, needsEntry, now]);

  if (!isDriver || !needsEntry || dismissed) return null;

  const overdue = now.getHours() >= DEADLINE_HOUR;
  const canAskPerm =
    typeof window !== "undefined" &&
    "Notification" in window &&
    Notification.permission === "default";

  return (
    <div
      className={
        "flex items-center gap-3 border-b px-4 py-2 text-sm md:px-6 " +
        (overdue
          ? "bg-rose-50 text-rose-900 border-rose-200"
          : "bg-amber-50 text-amber-900 border-amber-200")
      }
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <div className="flex-1">
        <span className="font-medium">
          {overdue ? "Odometer log overdue" : `Odometer log due before ${DEADLINE_HOUR}:00 AM`}
        </span>
        <span className="ml-1 text-xs opacity-80">
          No reading recorded today for your {driverType === "bus" ? "bus" : "vehicle"}.
        </span>
      </div>
      <Button asChild size="sm" variant={overdue ? "destructive" : "default"}>
        <Link to="/fuel-log">Log now</Link>
      </Button>
      {canAskPerm && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => Notification.requestPermission()}
        >
          <BellRing className="mr-1 h-3 w-3" /> Enable reminders
        </Button>
      )}
      <Button size="icon" variant="ghost" onClick={() => setDismissed(true)}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
