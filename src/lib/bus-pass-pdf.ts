import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { BusPassData } from "@/components/bus-pass-card";
import { fmtAcademicYear } from "@/components/bus-pass-card";
import { collegeLogoUrl } from "@/components/college-logo";

async function imgToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

function fmtDate(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${dt.getFullYear()}`;
}

export async function generateBusPassPdf(data: BusPassData, photoUrl: string | null, action: "print" | "download" = "download") {
  // A5 portrait: 148 x 210 mm
  const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
  const W = 148;
  const H = 210;
  const NAVY: [number, number, number] = [11, 42, 107];

  // Header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 34, "F");
  const logoData = await imgToDataUrl(collegeLogoUrl);
  if (logoData) {
    try {
      // white circle behind logo
      doc.setFillColor(255, 255, 255);
      doc.circle(15, 17, 11, "F");
      doc.addImage(logoData, "JPEG", 5.5, 7.5, 19, 19);
    } catch { /* */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.text("THIAGARAJAR POLYTECHNIC COLLEGE", 30, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("SALEM – 636 005", 30, 16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TRANSPORT BUS PASS", 30, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`ACADEMIC YEAR ${fmtAcademicYear(data.academic_year)}`, 30, 27);

  // ESTD label
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("ESTD. 1958", 7, 39);

  // Photo
  const photoData = photoUrl ? await imgToDataUrl(photoUrl) : null;
  const photoX = 7, photoY = 41, photoW = 30, photoH = 38;
  if (photoData) {
    try { doc.addImage(photoData, "JPEG", photoX, photoY, photoW, photoH); } catch { /* */ }
  }
  doc.setDrawColor(200);
  doc.rect(photoX, photoY, photoW, photoH);

  // Student Name (large)
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(String(data.student_name).toUpperCase(), 40, 46);

  // Status badge top right
  const statusText = (data.pass_status === "fee_pending" ? "active" : data.pass_status).toUpperCase();
  doc.setFillColor(220, 252, 231);
  doc.setDrawColor(110, 200, 140);
  doc.roundedRect(W - 28, 39, 22, 6, 1.5, 1.5, "FD");
  doc.setTextColor(20, 100, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(statusText, W - 17, 43, { align: "center" });

  // Details rows
  doc.setFontSize(8.5);
  let y = 52;
  const rows: Array<[string, string]> = [
    ["Register No.", data.roll_no],
    ["Department", (data.department ?? "—").toUpperCase()],
    ["Year / Sem", data.year ?? "—"],
    ["Route", data.route_name ?? "—"],
    ["Boarding Point", data.boarding_point ?? "—"],
    ["Mobile Number", data.phone ?? "—"],
  ];
  if (data.blood_group) rows.push(["Blood Group", data.blood_group]);
  for (const [k, v] of rows) {
    doc.setFont("helvetica", "normal"); doc.setTextColor(95);
    doc.text(k, 40, y);
    doc.setTextColor(120); doc.text(":", 68, y);
    doc.setFont("helvetica", "bold"); doc.setTextColor(20);
    doc.text(String(v).slice(0, 26), 71, y);
    y += 5;
  }

  // QR
  const qr = await QRCode.toDataURL(data.qr_token, { width: 600, margin: 1, errorCorrectionLevel: "M" });
  const qrSize = 36;
  const qrX = W - qrSize - 8;
  const qrY = 50;
  doc.setDrawColor(180);
  doc.setLineWidth(0.6);
  doc.rect(qrX - 1.5, qrY - 1.5, qrSize + 3, qrSize + 3);
  doc.addImage(qr, "PNG", qrX, qrY, qrSize, qrSize);
  doc.setLineWidth(0.2);

  // Pass ID under QR
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(110);
  doc.text("PASS ID", qrX + qrSize / 2, qrY + qrSize + 5, { align: "center" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(20);
  doc.text(data.pass_id, qrX + qrSize / 2, qrY + qrSize + 9, { align: "center" });

  // Validity + Fee Status
  const boxY = Math.max(y + 4, 96);
  const boxH = 14;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(7, boxY, W - 14, boxH, 2, 2, "FD");
  doc.setDrawColor(167, 243, 208);
  doc.line(W / 2, boxY + 2, W / 2, boxY + boxH - 2);
  doc.setTextColor(80); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  doc.text("VALIDITY", 12, boxY + 5);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(20);
  doc.text(`${fmtDate(data.valid_from)} to ${fmtDate(data.valid_to)}`, 12, boxY + 10);
  const feePaid = (data.fee_status ?? "").toLowerCase() === "paid";
  doc.setTextColor(80); doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  doc.text("FEE STATUS", W / 2 + 5, boxY + 5);
  if (feePaid) { doc.setTextColor(20, 110, 60); } else { doc.setTextColor(200, 100, 0); }
  doc.setFontSize(9);
  doc.text((data.fee_status ?? "—").toUpperCase(), W / 2 + 5, boxY + 10);

  // Instruction
  const insY = boxY + boxH + 3;
  doc.setFillColor(240, 249, 255);
  doc.setDrawColor(186, 230, 253);
  doc.roundedRect(7, insY, W - 14, 13, 2, 2, "FD");
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(60);
  doc.text("This pass is valid only for the above route and boarding point.", W / 2, insY + 5.5, { align: "center" });
  doc.text("Show this QR code to the driver during boarding.", W / 2, insY + 10, { align: "center" });

  // Footer band
  const footY = H - 14;
  doc.setFillColor(...NAVY);
  doc.rect(0, footY, W, 14, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
  doc.text("SAFE TRAVEL   |   REACH ON TIME   |   BE RESPONSIBLE", W / 2, footY + 8.5, { align: "center" });

  const filename = `bus-pass-${data.roll_no}.pdf`;
  if (action === "download") doc.save(filename);
  else { doc.autoPrint(); window.open(doc.output("bloburl"), "_blank"); }
}
