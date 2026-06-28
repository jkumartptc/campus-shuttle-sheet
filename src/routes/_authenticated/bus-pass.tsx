import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Printer, RefreshCcw, Ban, FileSpreadsheet, FileDown, Eye } from "lucide-react";
import { BusPassCard, statusColor, type BusPassData } from "@/components/bus-pass-card";
import { generateBusPassPdf } from "@/lib/bus-pass-pdf";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/bus-pass")({
  head: () => ({ meta: [{ title: "Bus Pass — Admin" }] }),
  component: BusPassAdmin,
});

type Row = {
  id: string; pass_id: string; qr_token: string; pass_status: string; fee_status: string;
  valid_from: string; valid_to: string; academic_year: string | null;
  boarding_point: string | null; bus_number: string | null; download_count: number;
  last_download: string | null; created_at: string;
  student_id: string;
  students: { name: string; roll_no: string; department: string | null; year: string | null; phone: string | null; photo_url: string | null; stop_id: string | null } | null;
  routes: { name: string } | null;
};

function BusPassAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [preview, setPreview] = useState<BusPassData | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [issueOpen, setIssueOpen] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [pickStudent, setPickStudent] = useState<string>("");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("bus_pass")
      .select("*, students(name, roll_no, department, year, phone, photo_url, stop_id), routes(name)")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (statusFilter !== "all" && r.pass_status !== statusFilter) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (r.students?.name ?? "").toLowerCase().includes(s)
      || (r.students?.roll_no ?? "").toLowerCase().includes(s)
      || r.pass_id.toLowerCase().includes(s);
  }), [rows, q, statusFilter]);

  const openPreview = async (r: Row) => {
    const data: BusPassData = {
      pass_id: r.pass_id, qr_token: r.qr_token, pass_status: r.pass_status, fee_status: r.fee_status,
      valid_from: r.valid_from, valid_to: r.valid_to, academic_year: r.academic_year,
      boarding_point: r.boarding_point, bus_number: r.bus_number, route_name: r.routes?.name ?? null,
      student_name: r.students?.name ?? "—", roll_no: r.students?.roll_no ?? "—",
      department: r.students?.department ?? null, year: r.students?.year ?? null,
      phone: r.students?.phone ?? null, photo_url: r.students?.photo_url ?? null,
    };
    setPreview(data);
    if (r.students?.photo_url) {
      const { data: signed } = await supabase.storage.from("student-photos").createSignedUrl(r.students.photo_url, 3600);
      setPreviewPhoto(signed?.signedUrl ?? null);
    } else setPreviewPhoto(null);
  };

  const downloadRow = async (r: Row, mode: "print" | "download") => {
    const data: BusPassData = {
      pass_id: r.pass_id, qr_token: r.qr_token, pass_status: r.pass_status, fee_status: r.fee_status,
      valid_from: r.valid_from, valid_to: r.valid_to, academic_year: r.academic_year,
      boarding_point: r.boarding_point, bus_number: r.bus_number, route_name: r.routes?.name ?? null,
      student_name: r.students?.name ?? "—", roll_no: r.students?.roll_no ?? "—",
      department: r.students?.department ?? null, year: r.students?.year ?? null,
      phone: r.students?.phone ?? null, photo_url: r.students?.photo_url ?? null,
    };
    let photoUrl: string | null = null;
    if (r.students?.photo_url) {
      const { data: signed } = await supabase.storage.from("student-photos").createSignedUrl(r.students.photo_url, 3600);
      photoUrl = signed?.signedUrl ?? null;
    }
    await generateBusPassPdf(data, photoUrl, mode);
  };

  const setStatus = async (r: Row, status: string) => {
    const { error } = await supabase.from("bus_pass").update({ pass_status: status }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(`Pass ${status}`); load();
  };

  const regenerateQr = async (r: Row) => {
    const { data, error } = await supabase.from("bus_pass").update({ qr_token: crypto.randomUUID() }).eq("id", r.id).select().single();
    if (error) return toast.error(error.message);
    toast.success("QR regenerated"); load();
    if (data) openPreview({ ...r, qr_token: (data as any).qr_token });
  };

  const openIssue = async () => {
    setIssueOpen(true); setPickStudent("");
    const { data } = await supabase.from("students").select("id, name, roll_no, total_fee, stop_id, academic_year").order("name");
    setStudents(data ?? []);
  };

  const issuePass = async () => {
    if (!pickStudent) return;
    const stu = students.find((s) => s.id === pickStudent);
    if (!stu) return;
    const { data: pays } = await supabase.from("payments").select("amount").eq("student_id", stu.id);
    const paid = (pays ?? []).reduce((a: number, p: any) => a + Number(p.amount || 0), 0);
    const feePaid = paid >= Number(stu.total_fee || 0) && Number(stu.total_fee || 0) > 0;
    // Look up stop -> route -> bus
    let route_id: string | null = null, boarding: string | null = null, bus_no: string | null = null;
    if (stu.stop_id) {
      const { data: stop } = await supabase.from("stops").select("name, route_id, routes(id, bus_id, buses(bus_no))").eq("id", stu.stop_id).maybeSingle();
      if (stop) {
        boarding = (stop as any).name;
        route_id = (stop as any).route_id;
        bus_no = (stop as any).routes?.buses?.bus_no ?? null;
      }
    }
    const ay = stu.academic_year || String(new Date().getFullYear());
    const pass_id = `TPT-${ay}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const { error } = await supabase.from("bus_pass").upsert({
      student_id: stu.id, pass_id, fee_status: feePaid ? "paid" : "pending",
      pass_status: feePaid ? "active" : "fee_pending",
      academic_year: ay, route_id, boarding_point: boarding, bus_number: bus_no,
    }, { onConflict: "student_id" });
    if (error) return toast.error(error.message);
    toast.success("Bus pass issued"); setIssueOpen(false); load();
  };

  const exportExcel = () => {
    const sheet = filtered.map((r) => ({
      PassID: r.pass_id, Name: r.students?.name, Reg: r.students?.roll_no,
      Dept: r.students?.department, Route: r.routes?.name, Boarding: r.boarding_point,
      Bus: r.bus_number, Status: r.pass_status, Fee: r.fee_status,
      ValidFrom: r.valid_from, ValidTo: r.valid_to, Downloads: r.download_count,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet), "BusPasses");
    XLSX.writeFile(wb, "bus-passes.xlsx");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bus Pass</h1>
          <p className="text-sm text-muted-foreground">Issue, manage and report digital bus passes.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openIssue}>Issue Pass</Button>
          <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="mr-2 h-4 w-4" />Export Excel</Button>
        </div>
      </div>

      <Tabs defaultValue="passes">
        <TabsList>
          <TabsTrigger value="passes">Issued Passes</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="passes" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input placeholder="Search name, reg no, pass id" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="fee_pending">Fee Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pass ID</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Route / Boarding</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.pass_id}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.students?.name}</div>
                        <div className="text-xs text-muted-foreground">{r.students?.roll_no} · {r.students?.department}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{r.routes?.name ?? "—"}</div>
                        <div className="text-muted-foreground">{r.boarding_point ?? "—"} · {r.bus_number ?? "—"}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`text-[10px] text-white px-2 py-0.5 rounded-full uppercase ${statusColor(r.pass_status)}`}>
                          {r.pass_status === "fee_pending" ? "FEE PENDING" : r.pass_status}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">{r.valid_from} → {r.valid_to}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button size="icon" variant="ghost" title="Preview" onClick={() => openPreview(r)}><Eye className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" title="Download PDF" onClick={() => downloadRow(r, "download")}><FileDown className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" title="Print" onClick={() => downloadRow(r, "print")}><Printer className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" title="Regenerate QR" onClick={() => regenerateQr(r)}><RefreshCcw className="h-4 w-4" /></Button>
                          {r.pass_status !== "cancelled" ? (
                            <Button size="icon" variant="ghost" title="Cancel" onClick={() => setStatus(r, "cancelled")}><Ban className="h-4 w-4" /></Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setStatus(r, "active")}>Reissue</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filtered.length && (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No passes</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <Stat label="Generated" value={rows.length} />
              <Stat label="Active" value={rows.filter((r) => r.pass_status === "active").length} />
              <Stat label="Cancelled" value={rows.filter((r) => r.pass_status === "cancelled").length} />
              <Stat label="Downloads" value={rows.reduce((a, r) => a + r.download_count, 0)} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bus Pass Preview</DialogTitle></DialogHeader>
          {preview && <BusPassCard data={preview} photoSignedUrl={previewPhoto} />}
          <DialogFooter>
            {preview && (
              <>
                <Button variant="secondary" onClick={() => generateBusPassPdf(preview, previewPhoto, "print")}><Printer className="mr-2 h-4 w-4" />Print</Button>
                <Button onClick={() => generateBusPassPdf(preview, previewPhoto, "download")}><Download className="mr-2 h-4 w-4" />Download</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Issue / Reissue Bus Pass</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={pickStudent} onValueChange={setPickStudent}>
              <SelectTrigger><SelectValue placeholder="Choose student" /></SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} · {s.roll_no}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Status will be set to Active only if transport fee is fully paid; otherwise Fee Pending.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIssueOpen(false)}>Cancel</Button>
            <Button onClick={issuePass} disabled={!pickStudent}>Issue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
