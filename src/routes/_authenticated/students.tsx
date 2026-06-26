import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { inr } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Students — Transport Admin" }] }),
  component: StudentsPage,
});

type Row = {
  id: string; roll_no: string; name: string; department: string | null; year: string | null;
  phone: string | null; total_fee: number; academic_year: string;
  stops: { name: string; routes: { name: string } | null } | null;
  paid: number;
};

function StudentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stops, setStops] = useState<{ id: string; name: string; fare: number; routes: { name: string } | null }[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "partial" | "pending">("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    roll_no: "", name: "", department: "", year: "", phone: "", parent_phone: "",
    stop_id: "", academic_year: new Date().getFullYear() + "-" + (new Date().getFullYear() + 1), total_fee: "0",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data: studentsData } = await supabase
      .from("students")
      .select("id, roll_no, name, department, year, phone, total_fee, academic_year, stops(name, routes(name))")
      .order("name");
    const { data: pays } = await supabase.from("payments").select("student_id, amount");
    const paidMap = new Map<string, number>();
    (pays ?? []).forEach((p: any) => paidMap.set(p.student_id, (paidMap.get(p.student_id) ?? 0) + Number(p.amount)));
    setRows(((studentsData ?? []) as any[]).map((s) => ({ ...s, paid: paidMap.get(s.id) ?? 0 })));

    const { data: stopsData } = await supabase
      .from("stops").select("id, name, fare, routes(name)").order("name");
    setStops((stopsData ?? []) as any);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    const matchQ = !q ||
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.roll_no.toLowerCase().includes(q.toLowerCase()) ||
      (r.stops?.routes?.name ?? "").toLowerCase().includes(q.toLowerCase());
    const bal = Number(r.total_fee) - r.paid;
    const status = bal <= 0 && r.total_fee > 0 ? "paid" : r.paid > 0 ? "partial" : "pending";
    const matchF = filter === "all" || filter === status;
    return matchQ && matchF;
  }), [rows, q, filter]);

  const onStopChange = (stop_id: string) => {
    const s = stops.find((x) => x.id === stop_id);
    setForm((f) => ({ ...f, stop_id, total_fee: s ? String(s.fare) : f.total_fee }));
  };

  const submit = async () => {
    if (!form.roll_no || !form.name) return toast.error("Roll no and name required");
    const { error } = await supabase.from("students").insert({
      roll_no: form.roll_no,
      name: form.name,
      department: form.department || null,
      year: form.year || null,
      phone: form.phone || null,
      parent_phone: form.parent_phone || null,
      stop_id: form.stop_id || null,
      academic_year: form.academic_year,
      total_fee: Number(form.total_fee) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Student added");
    setOpen(false);
    setForm({ roll_no: "", name: "", department: "", year: "", phone: "", parent_phone: "", stop_id: "", academic_year: form.academic_year, total_fee: "0" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">{rows.length} student{rows.length === 1 ? "" : "s"} using transport</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Add student</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New student</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Roll No *"><Input value={form.roll_no} onChange={(e) => setForm({ ...form, roll_no: e.target.value })} /></Field>
              <Field label="Name *"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Department"><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
              <Field label="Year"><Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="I / II / III / IV" /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="Parent Phone"><Input value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} /></Field>
              <Field label="Bus Stop">
                <Select value={form.stop_id} onValueChange={onStopChange}>
                  <SelectTrigger><SelectValue placeholder="Select stop" /></SelectTrigger>
                  <SelectContent>
                    {stops.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.routes?.name ? `${s.routes.name} — ` : ""}{s.name} ({inr(s.fare)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Academic Year"><Input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} /></Field>
              <Field label="Total Fee (₹)"><Input type="number" value={form.total_fee} onChange={(e) => setForm({ ...form, total_fee: e.target.value })} /></Field>
            </div>
            <DialogFooter><Button onClick={submit}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search name, roll no, route…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="paid">Fully paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roll No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Dept</TableHead>
                <TableHead>Route / Stop</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No students.</TableCell></TableRow>
              )}
              {filtered.map((r) => {
                const bal = Number(r.total_fee) - r.paid;
                const status = bal <= 0 && r.total_fee > 0 ? "Paid" : r.paid > 0 ? "Partial" : "Pending";
                return (
                  <TableRow key={r.id} className="cursor-pointer">
                    <TableCell><Link to="/students/$id" params={{ id: r.id }} className="font-medium hover:underline">{r.roll_no}</Link></TableCell>
                    <TableCell><Link to="/students/$id" params={{ id: r.id }} className="hover:underline">{r.name}</Link></TableCell>
                    <TableCell className="text-muted-foreground">{r.department ?? "—"} {r.year ? `· ${r.year}` : ""}</TableCell>
                    <TableCell className="text-muted-foreground">{r.stops?.routes?.name ?? "—"} / {r.stops?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">{inr(r.total_fee)}</TableCell>
                    <TableCell className="text-right">{inr(r.paid)}</TableCell>
                    <TableCell className="text-right font-medium">{inr(bal)}</TableCell>
                    <TableCell>
                      <Badge variant={status === "Paid" ? "default" : status === "Partial" ? "secondary" : "destructive"}>{status}</Badge>
                    </TableCell>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
