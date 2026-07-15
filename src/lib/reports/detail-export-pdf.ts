import type { jsPDF } from "jspdf";

import type { MobileDetailLineRow } from "@/lib/reports/collect-mobile-detail-lines";
import type { DailyNoteEntry } from "@/lib/reports/period-notes";
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
import { noteToPlainText } from "@/lib/utils/rich-text";

export type DetailExportKind = "notes" | "extras" | "cash_expenses" | "bank_expenses";

export type DetailExportPdfInput = {
  businessName: string;
  periodTitle: string;
  kind: DetailExportKind;
  notes?: DailyNoteEntry[];
  lines?: MobileDetailLineRow[];
};

const KIND_LABELS: Record<DetailExportKind, string> = {
  notes: "Daily Entry Notes",
  extras: "Extras",
  cash_expenses: "Cash Expenses",
  bank_expenses: "Bank Expenses",
};

function isoToDisplayDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function safeFilePart(name: string): string {
  return name.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 64) || "Business";
}

function drawHeader(doc: jsPDF, input: DetailExportPdfInput, margin: number, contentW: number): void {
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
  doc.text(KIND_LABELS[input.kind], margin, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_MUTED);
  doc.text(`Period: ${input.periodTitle}`, margin, y);
  y += 16;
  doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y);
}

function tableStartAfterHeader(margin: number): number {
  return margin + 22 + 28 + 22 + 16 + 16 + 28;
}

function lineTableColumnStyles(contentW: number) {
  const dateW = 84;
  const amountW = 96;
  const itemW = contentW - dateW - amountW;
  return {
    columnStyles: {
      0: { cellWidth: dateW, halign: "left" as const },
      1: { cellWidth: itemW, halign: "left" as const },
      2: { cellWidth: amountW, halign: "right" as const },
    },
  };
}

function sharedTableOptions(margin: number) {
  return {
    theme: "grid" as const,
    styles: { ...printTableBaseStyles, fontSize: 9 },
    headStyles: printTableHeadStyles,
    alternateRowStyles: printTableAltRowStyles,
    margin: { left: margin, right: margin, top: margin, bottom: margin },
  };
}

function alignLineTableCell(data: {
  section: "head" | "body" | "foot";
  column: { index: number };
  cell: { styles: { hallign?: string; halign?: string } };
}) {
  if (data.column.index === 0) {
    data.cell.styles.halign = "left";
    return;
  }
  if (data.column.index === 1) {
    data.cell.styles.halign = data.section === "foot" ? "right" : "left";
    return;
  }
  if (data.column.index === 2) {
    data.cell.styles.halign = "right";
  }
}

export async function generateDetailExportPdfBlob(input: DetailExportPdfInput): Promise<Blob> {
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
  const tableBase = sharedTableOptions(margin);

  const pageHooks = {
    willDrawPage: (data: { pageNumber: number }) => {
      paintPrintPageBackground(doc, pageW, pageH);
      if (data.pageNumber === 1) {
        drawHeader(doc, input, margin, contentW);
      }
    },
  };

  if (input.kind === "notes") {
    const notes = input.notes ?? [];
    const body = notes.map((n) => [isoToDisplayDDMMYYYY(n.date), noteToPlainText(n.html)]);
    const dateW = 84;

    autoTable(doc, {
      ...tableBase,
      ...pageHooks,
      startY,
      tableWidth: contentW,
      head: [["Date", "Notes"]],
      body: body.length ? body : [["—", "No notes for this period."]],
      columnStyles: {
        0: { cellWidth: dateW, halign: "left" },
        1: { cellWidth: contentW - dateW, halign: "left" },
      },
      didParseCell: (data) => {
        data.cell.styles.halign = "left";
      },
    });
  } else {
    const lines = input.lines ?? [];
    const total = lines.reduce((acc, r) => acc + r.amount, 0);
    const nameHeader = input.kind === "extras" ? "Item" : "Detail";
    const { columnStyles } = lineTableColumnStyles(contentW);

    autoTable(doc, {
      ...tableBase,
      ...pageHooks,
      startY,
      tableWidth: contentW,
      head: [["Date", nameHeader, "Amount (EUR)"]],
      body: lines.length
        ? lines.map((r) => [
            isoToDisplayDDMMYYYY(r.date),
            r.itemName,
            formatCurrency(r.amount),
          ])
        : [["—", "No entries for this period.", "—"]],
      foot: lines.length ? [["Total", "", formatCurrency(total)]] : undefined,
      showFoot: "lastPage",
      columnStyles,
      footStyles: printTableFootStyles,
      didParseCell: alignLineTableCell,
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_MUTED);
    doc.text(`LedgerView · ${KIND_LABELS[input.kind]} · Page ${i} of ${pageCount}`, margin, pageH - 28);
  }

  return doc.output("blob");
}

export async function downloadDetailExportPdf(input: DetailExportPdfInput): Promise<void> {
  const blob = await generateDetailExportPdfBlob(input);
  const url = URL.createObjectURL(blob);
  const monthFileTag = input.periodTitle.replace(/\s+/g, "_");
  const kindSlug = input.kind.replace(/_/g, "-");
  const filename = `${safeFilePart(input.businessName)}_${kindSlug}_${monthFileTag}.pdf`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
