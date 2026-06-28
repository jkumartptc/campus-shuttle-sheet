import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_authenticated/attendance/reports")({
  head: () => ({ meta: [{ title: "Attendance Reports" }] }),
  component: ReportsPage,
});

type Mode = "daily" | "monthly" | "student" | "route";

function ReportsPage() {
  const [mode, setMode] = useState<Mode>("daily");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [routeId, setRouteId] = useState<string>("all");
  const [routes, setRoutes] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("routes").select("id, name").order("name").then(({ data }) => setRoutes(data ?? []));
  }, []);

  const dateRange = useMemo(() => {
    if (mode === "monthly" || mode === "student" || mode === "route") {
      const [y, m] = month.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1)).toISOString().slice(0, 10);
      const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      return { start, end };
    }
    return { start: date, end: date };
  }, [mode, date, month]);

  const load = async () => {
    let q = supabase
      .from("attendance")
      .select("attendance_date, attendance_time, trip, route_id, student_id, students(name, roll_no, department), routes(name)")
      .gte("attendance_date", dateRange.start)
      .lte("attendance_date", dateRange.end)
      .order("attendance_date", { ascending: true });
    if (routeId !== "all") q = q.eq("route_id", routeId);
    const { data } = await q;
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, [mode, dateRange.start, dateRange.end, routeId]);

  const tableData = useMemo(() => buildTable(mode, rows), [mode, rows]);

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(tableData.exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `attendance_${mode}_${dateRange.start}_${dateRange.end}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(`Attendance Report — ${mode.toUpperCase()}`, 40, 40);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`${dateRange.start} → ${dateRange.end}`, 40, 58);
    let y = 84;
    doc.setFont("helvetica", "bold");
    tableData.headers.forEach((h, i) => doc.text(String(h), 40 + i * 110, y));
    y += 14;
    doc.setFont("helvetica", "normal");
    for (const r of tableData.exportRows) {
      if (y > 780) { doc.addPage(); y = 40; }
      tableData.headers.forEach((h, i) => doc.text(String((r as any)[h] ?? ""), 40 + i * 110, y));
      y += 14;
    }
    doc.save(`attendance_${mode}.pdf`);
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={mode} onValueChange={(v: any) => setMode(v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="student">Student-wise</SelectItem>
              <SelectItem value="route">Route-wise</SelectItem>
            </SelectContent>
          </Select>
          {mode === "daily" ? (
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
          ) : (
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
          )}
          <Select value={routeId} onValueChange={setRouteId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Route" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All routes</SelectItem>
              {routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={exportXlsx}><Download className="mr-2 h-4 w-4" /> Excel</Button>
            <Button variant="outline" onClick={exportPdf}><FileText className="mr-2 h-4 w-4" /> PDF</Button>
          </div>
        </div>

        <div className="overflow-auto">
          <Table>
            <TableHeader><TableRow>
              {tableData.headers.map((h) => <TableHead key={h}>{h}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {tableData.exportRows.length === 0 && (
                <TableRow><TableCell colSpan={tableData.headers.length} className="py-6 text-center text-muted-foreground">No records.</TableCell></TableRow>
              )}
              {tableData.exportRows.map((r, i) => (
                <TableRow key={i}>
                  {tableData.headers.map((h) => <TableCell key={h}>{String((r as any)[h] ?? "")}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function buildTable(mode: Mode, rows: any[]): { headers: string[]; exportRows: Record<string, any>[] } {
  if (mode === "daily") {
    return {
      headers: ["Date", "Trip", "Roll No", "Name", "Department", "Route", "Time"],
      exportRows: rows.map((r) => ({
        Date: r.attendance_date,
        Trip: r.trip,
        "Roll No": r.students?.roll_no ?? "",
        Name: r.students?.name ?? "",
        Department: r.students?.department ?? "",
        Route: r.routes?.name ?? "",
        Time: r.attendance_time ? new Date(r.attendance_time).toLocaleTimeString() : "",
      })),
    };
  }
  if (mode === "monthly") {
    const byDate = new Map<string, { morning: number; evening: number }>();
    for (const r of rows) {
      const k = r.attendance_date;
      const c = byDate.get(k) ?? { morning: 0, evening: 0 };
      if (r.trip === "morning") c.morning++; else c.evening++;
      byDate.set(k, c);
    }
    return {
      headers: ["Date", "Morning", "Evening", "Total"],
      exportRows: [...byDate.entries()].sort().map(([d, c]) => ({ Date: d, Morning: c.morning, Evening: c.evening, Total: c.morning + c.evening })),
    };
  }
  if (mode === "student") {
    const byStu = new Map<string, { name: string; roll: string; days: Set<string>; morn: number; eve: number }>();
    for (const r of rows) {
      const id = r.student_id;
      const c = byStu.get(id) ?? { name: r.students?.name ?? "", roll: r.students?.roll_no ?? "", days: new Set<string>(), morn: 0, eve: 0 };
      c.days.add(r.attendance_date);
      if (r.trip === "morning") c.morn++; else c.eve++;
      byStu.set(id, c);
    }
    return {
      headers: ["Roll No", "Name", "Days Present", "Morning", "Evening"],
      exportRows: [...byStu.values()].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({
        "Roll No": c.roll, Name: c.name, "Days Present": c.days.size, Morning: c.morn, Evening: c.eve,
      })),
    };
  }
  // route
  const byRoute = new Map<string, { morning: number; evening: number }>();
  for (const r of rows) {
    const k = r.routes?.name ?? "—";
    const c = byRoute.get(k) ?? { morning: 0, evening: 0 };
    if (r.trip === "morning") c.morning++; else c.evening++;
    byRoute.set(k, c);
  }
  return {
    headers: ["Route", "Morning", "Evening", "Total"],
    exportRows: [...byRoute.entries()].sort().map(([n, c]) => ({ Route: n, Morning: c.morning, Evening: c.evening, Total: c.morning + c.evening })),
  };
}
