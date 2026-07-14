import type { jsPDF } from "jspdf";

import type { NotebookEntry } from "@/lib/dashboard/notebook";
import { noteToPlainText } from "@/lib/utils/rich-text";

export type NotebookPdfInput = {
  businessName: string;
  periodTitle: string;
  entries: NotebookEntry[];
};

const NAVY: [number, number, number] = [11, 18, 32];
const NAVY_PANEL: [number, number, number] = [17, 28, 46];
const NAVY_STRIPE: [number, number, number] = [22, 36, 58];
const EMERALD: [number, number, number] = [16, 185, 129];
const TEXT: [number, number, number] = [241, 245, 249];
const MUTED: [number, number, number] = [148, 163, 184];

function isoToDisplayDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function safeFilePart(name: string): string {
  return name.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 64) || "Business";
}

function paintPageBackground(doc: jsPDF, pageW: number, pageH: number): void {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, pageH, "F");
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
    doc.setFillColor(...EMERALD);
    doc.rect(margin, y, contentW, 3, "F");
    y += 22;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...TEXT);
    doc.text(input.businessName, margin, y, { maxWidth: contentW });
    y += 28;

    doc.setFontSize(14);
    doc.text("Notes +", margin, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...MUTED);
    doc.text(`Period: ${input.periodTitle}`, margin, y);
    y += 16;
    doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y);
  };

  const startY = margin + 22 + 28 + 22 + 16 + 16 + 28;
  const dateW = 84;

  autoTable(doc, {
    theme: "plain",
    startY,
    tableWidth: contentW,
    margin: { left: margin, right: margin, top: margin, bottom: margin },
    head: [["Date", "Note"]],
    body: input.entries.length
      ? input.entries.map((e) => [isoToDisplayDDMMYYYY(e.date), entryCellText(e)])
      : [["—", "No Notes + entries for this period."]],
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: { top: 8, right: 10, bottom: 8, left: 10 },
      textColor: TEXT,
      lineColor: [30, 41, 59],
      lineWidth: 0.25,
      valign: "top",
      fillColor: NAVY_PANEL,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: EMERALD,
      textColor: NAVY,
      fontStyle: "bold",
      lineWidth: 0,
      valign: "middle",
    },
    alternateRowStyles: { fillColor: NAVY_STRIPE, lineWidth: 0 },
    columnStyles: {
      0: { cellWidth: dateW, halign: "left" },
      1: { cellWidth: contentW - dateW, halign: "left" },
    },
    willDrawPage: (data) => {
      paintPageBackground(doc, pageW, pageH);
      if (data.pageNumber === 1) drawHeader();
    },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
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
