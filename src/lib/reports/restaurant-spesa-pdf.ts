import type { jsPDF } from "jspdf";

import type { RestaurantSpesaLineRow } from "@/lib/reports/collect-restaurant-spesa-lines";
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

export type RestaurantSpesaPdfInput = {
  businessName: string;
  periodTitle: string;
  lines: RestaurantSpesaLineRow[];
};

function isoToDisplayDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function safeFilePart(name: string): string {
  return name.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 64) || "Business";
}

export async function generateRestaurantSpesaPdfBlob(input: RestaurantSpesaPdfInput): Promise<Blob> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new JsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  const total = input.lines.reduce((acc, r) => acc + r.amount, 0);

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
    doc.text("Purchases & Spesa", margin, y);
    y += 22;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_MUTED);
    doc.text(`Period: ${input.periodTitle}`, margin, y);
    y += 16;
    doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin, y);
  };

  const startY = margin + 22 + 28 + 22 + 16 + 16 + 28;
  const dateW = 78;
  const categoryW = 110;
  const amountW = 90;
  const detailW = contentW - dateW - categoryW - amountW;

  autoTable(doc, {
    theme: "grid",
    startY,
    tableWidth: contentW,
    margin: { left: margin, right: margin, top: margin, bottom: margin },
    head: [["Date", "Category", "Detail", "Amount (EUR)"]],
    body: input.lines.length
      ? input.lines.map((r) => [
          isoToDisplayDDMMYYYY(r.date),
          r.category,
          r.detail,
          formatCurrency(r.amount),
        ])
      : [["—", "—", "No purchases or spesa for this period.", "—"]],
    foot: input.lines.length ? [["Total", "", "", formatCurrency(total)]] : undefined,
    showFoot: "lastPage",
    styles: { ...printTableBaseStyles, fontSize: 9 },
    headStyles: printTableHeadStyles,
    alternateRowStyles: printTableAltRowStyles,
    footStyles: printTableFootStyles,
    columnStyles: {
      0: { cellWidth: dateW, halign: "left" },
      1: { cellWidth: categoryW, halign: "left" },
      2: { cellWidth: detailW, halign: "left" },
      3: { cellWidth: amountW, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.column.index === 3) data.cell.styles.halign = "right";
      else if (data.section === "foot" && data.column.index === 0) data.cell.styles.halign = "left";
      else if (data.section === "foot") data.cell.styles.halign = data.column.index === 3 ? "right" : "left";
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
    doc.text(`LedgerView · Purchases & Spesa · Page ${i} of ${pageCount}`, margin, pageH - 28);
  }

  return doc.output("blob");
}

export async function downloadRestaurantSpesaPdf(input: RestaurantSpesaPdfInput): Promise<void> {
  const blob = await generateRestaurantSpesaPdfBlob(input);
  const url = URL.createObjectURL(blob);
  const monthFileTag = input.periodTitle.replace(/\s+/g, "_");
  const filename = `${safeFilePart(input.businessName)}_spesa_${monthFileTag}.pdf`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
