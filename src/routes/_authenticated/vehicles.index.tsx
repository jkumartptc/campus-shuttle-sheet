import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bus as BusIcon, Car, Gauge, Fuel as FuelIcon, Wrench, ShieldAlert } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import { useCurrentUser, useDriverType } from "@/lib/use-role";

export const Route = createFileRoute("/_authenticated/vehicles/")({
  head: () => ({ meta: [{ title: "Fleet — Vehicles" }] }),
  component: VehiclesIndex,
});

type Dash = {
  id: string; name: string; reg_no: string | null; category: string; status: string;
  current_odo: number | null; last_odo_at: string | null;
  last_fuel_date: string | null; last_fuel_odo: number | null;
  km_since_last_fuel: number | null;
  avg_mileage_kmpl: number | null;
  month_litres: number | null; month_cost: number | null;
  next_service_item: string | null; next_service_due: string | null;
  insurance_expiry: string | null; fc_expiry: string | null;
  permit_expiry: string | null; puc_expiry: string | null;
};

function daysUntil(d: string | null) {
  if (!d) return null;
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return diff;
}

function ExpiryBadge({ label, date }: { label: string; date: string | null }) {
  const d = daysUntil(date);
  if (d === null) return <div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span>—</span></div>;
  const cls = d < 0 ? "text-rose-600" : d <= 30 ? "text-amber-600" : "text-emerald-600";
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cls}>{fmtDate(date)}{d <= 30 && ` (${d}d)`}</span>
    </div>
  );
}

function VehiclesIndex() {
  const { user } = useCurrentUser();
  const driverType = useDriverType(user?.id);
  const [items, setItems] = useState<Dash[]>([]);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data } = await supabase.from("vehicle_dashboard").select("*").order("category").order("name");
    let rows = (data ?? []) as unknown as Dash[];
    if (driverType === "bus") rows = rows.filter((r) => r.category === "Bus");
    else if (driverType === "car") rows = rows.filter((r) => r.category !== "Bus");
    setItems(rows);
  }, [driverType]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((v) => v.name.toLowerCase().includes(term) || (v.reg_no ?? "").toLowerCase().includes(term));
  }, [items, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fleet</h1>
          <p className="text-sm text-muted-foreground">{items.length} vehicles · pick one to open its unified dashboard</p>
        </div>
        <Input placeholder="Search name or registration…" className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((v) => {
          const Icon = v.category === "Bus" ? BusIcon : Car;
          return (
            <Link
              key={v.id}
              to="/vehicles/$id"
              params={{ id: v.id }}
              className="group"
            >
              <Card className="transition hover:border-primary hover:shadow-md">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{v.name}</div>
                      <div className="text-xs text-muted-foreground">{v.reg_no ?? "—"} · {v.category}</div>
                    </div>
                    <Badge variant="outline" className={v.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}>
                      {v.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded bg-muted/40 p-2">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><Gauge className="h-3 w-3" />Odometer</div>
                      <div className="text-sm font-bold">{v.current_odo ? `${Number(v.current_odo).toLocaleString("en-IN")} km` : "—"}</div>
                    </div>
                    <div className="rounded bg-muted/40 p-2">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><FuelIcon className="h-3 w-3" />Mileage</div>
                      <div className="text-sm font-bold">{v.avg_mileage_kmpl ? `${v.avg_mileage_kmpl} kmpl` : "—"}</div>
                    </div>
                    <div className="rounded bg-muted/40 p-2">
                      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground"><Wrench className="h-3 w-3" />Month cost</div>
                      <div className="text-sm font-bold">{inr(v.month_cost ?? 0)}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <ExpiryBadge label="Insurance" date={v.insurance_expiry} />
                    <ExpiryBadge label="FC" date={v.fc_expiry} />
                    <ExpiryBadge label="Permit" date={v.permit_expiry} />
                    <ExpiryBadge label="PUC" date={v.puc_expiry} />
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><ShieldAlert className="h-3 w-3" />Next service</span>
                      <span>{v.next_service_item ? `${v.next_service_item} · ${fmtDate(v.next_service_due)}` : "—"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            No vehicles match your search.
          </div>
        )}
      </div>
    </div>
  );
}
