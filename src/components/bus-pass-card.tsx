import { useEffect, useState, forwardRef } from "react";
import QRCode from "qrcode";
import { collegeLogoUrl } from "@/components/college-logo";


export type BusPassData = {
  pass_id: string;
  qr_token: string;
  pass_status: string;
  fee_status: string;
  valid_from: string;
  valid_to: string;
  academic_year: string | null;
  boarding_point: string | null;
  bus_number: string | null;
  route_name: string | null;
  student_name: string;
  roll_no: string;
  department: string | null;
  year: string | null;
  phone: string | null;
  photo_url: string | null;
  blood_group?: string | null;
};

export function statusColor(status: string) {
  switch (status) {
    case "active": return "bg-emerald-500";
    case "expired": return "bg-red-500";
    case "fee_pending": return "bg-orange-500";
    case "cancelled": return "bg-gray-500";
    default: return "bg-slate-500";
  }
}

export const BusPassCard = forwardRef<HTMLDivElement, { data: BusPassData; photoSignedUrl?: string | null }>(
  function BusPassCard({ data, photoSignedUrl }, ref) {
    const [qrUrl, setQrUrl] = useState<string>("");
    useEffect(() => {
      QRCode.toDataURL(data.qr_token, { width: 360, margin: 1, errorCorrectionLevel: "M" })
        .then(setQrUrl).catch(() => setQrUrl(""));
    }, [data.qr_token]);

    const photo = photoSignedUrl ?? null;
    return (
      <div ref={ref} className="bg-white text-slate-900 border-2 border-primary/30 rounded-xl overflow-hidden mx-auto shadow-lg" style={{ width: 420 }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-3 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-white p-1 flex items-center justify-center shrink-0">
            <img src={collegeLogoUrl} alt="College" className="h-full w-full object-contain" crossOrigin="anonymous" />
          </div>

          <div className="flex-1 text-center">
            <div className="text-[15px] font-bold leading-tight">THIAGARAJAR POLYTECHNIC COLLEGE</div>
            <div className="text-[11px] opacity-90">Salem – 636005</div>
            <div className="text-[12px] font-semibold mt-0.5 tracking-wide">TRANSPORT BUS PASS</div>
          </div>
          <div className="text-[10px] text-right opacity-90 leading-tight">
            <div>AY</div><div className="font-semibold">{data.academic_year ?? "—"}</div>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 flex gap-3">
          {photo ? (
            <img src={photo} alt={data.student_name} crossOrigin="anonymous" className="h-28 w-24 object-cover rounded border" />
          ) : (
            <div className="h-28 w-24 border rounded bg-slate-100 flex items-center justify-center text-[10px] text-slate-500">No Photo</div>
          )}
          <div className="flex-1 text-[11px] space-y-0.5">
            <Row label="Name" value={data.student_name} bold />
            <Row label="Reg No" value={data.roll_no} />
            <Row label="Dept" value={data.department ?? "—"} />
            <Row label="Year/Sem" value={data.year ?? "—"} />
            <Row label="Route" value={data.route_name ?? "—"} />
            <Row label="Boarding" value={data.boarding_point ?? "—"} />
            <Row label="Bus No" value={data.bus_number ?? "—"} />
            <Row label="Mobile" value={data.phone ?? "—"} />
            {data.blood_group ? <Row label="Blood" value={data.blood_group} /> : null}
          </div>
        </div>

        <div className="px-4 pb-2 text-[10px] flex justify-between text-slate-600">
          <div>Valid: <b>{data.valid_from}</b> → <b>{data.valid_to}</b></div>
          <div>Fee: <b className="uppercase text-emerald-700">{data.fee_status}</b></div>
        </div>

        {/* QR */}
        <div className="px-4 pb-3 flex flex-col items-center">
          {qrUrl ? <img src={qrUrl} alt="QR" className="h-40 w-40" /> : <div className="h-40 w-40 bg-slate-100" />}
          <div className="mt-1 text-[10px] text-slate-600">Pass ID: <b>{data.pass_id}</b></div>
          <div className="mt-1">
            <span className={`text-[10px] text-white px-2 py-0.5 rounded-full uppercase ${statusColor(data.pass_status)}`}>
              {data.pass_status === "fee_pending" ? "FEE PENDING" : data.pass_status}
            </span>
          </div>
        </div>

        <div className="bg-slate-50 border-t text-center py-2 text-[10px] text-slate-600">
          Show this QR Code while boarding the bus.
        </div>
      </div>
    );
  },
);

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-16 text-slate-500">{label}</span>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
