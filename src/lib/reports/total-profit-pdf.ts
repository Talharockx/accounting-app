import type { jsPDF } from "jspdf";

import type { MobileTotalProfitRow } from "@/lib/dashboard/mobile-transaction-ledger";
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

export type TotalProfitPdfInput = {
  businessName: string;
  periodTitle: string;
  rows: MobileTotalProfitRow[];
  grandTotal: MobileTotalProfitRow;
};

function isoToDisplayDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function safeFilePart(name: string): string {
  return name.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 64) || "Business";
}

function drawHeader(doc: jsPDF, input: TotalProfitPdfInput, margin: number, contentW: number): void {
  let y = margin;
  doc.setFillColor(...PDF_ACCENT);
  doc.rect(margin, y, contentW, 2, "F");
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...PDF_BLACK);
  doc.text(input.businessName, margin, y, { maxWidth: contentW });
  y += 28;

  doc.setFontSize(14);
  doc.text("Total profit", margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_MUTED);
  doc.text(`Period: ${input.periodTitle}`, margin, y);
  y += 16;
  doc.text("Formula: Total profit = Total sale − (Cash expense + Bank expense)", margin, y);
  y += 16;
  doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y);
}

function tableStartAfterHeader(margin: number): number {
  return margin + 22 + 28 + 22 + 16 + 16 + 16 + 28;
}

export async function downloadTotalProfitPdf(input: TotalProfitPdfInput): Promise<void> {
  const blob = await generateTotalProfitPdfBlob(input);
  const url = URL.createObjectURL(blob);
  const monthFileTag = input.periodTitle.replace(/\s+/g, "_");
  const filename = `${safeFilePart(input.businessName)}_total-profit_${monthFileTag}.pdf`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function generateTotalProfitPdfBlob(input: TotalProfitPdfInput): Promise<Blob> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new JsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  const startY = tableStartAfterHeader(margin);
  const dateW = 84;
  const colW = (contentW - dateW) / 5;

  autoTable(doc, {
    theme: "grid",
    startY,
    tableWidth: contentW,
    margin: { left: margin, right: margin, top: margin, bottom: margin },
    head: [["Date", "Total sale", "Cash expense", "Bank expense", "Total expense", "Total profit"]],
    body: input.rows.length
      ? input.rows.map((r) => [
          isoToDisplayDDMMYYYY(r.date),
          formatCurrency(r.totalSale),
          formatCurrency(r.cashExpense),
          formatCurrency(r.bankExpense),
          formatCurrency(r.totalExpense),
          formatCurrency(r.totalProfit),
        ])
      : [["—", "—", "—", "—", "—", "No entries for this period."]],
    foot: input.rows.length
      ? [
          [
            "Grand Total",
            formatCurrency(input.grandTotal.totalSale),
            formatCurrency(input.grandTotal.cashExpense),
            formatCurrency(input.grandTotal.bankExpense),
            formatCurrency(input.grandTotal.totalExpense),
            formatCurrency(input.grandTotal.totalProfit),
          ],
        ]
      : undefined,
    showFoot: "lastPage",
    styles: { ...printTableBaseStyles, fontSize: 9 },
    headStyles: printTableHeadStyles,
    footStyles: printTableFootStyles,
    alternateRowStyles: printTableAltRowStyles,
    columnStyles: {
      0: { cellWidth: dateW, halign: "left" },
      1: { cellWidth: colW, halign: "right" },
      2: { cellWidth: colW, halign: "right" },
      3: { cellWidth: colW, halign: "right" },
      4: { cellWidth: colW, halign: "right" },
      5: { cellWidth: colW, halign: "right" },
    },
    willDrawPage: (data) => {
      paintPrintPageBackground(doc, pageW, pageH);
      if (data.pageNumber === 1) {
        drawHeader(doc, input, margin, contentW);
      }
    },
    didParseCell: (data) => {
      if (data.column.index === 0) {
        data.cell.styles.halign = "left";
        return;
      }
      data.cell.styles.halign = "right";
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_MUTED);
    doc.text(`LedgerView · Total profit · Page ${i} of ${pageCount}`, margin, pageH - 28);
  }

  return doc.output("blob");
}
