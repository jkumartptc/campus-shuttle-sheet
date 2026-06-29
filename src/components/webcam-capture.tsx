import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";

type Props = {
  onCapture: (file: File) => void;
  trigger?: React.ReactNode;
  title?: string;
};

export function WebcamCapture({ onCapture, trigger, title = "Take a photo" }: Props) {
  const [open, setOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  };

  const start = async () => {
    setShot(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreaming(true);
    } catch (e: any) {
      toast.error(e?.message || "Unable to access webcam");
      setOpen(false);
    }
  };

  useEffect(() => {
    if (open) start();
    else stop();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const snap = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0);
    setShot(canvas.toDataURL("image/jpeg", 0.9));
  };

  const confirm = async () => {
    if (!shot) return;
    const blob = await (await fetch(shot)).blob();
    const file = new File([blob], `webcam-${Date.now()}.jpg`, { type: "image/jpeg" });
    onCapture(file);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <Camera className="mr-2 h-4 w-4" /> Webcam
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="rounded-md border bg-muted/30 overflow-hidden aspect-[4/3] flex items-center justify-center">
          {shot ? (
            <img src={shot} alt="captured" className="w-full h-full object-contain" />
          ) : (
            <video ref={videoRef} playsInline muted className="w-full h-full object-contain" />
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          {shot ? (
            <>
              <Button type="button" variant="outline" onClick={() => { setShot(null); }}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retake
              </Button>
              <Button type="button" onClick={confirm}>
                <Check className="mr-2 h-4 w-4" /> Use photo
              </Button>
            </>
          ) : (
            <Button type="button" onClick={snap} disabled={!streaming}>
              <Camera className="mr-2 h-4 w-4" /> Capture
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
