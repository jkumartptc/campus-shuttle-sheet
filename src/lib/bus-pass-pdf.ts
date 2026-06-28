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

export async function generateBusPassPdf(data: BusPassData, photoUrl: string | null, action: "print" | "download" = "download") {
  // A5 portrait: 148 x 210 mm
  const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
  const W = 148;
  // Header band
  doc.setFillColor(34, 84, 166);
  doc.rect(0, 0, W, 28, "F");
  // Logo
  const logoData = await imgToDataUrl(collegeLogoUrl);
  if (logoData) {
    try { doc.addImage(logoData, "JPEG", 4, 3, 22, 22); } catch { /* */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("THIAGARAJAR POLYTECHNIC COLLEGE", W / 2, 10, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Salem – 636005", W / 2, 15, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TRANSPORT BUS PASS", W / 2, 21, { align: "center" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`AY ${fmtAcademicYear(data.academic_year)}`, W - 4, 26, { align: "right" });


  // Photo
  const photoData = photoUrl ? await imgToDataUrl(photoUrl) : null;
  if (photoData) {
    try { doc.addImage(photoData, "JPEG", 8, 30, 28, 34); } catch { /* */ }
  } else {
    doc.setDrawColor(200); doc.rect(8, 30, 28, 34);
  }

  // Details
  doc.setTextColor(20);
  doc.setFontSize(9);
  let y = 32;
  const rows: Array<[string, string]> = [
    ["Name", data.student_name],
    ["Reg No", data.roll_no],
    ["Dept", data.department ?? "—"],
    ["Year/Sem", data.year ?? "—"],
    ["Route", data.route_name ?? "—"],
    ["Boarding", data.boarding_point ?? "—"],
    ["Bus No", data.bus_number ?? "—"],
    ["Mobile", data.phone ?? "—"],
  ];
  for (const [k, v] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(110);
    doc.text(k, 40, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20);
    doc.text(String(v).slice(0, 40), 60, y);
    y += 4.2;
  }

  // Validity + status
  y = 70;
  doc.setDrawColor(220); doc.line(8, y, W - 8, y);
  y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(80);
  doc.text(`Valid for Full Academic Year: ${fmtAcademicYear(data.academic_year)}`, 8, y);

  // QR
  const qr = await QRCode.toDataURL(data.qr_token, { width: 600, margin: 1, errorCorrectionLevel: "M" });
  const qrSize = 70;
  doc.addImage(qr, "PNG", (W - qrSize) / 2, y + 6, qrSize, qrSize);

  y = y + 6 + qrSize + 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20);
  doc.text(`Pass ID: ${data.pass_id}`, W / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(8);
  const printStatus = data.pass_status === "fee_pending" ? "active" : data.pass_status;
  const statusLabel = printStatus.toUpperCase();
  doc.text(`Status: ${statusLabel}`, W / 2, y, { align: "center" });

  // Footer
  doc.setFontSize(8); doc.setTextColor(100);
  doc.text("Show this QR Code while boarding the bus.", W / 2, 205, { align: "center" });

  const filename = `bus-pass-${data.roll_no}.pdf`;
  if (action === "download") doc.save(filename);
  else { doc.autoPrint(); window.open(doc.output("bloburl"), "_blank"); }
}
