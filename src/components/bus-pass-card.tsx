import { useEffect, useState, forwardRef } from "react";
import QRCode from "qrcode";
import { Calendar, Bus } from "lucide-react";
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

export function statusBadgeClass(status: string) {
  switch (status) {
    case "active": return "bg-emerald-100 text-emerald-700 border-emerald-300";
    case "expired": return "bg-red-100 text-red-700 border-red-300";
    case "fee_pending": return "bg-orange-100 text-orange-700 border-orange-300";
    case "cancelled": return "bg-gray-100 text-gray-700 border-gray-300";
    default: return "bg-slate-100 text-slate-700 border-slate-300";
  }
}

function fmtDate(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

export function fmtAcademicYear(ay: string | null | undefined): string {
  if (!ay) return "—";
  if (/^\d{4}-\d{4}$/.test(ay)) return ay;
  const m = ay.match(/^(\d{4})-(\d{2,4})$/);
  if (m) {
    const start = m[1];
    const endShort = m[2];
    const endFull = endShort.length === 2 ? `${start.slice(0, 2)}${endShort}` : endShort;
    return `${start}-${endFull}`;
  }
  return ay;
}

export const BusPassCard = forwardRef<HTMLDivElement, { data: BusPassData; photoSignedUrl?: string | null }>(
  function BusPassCard({ data, photoSignedUrl }, ref) {
    const [qrUrl, setQrUrl] = useState<string>("");
    useEffect(() => {
      QRCode.toDataURL(data.qr_token, { width: 480, margin: 1, errorCorrectionLevel: "M" })
        .then(setQrUrl).catch(() => setQrUrl(""));
    }, [data.qr_token]);

    const photo = photoSignedUrl ?? null;
    const printStatus =
      data.pass_status === "fee_pending" ? "active" : data.pass_status;
    const statusLabel = printStatus.toUpperCase();

    return (
      <div
        ref={ref}
        className="bg-white text-slate-900 rounded-xl overflow-hidden mx-auto shadow-md w-full"
        style={{ borderStyle: "dashed", borderWidth: 2, borderColor: "hsl(var(--primary) / 0.4)" }}
      >
        {/* Header */}
        <div className="bg-[#0b2a6b] text-white px-5 py-4 flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-white p-1 flex items-center justify-center shrink-0">
            <img src={collegeLogoUrl} alt="College" className="h-full w-full object-contain rounded-full" crossOrigin="anonymous" />
          </div>
          <div className="flex-1">
            <div className="text-lg sm:text-xl font-bold leading-tight tracking-wide">THIAGARAJAR POLYTECHNIC COLLEGE</div>
            <div className="text-sm opacity-90">SALEM – 636 005</div>
            <div className="text-sm font-semibold mt-1 tracking-wider">TRANSPORT BUS PASS</div>
            <div className="text-xs opacity-80">ACADEMIC YEAR {fmtAcademicYear(data.academic_year)}</div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 grid grid-cols-12 gap-4 relative">
          {/* Photo */}
          <div className="col-span-3">
            {photo ? (
              <img
                src={photo}
                alt={data.student_name}
                crossOrigin="anonymous"
                className="w-full aspect-[3/4] object-cover rounded border"
              />
            ) : (
              <div className="w-full aspect-[3/4] border rounded bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                No Photo
              </div>
            )}
          </div>

          {/* Details */}
          <div className="col-span-6 text-[13px] space-y-1.5">
            <Row label="Name" value={data.student_name} bold />
            <Row label="Register No." value={data.roll_no} bold />
            <Row label="Department" value={(data.department ?? "—").toUpperCase()} />
            <Row label="Year / Sem" value={data.year ?? "—"} />
            <Row label="Route" value={data.route_name ?? "—"} />
            <Row label="Boarding Point" value={data.boarding_point ?? "—"} />
            <Row label="Bus Number" value={data.bus_number ?? "—"} />
            <Row label="Mobile Number" value={data.phone ?? "—"} />
            {data.blood_group ? <Row label="Blood Group" value={data.blood_group} /> : null}
          </div>

          {/* QR + status */}
          <div className="col-span-3 flex flex-col items-center justify-start">
            <span className={`mb-2 text-[10px] font-semibold px-2 py-0.5 rounded border ${statusBadgeClass(printStatus)}`}>
              {statusLabel}
            </span>
            {qrUrl ? (
              <img src={qrUrl} alt="QR" className="w-full max-w-[140px] aspect-square border border-slate-200 rounded-md" />
            ) : (
              <div className="w-full max-w-[140px] aspect-square bg-slate-100 border border-slate-200 rounded-md" />
            )}
            <div className="mt-2 text-center text-[11px] text-slate-600">
              <div>PASS ID</div>
              <div className="font-semibold text-slate-900">{data.pass_id}</div>
            </div>
          </div>
        </div>

        {/* Validity */}
        <div className="mx-5 mb-4 rounded-md border border-emerald-200 bg-emerald-50/60 px-4 py-2.5">
          <div className="flex items-center gap-2 text-[12px]">
            <Calendar className="h-4 w-4 text-emerald-700" />
            <div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">Validity</div>
              <div className="font-semibold text-slate-800">Valid for Full Academic Year {fmtAcademicYear(data.academic_year)}</div>
            </div>
          </div>
        </div>

        {/* Footer slogan */}
        <div className="bg-[#0b2a6b] text-white px-4 py-2.5 flex items-center justify-center gap-6 text-[12px] font-semibold tracking-wider">
          <span className="flex items-center gap-2"><Bus className="h-4 w-4" /> SAFE TRAVEL</span>
          <span className="opacity-50">|</span>
          <span>REACH ON TIME</span>
          <span className="opacity-50">|</span>
          <span>BE RESPONSIBLE</span>
        </div>
      </div>
    );
  },
);

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 text-slate-500">{label}</span>
      <span className="text-slate-500">:</span>
      <span className={bold ? "font-semibold text-slate-900" : "text-slate-800"}>{value}</span>
    </div>
  );
}
