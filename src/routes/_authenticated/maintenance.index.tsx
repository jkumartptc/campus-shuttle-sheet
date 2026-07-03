import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Plus, Wrench, Car, Bus as BusIcon, FileDown, Printer, History } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maintenance/")({
  head: () => ({ meta: [{ title: "Vehicle Maintenance — Transport Admin" }] }),
  component: MaintenancePage,
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

const TYPES = ["Periodic Service","Engine","Brake","Electrical","Battery","Tyre","Suspension","AC","Body Repair","Other"];
const STATUSES = ["Pending","In Progress","Completed"];

const emptyForm = {
  vehicle_id: "", service_date: new Date().toISOString().slice(0,10),
  odometer: "", maintenance_type: "Periodic Service", description: "",
  workshop: "", invoice_no: "", cost: "", next_service_date: "", next_service_km: "", status: "Completed",
};

function statusColor(s: string) {
  if (s === "Completed") return "bg-emerald-100 text-emerald-700";
  if (s === "In Progress") return "bg-amber-100 text-amber-800";
  return "bg-rose-100 text-rose-700";
}

function MaintenancePage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [records, setRecords] = useState<MRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  const load = useCallback(async () => {
    const [v, r] = await Promise.all([
      supabase.from("vehicle_master").select("*").order("category").order("name"),
      supabase.from("maintenance_records").select("*").order("service_date", { ascending: false }),
    ]);
    setVehicles((v.data ?? []) as Vehicle[]);
    setRecords((r.data ?? []) as MRecord[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const vById = useMemo(() => Object.fromEntries(vehicles.map(v => [v.id, v])), [vehicles]);

  const stats = useMemo(() => {
    const now = new Date(); const ym = now.toISOString().slice(0,7);
    const inMaintenance = records.filter(r => r.status === "In Progress").map(r => r.vehicle_id);
    const upcoming = vehicles.filter(v => v.next_service_date && new Date(v.next_service_date) >= new Date(now.toDateString()) && (new Date(v.next_service_date).getTime() - now.getTime()) / 86400000 <= 30).length;
    const pending = records.filter(r => r.status === "Pending").length;
    const monthCost = records.filter(r => r.service_date.startsWith(ym)).reduce((s, r) => s + Number(r.cost ?? 0), 0);
    return {
      total: vehicles.length,
      underMaintenance: new Set(inMaintenance).size,
      upcoming, pending, monthCost,
    };
  }, [vehicles, records]);

  const openAdd = (vehicleId?: string) => {
    setForm({ ...emptyForm, vehicle_id: vehicleId ?? vehicles[0]?.id ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.vehicle_id) return toast.error("Select a vehicle");
    const v = vById[form.vehicle_id];
    const isDemo = v?.category === "Demo Vehicle";
    if (!isDemo && !form.odometer) return toast.error("Odometer required");

    const payload = {
      vehicle_id: form.vehicle_id,
      service_date: form.service_date,
      odometer: form.odometer ? Number(form.odometer) : null,
      maintenance_type: form.maintenance_type,
      description: form.description || null,
      workshop: form.workshop || null,
      invoice_no: form.invoice_no || null,
      cost: form.cost ? Number(form.cost) : 0,
      next_service_date: form.next_service_date || null,
      next_service_km: form.next_service_km ? Number(form.next_service_km) : null,
      status: form.status,
    };
    const { error } = await supabase.from("maintenance_records").insert(payload);
    if (error) return toast.error(error.message);

    if (form.status === "Completed") {
      await supabase.from("vehicle_master").update({
        last_service_date: form.service_date,
        next_service_date: form.next_service_date || null,
        next_service_km: form.next_service_km ? Number(form.next_service_km) : null,
        status: "active",
      }).eq("id", form.vehicle_id);
    } else if (form.status === "In Progress") {
      await supabase.from("vehicle_master").update({ status: "under_maintenance" }).eq("id", form.vehicle_id);
    }
    toast.success("Record saved");
    setOpen(false); setForm(emptyForm); load();
  };

  const exportCSV = (rows: MRecord[], filename: string) => {
    const header = ["Date","Vehicle","Registration","Type","Description","Workshop","Invoice","Odometer","Cost","Status","Next Service Date","Next Service KM"];
    const csv = [header.join(",")].concat(rows.map(r => {
      const v = vById[r.vehicle_id];
      const reg = v?.category === "Demo Vehicle" ? "N/A" : (v?.reg_no ?? "");
      return [r.service_date, v?.name ?? "", reg, r.maintenance_type, r.description ?? "", r.workshop ?? "", r.invoice_no ?? "", r.odometer ?? "", r.cost, r.status, r.next_service_date ?? "", r.next_service_km ?? ""]
        .map(x => `"${String(x).replaceAll('"','""')}"`).join(",");
    })).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  const vehicleHistoryRecords = historyVehicle ? records.filter(r => r.vehicle_id === historyVehicle.id) : [];
  const historyTotal = vehicleHistoryRecords.reduce((s, r) => s + Number(r.cost ?? 0), 0);

  const currentVehicle = vById[form.vehicle_id];
  const isDemoSelected = currentVehicle?.category === "Demo Vehicle";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vehicle Maintenance</h1>
          <p className="text-sm text-muted-foreground">Track servicing and repairs across {vehicles.length} vehicles</p>
        </div>
        <Button onClick={() => openAdd()}><Plus className="mr-2 h-4 w-4" /> New maintenance</Button>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Total Vehicles" value={stats.total} icon={<Car className="h-4 w-4" />} />
            <Stat label="Under Maintenance" value={stats.underMaintenance} icon={<Wrench className="h-4 w-4" />} />
            <Stat label="Upcoming Services (30d)" value={stats.upcoming} icon={<History className="h-4 w-4" />} />
            <Stat label="Pending Repairs" value={stats.pending} icon={<Wrench className="h-4 w-4" />} />
            <Stat label="This Month Cost" value={inr(stats.monthCost)} icon={<FileDown className="h-4 w-4" />} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent maintenance</CardTitle></CardHeader>
            <CardContent className="p-0">
              <RecordTable records={records.slice(0, 8)} vById={vById} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vehicles" className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {vehicles.map(v => {
              const isDemo = v.category === "Demo Vehicle";
              const lastSvc = v.last_service_date ?? records.find(r => r.vehicle_id === v.id && r.status === "Completed")?.service_date ?? null;
              return (
                <Card key={v.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        {v.category === "Bus" ? <BusIcon className="h-5 w-5 text-primary" /> : <Car className="h-5 w-5 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{v.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {isDemo ? "N/A" : (v.reg_no ?? "—")} · {v.category}
                        </div>
                      </div>
                      <Badge variant="outline" className={statusColor(v.status === "under_maintenance" ? "In Progress" : "Completed")}>
                        {v.status === "under_maintenance" ? "In Maintenance" : "Active"}
                      </Badge>
                    </div>
                    {isDemo && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Campus Use Only</Badge>}
                    <div className="text-xs text-muted-foreground">
                      <div>Usage: {v.usage ?? "—"}</div>
                      <div>Last service: {fmtDate(lastSvc)}</div>
                      <div>Next service: {fmtDate(v.next_service_date)}{v.next_service_km ? ` · ${v.next_service_km} km` : ""}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/maintenance/$vehicleId" params={{ vehicleId: v.id }}>
                          <History className="mr-1 h-3 w-3" /> Open
                        </Link>
                      </Button>
                      <Button size="sm" onClick={() => openAdd(v.id)}><Plus className="mr-1 h-3 w-3" /> Log service</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="records" className="space-y-3">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => exportCSV(records, "maintenance-records.csv")}>
              <FileDown className="mr-2 h-4 w-4" /> Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print / PDF
            </Button>
          </div>
          <Card><CardContent className="p-0"><RecordTable records={records} vById={vById} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <ReportsView vehicles={vehicles} records={records} exportCSV={exportCSV} />
        </TabsContent>
      </Tabs>

      {/* Add record dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New maintenance record</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Vehicle *</Label>
              <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} · {v.category === "Demo Vehicle" ? "N/A" : (v.reg_no ?? "—")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isDemoSelected && <p className="text-xs text-amber-700">Campus Use Only — odometer optional</p>}
            </div>
            <div className="space-y-1"><Label>Date *</Label><Input type="date" value={form.service_date} onChange={e => setForm({ ...form, service_date: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Odometer (km){isDemoSelected ? "" : " *"}</Label>
              <Input type="number" value={form.odometer} onChange={e => setForm({ ...form, odometer: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Maintenance Type</Label>
              <Select value={form.maintenance_type} onValueChange={v => setForm({ ...form, maintenance_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Workshop</Label><Input value={form.workshop} onChange={e => setForm({ ...form, workshop: e.target.value })} /></div>
            <div className="space-y-1"><Label>Invoice No</Label><Input value={form.invoice_no} onChange={e => setForm({ ...form, invoice_no: e.target.value })} /></div>
            <div className="space-y-1"><Label>Cost (₹)</Label><Input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /></div>
            <div className="space-y-1"><Label>Next Service Date</Label><Input type="date" value={form.next_service_date} onChange={e => setForm({ ...form, next_service_date: e.target.value })} /></div>
            <div className="space-y-1"><Label>Next Service KM</Label><Input type="number" value={form.next_service_km} onChange={e => setForm({ ...form, next_service_km: e.target.value })} /></div>
            <div className="space-y-1 sm:col-span-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={save}>Save record</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle history dialog */}
      <Dialog open={!!historyVehicle} onOpenChange={(o) => !o && setHistoryVehicle(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {historyVehicle?.name} · History
              <div className="text-xs font-normal text-muted-foreground mt-1">
                {historyVehicle?.category === "Demo Vehicle" ? "N/A" : (historyVehicle?.reg_no ?? "—")} · Total spent: {inr(historyTotal)}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <RecordTable records={vehicleHistoryRecords} vById={vById} hideVehicle />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => exportCSV(vehicleHistoryRecords, `${historyVehicle?.name}-history.csv`)}>
              <FileDown className="mr-2 h-4 w-4" /> Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>{label}</span>{icon}
        </div>
        <div className="mt-2 text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function RecordTable({ records, vById, hideVehicle }: { records: MRecord[]; vById: Record<string, Vehicle>; hideVehicle?: boolean }) {
  if (records.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">No records yet.</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          {!hideVehicle && <TableHead>Vehicle</TableHead>}
          <TableHead>Type</TableHead>
          <TableHead>Workshop</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map(r => {
          const v = vById[r.vehicle_id];
          return (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">{fmtDate(r.service_date)}</TableCell>
              {!hideVehicle && <TableCell>
                <div className="font-medium">{v?.name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{v?.category === "Demo Vehicle" ? "N/A" : (v?.reg_no ?? "—")}</div>
              </TableCell>}
              <TableCell>{r.maintenance_type}</TableCell>
              <TableCell className="text-xs">{r.workshop ?? "—"}{r.invoice_no ? ` · #${r.invoice_no}` : ""}</TableCell>
              <TableCell className="text-right">{inr(r.cost)}</TableCell>
              <TableCell><Badge variant="outline" className={statusColor(r.status)}>{r.status}</Badge></TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ReportsView({ vehicles, records, exportCSV }: { vehicles: Vehicle[]; records: MRecord[]; exportCSV: (rows: MRecord[], name: string) => void }) {
  const perVehicle = useMemo(() => vehicles.map(v => {
    const rs = records.filter(r => r.vehicle_id === v.id);
    return { v, count: rs.length, total: rs.reduce((s, r) => s + Number(r.cost ?? 0), 0) };
  }).sort((a, b) => b.total - a.total), [vehicles, records]);

  const perMonth = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of records) {
      const k = r.service_date.slice(0, 7);
      m[k] = (m[k] ?? 0) + Number(r.cost ?? 0);
    }
    return Object.entries(m).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12);
  }, [records]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Vehicle-wise cost</CardTitle>
          <Button size="sm" variant="outline" onClick={() => exportCSV(records, "all-records.csv")}>
            <FileDown className="mr-2 h-4 w-4" /> Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Vehicle</TableHead><TableHead className="text-right">Services</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {perVehicle.map(({ v, count, total }) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <div className="font-medium">{v.name}</div>
                    <div className="text-xs text-muted-foreground">{v.category === "Demo Vehicle" ? "N/A" : (v.reg_no ?? "—")}</div>
                  </TableCell>
                  <TableCell className="text-right">{count}</TableCell>
                  <TableCell className="text-right font-medium">{inr(total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Monthly expenditure</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Month</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
            <TableBody>
              {perMonth.length === 0 && <TableRow><TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">No data yet.</TableCell></TableRow>}
              {perMonth.map(([m, total]) => (
                <TableRow key={m}>
                  <TableCell>{new Date(m + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</TableCell>
                  <TableCell className="text-right font-medium">{inr(total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
