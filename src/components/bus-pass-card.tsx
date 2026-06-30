import { useEffect, useState, forwardRef } from "react";
import QRCode from "qrcode";
import { Calendar, Bus, CheckCircle2 } from "lucide-react";
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
  switch (status.trim().toLowerCase().replace(/[\s-]+/g, "_")) {
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
    const normalizedPassStatus = data.pass_status.trim().toLowerCase().replace(/[\s-]+/g, "_");
    const printStatus =
      normalizedPassStatus === "fee_pending" ? "active" : normalizedPassStatus || data.pass_status;
    const statusLabel = printStatus.toUpperCase();
    const feePaid = (data.fee_status ?? "").toLowerCase() === "paid";

    return (
      <div
        ref={ref}
        className="bg-white text-slate-900 rounded-2xl overflow-hidden mx-auto shadow-lg w-full border border-slate-200"
      >
        {/* Header */}
        <div className="bg-[#0b2a6b] text-white px-6 py-4 flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-white p-1 flex items-center justify-center shrink-0">
            <img src={collegeLogoUrl} alt="College" className="h-full w-full object-contain rounded-full" crossOrigin="anonymous" />
          </div>
          <div className="flex-1 leading-tight">
            <div className="text-xl sm:text-2xl font-extrabold tracking-wide">THIAGARAJAR POLYTECHNIC COLLEGE</div>
            <div className="text-sm opacity-90 mt-0.5">SALEM – 636 005</div>
            <div className="text-base font-semibold mt-1 tracking-wider">TRANSPORT BUS PASS</div>
            <div className="text-xs opacity-90 tracking-wider">ACADEMIC YEAR {fmtAcademicYear(data.academic_year)}</div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pt-5 pb-3 grid grid-cols-12 gap-5 relative">
          {/* Photo + ESTD */}
          <div className="col-span-3">
            <div className="text-[10px] font-semibold text-slate-600 mb-1">ESTD. 1958</div>
            {photo ? (
              <img
                src={photo}
                alt={data.student_name}
                crossOrigin="anonymous"
                className="w-full aspect-[3/4] object-cover rounded border border-slate-200"
              />
            ) : (
              <div className="w-full aspect-[3/4] border rounded bg-slate-100 flex items-center justify-center text-xs text-slate-500">
                No Photo
              </div>
            )}
          </div>

          {/* Details */}
          <div className="col-span-6">
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight uppercase">{data.student_name}</h2>
            </div>
            <div className="text-[13px] space-y-1.5">
              <Row label="Register No." value={data.roll_no} />
              <Row label="Department" value={(data.department ?? "—").toUpperCase()} />
              <Row label="Year / Sem" value={data.year ?? "—"} />
              <Row label="Route" value={data.route_name ?? "—"} />
              <Row label="Boarding Point" value={data.boarding_point ?? "—"} />
              <Row label="Mobile Number" value={data.phone ?? "—"} />
              {data.blood_group ? <Row label="Blood Group" value={data.blood_group} /> : null}
            </div>
          </div>

          {/* QR + status */}
          <div className="col-span-3 flex flex-col items-center">
            <span className={`self-end mb-2 text-[11px] font-bold px-3 py-1 rounded-md border ${statusBadgeClass(printStatus)}`}>
              {statusLabel}
            </span>
            <div className="w-full border-2 border-slate-300 rounded-md p-2 bg-white">
              {qrUrl ? (
                <img src={qrUrl} alt="QR" className="w-full aspect-square" />
              ) : (
                <div className="w-full aspect-square bg-slate-100" />
              )}
            </div>
            <div className="mt-2 text-center">
              <div className="text-[10px] text-slate-500 tracking-wider">PASS ID</div>
              <div className="font-bold text-slate-900 text-sm">{data.pass_id}</div>
            </div>
          </div>
        </div>

        {/* Validity + Fee Status */}
        <div className="mx-6 mt-1 mb-3 rounded-lg border border-emerald-200 bg-emerald-50 grid grid-cols-2 divide-x divide-emerald-200">
          <div className="px-4 py-3 flex items-center gap-3">
            <Calendar className="h-5 w-5 text-emerald-700 shrink-0" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">Validity</div>
              <div className="font-semibold text-slate-800 text-sm">{fmtDate(data.valid_from)} to {fmtDate(data.valid_to)}</div>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className={`h-5 w-5 shrink-0 ${feePaid ? "text-emerald-700" : "text-orange-600"}`} />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-600 font-semibold">Fee Status</div>
              <div className={`font-semibold text-sm ${feePaid ? "text-slate-800" : "text-orange-700"}`}>
                {(data.fee_status ?? "—").toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Instruction note */}
        <div className="mx-6 mb-4 rounded-lg bg-sky-50 border border-sky-100 px-4 py-3 text-center text-[12px] text-slate-700 leading-relaxed">
          This pass is valid only for the above route and boarding point.<br />
          Show this QR code to the driver during boarding.
        </div>

        {/* Footer slogan */}
        <div className="bg-[#0b2a6b] text-white px-4 py-3 flex items-center justify-center gap-6 text-[12px] font-bold tracking-widest">
          <span className="flex items-center gap-2"><Bus className="h-4 w-4" /> SAFE TRAVEL</span>
          <span className="opacity-40">|</span>
          <span>REACH ON TIME</span>
          <span className="opacity-40">|</span>
          <span>BE RESPONSIBLE</span>
        </div>
      </div>
    );
  },
);

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-32 shrink-0 text-slate-600 font-medium">{label}</span>
      <span className="text-slate-500">:</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
