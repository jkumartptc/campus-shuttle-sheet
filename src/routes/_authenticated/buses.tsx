import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Bus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/buses")({
  head: () => ({ meta: [{ title: "Buses — Transport Admin" }] }),
  component: BusesPage,
});

function BusesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bus_no: "", reg_no: "", driver_name: "", driver_phone: "", capacity: "" });

  const load = useCallback(async () => {
    const { data } = await supabase.from("buses").select("*").order("bus_no");
    setRows(data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.bus_no) return toast.error("Bus number required");
    const { error } = await supabase.from("buses").insert({
      bus_no: form.bus_no, reg_no: form.reg_no || null,
      driver_name: form.driver_name || null, driver_phone: form.driver_phone || null,
      capacity: form.capacity ? Number(form.capacity) : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Bus added"); setOpen(false);
    setForm({ bus_no: "", reg_no: "", driver_name: "", driver_phone: "", capacity: "" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Buses</h1>
          <p className="text-sm text-muted-foreground">{rows.length} bus{rows.length === 1 ? "" : "es"} on record</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add bus</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New bus</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Bus No *</Label><Input value={form.bus_no} onChange={(e) => setForm({ ...form, bus_no: e.target.value })} /></div>
              <div className="space-y-1"><Label>Registration No</Label><Input value={form.reg_no} onChange={(e) => setForm({ ...form, reg_no: e.target.value })} /></div>
              <div className="space-y-1"><Label>Driver name</Label><Input value={form.driver_name} onChange={(e) => setForm({ ...form, driver_name: e.target.value })} /></div>
              <div className="space-y-1"><Label>Driver phone</Label><Input value={form.driver_phone} onChange={(e) => setForm({ ...form, driver_phone: e.target.value })} /></div>
              <div className="space-y-1"><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={add}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rows.length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">No buses yet.</CardContent></Card>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((b) => (
          <Link key={b.id} to="/buses/$id" params={{ id: b.id }}>
            <Card className="transition hover:border-primary">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Bus className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">{b.bus_no}</div>
                    <div className="text-xs text-muted-foreground">{b.reg_no ?? "—"}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Driver: {b.driver_name ?? "—"} {b.driver_phone ? `· ${b.driver_phone}` : ""}<br />
                  Capacity: {b.capacity ?? "—"}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
