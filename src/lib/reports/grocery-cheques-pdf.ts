import type { jsPDF } from "jspdf";

import type { GroceryChequeLineRow } from "@/lib/reports/collect-grocery-cheques";
import {
  PDF_ACCENT,
  PDF_BLACK,
  PDF_MUTED,
  paintPrintPageBackground,
  printTableAltRowStyles,
  printTableBaseStyles,
  printTableFootStyles,
  printTableHeadStyles,
} from "@/lib/reports/pdf-print-theme";
import { formatCurrency } from "@/lib/utils/formatters";

export type GroceryChequesPdfInput = {
  businessName: string;
  periodTitle: string;
  lines: GroceryChequeLineRow[];
};

function isoToDisplayDDMMYYYY(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function safeFilePart(name: string): string {
  return name.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 64) || "Business";
}

export async function generateGroceryChequesPdfBlob(input: GroceryChequesPdfInput): Promise<Blob> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentW = pageW - margin * 2;
  const total = input.lines.reduce((acc, r) => acc + r.amount, 0);

  const drawHeader = () => {
    let y = margin;
    doc.setFillColor(...PDF_ACCENT);
    doc.rect(margin, y, contentW, 2, "F");
    y += 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...PDF_BLACK);
    doc.text(input.businessName, margin, y, { maxWidth: contentW });
    y += 22;

    doc.setFontSize(13);
    doc.text("Cheques", margin, y);
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_MUTED);
    doc.text(`Period: ${input.periodTitle}`, margin, y);
    y += 14;
    doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y);
  };

  const startY = margin + 20 + 22 + 18 + 14 + 14 + 16;

  autoTable(doc, {
    theme: "grid",
    startY,
    tableWidth: contentW,
    margin: { left: margin, right: margin, top: margin, bottom: margin },
    head: [["Entry date", "Cheque name", "Amount (EUR)", "Due date", "Paid"]],
    body: input.lines.length
      ? input.lines.map((r) => [
          isoToDisplayDDMMYYYY(r.date),
          r.name,
          formatCurrency(r.amount),
          isoToDisplayDDMMYYYY(r.dueDate),
          r.paid ? "Yes" : "No",
        ])
      : [["—", "No cheques for this period.", "—", "—", "—"]],
    foot: input.lines.length ? [["Total", "", formatCurrency(total), "", ""]] : undefined,
    showFoot: "lastPage",
    styles: { ...printTableBaseStyles, fontSize: 9 },
    headStyles: printTableHeadStyles,
    alternateRowStyles: printTableAltRowStyles,
    footStyles: printTableFootStyles,
    columnStyles: {
      0: { cellWidth: 90, halign: "left" },
      1: { cellWidth: "auto", halign: "left" },
      2: { cellWidth: 100, halign: "right" },
      3: { cellWidth: 90, halign: "left" },
      4: { cellWidth: 60, halign: "center" },
    },
    didParseCell: (data) => {
      if (data.column.index === 2) data.cell.styles.halign = "right";
      if (data.column.index === 4) data.cell.styles.halign = "center";
      if (data.section === "foot" && data.column.index === 0) data.cell.styles.halign = "left";
    },
    willDrawPage: (data) => {
      paintPrintPageBackground(doc, pageW, pageH);
      if (data.pageNumber === 1) drawHeader();
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_MUTED);
    doc.text(`LedgerView · Cheques · Page ${i} of ${pageCount}`, margin, pageH - 22);
  }

  return doc.output("blob");
}

export async function downloadGroceryChequesPdf(input: GroceryChequesPdfInput): Promise<void> {
  const blob = await generateGroceryChequesPdfBlob(input);
  const url = URL.createObjectURL(blob);
  const monthFileTag = input.periodTitle.replace(/\s+/g, "_");
  const filename = `${safeFilePart(input.businessName)}_cheques_${monthFileTag}.pdf`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
