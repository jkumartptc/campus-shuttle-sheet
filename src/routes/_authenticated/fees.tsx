import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { inr, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Receipt, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/fees")({
  head: () => ({ meta: [{ title: "Fees Collection — Transport Admin" }] }),
  component: FeesPage,
});

type Student = { id: string; roll_no: string; name: string; total_fee: number };
type Payment = {
  id: string; amount: number; paid_on: string; mode: string; receipt_no: string;
  reference: string | null; remarks: string | null;
  students: { roll_no: string; name: string; total_fee: number } | null;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

function FeesPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    register_no: "", receipt_no: "", amount: "", paid_on: todayISO(),
    mode: "cash", reference: "", remarks: "",
  });
  const [student, setStudent] = useState<Student | null>(null);
  const [lookupErr, setLookupErr] = useState<string | null>(null);
  const [paidSoFar, setPaidSoFar] = useState(0);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("payments")
      .select("id, amount, paid_on, mode, receipt_no, reference, remarks, students(roll_no, name, total_fee)")
      .order("paid_on", { ascending: false })
      .limit(200);
    if (error) return toast.error(error.message);
    setPayments((data ?? []) as any);
  };

  useEffect(() => { load(); }, []);

  // Lookup student when register_no changes
  useEffect(() => {
    const rn = form.register_no.trim();
    if (!rn) { setStudent(null); setLookupErr(null); setPaidSoFar(0); return; }
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("students").select("id, roll_no, name, total_fee").eq("roll_no", rn).maybeSingle();
      if (error) { setLookupErr(error.message); setStudent(null); return; }
      if (!data) { setStudent(null); setLookupErr("No student with this register number"); setPaidSoFar(0); return; }
      setStudent(data as Student); setLookupErr(null);
      const { data: pays } = await supabase.from("payments").select("amount").eq("student_id", data.id);
      const sum = (pays ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      setPaidSoFar(sum);
    }, 250);
    return () => clearTimeout(t);
  }, [form.register_no]);

  const submit = async () => {
    if (!student) return toast.error("Enter a valid register number");
    if (!form.receipt_no.trim()) return toast.error("Receipt number required");
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from("payments").insert({
      student_id: student.id,
      receipt_no: form.receipt_no.trim(),
      amount: amt,
      paid_on: form.paid_on,
      mode: form.mode,
      reference: form.reference.trim() || null,
      remarks: form.remarks.trim() || null,
      recorded_by: userRes.user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Payment of ${inr(amt)} recorded for ${student.name}`);
    setForm({ register_no: "", receipt_no: "", amount: "", paid_on: todayISO(), mode: "cash", reference: "", remarks: "" });
    setStudent(null); setPaidSoFar(0);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this payment?")) return;
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Payment deleted");
    load();
  };

  const filtered = useMemo(() => payments.filter((p) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return [p.receipt_no, p.students?.roll_no, p.students?.name, p.mode]
      .some((v) => (v ?? "").toString().toLowerCase().includes(s));
  }), [payments, q]);

  const totals = useMemo(() => {
    const total = filtered.reduce((s, p) => s + Number(p.amount || 0), 0);
    const cash = filtered.filter((p) => p.mode === "cash").reduce((s, p) => s + Number(p.amount || 0), 0);
    const online = total - cash;
    return { total, cash, online };
  }, [filtered]);

  const balance = student ? Number(student.total_fee) - paidSoFar : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fees Collection</h1>
        <p className="text-sm text-muted-foreground">Record student transport fee payments.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4" /> New payment</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Field label="Register Number *">
            <Input value={form.register_no} onChange={(e) => setForm({ ...form, register_no: e.target.value })} placeholder="e.g. 22CS001" />
            {lookupErr && <p className="mt-1 text-xs text-destructive">{lookupErr}</p>}
            {student && (
              <p className="mt-1 text-xs text-muted-foreground">
                {student.name} · Total {inr(student.total_fee)} · Paid {inr(paidSoFar)} · <span className="font-medium text-foreground">Balance {inr(balance)}</span>
              </p>
            )}
          </Field>
          <Field label="Receipt Number *">
            <Input value={form.receipt_no} onChange={(e) => setForm({ ...form, receipt_no: e.target.value })} placeholder="e.g. R-2026-0001" />
          </Field>
          <Field label="Amount Paid (₹) *">
            <Input type="number" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label="Date *">
            <Input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} />
          </Field>
          <Field label="Mode *">
            <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Reference (txn id / cheque)">
            <Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </Field>
          <div className="md:col-span-3 flex justify-end">
            <Button onClick={submit} disabled={saving || !student}>{saving ? "Saving…" : "Record Payment"}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Total Collected" value={inr(totals.total)} />
        <SummaryCard label="Cash" value={inr(totals.cash)} />
        <SummaryCard label="Online" value={inr(totals.online)} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base flex-1">Payments</CardTitle>
            <Input className="w-64" placeholder="Search receipt, reg no, name…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead>Reg No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No payments yet.</TableCell></TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{fmtDate(p.paid_on)}</TableCell>
                  <TableCell className="font-mono text-xs">{p.receipt_no}</TableCell>
                  <TableCell>{p.students?.roll_no ?? "—"}</TableCell>
                  <TableCell className="font-medium">{p.students?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant={p.mode === "online" ? "default" : "secondary"}>{p.mode}</Badge></TableCell>
                  <TableCell className="text-right font-semibold">{inr(p.amount)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
