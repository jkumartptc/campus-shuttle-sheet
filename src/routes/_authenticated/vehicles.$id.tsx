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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  ArrowLeft, Bus as BusIcon, Car, Gauge, Fuel as FuelIcon, Wrench, FileText,
  Plus, ShieldCheck, CalendarClock, Circle, Upload, Download, FileDown,
} from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import { useCurrentUser } from "@/lib/use-role";

export const Route = createFileRoute("/_authenticated/vehicles/$id")({
  head: () => ({ meta: [{ title: "Vehicle Dashboard" }] }),
  component: VehiclePage,
});

type Vehicle = {
  id: string; name: string; reg_no: string | null; category: string; status: string;
  usage: string | null; make: string | null; model: string | null; year: number | null;
  fuel_type: string | null; purchase_date: string | null; notes: string | null;
  last_service_date: string | null; next_service_date: string | null; next_service_km: number | null;
};
type Odo = { id: string; vehicle_id: string; reading_km: number; distance_km: number | null; anomaly: boolean; logged_at: string; remarks: string | null };
type Fuel = {
  id: string; vehicle_id: string | null; filled_on: string; odometer: number; litres: number;
  rate_per_litre: number; total_cost: number; mileage_kmpl: number | null;
  indent_number: string | null; bill_no: string | null; fuel_station: string | null;
  credit_purchase: boolean | null; payment_status: string | null; invoice_url: string | null; remarks: string | null;
};
type MRec = { id: string; vehicle_id: string; service_date: string; maintenance_type: string; workshop: string | null; cost: number; status: string; description: string | null; invoice_no: string | null; next_service_date: string | null; next_service_km: number | null; odometer: number | null };
type Doc = { id: string; vehicle_id: string; doc_type: string; doc_no: string | null; provider: string | null; issued_on: string | null; expires_on: string | null; file_url: string | null; notes: string | null; is_current: boolean };
type Sched = { id: string; vehicle_id: string; item: string; interval_km: number | null; interval_days: number | null; last_done_on: string | null; last_done_km: number | null; next_due_on: string | null; next_due_km: number | null; notes: string | null };
type Tyre = { id: string; vehicle_id: string; position: string | null; brand: string | null; serial_no: string | null; fitted_on: string | null; fitted_km: number | null; removed_on: string | null; removed_km: number | null; cost: number | null; notes: string | null };

const DOC_TYPES: { value: Doc["doc_type"]; label: string }[] = [
  { value: "insurance", label: "Insurance" },
  { value: "fc", label: "Fitness Certificate" },
  { value: "permit", label: "Permit" },
  { value: "puc", label: "PUC" },
  { value: "rc", label: "RC" },
  { value: "other", label: "Other" },
];

function daysUntil(d: string | null) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}
function expiryClass(d: string | null) {
  const n = daysUntil(d);
  if (n === null) return "";
  if (n < 0) return "text-rose-600";
  if (n <= 30) return "text-amber-600";
  return "text-emerald-600";
}

function csvExport(headers: string[], rows: (string | number | null | undefined)[][], filename: string) {
  const esc = (x: unknown) => `"${String(x ?? "").replaceAll('"', '""')}"`;
  const csv = [headers.map(esc).join(",")].concat(rows.map((r) => r.map(esc).join(","))).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function VehiclePage() {
  const { id } = useParams({ from: "/_authenticated/vehicles/$id" });
  const { user } = useCurrentUser();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [odo, setOdo] = useState<Odo[]>([]);
  const [fuel, setFuel] = useState<Fuel[]>([]);
  const [maint, setMaint] = useState<MRec[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [sched, setSched] = useState<Sched[]>([]);
  const [tyres, setTyres] = useState<Tyre[]>([]);

  const load = useCallback(async () => {
    const [v, o, f, m, d, s, t] = await Promise.all([
      supabase.from("vehicle_master").select("*").eq("id", id).maybeSingle(),
      supabase.from("odometer_logs").select("*").eq("vehicle_id", id).order("logged_at", { ascending: false }).limit(100),
      supabase.from("fuel_logs").select("*").eq("vehicle_id", id).order("filled_on", { ascending: false }).limit(100),
      supabase.from("maintenance_records").select("*").eq("vehicle_id", id).order("service_date", { ascending: false }),
      supabase.from("vehicle_documents").select("*").eq("vehicle_id", id).order("expires_on", { ascending: true, nullsFirst: false }),
      supabase.from("service_schedules").select("*").eq("vehicle_id", id).order("next_due_on", { ascending: true, nullsFirst: false }),
      supabase.from("tyres").select("*").eq("vehicle_id", id).order("fitted_on", { ascending: false, nullsFirst: false }),
    ]);
    setVehicle((v.data as Vehicle) ?? null);
    setOdo((o.data ?? []) as Odo[]);
    setFuel((f.data ?? []) as Fuel[]);
    setMaint((m.data ?? []) as MRec[]);
    setDocs((d.data ?? []) as Doc[]);
    setSched((s.data ?? []) as Sched[]);
    setTyres((t.data ?? []) as Tyre[]);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    const currentOdo = odo[0]?.reading_km ?? null;
    const lastFuel = fuel[0] ?? null;
    const kmSinceLastFuel = currentOdo && lastFuel ? Math.max(0, currentOdo - Number(lastFuel.odometer)) : 0;
    const last5 = fuel.filter((x) => x.mileage_kmpl).slice(0, 5);
    const avg = last5.length ? Math.round((last5.reduce((s, x) => s + Number(x.mileage_kmpl ?? 0), 0) / last5.length) * 100) / 100 : null;
    const ym = new Date().toISOString().slice(0, 7);
    const monthFuel = fuel.filter((x) => x.filled_on.startsWith(ym));
    const monthLitres = monthFuel.reduce((s, x) => s + Number(x.litres), 0);
    const monthCost = monthFuel.reduce((s, x) => s + Number(x.total_cost), 0);
    const dailyKm = odo[0]?.distance_km ?? null;
    const monthOdo = odo.filter((x) => x.logged_at.slice(0, 7) === ym).reduce((s, x) => s + Number(x.distance_km ?? 0), 0);
    const costPerKm = avg && lastFuel ? Math.round((Number(lastFuel.rate_per_litre) / avg) * 100) / 100 : null;
    return { currentOdo, lastFuel, kmSinceLastFuel, avg, monthLitres, monthCost, dailyKm, monthOdo, costPerKm };
  }, [odo, fuel]);

  const Icon = vehicle?.category === "Bus" ? BusIcon : Car;

  if (!vehicle) return <div className="p-8 text-center text-sm text-muted-foreground">Loading vehicle…</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/vehicles"><ArrowLeft className="mr-1 h-4 w-4" /> Fleet</Link></Button>
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-xl font-bold">{vehicle.name}</div>
            <div className="text-xs text-muted-foreground">{vehicle.reg_no ?? "—"} · {vehicle.category}{vehicle.make ? ` · ${vehicle.make} ${vehicle.model ?? ""}` : ""}</div>
          </div>
        </div>
        <Badge variant="outline" className={vehicle.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}>
          {vehicle.status}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <Stat label="Current Odometer" value={summary.currentOdo ? `${Number(summary.currentOdo).toLocaleString("en-IN")} km` : "—"} sub={summary.dailyKm ? `+${summary.dailyKm} km today` : ""} />
        <Stat label="Last Fuel" value={summary.lastFuel ? fmtDate(summary.lastFuel.filled_on) : "—"} sub={summary.lastFuel ? `${summary.lastFuel.litres} L · ${inr(summary.lastFuel.total_cost)}` : ""} />
        <Stat label="KM Since Last Fuel" value={summary.kmSinceLastFuel ? `${summary.kmSinceLastFuel} km` : "—"} />
        <Stat label="Avg Mileage" value={summary.avg ? `${summary.avg} kmpl` : "—"} sub={summary.costPerKm ? `${inr(summary.costPerKm)}/km` : ""} />
        <Stat label="Month Fuel" value={`${summary.monthLitres.toFixed(1)} L`} sub={inr(summary.monthCost)} />
        <Stat label="Month Running" value={`${summary.monthOdo.toFixed(0)} km`} />
      </div>

      <Tabs defaultValue="odometer">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="odometer">Odometer</TabsTrigger>
          <TabsTrigger value="fuel">Fuel</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="schedule">Service Schedule</TabsTrigger>
          <TabsTrigger value="documents">Insurance/FC/Permit/PUC</TabsTrigger>
          <TabsTrigger value="tyres">Tyres</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <VehicleInfoTab vehicle={vehicle} onSaved={load} />
        </TabsContent>
        <TabsContent value="odometer">
          <OdometerTab vehicleId={id} rows={odo} userId={user?.id} lastReading={summary.currentOdo} onChanged={load} />
        </TabsContent>
        <TabsContent value="fuel">
          <FuelTab vehicleId={id} rows={fuel} userId={user?.id} onChanged={load} />
        </TabsContent>
        <TabsContent value="maintenance">
          <MaintenanceTab vehicleId={id} rows={maint} onChanged={load} />
        </TabsContent>
        <TabsContent value="schedule">
          <ScheduleTab vehicleId={id} rows={sched} onChanged={load} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab vehicleId={id} rows={docs} onChanged={load} />
        </TabsContent>
        <TabsContent value="tyres">
          <TyresTab vehicleId={id} rows={tyres} onChanged={load} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-bold leading-tight">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

// ---------------- Info tab ----------------
function VehicleInfoTab({ vehicle, onSaved }: { vehicle: Vehicle; onSaved: () => void }) {
  const [form, setForm] = useState(vehicle);
  useEffect(() => setForm(vehicle), [vehicle]);
  const save = async () => {
    const { error } = await supabase.from("vehicle_master").update({
      name: form.name, reg_no: form.reg_no, category: form.category, usage: form.usage,
      make: form.make, model: form.model, year: form.year, fuel_type: form.fuel_type,
      purchase_date: form.purchase_date, notes: form.notes, status: form.status,
    }).eq("id", vehicle.id);
    if (error) return toast.error(error.message);
    toast.success("Saved"); onSaved();
  };
  return (
    <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2">
      <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Registration"><Input value={form.reg_no ?? ""} onChange={(e) => setForm({ ...form, reg_no: e.target.value })} /></Field>
      <Field label="Category">
        <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{["Bus","Car","Van","Truck","Demo Vehicle","Other"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Usage"><Input value={form.usage ?? ""} onChange={(e) => setForm({ ...form, usage: e.target.value })} /></Field>
      <Field label="Make"><Input value={form.make ?? ""} onChange={(e) => setForm({ ...form, make: e.target.value })} /></Field>
      <Field label="Model"><Input value={form.model ?? ""} onChange={(e) => setForm({ ...form, model: e.target.value })} /></Field>
      <Field label="Year"><Input type="number" value={form.year ?? ""} onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })} /></Field>
      <Field label="Fuel Type">
        <Select value={form.fuel_type ?? ""} onValueChange={(v) => setForm({ ...form, fuel_type: v })}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>{["Diesel","Petrol","CNG","Electric"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label="Purchase Date"><Input type="date" value={form.purchase_date ?? ""} onChange={(e) => setForm({ ...form, purchase_date: e.target.value || null })} /></Field>
      <Field label="Status">
        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{["active","under_maintenance","retired"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <div className="sm:col-span-2"><Field label="Notes"><Textarea rows={2} value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
      <div className="sm:col-span-2"><Button onClick={save}>Save vehicle info</Button></div>
    </CardContent></Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

// ---------------- Odometer tab ----------------
function OdometerTab({ vehicleId, rows, userId, lastReading, onChanged }:
  { vehicleId: string; rows: Odo[]; userId: string | undefined; lastReading: number | null; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [reading, setReading] = useState("");
  const [remarks, setRemarks] = useState("");
  const save = async () => {
    const n = Number(reading);
    if (!n) return toast.error("Enter reading");
    if (lastReading && n <= lastReading) return toast.error(`Must be greater than ${lastReading}`);
    const { error } = await supabase.from("odometer_logs").insert({
      vehicle_id: vehicleId, reading_km: n, remarks: remarks || null,
      driver_id: userId, created_by: userId, updated_by: userId,
    });
    if (error) return toast.error(error.message.replace(/^duplicate_odometer.*$/, "Another entry exists within 2 minutes").replace(/^odometer_must_increase.*$/, "Reading must exceed previous"));
    toast.success("Logged"); setOpen(false); setReading(""); setRemarks(""); onChanged();
  };
  const dailyByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const d = r.logged_at.slice(0, 10);
      m.set(d, (m.get(d) ?? 0) + Number(r.distance_km ?? 0));
    }
    return Array.from(m.entries()).slice(0, 7);
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          Last: {lastReading ? `${Number(lastReading).toLocaleString("en-IN")} km` : "—"} · Time & driver auto-recorded
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => csvExport(
            ["When", "Reading (km)", "Distance (km)", "Anomaly", "Remarks"],
            rows.map((r) => [new Date(r.logged_at).toLocaleString("en-IN"), r.reading_km, r.distance_km ?? "", r.anomaly ? "Yes" : "", r.remarks ?? ""]),
            "odometer.csv"
          )}><FileDown className="mr-2 h-4 w-4" />Export</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Log odometer</Button>
        </div>
      </div>

      <Card><CardHeader><CardTitle className="text-base">Daily running (last 7 recorded days)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Distance (km)</TableHead></TableRow></TableHeader>
            <TableBody>
              {dailyByDate.length === 0 && <TableRow><TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-6">No data.</TableCell></TableRow>}
              {dailyByDate.map(([d, km]) => <TableRow key={d}><TableCell>{fmtDate(d)}</TableCell><TableCell className="text-right font-medium">{km.toFixed(1)}</TableCell></TableRow>)}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card><CardHeader><CardTitle className="text-base">Odometer log</CardTitle></CardHeader><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>When</TableHead><TableHead className="text-right">Reading</TableHead><TableHead className="text-right">Distance</TableHead><TableHead>Remarks</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">No entries yet.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(r.logged_at).toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right font-medium">{Number(r.reading_km).toLocaleString("en-IN")} km</TableCell>
                <TableCell className="text-right">
                  {r.distance_km ? `${r.distance_km} km` : "—"}
                  {r.anomaly && <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-800">unusual</Badge>}
                </TableCell>
                <TableCell className="text-xs">{r.remarks ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Log odometer reading</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><CalendarClock className="h-3 w-3" />Timestamp: <b>{new Date().toLocaleString("en-IN")}</b> (auto)</div>
              <div className="mt-1">Previous reading: <b>{lastReading ?? "—"}</b> km</div>
            </div>
            <Field label="Odometer reading (km) *"><Input type="number" value={reading} onChange={(e) => setReading(e.target.value)} autoFocus /></Field>
            <Field label="Remarks"><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
          </div>
          <DialogFooter><Button onClick={save}>Save entry</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- Fuel tab ----------------
function FuelTab({ vehicleId, rows, userId, onChanged }:
  { vehicleId: string; rows: Fuel[]; userId: string | undefined; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const empty = {
    odometer: "", litres: "", rate_per_litre: "", indent_number: "",
    bill_no: "", fuel_station: "Five Roads Fuel Service Station",
    credit_purchase: true, payment_status: "pending", remarks: "",
  };
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => {
    const l = Number(form.litres || 0); const r = Number(form.rate_per_litre || 0);
    return Math.round(l * r * 100) / 100;
  }, [form.litres, form.rate_per_litre]);

  const save = async () => {
    if (!form.odometer || !form.litres || !form.rate_per_litre) return toast.error("Odometer, litres, rate required");
    if (!form.indent_number) return toast.error("Intent number is mandatory for credit purchase");
    setSaving(true);
    let invoice_url: string | null = null;
    if (file) {
      const path = `${vehicleId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("vehicle-docs").upload(path, file);
      if (upErr) { setSaving(false); return toast.error(upErr.message); }
      invoice_url = path;
    }
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("fuel_logs").insert({
      vehicle_id: vehicleId, filled_on: today,
      odometer: Number(form.odometer), litres: Number(form.litres),
      rate_per_litre: Number(form.rate_per_litre), total_cost: total,
      indent_number: form.indent_number, bill_no: form.bill_no || null,
      fuel_station: form.fuel_station, credit_purchase: form.credit_purchase,
      payment_status: form.payment_status, invoice_url, remarks: form.remarks || null,
      fuel_type: "diesel", created_by: userId, updated_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Fuel entry saved"); setOpen(false); setForm(empty); setFile(null); onChanged();
  };

  const updatePayment = async (id: string, status: string, bill_no?: string) => {
    const patch: { payment_status: string; updated_by?: string; bill_no?: string } = { payment_status: status, updated_by: userId };
    if (bill_no !== undefined) patch.bill_no = bill_no;
    const { error } = await supabase.from("fuel_logs").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated"); onChanged();
  };

  const downloadInvoice = async (path: string) => {
    const { data, error } = await supabase.storage.from("vehicle-docs").createSignedUrl(path, 300);
    if (error || !data) return toast.error("Cannot open");
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">Default station: <b>Five Roads Fuel Service Station</b> · Credit purchase</div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => csvExport(
            ["Date","Odometer","Litres","Rate","Total","Mileage","Intent","Bill","Station","Credit","Status","Remarks"],
            rows.map((r) => [r.filled_on, r.odometer, r.litres, r.rate_per_litre, r.total_cost, r.mileage_kmpl ?? "", r.indent_number ?? "", r.bill_no ?? "", r.fuel_station ?? "", r.credit_purchase ? "Yes" : "No", r.payment_status ?? "", r.remarks ?? ""]),
            "fuel.csv"
          )}><FileDown className="mr-2 h-4 w-4" />Export</Button>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Log fuel</Button>
        </div>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Intent / Bill</TableHead><TableHead className="text-right">Odometer</TableHead>
            <TableHead className="text-right">Litres</TableHead><TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Mileage</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">No fuel entries yet.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{fmtDate(r.filled_on)}</TableCell>
                <TableCell className="text-xs">
                  <div>Intent: {r.indent_number ?? "—"}</div>
                  <div className="text-muted-foreground">Bill: {r.bill_no ?? "—"}</div>
                </TableCell>
                <TableCell className="text-right">{Number(r.odometer).toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right">{r.litres}</TableCell>
                <TableCell className="text-right font-medium">{inr(r.total_cost)}</TableCell>
                <TableCell className="text-right">{r.mileage_kmpl ? `${r.mileage_kmpl} kmpl` : "—"}</TableCell>
                <TableCell>
                  <Select value={r.payment_status ?? "pending"} onValueChange={(v) => updatePayment(r.id, v)}>
                    <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="billed">Billed</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {r.invoice_url && <Button variant="ghost" size="icon" onClick={() => downloadInvoice(r.invoice_url!)}><Download className="h-4 w-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Log fuel entry</DialogTitle></DialogHeader>
          <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2"><CalendarClock className="h-3 w-3" />Timestamp: <b>{new Date().toLocaleString("en-IN")}</b> (auto)</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Odometer (km) *"><Input type="number" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} /></Field>
            <Field label="Intent Number *"><Input value={form.indent_number} onChange={(e) => setForm({ ...form, indent_number: e.target.value })} /></Field>
            <Field label="Fuel Quantity (Litres) *"><Input type="number" step="0.01" value={form.litres} onChange={(e) => setForm({ ...form, litres: e.target.value })} /></Field>
            <Field label="Rate per Litre (₹) *"><Input type="number" step="0.01" value={form.rate_per_litre} onChange={(e) => setForm({ ...form, rate_per_litre: e.target.value })} /></Field>
            <Field label="Total Amount (auto)"><Input value={total ? inr(total) : "—"} readOnly /></Field>
            <Field label="Fuel Station"><Input value={form.fuel_station} onChange={(e) => setForm({ ...form, fuel_station: e.target.value })} /></Field>
            <Field label="Bill Number"><Input value={form.bill_no} onChange={(e) => setForm({ ...form, bill_no: e.target.value })} /></Field>
            <Field label="Payment Status">
              <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="billed">Billed</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch checked={form.credit_purchase} onCheckedChange={(v) => setForm({ ...form, credit_purchase: v })} />
              <span className="text-sm">Credit Purchase</span>
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">Invoice Upload (optional)</Label>
              <Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="sm:col-span-2"><Field label="Remarks"><Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></Field></div>
          </div>
          <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save entry"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- Maintenance tab ----------------
function MaintenanceTab({ vehicleId, rows, onChanged }: { vehicleId: string; rows: MRec[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const empty = { service_date: new Date().toISOString().slice(0, 10), maintenance_type: "Periodic Service", workshop: "", invoice_no: "", cost: "", odometer: "", description: "", next_service_date: "", next_service_km: "", status: "Completed" };
  const [form, setForm] = useState(empty);
  const save = async () => {
    const { error } = await supabase.from("maintenance_records").insert({
      vehicle_id: vehicleId, service_date: form.service_date, maintenance_type: form.maintenance_type,
      workshop: form.workshop || null, invoice_no: form.invoice_no || null,
      cost: form.cost ? Number(form.cost) : 0, odometer: form.odometer ? Number(form.odometer) : null,
      description: form.description || null, status: form.status,
      next_service_date: form.next_service_date || null,
      next_service_km: form.next_service_km ? Number(form.next_service_km) : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); setForm(empty); onChanged();
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />New maintenance</Button></div>
      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Workshop</TableHead><TableHead className="text-right">Cost</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">No records yet.</TableCell></TableRow>}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{fmtDate(r.service_date)}</TableCell>
              <TableCell>{r.maintenance_type}</TableCell>
              <TableCell className="text-xs">{r.workshop ?? "—"}{r.invoice_no ? ` · #${r.invoice_no}` : ""}</TableCell>
              <TableCell className="text-right font-medium">{inr(r.cost)}</TableCell>
              <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New maintenance record</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date"><Input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} /></Field>
            <Field label="Type">
              <Select value={form.maintenance_type} onValueChange={(v) => setForm({ ...form, maintenance_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Periodic Service","Engine","Brake","Electrical","Battery","Tyre","Suspension","AC","Body Repair","Other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Odometer (km)"><Input type="number" value={form.odometer} onChange={(e) => setForm({ ...form, odometer: e.target.value })} /></Field>
            <Field label="Cost (₹)"><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
            <Field label="Workshop"><Input value={form.workshop} onChange={(e) => setForm({ ...form, workshop: e.target.value })} /></Field>
            <Field label="Invoice No"><Input value={form.invoice_no} onChange={(e) => setForm({ ...form, invoice_no: e.target.value })} /></Field>
            <Field label="Next Service Date"><Input type="date" value={form.next_service_date} onChange={(e) => setForm({ ...form, next_service_date: e.target.value })} /></Field>
            <Field label="Next Service KM"><Input type="number" value={form.next_service_km} onChange={(e) => setForm({ ...form, next_service_km: e.target.value })} /></Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Pending","In Progress","Completed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2"><Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- Service schedule tab ----------------
function ScheduleTab({ vehicleId, rows, onChanged }: { vehicleId: string; rows: Sched[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const empty = { item: "", interval_km: "", interval_days: "", last_done_on: "", last_done_km: "", next_due_on: "", next_due_km: "", notes: "" };
  const [form, setForm] = useState(empty);
  const save = async () => {
    if (!form.item) return toast.error("Item required");
    const { error } = await supabase.from("service_schedules").insert({
      vehicle_id: vehicleId, item: form.item,
      interval_km: form.interval_km ? Number(form.interval_km) : null,
      interval_days: form.interval_days ? Number(form.interval_days) : null,
      last_done_on: form.last_done_on || null,
      last_done_km: form.last_done_km ? Number(form.last_done_km) : null,
      next_due_on: form.next_due_on || null,
      next_due_km: form.next_due_km ? Number(form.next_due_km) : null,
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); setForm(empty); onChanged();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("service_schedules").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChanged();
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Add schedule item</Button></div>
      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Interval</TableHead><TableHead>Last done</TableHead><TableHead>Next due</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">No schedule items yet — add Engine Oil, Brake Service, etc.</TableCell></TableRow>}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.item}</TableCell>
              <TableCell className="text-xs">{r.interval_km ? `${r.interval_km} km` : ""}{r.interval_km && r.interval_days ? " / " : ""}{r.interval_days ? `${r.interval_days} days` : ""}</TableCell>
              <TableCell className="text-xs">{r.last_done_on ? fmtDate(r.last_done_on) : "—"}{r.last_done_km ? ` · ${r.last_done_km} km` : ""}</TableCell>
              <TableCell className={`text-xs ${expiryClass(r.next_due_on)}`}>{r.next_due_on ? fmtDate(r.next_due_on) : "—"}{r.next_due_km ? ` · ${r.next_due_km} km` : ""}</TableCell>
              <TableCell><Button variant="ghost" size="sm" onClick={() => remove(r.id)}>Remove</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>Schedule item</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Item *"><Input placeholder="e.g. Engine Oil Change" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} /></Field></div>
            <Field label="Interval (km)"><Input type="number" value={form.interval_km} onChange={(e) => setForm({ ...form, interval_km: e.target.value })} /></Field>
            <Field label="Interval (days)"><Input type="number" value={form.interval_days} onChange={(e) => setForm({ ...form, interval_days: e.target.value })} /></Field>
            <Field label="Last done on"><Input type="date" value={form.last_done_on} onChange={(e) => setForm({ ...form, last_done_on: e.target.value })} /></Field>
            <Field label="Last done km"><Input type="number" value={form.last_done_km} onChange={(e) => setForm({ ...form, last_done_km: e.target.value })} /></Field>
            <Field label="Next due on"><Input type="date" value={form.next_due_on} onChange={(e) => setForm({ ...form, next_due_on: e.target.value })} /></Field>
            <Field label="Next due km"><Input type="number" value={form.next_due_km} onChange={(e) => setForm({ ...form, next_due_km: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- Documents tab ----------------
function DocumentsTab({ vehicleId, rows, onChanged }: { vehicleId: string; rows: Doc[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const empty = { doc_type: "insurance", doc_no: "", provider: "", issued_on: "", expires_on: "", notes: "" };
  const [form, setForm] = useState(empty);
  const save = async () => {
    let file_url: string | null = null;
    if (file) {
      const path = `${vehicleId}/docs/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("vehicle-docs").upload(path, file);
      if (upErr) return toast.error(upErr.message);
      file_url = path;
    }
    const { error } = await supabase.from("vehicle_documents").insert({
      vehicle_id: vehicleId, doc_type: form.doc_type, doc_no: form.doc_no || null,
      provider: form.provider || null, issued_on: form.issued_on || null,
      expires_on: form.expires_on || null, notes: form.notes || null, file_url,
    });
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); setForm(empty); setFile(null); onChanged();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    const { error } = await supabase.from("vehicle_documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChanged();
  };
  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from("vehicle-docs").createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  const byType = useMemo(() => {
    const m: Record<string, Doc[]> = {};
    for (const r of rows) { (m[r.doc_type] ??= []).push(r); }
    return m;
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Add document</Button></div>
      <div className="grid gap-3 md:grid-cols-2">
        {DOC_TYPES.filter((t) => t.value !== "other").map((t) => {
          const list = byType[t.value] ?? [];
          const latest = list[0];
          return (
            <Card key={t.value}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />{t.label}</CardTitle>
                {latest?.expires_on && <span className={`text-xs ${expiryClass(latest.expires_on)}`}>Expires {fmtDate(latest.expires_on)}</span>}
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                {!latest && <div>No document on file.</div>}
                {latest && (
                  <>
                    <div>No: <span className="text-foreground">{latest.doc_no ?? "—"}</span></div>
                    <div>Provider: <span className="text-foreground">{latest.provider ?? "—"}</span></div>
                    <div>Issued: {fmtDate(latest.issued_on)}</div>
                    <div className="flex gap-2 pt-1">
                      {latest.file_url && <Button size="sm" variant="outline" onClick={() => openFile(latest.file_url!)}><FileText className="mr-1 h-3 w-3" />View</Button>}
                      <Button size="sm" variant="ghost" onClick={() => remove(latest.id)}>Delete</Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card><CardHeader><CardTitle className="text-base">All documents</CardTitle></CardHeader><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Number</TableHead><TableHead>Provider</TableHead><TableHead>Issued</TableHead><TableHead>Expires</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No documents.</TableCell></TableRow>}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="capitalize">{r.doc_type}</TableCell>
                <TableCell>{r.doc_no ?? "—"}</TableCell>
                <TableCell>{r.provider ?? "—"}</TableCell>
                <TableCell>{fmtDate(r.issued_on)}</TableCell>
                <TableCell className={expiryClass(r.expires_on)}>{fmtDate(r.expires_on)}</TableCell>
                <TableCell>{r.file_url && <Button variant="ghost" size="icon" onClick={() => openFile(r.file_url!)}><Download className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add document</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">
              <Select value={form.doc_type} onValueChange={(v) => setForm({ ...form, doc_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Document Number"><Input value={form.doc_no} onChange={(e) => setForm({ ...form, doc_no: e.target.value })} /></Field>
            <Field label="Provider"><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} /></Field>
            <Field label="Issued On"><Input type="date" value={form.issued_on} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} /></Field>
            <Field label="Expires On"><Input type="date" value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} /></Field>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1"><Upload className="h-3 w-3" />Document file</Label>
              <Input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="sm:col-span-2"><Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- Tyres tab ----------------
function TyresTab({ vehicleId, rows, onChanged }: { vehicleId: string; rows: Tyre[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const empty = { position: "", brand: "", serial_no: "", fitted_on: "", fitted_km: "", removed_on: "", removed_km: "", cost: "", notes: "" };
  const [form, setForm] = useState(empty);
  const save = async () => {
    const { error } = await supabase.from("tyres").insert({
      vehicle_id: vehicleId, position: form.position || null, brand: form.brand || null,
      serial_no: form.serial_no || null, fitted_on: form.fitted_on || null,
      fitted_km: form.fitted_km ? Number(form.fitted_km) : null,
      removed_on: form.removed_on || null,
      removed_km: form.removed_km ? Number(form.removed_km) : null,
      cost: form.cost ? Number(form.cost) : null, notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Saved"); setOpen(false); setForm(empty); onChanged();
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Add tyre</Button></div>
      <Card><CardContent className="p-0"><Table>
        <TableHeader><TableRow><TableHead>Position</TableHead><TableHead>Brand</TableHead><TableHead>Serial</TableHead><TableHead>Fitted</TableHead><TableHead>Removed</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No tyres tracked yet.</TableCell></TableRow>}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="flex items-center gap-2"><Circle className="h-3 w-3" />{r.position ?? "—"}</TableCell>
              <TableCell>{r.brand ?? "—"}</TableCell>
              <TableCell className="text-xs">{r.serial_no ?? "—"}</TableCell>
              <TableCell className="text-xs">{fmtDate(r.fitted_on)}{r.fitted_km ? ` · ${r.fitted_km} km` : ""}</TableCell>
              <TableCell className="text-xs">{r.removed_on ? `${fmtDate(r.removed_on)}${r.removed_km ? ` · ${r.removed_km} km` : ""}` : <Badge variant="outline" className="bg-emerald-100 text-emerald-700">In use</Badge>}</TableCell>
              <TableCell className="text-right">{r.cost ? inr(r.cost) : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add tyre</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Position"><Input placeholder="Front Left, Rear Right…" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} /></Field>
            <Field label="Brand"><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></Field>
            <Field label="Serial No"><Input value={form.serial_no} onChange={(e) => setForm({ ...form, serial_no: e.target.value })} /></Field>
            <Field label="Cost (₹)"><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></Field>
            <Field label="Fitted on"><Input type="date" value={form.fitted_on} onChange={(e) => setForm({ ...form, fitted_on: e.target.value })} /></Field>
            <Field label="Fitted km"><Input type="number" value={form.fitted_km} onChange={(e) => setForm({ ...form, fitted_km: e.target.value })} /></Field>
            <Field label="Removed on"><Input type="date" value={form.removed_on} onChange={(e) => setForm({ ...form, removed_on: e.target.value })} /></Field>
            <Field label="Removed km"><Input type="number" value={form.removed_km} onChange={(e) => setForm({ ...form, removed_km: e.target.value })} /></Field>
            <div className="sm:col-span-2"><Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field></div>
          </div>
          <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
