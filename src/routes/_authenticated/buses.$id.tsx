import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { inr, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Fuel, Wrench } from "lucide-react";
import { useCurrentUser, useIsAdmin } from "@/lib/use-role";

export const Route = createFileRoute("/_authenticated/buses/$id")({
  head: () => ({ meta: [{ title: "Bus details — Transport Admin" }] }),
  component: BusDetail,
});

function BusDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const isAdmin = useIsAdmin(user?.id);

  const [bus, setBus] = useState<any>(null);
  const [fuel, setFuel] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [fuelOpen, setFuelOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [fForm, setFForm] = useState({ filled_on: today, litres: "", rate_per_litre: "", odometer: "", station: "", remarks: "" });
  const [sForm, setSForm] = useState({ service_on: today, service_type: "General service", workshop: "", cost: "", next_due_on: "", remarks: "" });

  const load = useCallback(async () => {
    const { data: b } = await supabase.from("buses").select("*").eq("id", id).single();
    setBus(b);
    const { data: f } = await supabase.from("fuel_logs").select("*").eq("bus_id", id).order("filled_on", { ascending: false });
    setFuel(f ?? []);
    const { data: s } = await supabase.from("service_logs").select("*").eq("bus_id", id).order("service_on", { ascending: false });
    setServices(s ?? []);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthFuel = fuel.filter((x) => new Date(x.filled_on) >= monthStart);
    const totalDieselMonth = monthFuel.reduce((s, x) => s + Number(x.total_cost || 0), 0);
    const mileages = fuel.map((x) => Number(x.mileage_kmpl)).filter((n) => n > 0);
    const avgMileage = mileages.length ? mileages.reduce((a, b) => a + b, 0) / mileages.length : null;
    const sortedFuel = [...fuel].sort((a, b) => new Date(a.filled_on).getTime() - new Date(b.filled_on).getTime());
    const monthKm = (() => {
      const f2 = sortedFuel.filter((x) => new Date(x.filled_on) >= monthStart);
      if (f2.length < 2) return null;
      return Number(f2[f2.length - 1].odometer) - Number(f2[0].odometer);
    })();
    const lastService = services[0]?.service_on ?? null;
    const nextDue = services.map((s) => s.next_due_on).filter(Boolean).sort()[0] ?? null;
    return { totalDieselMonth, avgMileage, monthKm, lastService, nextDue };
  }, [fuel, services]);

  if (!bus) return <div className="text-muted-foreground">Loading…</div>;

  const addFuel = async () => {
    if (!fForm.litres || !fForm.odometer) return toast.error("Litres and odometer required");
    const { error } = await supabase.from("fuel_logs").insert({
      bus_id: id,
      filled_on: fForm.filled_on,
      litres: Number(fForm.litres),
      rate_per_litre: Number(fForm.rate_per_litre) || 0,
      total_cost: Number(fForm.litres) * (Number(fForm.rate_per_litre) || 0),
      odometer: Number(fForm.odometer),
      station: fForm.station || null,
      remarks: fForm.remarks || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Fuel entry saved"); setFuelOpen(false);
    setFForm({ filled_on: today, litres: "", rate_per_litre: "", odometer: "", station: "", remarks: "" });
    load();
  };

  const addService = async () => {
    if (!sForm.service_type) return toast.error("Service type required");
    const { error } = await supabase.from("service_logs").insert({
      bus_id: id, service_on: sForm.service_on, service_type: sForm.service_type,
      workshop: sForm.workshop || null, cost: Number(sForm.cost) || 0,
      next_due_on: sForm.next_due_on || null, remarks: sForm.remarks || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Service entry saved"); setServiceOpen(false);
    setSForm({ service_on: today, service_type: "General service", workshop: "", cost: "", next_due_on: "", remarks: "" });
    load();
  };

  const delFuel = async (fid: string) => {
    if (!confirm("Delete fuel entry?")) return;
    const { error } = await supabase.from("fuel_logs").delete().eq("id", fid);
    if (error) return toast.error(error.message); load();
  };
  const delService = async (sid: string) => {
    if (!confirm("Delete service entry?")) return;
    const { error } = await supabase.from("service_logs").delete().eq("id", sid);
    if (error) return toast.error(error.message); load();
  };

  const delBus = async () => {
    if (!confirm("Delete this bus and all its fuel/service records?")) return;
    const { error } = await supabase.from("buses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    navigate({ to: "/buses" });
  };

  return (
    <div className="space-y-6">
      <Link to="/buses" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to buses
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{bus.bus_no}</h1>
          <p className="text-sm text-muted-foreground">
            {bus.reg_no ?? "—"} · Driver: {bus.driver_name ?? "—"} {bus.driver_phone ? `· ${bus.driver_phone}` : ""} · Capacity {bus.capacity ?? "—"}
          </p>
        </div>
        {isAdmin && <Button variant="destructive" size="icon" onClick={delBus}><Trash2 className="h-4 w-4" /></Button>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Diesel (this month)" value={inr(summary.totalDieselMonth)} />
        <Stat label="Km (this month)" value={summary.monthKm != null ? `${summary.monthKm.toFixed(0)} km` : "—"} />
        <Stat label="Avg mileage" value={summary.avgMileage ? `${summary.avgMileage.toFixed(2)} km/L` : "—"} />
        <Stat label="Last service" value={fmtDate(summary.lastService)} />
        <Stat label="Next due" value={fmtDate(summary.nextDue)} />
      </div>

      <Tabs defaultValue="fuel">
        <TabsList>
          <TabsTrigger value="fuel"><Fuel className="mr-2 h-4 w-4" /> Fuel log</TabsTrigger>
          <TabsTrigger value="service"><Wrench className="mr-2 h-4 w-4" /> Service log</TabsTrigger>
        </TabsList>

        <TabsContent value="fuel">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Diesel fills</CardTitle>
              <Dialog open={fuelOpen} onOpenChange={setFuelOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add fill</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New fuel entry</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Date</Label><Input type="date" value={fForm.filled_on} onChange={(e) => setFForm({ ...fForm, filled_on: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Odometer (km)</Label><Input type="number" value={fForm.odometer} onChange={(e) => setFForm({ ...fForm, odometer: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Litres</Label><Input type="number" step="0.01" value={fForm.litres} onChange={(e) => setFForm({ ...fForm, litres: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Rate / litre (₹)</Label><Input type="number" step="0.01" value={fForm.rate_per_litre} onChange={(e) => setFForm({ ...fForm, rate_per_litre: e.target.value })} /></div>
                    <div className="col-span-2 space-y-1"><Label>Station</Label><Input value={fForm.station} onChange={(e) => setFForm({ ...fForm, station: e.target.value })} /></div>
                    <div className="col-span-2 space-y-1"><Label>Remarks</Label><Textarea value={fForm.remarks} onChange={(e) => setFForm({ ...fForm, remarks: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={addFuel}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead className="text-right">Odo (km)</TableHead>
                  <TableHead className="text-right">Litres</TableHead><TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Mileage</TableHead>
                  <TableHead>Station</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {fuel.length === 0 && <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">No fuel entries yet.</TableCell></TableRow>}
                  {fuel.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{fmtDate(f.filled_on)}</TableCell>
                      <TableCell className="text-right">{Number(f.odometer).toLocaleString()}</TableCell>
                      <TableCell className="text-right">{f.litres}</TableCell>
                      <TableCell className="text-right">{inr(f.rate_per_litre)}</TableCell>
                      <TableCell className="text-right font-medium">{inr(f.total_cost)}</TableCell>
                      <TableCell className="text-right">{f.mileage_kmpl ? `${f.mileage_kmpl} km/L` : "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{f.station ?? "—"}</TableCell>
                      <TableCell className="text-right">{isAdmin && <Button size="icon" variant="ghost" onClick={() => delFuel(f.id)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="service">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Service & repairs</CardTitle>
              <Dialog open={serviceOpen} onOpenChange={setServiceOpen}>
                <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add service</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>New service entry</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Date</Label><Input type="date" value={sForm.service_on} onChange={(e) => setSForm({ ...sForm, service_on: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Type</Label><Input value={sForm.service_type} onChange={(e) => setSForm({ ...sForm, service_type: e.target.value })} placeholder="Oil change / Tyre / Brake / General" /></div>
                    <div className="space-y-1"><Label>Workshop</Label><Input value={sForm.workshop} onChange={(e) => setSForm({ ...sForm, workshop: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Cost (₹)</Label><Input type="number" value={sForm.cost} onChange={(e) => setSForm({ ...sForm, cost: e.target.value })} /></div>
                    <div className="col-span-2 space-y-1"><Label>Next due on</Label><Input type="date" value={sForm.next_due_on} onChange={(e) => setSForm({ ...sForm, next_due_on: e.target.value })} /></div>
                    <div className="col-span-2 space-y-1"><Label>Remarks</Label><Textarea value={sForm.remarks} onChange={(e) => setSForm({ ...sForm, remarks: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={addService}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Workshop</TableHead>
                  <TableHead className="text-right">Cost</TableHead><TableHead>Next due</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {services.length === 0 && <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No service entries yet.</TableCell></TableRow>}
                  {services.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{fmtDate(s.service_on)}</TableCell>
                      <TableCell>{s.service_type}</TableCell>
                      <TableCell className="text-muted-foreground">{s.workshop ?? "—"}</TableCell>
                      <TableCell className="text-right">{inr(s.cost)}</TableCell>
                      <TableCell>{fmtDate(s.next_due_on)}</TableCell>
                      <TableCell className="text-right">{isAdmin && <Button size="icon" variant="ghost" onClick={() => delService(s.id)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
                    </TableRow>
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

function Stat({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="text-base font-semibold">{value}</div></CardContent></Card>;
}
