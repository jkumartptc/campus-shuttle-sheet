import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Download,
  Printer,
  ImageDown,
  Loader2,
  Contact,
  Info,
  Check,
  Shield,
  Bus,
} from "lucide-react";
import { toast } from "sonner";
import { BusPassCard, type BusPassData } from "@/components/bus-pass-card";
import { CollegeLogo } from "@/components/college-logo";
import { generateBusPassPdf } from "@/lib/bus-pass-pdf";

export const Route = createFileRoute("/bus-pass")({
  head: () => ({
    meta: [
      { title: "Student Bus Pass — Thiagarajar Polytechnic College" },
      { name: "description", content: "Download your digital bus pass with secure QR code." },
    ],
  }),
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
    if (!reg.trim() || !mobile.trim()) {
      toast.error("Enter register number and mobile");
      return;
    }
    setLoading(true);
    setPass(null);
    setPhotoUrl(null);
    const { data, error } = await supabase.rpc("get_bus_pass_public", {
      p_register_no: reg.trim(),
      p_mobile: mobile.trim(),
    });
    setLoading(false);
    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      toast.error("No bus pass found for the given details.");
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as BusPassData;
    setPass(row);
    if (row.photo_url) {
      const { data: signed } = await supabase.storage
        .from("student-photos")
        .createSignedUrl(row.photo_url, 3600);
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
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `bus-pass-${pass?.roll_no ?? "pass"}.png`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top bar */}
      <header className="border-b bg-card">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-primary font-semibold">
            <Bus className="h-5 w-5" />
            Transport
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-foreground leading-tight">
                Thiagarajar Polytechnic College, Salem – 636 005
              </div>
            </div>
            <CollegeLogo className="h-10 w-10" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Bus Pass</h1>
          <p className="text-muted-foreground text-sm">Download your digital bus pass</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Form card */}
            <Card>
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-2 text-primary">
                  <Contact className="h-5 w-5" />
                  <h2 className="font-semibold text-lg">Get Your Bus Pass</h2>
                </div>
                <p className="text-sm text-muted-foreground -mt-3">
                  Enter your Register Number and Mobile Number
                </p>

                <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="reg">Register Number</Label>
                      <Input
                        id="reg"
                        value={reg}
                        onChange={(e) => setReg(e.target.value)}
                        placeholder="Enter your register number"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="mob">Mobile Number</Label>
                      <Input
                        id="mob"
                        inputMode="tel"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="Enter your mobile number"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={submit}
                    disabled={loading}
                    size="lg"
                    className="h-12 sm:self-end sm:mb-0 px-6"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Contact className="mr-2 h-4 w-4" />
                    )}
                    Get Bus Pass
                  </Button>
                </div>

              </CardContent>
            </Card>

            {/* Pass card (only when fetched) */}
            {pass && (
              <BusPassCard ref={cardRef} data={pass} photoSignedUrl={photoUrl} />
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Instructions */}
            <Card>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-2 text-primary">
                  <Info className="h-5 w-5" />
                  <h2 className="font-semibold text-lg">Instructions</h2>
                </div>
                <ul className="space-y-2.5 text-sm">
                {[
                    "Enter your valid register number and mobile number.",
                    "Your bus pass contains a unique QR code.",
                    "Show this pass to the driver and scan during boarding.",
                    "Do not share your QR code with others.",
                  ].map((t) => (
                    <li key={t} className="flex gap-2">
                      <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{t}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Download panel */}
            {pass && (
              <>
                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                      <Download className="h-5 w-5" />
                      <h2 className="font-semibold text-lg">Download Your Bus Pass</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Your bus pass is ready. You can download or print it.
                    </p>
                    <div className="space-y-2">
                      <Button onClick={onDownloadPdf} className="w-full" size="lg">
                        <Download className="mr-2 h-4 w-4" />
                        Download Bus Pass (PDF)
                      </Button>
                      <Button onClick={onPrint} variant="outline" className="w-full" size="lg">
                        <Printer className="mr-2 h-4 w-4" />
                        Print Bus Pass
                      </Button>
                      <Button onClick={onSaveImage} variant="ghost" className="w-full">
                        <ImageDown className="mr-2 h-4 w-4" />
                        Save as Image
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="p-5 space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                      <Shield className="h-4 w-4" />
                      <h3 className="font-semibold">Important Note</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      This pass is valid only for the above route and boarding point. This is not transferable.
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t bg-card mt-8">
        <div className="mx-auto max-w-7xl px-4 py-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Thiagarajar Polytechnic College. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
