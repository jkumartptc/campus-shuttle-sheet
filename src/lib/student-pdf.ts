import jsPDF from "jspdf";
import { fmtDate, inr } from "./format";

interface StudentPdfData {
  student: {
    name: string;
    roll_no: string;
    department?: string | null;
    year?: string | null;
    academic_year: string;
    phone?: string | null;
    parent_phone?: string | null;
    total_fee: number;
    stops?: { name?: string | null; routes?: { name?: string | null } | null } | null;
  };
  payments: Array<{ receipt_no: string; paid_on: string; mode: string; reference?: string | null; amount: number }>;
  photoDataUrl?: string | null;
}

export function generateStudentPdf({ student, payments, photoDataUrl, action = "print" }: StudentPdfData & { action?: "print" | "download" }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 40;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("COLLEGE TRANSPORT", W / 2, y, { align: "center" });
  y += 18;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Student Details", W / 2, y, { align: "center" });
  y += 14;
  doc.setLineWidth(0.5);
  doc.line(32, y, W - 32, y);
  y += 20;

  if (photoDataUrl) {
    try { doc.addImage(photoDataUrl, "JPEG", W - 120, y, 80, 80); } catch { /* ignore */ }
  }

  const row = (k: string, v: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(k, 40, y);
    doc.setFont("helvetica", "normal");
    doc.text(v, 170, y);
    y += 16;
  };

  doc.setFontSize(11);
  row("Name:", student.name);
  row("Register No:", student.roll_no);
  row("Department:", student.department ?? "—");
  row("Year:", student.year ?? "—");
  row("Academic Year:", student.academic_year);
  row("Phone:", student.phone ?? "—");
  row("Parent Phone:", student.parent_phone ?? "—");
  row("Route:", student.stops?.routes?.name ?? "—");
  row("Bus Stop:", student.stops?.name ?? "—");
  row("Total Fee:", inr(student.total_fee));

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Number(student.total_fee) - totalPaid;
  row("Total Paid:", inr(totalPaid));
  doc.setFont("helvetica", "bold");
  row("Balance:", inr(balance));

  y += 10;
  doc.setLineWidth(0.5);
  doc.line(32, y, W - 32, y);
  y += 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Payment History", 40, y);
  y += 16;
  doc.setFontSize(10);

  if (payments.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.text("No payments recorded.", 40, y);
    y += 14;
  } else {
    doc.setFont("helvetica", "bold");
    doc.text("Receipt", 40, y);
    doc.text("Date", 160, y);
    doc.text("Mode", 240, y);
    doc.text("Reference", 310, y);
    doc.text("Amount", W - 40, y, { align: "right" });
    y += 6;
    doc.line(32, y, W - 32, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    for (const p of payments) {
      if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); y = 40; }
      doc.text(String(p.receipt_no), 40, y);
      doc.text(fmtDate(p.paid_on), 160, y);
      doc.text(p.mode, 240, y);
      doc.text(p.reference ?? "—", 310, y);
      doc.text(inr(p.amount), W - 40, y, { align: "right" });
      y += 14;
    }
  }

  y = doc.internal.pageSize.getHeight() - 50;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, y);

  if (action === "download") {
    doc.save(`Student_${student.roll_no}.pdf`);
  } else {
    doc.autoPrint?.();
    const url = doc.output("bloburl");
    window.open(url, "_blank");
  }
}
