import jsPDF from "jspdf";
import { fmtDate, inr } from "./format";

interface ReceiptData {
  receipt_no: string;
  paid_on: string;
  amount: number;
  mode: string;
  reference?: string | null;
  remarks?: string | null;
  student: {
    name: string;
    roll_no: string;
    department?: string | null;
    year?: string | null;
    academic_year: string;
    phone?: string | null;
    parent_phone?: string | null;
  };
  route?: string | null;
  stop?: string | null;
  total_fee: number;
  total_paid: number;
}

export function generateReceiptPdf(d: ReceiptData) {
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const W = doc.internal.pageSize.getWidth();
  let y = 36;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("COLLEGE TRANSPORT", W / 2, y, { align: "center" });
  y += 18;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Transport Fee Receipt", W / 2, y, { align: "center" });
  y += 16;
  doc.setLineWidth(0.5);
  doc.line(24, y, W - 24, y);
  y += 18;

  // Receipt meta
  doc.setFontSize(10);
  doc.text(`Receipt No: ${d.receipt_no}`, 28, y);
  doc.text(`Date: ${fmtDate(d.paid_on)}`, W - 28, y, { align: "right" });
  y += 20;

  const row = (k: string, v: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(k, 28, y);
    doc.setFont("helvetica", "normal");
    doc.text(v, 130, y);
    y += 14;
  };

  row("Name:", d.student.name);
  row("Roll No:", d.student.roll_no);
  row("Department:", `${d.student.department ?? "—"}  (${d.student.year ?? "—"})`);
  row("Academic Year:", d.student.academic_year);
  row("Route / Stop:", `${d.route ?? "—"} / ${d.stop ?? "—"}`);
  row("Phone:", d.student.phone ?? "—");

  y += 6;
  doc.line(24, y, W - 24, y);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Amount Paid:", 28, y);
  doc.text(inr(d.amount), W - 28, y, { align: "right" });
  y += 18;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  row("Payment Mode:", d.mode);
  if (d.reference) row("Reference:", d.reference);

  y += 6;
  doc.line(24, y, W - 24, y);
  y += 16;

  const balance = Number(d.total_fee) - Number(d.total_paid);
  row("Total Fee:", inr(d.total_fee));
  row("Total Paid:", inr(d.total_paid));
  doc.setFont("helvetica", "bold");
  row("Balance:", inr(balance));

  if (d.remarks) {
    y += 6;
    doc.setFont("helvetica", "italic");
    doc.text(`Remarks: ${d.remarks}`, 28, y);
    y += 14;
  }

  // Signature
  y = doc.internal.pageSize.getHeight() - 60;
  doc.setFont("helvetica", "normal");
  doc.line(W - 160, y, W - 28, y);
  doc.text("Authorized Signature", W - 94, y + 14, { align: "center" });

  doc.save(`Receipt-${d.receipt_no}.pdf`);
}
