import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Fuel, Plus, Gauge } from "lucide-react";
import { inr, fmtDate } from "@/lib/format";
import { useCurrentUser, useDriverType } from "@/lib/use-role";

export const Route = createFileRoute("/_authenticated/fuel-log")({
  head: () => ({ meta: [{ title: "Fuel & Odometer Log — Transport Admin" }] }),
  component: FuelLogPage,
});

type Vehicle = { id: string; name: string; reg_no: string | null; category: string };
type FuelLog = {
  id: string; vehicle_id: string | null; filled_on: string; indent_number: string | null;
  fuel_type: string | null; odometer: number; litres: number; rate_per_litre: number;
  total_cost: number; driver: string | null; remarks: string | null; mileage_kmpl: number | null;
};

const FUEL_STATION = "Five Roads Fuel Service Station";
const today = () => new Date().toISOString().slice(0, 10);

const emptyFuel = {
  filled_on: today(), indent_number: "", fuel_type: "diesel",
  odometer: "", litres: "", rate_per_litre: "", driver: "", remarks: "",
};
const emptyOdo = { filled_on: today(), odometer: "", remarks: "" };

function FuelLogPage() {
  const { user } = useCurrentUser();
  const driverType = useDriverType(user?.id);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<FuelLog[]>([]);
  const [vehicleId, setVehicleId] = useState<string>("");
  const [fOpen, setFOpen] = useState(false);
  const [oOpen, setOOpen] = useState(false);
  const [fForm, setFForm] = useState(emptyFuel);
  const [oForm, setOForm] = useState(emptyOdo);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data: v } = await supabase.from("vehicle_master").select("id,name,reg_no,category").order("name");
    let vs = (v ?? []) as Vehicle[];
    if (driverType === "bus") vs = vs.filter((x) => x.category === "Bus");
    else if (driverType === "car") vs = vs.filter((x) => x.category !== "Bus");
    setVehicles(vs);
    if (vs.length && !vs.find((x) => x.id === vehicleId)) setVehicleId(vs[0].id);

    const ids = vs.map((x) => x.id);
    if (ids.length === 0) { setLogs([]); return; }
    const { data: f } = await supabase.from("fuel_logs").select("*")
      .in("vehicle_id", ids)
      .order("filled_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);
    setLogs((f ?? []) as FuelLog[]);
  }, [driverType, vehicleId]);
  useEffect(() => { load(); }, [load]);

  const currentLogs = useMemo(() => logs.filter((l) => l.vehicle_id === vehicleId), [logs, vehicleId]);
  const currentVehicle = vehicles.find((v) => v.id === vehicleId);
  const lastOdo = currentLogs[0]?.odometer ?? null;

  const saveFuel = async () => {
    if (!vehicleId) return toast.error("Select a vehicle");
    if (!fForm.indent_number.trim()) return toast.error("Indent Number is mandatory");
    const litres = Number(fForm.litres), rate = Number(fForm.rate_per_litre), odo = Number(fForm.odometer);
    if (!(litres > 0)) return toast.error("Litres must be greater than 0");
    if (!(rate > 0)) return toast.error("Rate must be greater than 0");
    if (!(odo > 0)) return toast.error("Odometer required");
    if (lastOdo != null && odo <= Number(lastOdo)) {
      return toast.error(`Odometer must be greater than previous reading (${lastOdo})`);
    }
    setSaving(true);
    const { error } = await supabase.from("fuel_logs").insert({
      vehicle_id: vehicleId,
      filled_on: fForm.filled_on,
      indent_number: fForm.indent_number.trim(),
      fuel_type: fForm.fuel_type,
      odometer: odo, litres, rate_per_litre: rate,
      total_cost: Math.round(litres * rate * 100) / 100,
      station: FUEL_STATION, payment_mode: "credit",
      driver: fForm.driver || user?.email || null,
      filled_by: user?.email || null,
      remarks: fForm.remarks || null,
    } as never);
    setSaving(false);
    if (error) {
      if (error.code === "23505") return toast.error("Indent Number already exists");
      if (error.message.includes("odometer_must_increase")) return toast.error("Odometer must be greater than previous reading");
      return toast.error(error.message);
    }
    toast.success("Fuel entry saved"); setFOpen(false); setFForm({ ...emptyFuel, filled_on: today() }); load();
  };

  const saveOdo = async () => {
    if (!vehicleId) return toast.error("Select a vehicle");
    const odo = Number(oForm.odometer);
    if (!(odo > 0)) return toast.error("Odometer required");
    if (lastOdo != null && odo <= Number(lastOdo)) {
      return toast.error(`Odometer must be greater than previous reading (${lastOdo})`);
    }
    setSaving(true);
    // Store odometer-only reading as a zero-fuel fuel_log entry with an auto indent tag.
    const indent = `ODO-${vehicleId.slice(0, 4)}-${Date.now()}`;
    const { error } = await supabase.from("fuel_logs").insert({
      vehicle_id: vehicleId,
      filled_on: oForm.filled_on,
      indent_number: indent,
      fuel_type: "odometer",
      odometer: odo,
      litres: 0, rate_per_litre: 0, total_cost: 0,
      station: null, payment_mode: null,
      driver: user?.email || null,
      filled_by: user?.email || null,
      remarks: oForm.remarks ? `[Odometer reading] ${oForm.remarks}` : "[Odometer reading]",
    } as never);
    setSaving(false);
    if (error) {
      if (error.message.includes("odometer_must_increase")) return toast.error("Odometer must be greater than previous reading");
      return toast.error(error.message);
    }
    toast.success("Odometer reading saved"); setOOpen(false); setOForm({ ...emptyOdo, filled_on: today() }); load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fuel & Odometer Log</h1>
          <p className="text-sm text-muted-foreground">
            Record daily odometer readings and fuel fills for your {driverType === "bus" ? "buses" : driverType === "car" ? "vehicles" : "vehicles"}.
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={oOpen} onOpenChange={setOOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={!vehicleId}><Gauge className="mr-2 h-4 w-4" /> Log odometer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Daily odometer reading</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Date</Label>
                  <Input type="date" value={oForm.filled_on} onChange={(e) => setOForm({ ...oForm, filled_on: e.target.value })} /></div>
                <div className="space-y-1"><Label>Odometer (km)</Label>
                  <Input type="number" value={oForm.odometer} onChange={(e) => setOForm({ ...oForm, odometer: e.target.value })} placeholder={lastOdo ? `> ${lastOdo}` : ""} /></div>
                <div className="col-span-2 space-y-1"><Label>Remarks</Label>
                  <Textarea rows={2} value={oForm.remarks} onChange={(e) => setOForm({ ...oForm, remarks: e.target.value })} /></div>
              </div>
              <DialogFooter><Button disabled={saving} onClick={saveOdo}>Save reading</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={fOpen} onOpenChange={setFOpen}>
            <DialogTrigger asChild>
              <Button disabled={!vehicleId}><Fuel className="mr-2 h-4 w-4" /> Add fuel entry</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New fuel entry</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Date</Label>
                  <Input type="date" value={fForm.filled_on} onChange={(e) => setFForm({ ...fForm, filled_on: e.target.value })} /></div>
                <div className="space-y-1"><Label>Indent Number *</Label>
                  <Input value={fForm.indent_number} onChange={(e) => setFForm({ ...fForm, indent_number: e.target.value })} /></div>
                <div className="space-y-1"><Label>Odometer (km) *</Label>
                  <Input type="number" value={fForm.odometer} onChange={(e) => setFForm({ ...fForm, odometer: e.target.value })} placeholder={lastOdo ? `> ${lastOdo}` : ""} /></div>
                <div className="space-y-1"><Label>Litres *</Label>
                  <Input type="number" step="0.01" value={fForm.litres} onChange={(e) => setFForm({ ...fForm, litres: e.target.value })} /></div>
                <div className="space-y-1"><Label>Rate / litre (₹) *</Label>
                  <Input type="number" step="0.01" value={fForm.rate_per_litre} onChange={(e) => setFForm({ ...fForm, rate_per_litre: e.target.value })} /></div>
                <div className="space-y-1"><Label>Fuel Type</Label>
                  <Select value={fForm.fuel_type} onValueChange={(v) => setFForm({ ...fForm, fuel_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diesel">Diesel</SelectItem>
                      <SelectItem value="petrol">Petrol</SelectItem>
                      <SelectItem value="cng">CNG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1"><Label>Remarks</Label>
                  <Textarea rows={2} value={fForm.remarks} onChange={(e) => setFForm({ ...fForm, remarks: e.target.value })} /></div>
              </div>
              <DialogFooter><Button disabled={saving} onClick={saveFuel}>Save entry</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Vehicle</CardTitle>
            <div className="w-full sm:w-80">
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} · {v.category === "Demo Vehicle" ? "N/A" : (v.reg_no ?? "—")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {currentVehicle && (
            <div className="text-xs text-muted-foreground pt-2">
              Last odometer: <span className="font-medium">{lastOdo != null ? `${Number(lastOdo).toLocaleString()} km` : "—"}</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Indent</TableHead>
              <TableHead className="text-right">Odometer</TableHead>
              <TableHead className="text-right">Litres</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Mileage</TableHead>
              <TableHead>Remarks</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {currentLogs.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">No entries yet.</TableCell></TableRow>
              ) : currentLogs.map((f) => {
                const isOdo = f.fuel_type === "odometer" || Number(f.litres) === 0;
                return (
                  <TableRow key={f.id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(f.filled_on)}</TableCell>
                    <TableCell className="text-xs">{isOdo ? "Odometer" : "Fuel"}</TableCell>
                    <TableCell className="font-mono text-xs">{isOdo ? "—" : (f.indent_number ?? "—")}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(f.odometer).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{isOdo ? "—" : Number(f.litres).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{isOdo ? "—" : inr(f.total_cost)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.mileage_kmpl ? `${Number(f.mileage_kmpl).toFixed(2)} km/L` : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-xs">{f.remarks ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
