import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, StopCircle, CheckCircle2 } from "lucide-react";
import { useCurrentUser } from "@/lib/use-role";
import { beep, vibrate, preloadBeeps, primeAudio } from "@/lib/beep";
import { queueAttendance, flushPending, getPending } from "@/lib/attendance-offline";

export const Route = createFileRoute("/_authenticated/attendance/scan")({
  head: () => ({ meta: [{ title: "Scan QR — Bus Attendance" }] }),
  component: ScanPage,
});

type Last = {
  name: string; roll_no: string; department: string | null;
  route: string | null; stop: string | null; photoUrl: string | null; time: string;
  trip: "morning" | "evening"; offline: boolean;
};

function todayKolkata() {
  return new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
}

function ScanPage() {
  const { user } = useCurrentUser();
  const [scanning, setScanning] = useState(false);
  const [last, setLast] = useState<Last | null>(null);
  const [pending, setPending] = useState(getPending().length);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    const onOnline = async () => {
      setOnline(true);
      const r = await flushPending();
      setPending(getPending().length);
      if (r.flushed) toast.success(`Synced ${r.flushed} pending`);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => { preloadBeeps(); }, []);

  useEffect(() => {
    return () => { stop().catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      try { await scannerRef.current.clear(); } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const start = async () => {
    primeAudio();
    setScanning(true);
    setTimeout(async () => {
      const el = document.getElementById("qr-reader");
      if (!el) return;
      const scanner = new Html5Qrcode("qr-reader", { verbose: false });
      scannerRef.current = scanner;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (text) => onDecoded(text),
          () => {},
        );
      } catch (e: any) {
        toast.error(e?.message || "Camera failed to start");
        setScanning(false);
      }
    }, 50);
  };

  const onDecoded = async (raw: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await handleToken(raw.trim());
    } finally {
      setTimeout(() => { busyRef.current = false; }, 1200);
    }
  };

  const handleToken = async (token: string) => {
    if (!/^[0-9a-f-]{20,}$/i.test(token)) {
      beep("err"); vibrate(300);
      toast.error("Invalid Bus Pass");
      return;
    }
    const { data: rows, error } = await supabase.rpc("resolve_bus_pass_qr", { p_qr_token: token });
    const resolved: any = Array.isArray(rows) ? rows[0] : rows;
    if (error || !resolved) {
      beep("err"); vibrate(300);
      toast.error("Invalid Bus Pass");
      return;
    }
    if (resolved.pass_status === "cancelled") { beep("err"); vibrate(300); toast.error("Bus pass is cancelled"); return; }
    if (resolved.pass_status === "expired") { beep("err"); vibrate(300); toast.error("Bus pass expired"); return; }
    if (resolved.pass_status !== "active") { beep("err"); vibrate(300); toast.error("Bus pass is not active"); return; }
    if (resolved.fee_status !== "paid") { beep("err"); vibrate(300); toast.error("Transport fee is pending"); return; }
    if (resolved.valid_to && new Date(resolved.valid_to) < new Date()) { beep("err"); vibrate(300); toast.error("Bus pass validity expired"); return; }
    const s: any = {
      id: resolved.student_id, name: resolved.student_name, roll_no: resolved.roll_no,
      department: resolved.department, photo_url: resolved.photo_url,
      stops: { name: resolved.stop_name, routes: { id: resolved.route_id, name: resolved.route_name } },
    };
    const hour = new Date().getHours();
    const trip: "morning" | "evening" = hour < 12 ? "morning" : "evening";
    const now = new Date().toISOString();
    const date = todayKolkata();
    const routeId: string | null = resolved.route_id ?? null;


    let lat: number | null = null, lon: number | null = null;
    if (navigator.geolocation) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (p) => { lat = p.coords.latitude; lon = p.coords.longitude; resolve(); },
          () => resolve(),
          { timeout: 1500, maximumAge: 60000 },
        );
      });
    }

    const rec = {
      student_id: s.id,
      attendance_date: date,
      attendance_time: now,
      trip,
      route_id: routeId,
      device_name: navigator.userAgent.slice(0, 80),
      user_id: user?.id ?? null,
      latitude: lat,
      longitude: lon,
      remarks: null,
    };

    let offline = false;
    if (!navigator.onLine) {
      queueAttendance(rec);
      offline = true;
      setPending(getPending().length);
    } else {
      const { error: insErr } = await supabase.from("attendance").insert(rec);
      if (insErr) {
        if (insErr.code === "23505") {
          beep("duplicate"); vibrate([100, 60, 100]);
          toast.warning(`Attendance Already Marked — ${s.name} (${trip})`);
          return;
        }
        // Likely network — queue
        queueAttendance(rec);
        offline = true;
        setPending(getPending().length);
      }
    }

    let photoUrl: string | null = null;
    if (s.photo_url) {
      const { data: signed } = await supabase.storage.from("student-photos").createSignedUrl(s.photo_url, 600);
      photoUrl = signed?.signedUrl ?? null;
    }

    setLast({
      name: s.name, roll_no: s.roll_no, department: s.department,
      route: s.stops?.routes?.name ?? null, stop: s.stops?.name ?? null,
      photoUrl, time: new Date().toLocaleTimeString(), trip, offline,
    });
    if (offline) {
      beep("warning"); vibrate(150);
      toast.message("Offline Mode — Attendance Saved", { description: s.name });
    } else {
      beep("ok"); vibrate([80, 40, 80]);
      toast.success(`Attendance Marked Successfully — ${s.name}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={online ? "default" : "destructive"}>{online ? "Online" : "Offline"}</Badge>
          {pending > 0 && <Badge variant="secondary">Pending sync: {pending}</Badge>}
        </div>
        {!scanning ? (
          <Button size="lg" className="h-16 px-8 text-lg w-full sm:w-auto" onClick={start}>
            <Camera className="mr-2 h-6 w-6" /> Scan QR Code
          </Button>
        ) : (
          <Button size="lg" variant="destructive" className="h-16 px-8 text-lg w-full sm:w-auto" onClick={stop}>
            <StopCircle className="mr-2 h-6 w-6" /> Stop scanning
          </Button>
        )}
      </div>

      {scanning && (
        <Card>
          <CardContent className="p-2">
            <div id="qr-reader" className="mx-auto w-full max-w-sm" />
            <p className="mt-2 text-center text-xs text-muted-foreground">Point the camera at the student's QR code.</p>
          </CardContent>
        </Card>
      )}

      {last && (
        <Card className="border-emerald-500/40">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
            {last.photoUrl ? (
              <img src={last.photoUrl} alt={last.name} className="h-28 w-28 rounded-lg object-cover border" />
            ) : (
              <div className="h-28 w-28 rounded-lg border bg-muted flex items-center justify-center text-xs text-muted-foreground">No photo</div>
            )}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div className="text-base font-semibold">Attendance Marked Successfully</div>
              </div>
              <div className="mt-2 text-xl font-bold">{last.name}</div>
              <div className="text-sm text-muted-foreground">{last.roll_no} · {last.department ?? "—"}</div>
              <div className="text-sm text-muted-foreground">{last.route ?? "—"} / {last.stop ?? "—"}</div>
              <div className="mt-1 flex items-center justify-center sm:justify-start gap-2">
                <Badge>{last.trip.toUpperCase()}</Badge>
                <span className="text-sm">{last.time}</span>
                {last.offline && <Badge variant="secondary">Queued offline</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
