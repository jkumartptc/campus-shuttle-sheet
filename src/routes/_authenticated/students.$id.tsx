import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { inr, fmtDate } from "@/lib/format";
import { generateReceiptPdf } from "@/lib/receipt";
import { toast } from "sonner";
import { ArrowLeft, Download, Plus, Trash2, X } from "lucide-react";
import { useCurrentUser, useIsAdmin } from "@/lib/use-role";

export const Route = createFileRoute("/_authenticated/students/$id")({
  head: () => ({ meta: [{ title: "Student — Transport Admin" }] }),
  component: StudentDetail,
});

function StudentDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const isAdmin = useIsAdmin(user?.id);

  const [student, setStudent] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", paid_on: new Date().toISOString().slice(0, 10), mode: "Cash", reference: "", remarks: "" });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const load = useCallback(async () => {
    const { data: s } = await supabase
      .from("students")
      .select("*, stops(name, fare, routes(name))")
      .eq("id", id)
      .single();
    setStudent(s);
    if (s?.photo_url) {
      const { data: signed } = await supabase.storage.from("student-photos").createSignedUrl(s.photo_url, 3600);
      setPhotoUrl(signed?.signedUrl ?? null);
    } else {
      setPhotoUrl(null);
    }
    const { data: p } = await supabase.from("payments").select("*").eq("student_id", id).order("paid_on", { ascending: false });
    setPayments(p ?? []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const removePhoto = async () => {
    if (!student?.photo_url) return;
    if (!confirm("Remove this student's photo?")) return;
    const { error: delErr } = await supabase.storage.from("student-photos").remove([student.photo_url]);
    if (delErr) return toast.error(delErr.message);
    const { error } = await supabase.from("students").update({ photo_url: null }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Photo removed");
    load();
  };

  const onPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Photo must be under 5 MB");
    setUploadingPhoto(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("student-photos").upload(path, file, { contentType: file.type });
    if (upErr) { setUploadingPhoto(false); return toast.error(upErr.message); }
    if (student?.photo_url) {
      await supabase.storage.from("student-photos").remove([student.photo_url]);
    }
    const { error } = await supabase.from("students").update({ photo_url: path }).eq("id", id);
    setUploadingPhoto(false);
    if (error) return toast.error(error.message);
    toast.success("Photo updated");
    load();
  };

  if (!student) return <div className="text-muted-foreground">Loading…</div>;

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Number(student.total_fee) - totalPaid;

  const recordPayment = async () => {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    const { data, error } = await supabase
      .from("payments")
      .insert({
        student_id: id,
        amount: amt,
        paid_on: form.paid_on,
        mode: form.mode,
        reference: form.reference || null,
        remarks: form.remarks || null,
        recorded_by: user?.id ?? null,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    toast.success(`Payment recorded · ${data.receipt_no}`);
    setOpen(false);
    setForm({ amount: "", paid_on: new Date().toISOString().slice(0, 10), mode: "Cash", reference: "", remarks: "" });
    load();
  };

  const downloadReceipt = (p: any) => {
    generateReceiptPdf({
      receipt_no: p.receipt_no,
      paid_on: p.paid_on,
      amount: Number(p.amount),
      mode: p.mode,
      reference: p.reference,
      remarks: p.remarks,
      student: {
        name: student.name, roll_no: student.roll_no, department: student.department,
        year: student.year, academic_year: student.academic_year, phone: student.phone,
        parent_phone: student.parent_phone,
      },
      route: student.stops?.routes?.name ?? null,
      stop: student.stops?.name ?? null,
      total_fee: Number(student.total_fee),
      total_paid: totalPaid,
    });
  };

  const deletePayment = async (pid: string) => {
    if (!confirm("Delete this payment?")) return;
    const { error } = await supabase.from("payments").delete().eq("id", pid);
    if (error) return toast.error(error.message);
    toast.success("Payment deleted");
    load();
  };

  const deleteStudent = async () => {
    if (!confirm(`Delete ${student.name}? This removes all their payments too.`)) return;
    const { error } = await supabase.from("students").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Student deleted");
    navigate({ to: "/students" });
  };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/students" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to students
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-1">
            <label className="relative group cursor-pointer">
              {photoUrl ? (
                <img src={photoUrl} alt={student.name} className="h-20 w-20 rounded-lg object-cover border" />
              ) : (
                <div className="h-20 w-20 rounded-lg border bg-muted flex items-center justify-center text-xs text-muted-foreground">No photo</div>
              )}
              <div className="absolute inset-0 rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition">
                {uploadingPhoto ? "Uploading…" : "Change"}
              </div>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoUpload} disabled={uploadingPhoto} />
            </label>
            {photoUrl && (
              <button
                type="button"
                onClick={removePhoto}
                className="text-[11px] text-destructive hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{student.name}</h1>
            <p className="text-sm text-muted-foreground">{student.roll_no} · {student.department ?? "—"} · {student.year ?? "—"} · AY {student.academic_year}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Record payment</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Amount (₹)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div className="space-y-1"><Label>Date</Label><Input type="date" value={form.paid_on} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} /></div>
                <div className="space-y-1"><Label>Mode</Label>
                  <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Bank">Bank Transfer</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Txn / Cheque no" /></div>
                <div className="col-span-2 space-y-1"><Label>Remarks</Label><Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={recordPayment}>Save & generate receipt</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          {isAdmin && <Button variant="destructive" size="icon" onClick={deleteStudent}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total Fee" value={inr(student.total_fee)} />
        <StatCard label="Total Paid" value={inr(totalPaid)} />
        <StatCard label="Balance" value={inr(balance)} highlight={balance > 0 ? "amber" : "green"} />
        <StatCard label="Route / Stop" value={`${student.stops?.routes?.name ?? "—"} / ${student.stops?.name ?? "—"}`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Info label="Phone" value={student.phone} />
          <Info label="Parent Phone" value={student.parent_phone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Payment history</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Receipt</TableHead><TableHead>Date</TableHead><TableHead>Mode</TableHead>
              <TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {payments.length === 0 && <TableRow><TableCell colSpan={6} className="py-6 text-center text-muted-foreground">No payments yet.</TableCell></TableRow>}
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.receipt_no}</TableCell>
                  <TableCell>{fmtDate(p.paid_on)}</TableCell>
                  <TableCell>{p.mode}</TableCell>
                  <TableCell className="text-muted-foreground">{p.reference ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{inr(p.amount)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => downloadReceipt(p)}><Download className="h-4 w-4" /></Button>
                    {isAdmin && <Button variant="ghost" size="sm" onClick={() => deletePayment(p.id)}><Trash2 className="h-4 w-4" /></Button>}
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

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: "amber" | "green" }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${highlight === "amber" ? "text-amber-600" : highlight === "green" ? "text-emerald-600" : ""}`}>{value}</div>
    </CardContent></Card>
  );
}
function Info({ label, value }: { label: string; value: string | null }) {
  return <div><div className="text-xs text-muted-foreground">{label}</div><div>{value ?? "—"}</div></div>;
}
