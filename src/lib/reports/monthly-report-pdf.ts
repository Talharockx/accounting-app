import type { jsPDF } from "jspdf";

import type { DailyFinancialBreakdown, ReportsBusinessType } from "@/lib/dashboard/reports-metrics";
import type { ProfitTrendDatum, SalesVsExpensesDatum } from "@/components/dashboard/reports-performance-charts";

export type MonthlyReportPdfInput = {
  businessName: string;
  dateRangeLabel: string;
  businessTypeLabel: string;
  periodTitle: string;
  dailyRows: DailyFinancialBreakdown[];
  totals: {
    sales: number;
    purchases: number;
    operatingExpenses: number;
    /** Purchases + operating (matches dashboard bar “expenses” series). */
    expenses: number;
    profit: number;
  };
  /** Same series as dashboard bar chart (e.g. last 30 days ending in selected month). */
  salesVsExpensesChart: SalesVsExpensesDatum[];
  /** Same series as dashboard profit line for the month. */
  profitTrendChart: ProfitTrendDatum[];
  /** Restaurant daily-entry notes for the calendar month. */
  monthNotes: { date: string; text: string }[];
};

const NAVY: [number, number, number] = [11, 18, 32];
const NAVY_PANEL: [number, number, number] = [17, 28, 46];
const NAVY_STRIPE: [number, number, number] = [22, 36, 58];
const EMERALD: [number, number, number] = [16, 185, 129];
const EMERALD_SOFT: [number, number, number] = [52, 211, 153];
const EMERALD_DEEP: [number, number, number] = [6, 78, 59];
const TEXT: [number, number, number] = [241, 245, 249];
const MUTED: [number, number, number] = [148, 163, 184];
const ROSE: [number, number, number] = [251, 113, 133];

function money(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function safeFilePart(name: string): string {
  return name.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 64) || "Business";
}

function paintPageBackground(doc: jsPDF, pageW: number, pageH: number): void {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, pageH, "F");
}

export async function generateMonthlyReportPdfBlob(input: MonthlyReportPdfInput): Promise<Blob> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const { captureReportChartsForPdf } = await import("./pdf-chart-snapshot");

  const { salesVsExpensesPng, profitTrendPng } = await captureReportChartsForPdf({
    salesVsExpenses: input.salesVsExpensesChart,
    profitTrend: input.profitTrendChart,
  });

  const doc = new JsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;

  paintPageBackground(doc, pageW, pageH);
  let y = margin;

  doc.setFillColor(...EMERALD);
  doc.rect(margin, y, contentW, 3, "F");
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...TEXT);
  doc.text(input.businessName, margin, y, { maxWidth: contentW });
  y += 30;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...MUTED);
  doc.text("Monthly Financial Statement", margin, y);
  y += 22;

  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(`Report period: ${input.dateRangeLabel}`, margin, y);
  y += 14;
  const generatedOn = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });
  doc.text(`Generated on: ${generatedOn}`, margin, y);
  y += 14;
  doc.setTextColor(...MUTED);
  doc.text(`${input.businessTypeLabel} · ${input.periodTitle}`, margin, y);
  y += 32;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...EMERALD_SOFT);
  doc.text("Executive summary", margin, y);
  y += 18;

  const gap = 8;
  const boxW = (contentW - gap * 3) / 4;
  const boxH = 76;
  const boxTop = y;

  const drawSummaryBox = (
    col: number,
    label: string,
    value: string,
    valueRgb: [number, number, number],
  ) => {
    const x = margin + col * (boxW + gap);
    doc.setFillColor(...NAVY_PANEL);
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.4);
    doc.roundedRect(x, boxTop, boxW, boxH, 6, 6, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 12, boxTop + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...valueRgb);
    const lines = doc.splitTextToSize(value, boxW - 24);
    doc.text(lines, x + 12, boxTop + 44);
  };

  drawSummaryBox(0, "Total sales", money(input.totals.sales), EMERALD_SOFT);
  drawSummaryBox(1, "Purchases", money(input.totals.purchases), MUTED);
  drawSummaryBox(2, "Operating expenses", money(input.totals.operatingExpenses), ROSE);
  const profitRgb: [number, number, number] = input.totals.profit >= 0 ? EMERALD_SOFT : ROSE;
  drawSummaryBox(3, "Net profit / loss", money(input.totals.profit), profitRgb);

  y = boxTop + boxH + 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const marginPct =
    input.totals.sales > 0 ? ((input.totals.profit / input.totals.sales) * 100).toFixed(2) : null;
  doc.text(
    marginPct !== null
      ? `Profit margin (net profit ÷ total sales): ${marginPct}%`
      : "Profit margin: N/A (no sales in period)",
    margin,
    y,
    { maxWidth: contentW },
  );
  y += 28;

  const addChartImage = (dataUrl: string) => {
    const props = doc.getImageProperties(dataUrl);
    const ratio = props.height / props.width;
    let imgW = contentW;
    let imgH = imgW * ratio;
    const maxH = pageH - margin - y - 36;
    if (imgH > maxH && maxH > 80) {
      imgH = maxH;
      imgW = imgH / ratio;
    }
    if (y + imgH > pageH - margin - 24) {
      doc.addPage();
      paintPageBackground(doc, pageW, pageH);
      y = margin;
    }
    const xImg = margin + (contentW - imgW) / 2;
    doc.addImage(dataUrl, "PNG", xImg, y, imgW, imgH, undefined, "FAST");
    y += imgH + 20;
  };

  if (salesVsExpensesPng || profitTrendPng) {
    if (y > pageH - 220) {
      doc.addPage();
      paintPageBackground(doc, pageW, pageH);
      y = margin;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...EMERALD_SOFT);
    doc.text("Performance visualizations", margin, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text("Charts mirror dashboard logic (Recharts → high-resolution raster).", margin, y);
    y += 18;
    if (salesVsExpensesPng) addChartImage(salesVsExpensesPng);
    if (profitTrendPng) addChartImage(profitTrendPng);
  }

  doc.addPage();
  paintPageBackground(doc, pageW, pageH);
  const firstTablePage = doc.getNumberOfPages();
  const tableStartY = margin + 26;

  const body = input.dailyRows.map((row) => [
    row.date,
    money(row.sales),
    money(row.purchases),
    money(row.operatingExpenses),
    money(row.profit),
  ]);

  autoTable(doc, {
    startY: tableStartY,
    head: [["Date", "Total sales", "Purchases", "Operating expenses", "Daily profit"]],
    body: body.length ? body : [["No entries", "—", "—", "—", "—"]],
    foot:
      body.length > 0
        ? [
            [
              "Grand Total",
              money(input.totals.sales),
              money(input.totals.purchases),
              money(input.totals.operatingExpenses),
              money(input.totals.profit),
            ],
          ]
        : [],
    showFoot: "lastPage",
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: { top: 8, right: 10, bottom: 8, left: 10 },
      lineColor: [30, 41, 59],
      lineWidth: 0.25,
      valign: "middle",
      fillColor: NAVY_PANEL,
      textColor: TEXT,
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: EMERALD,
      textColor: [11, 18, 32],
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: NAVY_STRIPE },
    columnStyles: {
      0: { halign: "left", fontStyle: "normal" },
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right", fontStyle: "bold" },
    },
    footStyles: {
      fontStyle: "bold",
      fillColor: EMERALD_DEEP,
      textColor: [209, 250, 229],
      fontSize: 10,
    },
    margin: { left: margin, right: margin, top: margin, bottom: margin },
    willDrawPage: (data) => {
      paintPageBackground(doc, pageW, pageH);
      if (data.pageNumber === firstTablePage) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...EMERALD_SOFT);
        doc.text("Daily breakdown", margin, margin + 10);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text(
          "All amounts in USD · Matches Transactions columns (purchases vs operating). Bar charts use purchases + operating combined.",
          margin,
          margin + 22,
        );
      }
    },
    didParseCell: (data) => {
      if (data.section === "head") {
        data.cell.styles.halign = data.column.index === 0 ? "left" : "right";
      }
      if (data.section === "body" && data.column.index === 4 && input.dailyRows.length > 0) {
        const profit = input.dailyRows[data.row.index]?.profit;
        if (typeof profit === "number" && profit < 0) {
          data.cell.styles.textColor = ROSE;
        }
      }
      if (data.section === "foot" && data.column.index === 0) {
        data.cell.styles.halign = "left";
      }
      if (data.section === "foot" && data.column.index >= 1) {
        data.cell.styles.halign = "right";
      }
    },
  });

  type DocWithAutoTable = typeof doc & { lastAutoTable?: { finalY: number } };
  let notesY = ((doc as DocWithAutoTable).lastAutoTable?.finalY ?? tableStartY + 120) + 28;

  const drawNotesBlock = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...EMERALD_SOFT);
    doc.text("Notes & reminders", margin, notesY);
    notesY += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);

    if (input.monthNotes.length === 0) {
      if (notesY > pageH - 100) {
        doc.addPage();
        paintPageBackground(doc, pageW, pageH);
        notesY = margin + 12;
      }
      doc.setTextColor(...MUTED);
      doc.text(
        "No daily notes were recorded for this month. (Restaurant daily entry notes appear here when provided.)",
        margin,
        notesY,
        { maxWidth: contentW },
      );
      return;
    }

    for (const note of input.monthNotes) {
      const heading = `${note.date}`;
      const bodyLines = doc.splitTextToSize(note.text, contentW - 8);
      const blockH = 14 + bodyLines.length * 11 + 14;
      if (notesY + blockH > pageH - margin) {
        doc.addPage();
        paintPageBackground(doc, pageW, pageH);
        notesY = margin;
      }
      doc.setFillColor(...NAVY_PANEL);
      doc.setDrawColor(30, 41, 59);
      doc.roundedRect(margin, notesY, contentW, blockH, 5, 5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...EMERALD_SOFT);
      doc.text(heading, margin + 10, notesY + 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      doc.text(bodyLines, margin + 10, notesY + 28);
      notesY += blockH + 10;
    }
  };

  drawNotesBlock();

  const blob = doc.output("blob");
  return blob;
}

export async function downloadMonthlyReportPdf(input: MonthlyReportPdfInput): Promise<void> {
  const blob = await generateMonthlyReportPdfBlob(input);
  const url = URL.createObjectURL(blob);
  const monthFileTag = input.periodTitle.replace(/\s+/g, "_");
  const filename = `${safeFilePart(input.businessName)}_Report_${monthFileTag}.pdf`;
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function businessTypeLabel(bt: ReportsBusinessType): string {
  return bt === "restaurant" ? "Restaurant" : "Mobile shop";
}
