import type { jsPDF } from "jspdf";

import type { NotebookEntry } from "@/lib/dashboard/notebook";
import {
  PDF_ACCENT,
  PDF_BLACK,
  PDF_MUTED,
  paintPrintPageBackground,
  printTableAltRowStyles,
  printTableBaseStyles,
  printTableHeadStyles,
} from "@/lib/reports/pdf-print-theme";
import { noteToPlainText } from "@/lib/utils/rich-text";

export type NotebookPdfInput = {
  businessName: string;
  periodTitle: string;
  entries: NotebookEntry[];
};

function isoToDisplayDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function safeFilePart(name: string): string {
  return name.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 64) || "Business";
}

function entryCellText(entry: NotebookEntry): string {
  const body = noteToPlainText(entry.body);
  if (entry.title) return `${entry.title}\n${body}`;
  return body || "—";
}

export async function generateNotebookPdfBlob(input: NotebookPdfInput): Promise<Blob> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new JsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;

  const drawHeader = () => {
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
    doc.text("Notes +", margin, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_MUTED);
    doc.text(`Period: ${input.periodTitle}`, margin, y);
    y += 16;
    doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y);
  };

  const startY = margin + 22 + 28 + 22 + 16 + 16 + 28;
  const dateW = 84;

  autoTable(doc, {
    theme: "grid",
    startY,
    tableWidth: contentW,
    margin: { left: margin, right: margin, top: margin, bottom: margin },
    head: [["Date", "Note"]],
    body: input.entries.length
      ? input.entries.map((e) => [isoToDisplayDDMMYYYY(e.date), entryCellText(e)])
      : [["—", "No Notes + entries for this period."]],
    styles: { ...printTableBaseStyles, fontSize: 9, valign: "top" },
    headStyles: printTableHeadStyles,
    alternateRowStyles: printTableAltRowStyles,
    columnStyles: {
      0: { cellWidth: dateW, halign: "left" },
      1: { cellWidth: contentW - dateW, halign: "left" },
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
    doc.text(`LedgerView · Notes + · Page ${i} of ${pageCount}`, margin, pageH - 28);
  }

  return doc.output("blob");
}

export async function downloadNotebookPdf(input: NotebookPdfInput): Promise<void> {
  const blob = await generateNotebookPdfBlob(input);
  const url = URL.createObjectURL(blob);
  const monthFileTag = input.periodTitle.replace(/\s+/g, "_");
  const filename = `${safeFilePart(input.businessName)}_notes-plus_${monthFileTag}.pdf`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
