import type { jsPDF } from "jspdf";

import type { LedgerNotebookRowWithBalance } from "@/lib/dashboard/ledger-notebook";
import { formatLedgerMoney, formatMoneyOrBlank } from "@/lib/dashboard/ledger-notebook";
import {
  PDF_ACCENT,
  PDF_BLACK,
  PDF_MUTED,
  paintPrintPageBackground,
  printTableAltRowStyles,
  printTableBaseStyles,
  printTableHeadStyles,
} from "@/lib/reports/pdf-print-theme";

export type LedgerNotebookPdfInput = {
  businessName: string;
  khataName: string;
  periodTitle: string;
  openingBalance: number;
  rows: LedgerNotebookRowWithBalance[];
};

function isoToDisplayDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function safeFilePart(name: string): string {
  return name.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 64) || "Business";
}

export async function generateLedgerNotebookPdfBlob(input: LedgerNotebookPdfInput): Promise<Blob> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentW = pageW - margin * 2;

  const head = [["Date", "Amount", "Paid", "Balance", "Details"]];

  const body =
    input.rows.length > 0
      ? input.rows.map((r) => [
          isoToDisplayDDMMYYYY(r.date),
          formatMoneyOrBlank(r.amount),
          formatMoneyOrBlank(r.paid),
          formatLedgerMoney(r.balance),
          r.details || "—",
        ])
      : [["—", "", "", formatLedgerMoney(input.openingBalance), "No notebook rows for this period."]];

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
    doc.text(`Notebook — ${input.khataName}`, margin, y);
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_MUTED);
    doc.text(`Period: ${input.periodTitle}`, margin, y);
    y += 14;
    doc.text(`Opening balance: ${formatLedgerMoney(input.openingBalance)}`, margin, y);
    y += 12;
    doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y);
  };

  const startY = margin + 20 + 22 + 18 + 14 + 12 + 12 + 16;

  autoTable(doc, {
    theme: "grid",
    startY,
    tableWidth: contentW,
    margin: { left: margin, right: margin, top: margin, bottom: margin },
    head,
    body,
    styles: printTableBaseStyles,
    headStyles: printTableHeadStyles,
    alternateRowStyles: printTableAltRowStyles,
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
    doc.text(`LedgerView · Notebook · Page ${i} of ${pageCount}`, margin, pageH - 22);
  }

  return doc.output("blob");
}

export async function downloadLedgerNotebookPdf(input: LedgerNotebookPdfInput): Promise<void> {
  const blob = await generateLedgerNotebookPdfBlob(input);
  const url = URL.createObjectURL(blob);
  const monthFileTag = input.periodTitle.replace(/\s+/g, "_");
  const filename = `${safeFilePart(input.businessName)}_notebook_${safeFilePart(input.khataName)}_${monthFileTag}.pdf`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
