import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, MapPin } from "lucide-react";
import { useCurrentUser, useIsAdmin } from "@/lib/use-role";

export const Route = createFileRoute("/_authenticated/routes")({
  head: () => ({ meta: [{ title: "Routes & Stops — Transport Admin" }] }),
  component: RoutesPage,
});

function RoutesPage() {
  const { user } = useCurrentUser();
  const isAdmin = useIsAdmin(user?.id);
  const [routes, setRoutes] = useState<any[]>([]);
  const [buses, setBuses] = useState<any[]>([]);
  const [routeOpen, setRouteOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState<string | null>(null);
  const [routeForm, setRouteForm] = useState({ name: "", bus_id: "", notes: "" });
  const [stopForm, setStopForm] = useState({ name: "", fare: "0", stop_order: "0" });

  const load = useCallback(async () => {
    const { data: r } = await supabase.from("routes").select("*, buses(bus_no), stops(*)").order("name");
    setRoutes((r ?? []).map((x: any) => ({ ...x, stops: (x.stops ?? []).sort((a: any, b: any) => a.stop_order - b.stop_order) })));
    const { data: b } = await supabase.from("buses").select("id, bus_no").order("bus_no");
    setBuses(b ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const addRoute = async () => {
    if (!routeForm.name) return toast.error("Route name required");
    const { error } = await supabase.from("routes").insert({
      name: routeForm.name, bus_id: routeForm.bus_id || null, notes: routeForm.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Route added");
    setRouteOpen(false); setRouteForm({ name: "", bus_id: "", notes: "" }); load();
  };

  const addStop = async (route_id: string) => {
    if (!stopForm.name) return toast.error("Stop name required");
    const { error } = await supabase.from("stops").insert({
      route_id, name: stopForm.name, fare: Number(stopForm.fare) || 0, stop_order: Number(stopForm.stop_order) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Stop added");
    setStopOpen(null); setStopForm({ name: "", fare: "0", stop_order: "0" }); load();
  };

  const delRoute = async (id: string) => {
    if (!confirm("Delete this route and all its stops?")) return;
    const { error } = await supabase.from("routes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };
  const delStop = async (id: string) => {
    if (!confirm("Delete this stop?")) return;
    const { error } = await supabase.from("stops").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Routes & Stops</h1>
          <p className="text-sm text-muted-foreground">Define routes, assign a bus, and set per-stop fares.</p>
        </div>
        <Dialog open={routeOpen} onOpenChange={setRouteOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add route</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New route</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Route name</Label><Input value={routeForm.name} onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })} placeholder="Route 1 — North City" /></div>
              <div className="space-y-1"><Label>Assigned bus</Label>
                <Select value={routeForm.bus_id} onValueChange={(v) => setRouteForm({ ...routeForm, bus_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>{buses.map((b) => <SelectItem key={b.id} value={b.id}>{b.bus_no}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Notes</Label><Input value={routeForm.notes} onChange={(e) => setRouteForm({ ...routeForm, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={addRoute}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {routes.length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">No routes yet. Add your first route to get started.</CardContent></Card>}

      <div className="grid gap-4 md:grid-cols-2">
        {routes.map((r) => (
          <Card key={r.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{r.name}</CardTitle>
                <p className="text-xs text-muted-foreground">Bus: {r.buses?.bus_no ?? "—"}</p>
              </div>
              <div className="flex gap-1">
                <Dialog open={stopOpen === r.id} onOpenChange={(o) => setStopOpen(o ? r.id : null)}>
                  <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="mr-1 h-3 w-3" /> Stop</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add stop to {r.name}</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 space-y-1"><Label>Stop name</Label><Input value={stopForm.name} onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })} /></div>
                      <div className="space-y-1"><Label>Fare (₹)</Label><Input type="number" value={stopForm.fare} onChange={(e) => setStopForm({ ...stopForm, fare: e.target.value })} /></div>
                      <div className="space-y-1"><Label>Order</Label><Input type="number" value={stopForm.stop_order} onChange={(e) => setStopForm({ ...stopForm, stop_order: e.target.value })} /></div>
                    </div>
                    <DialogFooter><Button onClick={() => addStop(r.id)}>Add</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
                {isAdmin && <Button size="icon" variant="ghost" onClick={() => delRoute(r.id)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </CardHeader>
            <CardContent>
              {r.stops.length === 0 && <p className="text-sm text-muted-foreground">No stops yet.</p>}
              <ul className="divide-y">
                {r.stops.map((s: any) => (
                  <li key={s.id} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{inr(s.fare)}</span>
                      {isAdmin && <Button size="icon" variant="ghost" onClick={() => delStop(s.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
