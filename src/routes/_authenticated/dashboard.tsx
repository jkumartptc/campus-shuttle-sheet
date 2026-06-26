import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inr, fmtDate } from "@/lib/format";
import { Users, Wallet, AlertCircle, Bus, Fuel, Gauge } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Transport Admin" }] }),
  component: Dashboard,
});

interface Stats {
  students: number;
  totalFee: number;
  collected: number;
  pending: number;
  perRoute: { name: string; count: number }[];
  fuelMonth: number;
  avgMileage: number | null;
  recentPayments: { id: string; amount: number; paid_on: string; receipt_no: string; student_name: string }[];
  recentFuel: { id: string; filled_on: string; litres: number; total_cost: number; bus_no: string }[];
}

function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = async () => {
      const [studentsRes, paymentsRes, fuelRes, busesRes] = await Promise.all([
        supabase.from("students").select("id, total_fee, stop_id, stops(route_id, routes(name))"),
        supabase.from("payments").select("id, amount, paid_on, receipt_no, students(name)").order("paid_on", { ascending: false }).limit(5),
        supabase.from("fuel_logs").select("id, filled_on, litres, total_cost, mileage_kmpl, buses(bus_no)").order("filled_on", { ascending: false }).limit(20),
        supabase.from("buses").select("id"),
      ]);

      const students = studentsRes.data ?? [];
      const totalFee = students.reduce((s, r: any) => s + Number(r.total_fee || 0), 0);

      const allPaymentsRes = await supabase.from("payments").select("amount");
      const collected = (allPaymentsRes.data ?? []).reduce((s, r: any) => s + Number(r.amount || 0), 0);

      // students per route
      const routeMap = new Map<string, number>();
      for (const s of students as any[]) {
        const rn = s.stops?.routes?.name ?? "Unassigned";
        routeMap.set(rn, (routeMap.get(rn) ?? 0) + 1);
      }

      // fuel this month
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const fuel = (fuelRes.data ?? []) as any[];
      const fuelMonth = fuel
        .filter((f) => new Date(f.filled_on) >= monthStart)
        .reduce((s, r) => s + Number(r.total_cost || 0), 0);
      const mileages = fuel.map((f) => Number(f.mileage_kmpl)).filter((n) => n > 0);
      const avgMileage = mileages.length ? mileages.reduce((a, b) => a + b, 0) / mileages.length : null;

      setStats({
        students: students.length,
        totalFee,
        collected,
        pending: totalFee - collected,
        perRoute: Array.from(routeMap.entries()).map(([name, count]) => ({ name, count })),
        fuelMonth,
        avgMileage,
        recentPayments: (paymentsRes.data ?? []).map((p: any) => ({
          id: p.id, amount: p.amount, paid_on: p.paid_on, receipt_no: p.receipt_no,
          student_name: p.students?.name ?? "—",
        })),
        recentFuel: fuel.slice(0, 5).map((f) => ({
          id: f.id, filled_on: f.filled_on, litres: f.litres, total_cost: f.total_cost,
          bus_no: f.buses?.bus_no ?? "—",
        })),
      });
      void busesRes;
    };
    load();
  }, []);

  if (!stats) return <div className="text-muted-foreground">Loading…</div>;

  const cards = [
    { label: "Transport Students", value: stats.students.toString(), icon: Users, color: "text-blue-600" },
    { label: "Total Expected", value: inr(stats.totalFee), icon: Wallet, color: "text-emerald-600" },
    { label: "Collected", value: inr(stats.collected), icon: Wallet, color: "text-emerald-600" },
    { label: "Pending Balance", value: inr(stats.pending), icon: AlertCircle, color: "text-amber-600" },
    { label: "Diesel This Month", value: inr(stats.fuelMonth), icon: Fuel, color: "text-rose-600" },
    { label: "Avg Mileage", value: stats.avgMileage ? `${stats.avgMileage.toFixed(2)} km/L` : "—", icon: Gauge, color: "text-indigo-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of students, fees, and bus operations.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardContent className="p-4">
                <Icon className={`mb-2 h-5 w-5 ${c.color}`} />
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="text-lg font-semibold">{c.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Students per route</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.perRoute.length === 0 && <p className="text-sm text-muted-foreground">No routes yet. <Link to="/routes" className="underline">Add one</Link></p>}
            {stats.perRoute.map((r) => (
              <div key={r.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{r.name}</span><span className="text-muted-foreground">{r.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, (r.count / Math.max(...stats.perRoute.map((x) => x.count))) * 100)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Recent payments</CardTitle></CardHeader>
          <CardContent>
            {stats.recentPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {stats.recentPayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">{p.student_name}</div>
                      <div className="text-xs text-muted-foreground">{p.receipt_no} · {fmtDate(p.paid_on)}</div>
                    </div>
                    <div className="font-semibold">{inr(p.amount)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Recent fuel fills</CardTitle></CardHeader>
          <CardContent>
            {stats.recentFuel.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fuel entries yet. <Link to="/buses" className="underline">Add a bus</Link></p>
            ) : (
              <ul className="divide-y text-sm">
                {stats.recentFuel.map((f) => (
                  <li key={f.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <Bus className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{f.bus_no}</div>
                        <div className="text-xs text-muted-foreground">{fmtDate(f.filled_on)} · {f.litres}L</div>
                      </div>
                    </div>
                    <div className="font-semibold">{inr(f.total_cost)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
