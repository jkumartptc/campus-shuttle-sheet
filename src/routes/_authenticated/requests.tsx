import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Trash2, ExternalLink, Camera } from "lucide-react";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({ meta: [{ title: "Transport Requests — Admin" }] }),
  component: RequestsPage,
});

type Req = {
  id: string; name: string; register_no: string; department: string; year: string;
  mobile: string; father_name: string; father_mobile: string; bus_stop_name: string;
  bus_fee: number | null;
  status: string; remarks: string | null; created_at: string;
};

const currentAcademicYear = () => {
  const d = new Date();
  const y = d.getFullYear();
  return d.getMonth() >= 5 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
};

function RequestsPage() {
  const [rows, setRows] = useState<Req[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [q, setQ] = useState("");
  const [shareUrl, setShareUrl] = useState("");

  const load = async () => {
    const { data, error } = await supabase
      .from("transport_requests").select("*").order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Req[]);
  };

  useEffect(() => {
    load();
    if (typeof window !== "undefined") setShareUrl(`${window.location.origin}/request`);
  }, []);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const pendingStudentId = useRef<string | null>(null);

  const approve = async (r: Req) => {
    // Check if student already exists by roll_no
    const { data: existing } = await supabase
      .from("students").select("id").eq("roll_no", r.register_no).maybeSingle();
    if (existing) {
      toast.error("A student with this register number already exists");
      return;
    }
    // Try to match a stop by name (case-insensitive)
    const { data: stop } = await supabase
      .from("stops").select("id, fare").ilike("name", r.bus_stop_name).maybeSingle();

    const { data: inserted, error: insErr } = await supabase.from("students").insert({
      name: r.name,
      roll_no: r.register_no,
      department: r.department,
      year: r.year,
      phone: r.mobile,
      parent_phone: r.father_mobile,
      academic_year: currentAcademicYear(),
      stop_id: stop?.id ?? null,
      total_fee: Number(stop?.fare ?? r.bus_fee ?? 0),
    }).select("id").single();
    if (insErr || !inserted) return toast.error(insErr?.message ?? "Failed to add student");

    const { error } = await supabase.from("transport_requests").update({ status: "approved" }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Approved & added to Students");
    load();

    // Prompt to capture photo for the newly added student
    if (confirm(`Take a photo for ${r.name} now?`)) {
      pendingStudentId.current = inserted.id;
      photoInputRef.current?.click();
    }
  };

  const capturePhoto = async (studentId: string, file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("Photo must be under 5 MB");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("student-photos").upload(path, file, { contentType: file.type });
    if (upErr) return toast.error(upErr.message);
    const { error } = await supabase.from("students").update({ photo_url: path }).eq("id", studentId);
    if (error) return toast.error(error.message);
    toast.success("Photo saved");
  };

  const onPhotoInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const sid = pendingStudentId.current;
    e.target.value = "";
    pendingStudentId.current = null;
    if (!file || !sid) return;
    await capturePhoto(sid, file);
  };

  const takePhotoFor = (studentId: string) => {
    pendingStudentId.current = studentId;
    photoInputRef.current?.click();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("transport_requests").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this request?")) return;
    const { error } = await supabase.from("transport_requests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied");
  };

  const filtered = rows.filter((r) => {
    const matchF = filter === "all" || r.status === filter;
    const matchQ = !q || [r.name, r.register_no, r.department, r.bus_stop_name, r.mobile].some(
      (v) => v.toLowerCase().includes(q.toLowerCase()),
    );
    return matchF && matchQ;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transport Requests</h1>
        <p className="text-sm text-muted-foreground">{rows.length} request{rows.length === 1 ? "" : "s"} received</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Shareable request form link</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2 items-center">
          <Input readOnly value={shareUrl} className="flex-1 min-w-[260px] font-mono text-xs" />
          <Button onClick={copyLink}><Copy className="mr-2 h-4 w-4" />Copy</Button>
          <Button variant="outline" asChild><a href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Open</a></Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2 items-center">
            <Input placeholder="Search name, register no, stop…" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 min-w-[200px]" />
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Reg No</TableHead>
                <TableHead>Dept / Year</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Father</TableHead>
                <TableHead>Bus Stop</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">No requests.</TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.register_no}</TableCell>
                  <TableCell className="text-muted-foreground">{r.department} · {r.year}</TableCell>
                  <TableCell>{r.mobile}</TableCell>
                  <TableCell className="text-muted-foreground">{r.father_name}<br /><span className="text-xs">{r.father_mobile}</span></TableCell>
                  <TableCell>{r.bus_stop_name}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}>
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1 whitespace-nowrap">
                    {r.status !== "approved" && <Button size="sm" variant="outline" onClick={() => approve(r)}>Approve</Button>}
                    {r.status === "approved" && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        const { data: s } = await supabase.from("students").select("id").eq("roll_no", r.register_no).maybeSingle();
                        if (!s) return toast.error("Student not found");
                        takePhotoFor(s.id);
                      }}>
                        <Camera className="h-4 w-4 mr-1" />Photo
                      </Button>
                    )}
                    {r.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "rejected")}>Reject</Button>}
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
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
