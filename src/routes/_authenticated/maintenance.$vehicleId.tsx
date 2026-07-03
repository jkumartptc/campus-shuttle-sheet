import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Wrench, Fuel, ArrowLeft, FileDown, Printer } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maintenance/$vehicleId")({
  head: () => ({ meta: [{ title: "Vehicle Details — Maintenance" }] }),
  component: VehicleDetailPage,
});

type Vehicle = {
  id: string; name: string; reg_no: string | null; category: string;
  usage: string | null; campus_only: boolean; status: string;
  last_service_date: string | null; next_service_date: string | null; next_service_km: number | null;
};

type MRecord = {
  id: string; vehicle_id: string; service_date: string; odometer: number | null;
  maintenance_type: string; description: string | null; workshop: string | null;
  invoice_no: string | null; cost: number; next_service_date: string | null;
  next_service_km: number | null; status: string;
};

type FuelLog = {
  id: string; vehicle_id: string | null; filled_on: string; indent_number: string | null;
  fuel_type: string | null; odometer: number; litres: number; rate_per_litre: number;
  total_cost: number; station: string | null; driver: string | null; filled_by: string | null;
  remarks: string | null; mileage_kmpl: number | null;
};

const FUEL_STATION = "Five Roads Fuel Service Station";
const MTYPES = ["Periodic Service","Engine","Brake","Electrical","Battery","Tyre","Suspension","AC","Body Repair","Other"];
const MSTATUSES = ["Pending","In Progress","Completed"];

const emptyM = {
  service_date: new Date().toISOString().slice(0,10),
  odometer: "", maintenance_type: "Periodic Service", description: "",
  workshop: "", invoice_no: "", cost: "", next_service_date: "", next_service_km: "", status: "Completed",
};

const emptyF = {
  filled_on: new Date().toISOString().slice(0,10),
  indent_number: "", fuel_type: "diesel",
  odometer: "", litres: "", rate_per_litre: "",
  driver: "", filled_by: "", remarks: "",
};

function statusColor(s: string) {
  if (s === "Completed") return "bg-emerald-100 text-emerald-700";
  if (s === "In Progress") return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-700";
}

function VehicleDetailPage() {
  const { vehicleId } = useParams({ from: "/_authenticated/maintenance/$vehicleId" });
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [records, setRecords] = useState<MRecord[]>([]);
  const [fuels, setFuels] = useState<FuelLog[]>([]);
  const [openM, setOpenM] = useState(false);
  const [openF, setOpenF] = useState(false);
  const [mForm, setMForm] = useState(emptyM);
  const [fForm, setFForm] = useState(emptyF);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [v, r, f] = await Promise.all([
      supabase.from("vehicle_master").select("*").eq("id", vehicleId).maybeSingle(),
      supabase.from("maintenance_records").select("*").eq("vehicle_id", vehicleId).order("service_date", { ascending: false }),
      supabase.from("fuel_logs").select("*").eq("vehicle_id", vehicleId).order("filled_on", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    setVehicle((v.data as Vehicle) ?? null);
    setRecords((r.data ?? []) as MRecord[]);
    setFuels((f.data ?? []) as FuelLog[]);
  }, [vehicleId]);
  useEffect(() => { void load(); }, [load]);

  const isDemo = vehicle?.category === "Demo Vehicle";

  const totals = useMemo(() => {
    const fuelExp = fuels.reduce((s, f) => s + Number(f.total_cost ?? 0), 0);
    const maintExp = records.reduce((s, r) => s + Number(r.cost ?? 0), 0);
    const mileages = fuels.map(f => Number(f.mileage_kmpl ?? 0)).filter(n => n > 0);
    const avgMileage = mileages.length ? mileages.reduce((a, b) => a + b, 0) / mileages.length : 0;
    const lastFuel = fuels[0];
    const currentOdo = fuels.length ? Number(fuels[0].odometer) : (records.find(r => r.odometer)?.odometer ?? 0);
    return { fuelExp, maintExp, avgMileage, lastFuel, currentOdo, running: fuelExp + maintExp };
  }, [fuels, records]);

  const saveMaintenance = async () => {
    if (!isDemo && !mForm.odometer) return toast.error("Odometer required");
    setSaving(true);
    const payload = {
      vehicle_id: vehicleId,
      service_date: mForm.service_date,
      odometer: mForm.odometer ? Number(mForm.odometer) : null,
      maintenance_type: mForm.maintenance_type,
      description: mForm.description || null,
      workshop: mForm.workshop || null,
      invoice_no: mForm.invoice_no || null,
      cost: mForm.cost ? Number(mForm.cost) : 0,
      next_service_date: mForm.next_service_date || null,
      next_service_km: mForm.next_service_km ? Number(mForm.next_service_km) : null,
      status: mForm.status,
    };
    const { error } = await supabase.from("maintenance_records").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    if (mForm.status === "Completed") {
      await supabase.from("vehicle_master").update({
        last_service_date: mForm.service_date,
        next_service_date: mForm.next_service_date || null,
        next_service_km: mForm.next_service_km ? Number(mForm.next_service_km) : null,
        status: "active",
      }).eq("id", vehicleId);
    } else if (mForm.status === "In Progress") {
      await supabase.from("vehicle_master").update({ status: "under_maintenance" }).eq("id", vehicleId);
    }
    toast.success("Maintenance record saved");
    setOpenM(false); setMForm(emptyM); void load();
  };

  const saveFuel = async () => {
    if (!fForm.indent_number.trim()) return toast.error("Indent Number is mandatory");
    const litres = Number(fForm.litres);
    const rate = Number(fForm.rate_per_litre);
    const odo = Number(fForm.odometer);
    if (!(litres > 0)) return toast.error("Fuel litres must be greater than 0");
    if (!(rate > 0)) return toast.error("Fuel rate must be greater than 0");
    if (!(odo > 0)) return toast.error("Odometer reading is required");
    const prev = fuels[0];
    if (prev && odo <= Number(prev.odometer)) {
      return toast.error(`Odometer must be greater than previous reading (${prev.odometer})`);
    }
    setSaving(true);
    const { error } = await supabase.from("fuel_logs").insert({
      vehicle_id: vehicleId,
      filled_on: fForm.filled_on,
      indent_number: fForm.indent_number.trim(),
      fuel_type: fForm.fuel_type,
      odometer: odo,
      litres,
      rate_per_litre: rate,
      total_cost: Math.round(litres * rate * 100) / 100,
      station: FUEL_STATION,
      payment_mode: "credit",
      driver: fForm.driver || null,
      filled_by: fForm.filled_by || null,
      remarks: fForm.remarks || null,
    } as never);
    setSaving(false);
    if (error) {
      if (error.message.includes("idx_fuel_logs_indent_unique") || error.code === "23505") {
        return toast.error("This Indent Number already exists");
      }
      if (error.message.includes("odometer_must_increase")) {
        return toast.error("Odometer must be greater than previous reading");
      }
      return toast.error(error.message);
    }
    toast.success("Fuel entry saved");
    setOpenF(false); setFForm(emptyF); void load();
  };

  const exportCsv = (rows: (string | number)[][], filename: string) => {
    const csv = rows.map(r => r.map(c => `"${String(c).replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  if (!vehicle) {
    return <div className="p-8 text-sm text-muted-foreground">Loading vehicle…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/maintenance"><ArrowLeft className="mr-1 h-4 w-4" /> Vehicles</Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{vehicle.name}</h1>
            <p className="text-xs text-muted-foreground">
              {isDemo ? "N/A" : (vehicle.reg_no ?? "—")} · {vehicle.category}{vehicle.usage ? ` · ${vehicle.usage}` : ""}
              {isDemo && <Badge className="ml-2 bg-amber-100 text-amber-800 hover:bg-amber-100">Campus Use Only</Badge>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenM(true)}><Wrench className="mr-2 h-4 w-4" /> Add Maintenance</Button>
          <Button onClick={() => setOpenF(true)}><Fuel className="mr-2 h-4 w-4" /> Add Fuel Entry</Button>
        </div>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Current Odometer" value={totals.currentOdo ? `${Number(totals.currentOdo).toLocaleString()} km` : "—"} />
        <Stat label="Last Service" value={fmtDate(vehicle.last_service_date)} />
        <Stat label="Next Service Due" value={fmtDate(vehicle.next_service_date)} />
        <Stat label="Last Fuel Date" value={totals.lastFuel ? fmtDate(totals.lastFuel.filled_on) : "—"} />
        <Stat label="Average Mileage" value={totals.avgMileage ? `${totals.avgMileage.toFixed(2)} km/L` : "—"} />
        <Stat label="Total Fuel Expense" value={inr(totals.fuelExp)} />
        <Stat label="Total Maintenance" value={inr(totals.maintExp)} />
        <Stat label="Total Running Cost" value={inr(totals.running)} highlight />
      </div>

      <Tabs defaultValue="maintenance">
        <TabsList>
          <TabsTrigger value="maintenance">Maintenance History</TabsTrigger>
          <TabsTrigger value="fuel">Fuel History</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="maintenance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Maintenance Records</CardTitle>
              <Button size="sm" variant="outline" onClick={() => exportCsv(
                [["Date","Type","Workshop","Cost","Invoice","Status"],
                 ...records.map(r => [fmtDate(r.service_date), r.maintenance_type, r.workshop ?? "", r.cost, r.invoice_no ?? "", r.status])],
                `${vehicle.name}-maintenance.csv`
              )}><FileDown className="mr-1 h-4 w-4" /> CSV</Button>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Type</TableHead>
                  <TableHead>Workshop</TableHead><TableHead className="text-right">Cost</TableHead>
                  <TableHead>Invoice</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">No maintenance records yet.</TableCell></TableRow>
                  ) : records.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(r.service_date)}</TableCell>
                      <TableCell>{r.maintenance_type}</TableCell>
                      <TableCell className="text-xs">{r.workshop ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(r.cost)}</TableCell>
                      <TableCell className="text-xs">{r.invoice_no ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={statusColor(r.status)}>{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fuel">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Fuel Entries</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Credit purchases from {FUEL_STATION}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => exportCsv(
                [["Date","Indent","Fuel Type","Litres","Rate","Cost","Odometer","Distance","Mileage","Driver","Filled By","Remarks"],
                 ...fuels.map((f, i) => {
                    const prev = fuels[i + 1];
                    const dist = prev ? Number(f.odometer) - Number(prev.odometer) : 0;
                    return [fmtDate(f.filled_on), f.indent_number ?? "", f.fuel_type ?? "", f.litres, f.rate_per_litre, f.total_cost, f.odometer, dist || "", f.mileage_kmpl ?? "", f.driver ?? "", f.filled_by ?? "", f.remarks ?? ""];
                 })],
                `${vehicle.name}-fuel.csv`
              )}><FileDown className="mr-1 h-4 w-4" /> CSV</Button>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Indent #</TableHead>
                  <TableHead className="text-right">Litres</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Odometer</TableHead>
                  <TableHead className="text-right">Distance</TableHead>
                  <TableHead className="text-right">Mileage</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {fuels.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No fuel entries yet.</TableCell></TableRow>
                  ) : fuels.map((f, i) => {
                    const prev = fuels[i + 1];
                    const dist = prev ? Number(f.odometer) - Number(prev.odometer) : null;
                    return (
                      <TableRow key={f.id}>
                        <TableCell className="whitespace-nowrap">{fmtDate(f.filled_on)}</TableCell>
                        <TableCell className="font-mono text-xs">{f.indent_number ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(f.litres).toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums">{inr(f.total_cost)}</TableCell>
                        <TableCell className="text-right tabular-nums">{Number(f.odometer).toLocaleString()}</TableCell>
                        <TableCell className="text-right tabular-nums">{dist ? `${dist} km` : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {f.mileage_kmpl ? `${Number(f.mileage_kmpl).toFixed(2)} km/L` :
                            <span className="text-xs text-muted-foreground">First entry</span>}
                        </TableCell>
                        <TableCell className="text-xs">{f.remarks ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="grid gap-3 md:grid-cols-2">
          <MonthlyCard title="Monthly Fuel Expense" rows={monthlyAgg(fuels.map(f => ({ date: f.filled_on, cost: Number(f.total_cost) })))} />
          <MonthlyCard title="Monthly Maintenance Expense" rows={monthlyAgg(records.map(r => ({ date: r.service_date, cost: Number(r.cost) })))} />
          <Card>
            <CardHeader><CardTitle className="text-sm">Fuel vs Maintenance</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Fuel Total" value={inr(totals.fuelExp)} />
              <Row label="Maintenance Total" value={inr(totals.maintExp)} />
              <Row label="Running Cost" value={inr(totals.running)} strong />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Mileage Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(() => {
                const m = fuels.map(f => Number(f.mileage_kmpl ?? 0)).filter(n => n > 0);
                return (
                  <>
                    <Row label="Average" value={m.length ? `${(m.reduce((a,b)=>a+b,0)/m.length).toFixed(2)} km/L` : "—"} />
                    <Row label="Highest" value={m.length ? `${Math.max(...m).toFixed(2)} km/L` : "—"} />
                    <Row label="Lowest" value={m.length ? `${Math.min(...m).toFixed(2)} km/L` : "—"} />
                    <Row label="Total Litres" value={`${fuels.reduce((s,f)=>s+Number(f.litres),0).toFixed(2)} L`} />
                  </>
                );
              })()}
            </CardContent>
          </Card>
          <div className="md:col-span-2 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" /> Print / PDF</Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Maintenance dialog */}
      <Dialog open={openM} onOpenChange={setOpenM}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Add Maintenance — {vehicle.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Date *</Label><Input type="date" value={mForm.service_date} onChange={e => setMForm({ ...mForm, service_date: e.target.value })} /></div>
            <div className="space-y-1"><Label>Odometer (km){isDemo ? "" : " *"}</Label><Input type="number" value={mForm.odometer} onChange={e => setMForm({ ...mForm, odometer: e.target.value })} /></div>
            <div className="space-y-1"><Label>Maintenance Type</Label>
              <Select value={mForm.maintenance_type} onValueChange={v => setMForm({ ...mForm, maintenance_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MTYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Status</Label>
              <Select value={mForm.status} onValueChange={v => setMForm({ ...mForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MSTATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Workshop</Label><Input value={mForm.workshop} onChange={e => setMForm({ ...mForm, workshop: e.target.value })} /></div>
            <div className="space-y-1"><Label>Invoice No</Label><Input value={mForm.invoice_no} onChange={e => setMForm({ ...mForm, invoice_no: e.target.value })} /></div>
            <div className="space-y-1"><Label>Cost (₹)</Label><Input type="number" value={mForm.cost} onChange={e => setMForm({ ...mForm, cost: e.target.value })} /></div>
            <div className="space-y-1"><Label>Next Service Date</Label><Input type="date" value={mForm.next_service_date} onChange={e => setMForm({ ...mForm, next_service_date: e.target.value })} /></div>
            <div className="space-y-1"><Label>Next Service KM</Label><Input type="number" value={mForm.next_service_km} onChange={e => setMForm({ ...mForm, next_service_km: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Description</Label><Textarea rows={2} value={mForm.description} onChange={e => setMForm({ ...mForm, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenM(false)}>Cancel</Button>
            <Button onClick={saveMaintenance} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fuel dialog */}
      <Dialog open={openF} onOpenChange={setOpenF}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Fuel Entry — {vehicle.name}</DialogTitle>
            <p className="text-xs text-muted-foreground pt-1">Fuel supplied on credit against Indent by {FUEL_STATION}</p>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>Fuel Date *</Label><Input type="date" value={fForm.filled_on} onChange={e => setFForm({ ...fForm, filled_on: e.target.value })} /></div>
            <div className="space-y-1"><Label>Indent Number *</Label><Input value={fForm.indent_number} onChange={e => setFForm({ ...fForm, indent_number: e.target.value })} placeholder="Unique indent ref" /></div>
            <div className="space-y-1"><Label>Fuel Type</Label>
              <Select value={fForm.fuel_type} onValueChange={v => setFForm({ ...fForm, fuel_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="petrol">Petrol</SelectItem><SelectItem value="diesel">Diesel</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Odometer (km) *</Label><Input type="number" value={fForm.odometer} onChange={e => setFForm({ ...fForm, odometer: e.target.value })} /></div>
            <div className="space-y-1"><Label>Fuel Quantity (L) *</Label><Input type="number" step="0.01" value={fForm.litres} onChange={e => setFForm({ ...fForm, litres: e.target.value })} /></div>
            <div className="space-y-1"><Label>Rate per Litre (₹) *</Label><Input type="number" step="0.01" value={fForm.rate_per_litre} onChange={e => setFForm({ ...fForm, rate_per_litre: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Total Amount</Label>
              <Input readOnly value={fForm.litres && fForm.rate_per_litre ? inr(Number(fForm.litres) * Number(fForm.rate_per_litre)) : ""} />
            </div>
            <div className="space-y-1"><Label>Driver</Label><Input value={fForm.driver} onChange={e => setFForm({ ...fForm, driver: e.target.value })} /></div>
            <div className="space-y-1"><Label>Filled By</Label><Input value={fForm.filled_by} onChange={e => setFForm({ ...fForm, filled_by: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Remarks</Label><Textarea rows={2} value={fForm.remarks} onChange={e => setFForm({ ...fForm, remarks: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenF(false)}>Cancel</Button>
            <Button onClick={saveFuel} disabled={saving}>{saving ? "Saving…" : "Save Entry"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary" : undefined}>
      <CardContent className="p-3">
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className={`mt-1 text-lg font-bold tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${strong ? "font-semibold text-primary" : "font-medium"}`}>{value}</span>
    </div>
  );
}

function monthlyAgg(rows: { date: string; cost: number }[]) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = r.date.slice(0, 7);
    m.set(k, (m.get(k) ?? 0) + Number(r.cost || 0));
  }
  return Array.from(m.entries()).sort(([a], [b]) => b.localeCompare(a)).slice(0, 12);
}

function MonthlyCard({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : rows.map(([m, v]) => (
          <div key={m}>
            <div className="flex justify-between text-xs mb-1">
              <span>{new Date(m + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
              <span className="tabular-nums">{inr(v)}</span>
            </div>
            <div className="h-2 rounded bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
