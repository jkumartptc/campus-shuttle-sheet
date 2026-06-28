import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, Download, Printer, ImageDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BusPassCard, type BusPassData } from "@/components/bus-pass-card";
import { generateBusPassPdf } from "@/lib/bus-pass-pdf";

export const Route = createFileRoute("/bus-pass")({
  head: () => ({ meta: [
    { title: "Student Bus Pass — Thiagarajar Polytechnic College" },
    { name: "description", content: "Download your digital bus pass with secure QR code." },
  ] }),
  component: PublicBusPass,
});

function PublicBusPass() {
  const [reg, setReg] = useState("");
  const [mobile, setMobile] = useState("");
  const [loading, setLoading] = useState(false);
  const [pass, setPass] = useState<BusPassData | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const submit = async () => {
    if (!reg.trim() || !mobile.trim()) { toast.error("Enter register number and mobile"); return; }
    setLoading(true); setPass(null); setPhotoUrl(null);
    const { data, error } = await supabase.rpc("get_bus_pass_public", {
      p_register_no: reg.trim(),
      p_mobile: mobile.trim(),
    });
    setLoading(false);
    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      toast.error("Transport fee is pending or student is not registered for transport.");
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as BusPassData;
    setPass(row);
    if (row.photo_url) {
      const { data: signed } = await supabase.storage.from("student-photos").createSignedUrl(row.photo_url, 3600);
      setPhotoUrl(signed?.signedUrl ?? null);
    }
    supabase.rpc("bump_bus_pass_download", { p_qr_token: row.qr_token });
  };

  const onDownloadPdf = async () => {
    if (!pass) return;
    await generateBusPassPdf(pass, photoUrl, "download");
  };
  const onPrint = async () => {
    if (!pass) return;
    await generateBusPassPdf(pass, photoUrl, "print");
  };
  const onSaveImage = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url; a.download = `bus-pass-${pass?.roll_no ?? "pass"}.png`; a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <Bus className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-base sm:text-lg font-bold leading-tight">THIAGARAJAR POLYTECHNIC COLLEGE</h1>
            <p className="text-xs text-muted-foreground">Salem – 636005 · Transport Bus Pass · AY {new Date().getFullYear()}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {!pass && (
          <Card>
            <CardHeader>
              <CardTitle>Get your Bus Pass</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="reg">Register Number</Label>
                  <Input id="reg" value={reg} onChange={(e) => setReg(e.target.value)} placeholder="e.g. 23ME001" />
                </div>
                <div>
                  <Label htmlFor="mob">Mobile Number</Label>
                  <Input id="mob" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Registered mobile" />
                </div>
              </div>
              <Button onClick={submit} disabled={loading} className="w-full sm:w-auto">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Get Bus Pass
              </Button>
              <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1 pt-2">
                <li>Enter your college Register Number and registered Mobile Number.</li>
                <li>Only students with paid transport fee can download the bus pass.</li>
                <li>QR Code is used only for bus attendance — no personal data is stored in the QR.</li>
              </ul>
            </CardContent>
          </Card>
        )}

        {pass && (
          <div className="space-y-4">
            <BusPassCard ref={cardRef} data={pass} photoSignedUrl={photoUrl} />
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={onDownloadPdf}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
              <Button variant="secondary" onClick={onPrint}><Printer className="mr-2 h-4 w-4" />Print</Button>
              <Button variant="outline" onClick={onSaveImage}><ImageDown className="mr-2 h-4 w-4" />Save as Image</Button>
              <Button variant="ghost" onClick={() => { setPass(null); setReg(""); setMobile(""); }}>New lookup</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

