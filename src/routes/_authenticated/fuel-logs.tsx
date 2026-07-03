import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Fuel, FileDown, Gauge } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/fuel-logs")({
  head: () => ({ meta: [{ title: "Fuel & Mileage — Transport Admin" }] }),
  component: FuelLogsPage,
});

type Vehicle = {
  id: string;
  name: string;
  reg_no: string | null;
  category: string;
  campus_only: boolean;
};

type FuelLog = {
  id: string;
  vehicle_id: string | null;
  bus_id: string | null;
  filled_on: string;
  odometer: number;
  litres: number;
  rate_per_litre: number;
  total_cost: number;
  station: string | null;
  payment_mode: string | null;
  filled_by: string | null;
  remarks: string | null;
  mileage_kmpl: number | null;
  created_at: string;
};

const emptyForm = {
  vehicle_id: "",
  filled_on: new Date().toISOString().slice(0, 10),
  odometer: "",
  litres: "",
  rate_per_litre: "",
  station: "",
  payment_mode: "cash",
  filled_by: "",
  remarks: "",
};

function FuelLogsPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [vehicleFilter, setVehicleFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: vs }, { data: ls }] = await Promise.all([
      supabase.from("vehicle_master").select("id,name,reg_no,category,campus_only").order("name"),
      supabase.from("fuel_logs").select("*").order("filled_on", { ascending: false }).order("created_at", { ascending: false }).limit(500),
    ]);
    setVehicles((vs ?? []) as Vehicle[]);
    setLogs((ls ?? []) as FuelLog[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const vehicleById = useMemo(() => {
    const m = new Map<string, Vehicle>();
    for (const v of vehicles) m.set(v.id, v);
    return m;
  }, [vehicles]);

  const filteredLogs = useMemo(
    () => (vehicleFilter === "all" ? logs : logs.filter((l) => l.vehicle_id === vehicleFilter)),
    [logs, vehicleFilter]
  );

  // Dashboard metrics
  const metrics = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let monthExpense = 0;
    let totalLitres = 0;
    const mileages: number[] = [];
    for (const l of logs) {
      totalLitres += Number(l.litres || 0);
      if (l.filled_on.startsWith(monthKey)) monthExpense += Number(l.total_cost || 0);
      if (l.mileage_kmpl) mileages.push(Number(l.mileage_kmpl));
    }
    const avgMileage = mileages.length ? mileages.reduce((a, b) => a + b, 0) / mileages.length : 0;
    const last = logs[0];
    return { monthExpense, totalLitres, avgMileage, last };
  }, [logs]);

  const submit = async () => {
    if (!form.vehicle_id) return toast.error("Select a vehicle");
    const litres = Number(form.litres);
    const rate = Number(form.rate_per_litre);
    const odo = Number(form.odometer);
    if (!(litres > 0)) return toast.error("Fuel litres must be greater than 0");
    if (!(rate > 0)) return toast.error("Fuel rate must be greater than 0");
    if (!(odo > 0)) return toast.error("Odometer reading is required");

    // Client-side odometer check
    const prev = logs.find((l) => l.vehicle_id === form.vehicle_id);
    if (prev && odo <= Number(prev.odometer)) {
      return toast.error(`Odometer must be greater than previous reading (${prev.odometer})`);
    }

    setSaving(true);
    const { error } = await supabase.from("fuel_logs").insert({
      vehicle_id: form.vehicle_id,
      filled_on: form.filled_on,
      odometer: odo,
      litres,
      rate_per_litre: rate,
      total_cost: Math.round(litres * rate * 100) / 100,
      station: form.station || null,
      payment_mode: form.payment_mode,
      remarks: form.remarks ? `${form.filled_by ? `Filled by: ${form.filled_by}. ` : ""}${form.remarks}` : (form.filled_by ? `Filled by: ${form.filled_by}` : null),
      // filled_by is stored in a dedicated column too
      filled_by: form.filled_by || null,
    } as never);
    setSaving(false);
    if (error) {
      toast.error(error.message.includes("odometer_must_increase") ? "Odometer must be greater than previous reading" : error.message);
      return;
    }
    toast.success("Fuel entry saved");
    setForm(emptyForm);
    setOpen(false);
    void load();
  };

  // Reports
  const perVehicle = useMemo(() => {
    const map = new Map<string, { name: string; reg: string; litres: number; cost: number; mileages: number[] }>();
    for (const v of vehicles) map.set(v.id, { name: v.name, reg: v.reg_no ?? "N/A", litres: 0, cost: 0, mileages: [] });
    for (const l of logs) {
      if (!l.vehicle_id) continue;
      const e = map.get(l.vehicle_id);
      if (!e) continue;
      e.litres += Number(l.litres || 0);
      e.cost += Number(l.total_cost || 0);
      if (l.mileage_kmpl) e.mileages.push(Number(l.mileage_kmpl));
    }
    return Array.from(map.entries()).map(([id, v]) => ({
      id,
      ...v,
      avg: v.mileages.length ? v.mileages.reduce((a, b) => a + b, 0) / v.mileages.length : 0,
      high: v.mileages.length ? Math.max(...v.mileages) : 0,
      low: v.mileages.length ? Math.min(...v.mileages) : 0,
    }));
  }, [logs, vehicles]);

  const perMonth = useMemo(() => {
    const map = new Map<string, { litres: number; cost: number }>();
    for (const l of logs) {
      const k = l.filled_on.slice(0, 7);
      const e = map.get(k) ?? { litres: 0, cost: 0 };
      e.litres += Number(l.litres || 0);
      e.cost += Number(l.total_cost || 0);
      map.set(k, e);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [logs]);

  const exportCsv = (rows: (string | number)[][], filename: string) => {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Simple bar chart for mileage per vehicle
  const maxMileage = Math.max(1, ...perVehicle.map((v) => v.avg));
  const maxMonthCost = Math.max(1, ...perMonth.map(([, v]) => v.cost));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Fuel className="h-6 w-6" /> Fuel & Mileage</h1>
          <p className="text-sm text-muted-foreground">Track fuel entries and mileage for all vehicles.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Add Fuel Entry</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Fuel Entry</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Vehicle</Label>
                <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} {v.reg_no ? `— ${v.reg_no}` : "(Campus)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fuel Date</Label>
                <Input type="date" value={form.filled_on} onChange={(e) => setForm({ ...form, filled_on: e.target.value })} />
              </div>
              <div>
                <Label>Odometer (km)</Label>
                <Input type="number" min="0" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} />
              </div>
              <div>
                <Label>Fuel Quantity (L)</Label>
                <Input type="number" min="0" step="0.01" value={form.litres} onChange={(e) => setForm({ ...form, litres: e.target.value })} />
              </div>
              <div>
                <Label>Rate per Litre (₹)</Label>
                <Input type="number" min="0" step="0.01" value={form.rate_per_litre} onChange={(e) => setForm({ ...form, rate_per_litre: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Total Amount</Label>
                <Input readOnly value={form.litres && form.rate_per_litre ? inr(Number(form.litres) * Number(form.rate_per_litre)) : ""} />
              </div>
              <div>
                <Label>Fuel Station</Label>
                <Input value={form.station} onChange={(e) => setForm({ ...form, station: e.target.value })} />
              </div>
              <div>
                <Label>Payment Mode</Label>
                <Select value={form.payment_mode} onValueChange={(v) => setForm({ ...form, payment_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Filled By</Label>
                <Input value={form.filled_by} onChange={(e) => setForm({ ...form, filled_by: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Remarks</Label>
                <Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save Entry"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Fuel Expense (This Month)</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{inr(metrics.monthExpense)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Total Fuel Consumed</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{metrics.totalLitres.toFixed(2)} L</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Avg Fleet Mileage</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{metrics.avgMileage ? `${metrics.avgMileage.toFixed(2)} km/L` : "—"}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Last Fuel Entry</CardTitle></CardHeader><CardContent>
          {metrics.last ? (
            <div className="text-sm">
              <div className="font-semibold">{vehicleById.get(metrics.last.vehicle_id ?? "")?.name ?? "—"}</div>
              <div className="text-xs text-muted-foreground">{fmtDate(metrics.last.filled_on)} · {metrics.last.litres}L · {inr(metrics.last.total_cost)}</div>
            </div>
          ) : <div className="text-sm text-muted-foreground">No entries</div>}
        </CardContent></Card>
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Fuel History</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Filter:</Label>
            <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
              <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="text-right">Odometer</TableHead>
                    <TableHead className="text-right">Litres</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Mileage</TableHead>
                    <TableHead>Station</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No fuel entries yet.</TableCell></TableRow>
                  ) : filteredLogs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{fmtDate(l.filled_on)}</TableCell>
                      <TableCell>{vehicleById.get(l.vehicle_id ?? "")?.name ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(l.odometer).toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(l.litres).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{inr(l.total_cost)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {l.mileage_kmpl ? `${Number(l.mileage_kmpl).toFixed(2)} km/L` : <span className="text-xs text-muted-foreground">Insufficient data</span>}
                      </TableCell>
                      <TableCell className="text-xs">{l.station ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="uppercase text-[10px]">{l.payment_mode ?? "—"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles" className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {perVehicle.map((v) => {
            const vLogs = logs.filter((l) => l.vehicle_id === v.id);
            const last = vLogs[0];
            return (
              <Card key={v.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{v.name}</span>
                    <Badge variant="outline">{v.reg}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <Row label="Current Odometer" value={last ? `${Number(last.odometer).toLocaleString()} km` : "—"} />
                  <Row label="Last Fuel Filled" value={last ? `${fmtDate(last.filled_on)} · ${last.litres}L` : "—"} />
                  <Row label="Avg Mileage" value={v.avg ? `${v.avg.toFixed(2)} km/L` : "—"} />
                  <Row label="Highest Mileage" value={v.high ? `${v.high.toFixed(2)} km/L` : "—"} />
                  <Row label="Lowest Mileage" value={v.low ? `${v.low.toFixed(2)} km/L` : "—"} />
                  <Row label="Total Fuel" value={`${v.litres.toFixed(2)} L`} />
                  <Row label="Total Expense" value={inr(v.cost)} />
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="charts" className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Gauge className="h-4 w-4" /> Average Mileage by Vehicle</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {perVehicle.filter((v) => v.avg > 0).length === 0 ? (
                <p className="text-sm text-muted-foreground">No mileage data yet.</p>
              ) : perVehicle.filter((v) => v.avg > 0).map((v) => (
                <div key={v.id}>
                  <div className="flex justify-between text-xs mb-1"><span>{v.name}</span><span className="tabular-nums">{v.avg.toFixed(2)} km/L</span></div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(v.avg / maxMileage) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Fuel Expense by Month</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {perMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries yet.</p>
              ) : perMonth.slice(0, 12).map(([month, v]) => (
                <div key={month}>
                  <div className="flex justify-between text-xs mb-1"><span>{month}</span><span className="tabular-nums">{inr(v.cost)}</span></div>
                  <div className="h-2 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(v.cost / maxMonthCost) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Vehicle-wise Fuel Expense</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportCsv(
                [["Vehicle","Reg","Litres","Cost","Avg Mileage","High","Low"], ...perVehicle.map((v) => [v.name, v.reg, v.litres.toFixed(2), v.cost, v.avg.toFixed(2), v.high.toFixed(2), v.low.toFixed(2)])],
                "vehicle-fuel-expense.csv"
              )}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Vehicle</TableHead><TableHead>Reg</TableHead><TableHead className="text-right">Litres</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Avg km/L</TableHead></TableRow></TableHeader>
                <TableBody>
                  {perVehicle.map((v) => (
                    <TableRow key={v.id}><TableCell>{v.name}</TableCell><TableCell>{v.reg}</TableCell><TableCell className="text-right tabular-nums">{v.litres.toFixed(2)}</TableCell><TableCell className="text-right tabular-nums">{inr(v.cost)}</TableCell><TableCell className="text-right tabular-nums">{v.avg ? v.avg.toFixed(2) : "—"}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Monthly Fuel Expense</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportCsv(
                [["Month","Litres","Cost"], ...perMonth.map(([m, v]) => [m, v.litres.toFixed(2), v.cost])],
                "monthly-fuel-expense.csv"
              )}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Litres</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
                <TableBody>
                  {perMonth.map(([m, v]) => (
                    <TableRow key={m}><TableCell>{m}</TableCell><TableCell className="text-right tabular-nums">{v.litres.toFixed(2)}</TableCell><TableCell className="text-right tabular-nums">{inr(v.cost)}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
