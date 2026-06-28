import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useCurrentUser, useIsAdmin } from "@/lib/use-role";
import { Search, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/attendance/manual")({
  head: () => ({ meta: [{ title: "Manual Attendance — Bus Attendance" }] }),
  component: ManualPage,
});

function todayKolkata() {
  return new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
}

function ManualPage() {
  const { user } = useCurrentUser();
  const isAdmin = useIsAdmin(user?.id);
  const [q, setQ] = useState("");
  const [date, setDate] = useState(todayKolkata());
  const [trip, setTrip] = useState<"morning" | "evening">(new Date().getHours() < 12 ? "morning" : "evening");
  const [students, setStudents] = useState<any[]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set());

  const load = async () => {
    const { data: s } = await supabase
      .from("students")
      .select("id, roll_no, name, department, stops(name, routes(id, name))")
      .order("name").limit(500);
    setStudents(s ?? []);
    const { data: a } = await supabase
      .from("attendance").select("student_id").eq("attendance_date", date).eq("trip", trip);
    setMarked(new Set((a ?? []).map((x: any) => x.student_id)));
  };

  useEffect(() => { load(); }, [date, trip]);

  if (!isAdmin) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Only admins can mark attendance manually.</CardContent></Card>;
  }

  const mark = async (s: any) => {
    const { error } = await supabase.from("attendance").insert({
      student_id: s.id,
      attendance_date: date,
      trip,
      route_id: s.stops?.routes?.id ?? null,
      device_name: "manual",
      user_id: user?.id ?? null,
      remarks: "Manual entry",
    });
    if (error) {
      if (error.code === "23505") toast.warning("Already marked");
      else toast.error(error.message);
      return;
    }
    toast.success(`Marked ${s.name}`);
    setMarked((m) => new Set(m).add(s.id));
  };

  const filtered = students.filter((s) =>
    !q || s.name.toLowerCase().includes(q.toLowerCase()) || s.roll_no.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search name or roll no" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
          <Select value={trip} onValueChange={(v: any) => setTrip(v)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Morning</SelectItem>
              <SelectItem value="evening">Evening</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Roll No</TableHead><TableHead>Name</TableHead><TableHead>Route</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.slice(0, 200).map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-mono text-xs">{s.roll_no}</TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell className="text-muted-foreground">{s.stops?.routes?.name ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {marked.has(s.id) ? (
                    <span className="inline-flex items-center text-emerald-600 text-sm"><Check className="h-4 w-4 mr-1" /> Marked</span>
                  ) : (
                    <Button size="sm" onClick={() => mark(s)}>Mark present</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
