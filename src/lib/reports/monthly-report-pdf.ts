import type { jsPDF } from "jspdf";

import type { DailyFinancialBreakdown, ReportsBusinessType } from "@/lib/dashboard/reports-metrics";
import type { MobileLedgerMatrixReport } from "@/lib/dashboard/mobile-transaction-ledger";
import type { MobilePersonExpenseMatrixReport } from "@/lib/reports/mobile-person-expense-matrix";
import { formatCurrency } from "@/lib/utils/formatters";
import type { ProfitTrendDatum, SalesVsExpensesDatum } from "@/components/dashboard/reports-performance-charts";

/** Month-level mobile sheet KPIs (one {@link mobileProfitFromTransactions} pass on the month’s rows). */
export type MobileExecutiveSummary = {
  totalSale: number;
  totalCost: number;
  totalRicarche: number;
  totalExpenseCash: number;
  lastBalanceWithoutBank: number;
  /** Month total: Sim Sale − Sim Buying. */
  simProfit: number;
  /** Month total: Mobile Sale − Mobile Buying. */
  mobileProfit: number;
  /** Month total: Accessories sale − Accessories buying. */
  accesProfit: number;
};

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
  /** Mobile shop: Transactions-tab ledger grid (preferred for monthly entries table). */
  mobileLedgerMatrix?: MobileLedgerMatrixReport | null;
  /** Mobile shop: legacy person / bucket grid (fallback). */
  mobilePersonMatrix?: MobilePersonExpenseMatrixReport | null;
  /** Mobile shop: PDF uses “Last balance” labels (client sheet formula). */
  useClientLastBalanceLabels?: boolean;
  /** Mobile shop: client-style executive summary (replaces four KPI boxes when set). */
  mobileExecutiveSummary?: MobileExecutiveSummary | null;
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
  return formatCurrency(n);
}

function isoToDisplayDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

function safeFilePart(name: string): string {
  return name.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 64) || "Business";
}

function isMobileSheetProfitColumn(col: string): boolean {
  return (
    col === "Sim Profit" ||
    col === "Mobile Profit" ||
    col === "Acces. Profit" ||
    col === "Sim profit" ||
    col === "Mobile profit" ||
    col === "Access. profit" ||
    col === "Last balance" ||
    col === "Profit (sale−buy)"
  );
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
  const mobileClient = input.useClientLastBalanceLabels === true;
  const profitBoxLabel = mobileClient ? "Last balance" : "Net profit / loss";
  const dailyProfitColumn = mobileClient ? "Daily last balance" : "Daily profit";
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

  const mobileExec = input.mobileExecutiveSummary ?? null;

  if (mobileClient && mobileExec) {
    const blockTop = y;
    const rowH = 32;
    const padX = 18;
    const leftSectionW = contentW * 0.55;
    const valueXLeft = margin + leftSectionW - padX;
    const rows: { label: string; value: string; valueRgb: [number, number, number] }[] = [
      { label: "Total sale", value: money(mobileExec.totalSale), valueRgb: EMERALD_SOFT },
      { label: "Total cost", value: money(mobileExec.totalCost), valueRgb: TEXT },
      { label: "Total ricariche (R.Wind + R.Voda)", value: money(mobileExec.totalRicarche), valueRgb: TEXT },
      { label: "Total expense (cash)", value: money(mobileExec.totalExpenseCash), valueRgb: ROSE },
      {
        label: "Last balance (excl. bank expenses)",
        value: money(mobileExec.lastBalanceWithoutBank),
        valueRgb: mobileExec.lastBalanceWithoutBank >= 0 ? EMERALD_SOFT : ROSE,
      },
    ];
    const blockH = 16 + rows.length * rowH + 14;

    doc.setFillColor(...NAVY_PANEL);
    doc.setDrawColor(40, 52, 72);
    doc.setLineWidth(0.45);
    doc.roundedRect(margin, blockTop, contentW, blockH, 8, 8, "FD");

    let ry = blockTop + 22;
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(...MUTED);
      doc.text(row.label, margin + padX, ry);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...row.valueRgb);
      doc.text(row.value, valueXLeft, ry, { align: "right" });
      ry += rowH;
    }

    const profitTitles = ["Sim Profit", "Mobile Profit", "Acces. Profit"] as const;
    const profitVals = [mobileExec.simProfit, mobileExec.mobileProfit, mobileExec.accesProfit];
    const profitBandX0 = margin + leftSectionW + 14;
    const profitBandW = margin + contentW - padX - profitBandX0;
    const pcw = profitBandW / 3;
    let px = profitBandX0;
    for (let j = 0; j < 3; j += 1) {
      const pv = profitVals[j] ?? 0;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(profitTitles[j]!, px + pcw / 2, blockTop + 22, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...(pv >= 0 ? EMERALD_SOFT : ROSE));
      doc.text(money(pv), px + pcw / 2, blockTop + 44, { align: "center" });
      px += pcw;
    }

    y = blockTop + blockH + 16;
  } else {
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
    drawSummaryBox(3, profitBoxLabel, money(input.totals.profit), profitRgb);

    y = boxTop + boxH + 22;
  }

  if (!mobileClient) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    const marginNumerator = input.totals.profit;
    const marginDenominator = input.totals.sales;
    const marginPct =
      marginDenominator > 0 ? ((marginNumerator / marginDenominator) * 100).toFixed(2) : null;
    doc.text(
      marginPct !== null
        ? `Profit margin (net profit ÷ total sales): ${marginPct}%`
        : "Profit margin: N/A (no sales in period)",
      margin,
      y,
      { maxWidth: contentW },
    );
    y += 28;
  }

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

  type MatrixReport = MobileLedgerMatrixReport | MobilePersonExpenseMatrixReport;

  const ledgerMatrix =
    mobileClient &&
    input.mobileLedgerMatrix &&
    input.mobileLedgerMatrix.columns.length > 0 &&
    input.mobileLedgerMatrix.rows.length > 0
      ? input.mobileLedgerMatrix
      : null;

  const hasNamedPersonMatrix = Boolean(
    mobileClient &&
      !ledgerMatrix &&
      input.mobilePersonMatrix &&
      input.mobilePersonMatrix.columns.length > 0 &&
      input.mobilePersonMatrix.rows.length > 0,
  );

  let matrixForPdf: MatrixReport | null = ledgerMatrix ?? (hasNamedPersonMatrix ? input.mobilePersonMatrix! : null);

  /** Named lines missing in DB metadata but month has operating → still use sheet layout (one column). */
  if (
    mobileClient &&
    !matrixForPdf &&
    input.totals.operatingExpenses > 0 &&
    input.dailyRows.length > 0
  ) {
    const col = "Operating expenses";
    matrixForPdf = {
      columns: [col],
      rows: input.dailyRows.map((r) => ({
        dateISO: r.date,
        displayDate: isoToDisplayDDMMYYYY(r.date),
        amounts: { [col]: r.operatingExpenses },
      })),
      columnTotals: [input.dailyRows.reduce((s, r) => s + r.operatingExpenses, 0)],
    };
  }

  const usePersonMatrix = Boolean(
    matrixForPdf && matrixForPdf.columns.length > 0 && matrixForPdf.rows.length > 0,
  );

  const matrixBlurbSingleOperatingCol =
    matrixForPdf?.columns.length === 1 && matrixForPdf.columns[0] === "Operating expenses";

  if (usePersonMatrix && matrixForPdf) {
    doc.addPage("a4", "l");
    const lw = doc.internal.pageSize.getWidth();
    paintPageBackground(doc, lw, doc.internal.pageSize.getHeight());
    const firstMatrixPage = doc.getNumberOfPages();
    const tableStartY = margin + 26;
    const colCount = matrixForPdf.columns.length;
    const tableFont = Math.max(6, Math.min(9, 11 - Math.floor(colCount / 3)));

    const headRow = ["Date", ...matrixForPdf.columns];
    const bodyRows = matrixForPdf.rows.map((r) => [
      r.displayDate,
      ...matrixForPdf.columns.map((c) => {
        const v = r.amounts[c] ?? 0;
        if (isMobileSheetProfitColumn(c)) return money(v);
        return v > 0 ? money(v) : "";
      }),
    ]);
    const footRow = [
      "Grand Total",
      ...matrixForPdf.columnTotals.map((t) => money(t)),
    ];

    const colStyles: Record<number, { halign: "left" | "right" }> = {
      0: { halign: "left" },
    };
    for (let i = 1; i <= colCount; i += 1) {
      colStyles[i] = { halign: "right" };
    }

    autoTable(doc, {
      startY: tableStartY,
      head: [headRow],
      body: bodyRows,
      foot: [footRow],
      showFoot: "lastPage",
      theme: "plain",
      styles: {
        fontSize: tableFont,
        cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
        lineColor: [30, 41, 59],
        lineWidth: 0,
        valign: "middle",
        fillColor: NAVY_PANEL,
        textColor: TEXT,
        overflow: "linebreak",
      },
      headStyles: {
        fontStyle: "bold",
        fillColor: EMERALD,
        textColor: [11, 18, 32],
        fontSize: tableFont,
        lineWidth: 0,
      },
      alternateRowStyles: { fillColor: NAVY_STRIPE, lineWidth: 0 },
      columnStyles: colStyles,
      footStyles: {
        fontStyle: "bold",
        fillColor: EMERALD_DEEP,
        textColor: [209, 250, 229],
        fontSize: tableFont + 0.5,
        lineWidth: 0,
      },
      margin: { left: margin, right: margin, top: margin, bottom: margin },
      willDrawPage: (data) => {
        const pw = doc.internal.pageSize.getWidth();
        paintPageBackground(doc, pw, doc.internal.pageSize.getHeight());
        if (data.pageNumber === firstMatrixPage) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(...EMERALD_SOFT);
          doc.text("Monthly entries", margin, margin + 10);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(...MUTED);
          doc.text(
            matrixBlurbSingleOperatingCol
              ? "All amounts in EUR · Daily operating total (matches “Operating expenses” in the summary table). Use Daily Entry named cash/bank lines to split this into person columns."
              : ledgerMatrix
                ? "All amounts in EUR · Same columns as the Transactions tab (daily ledger: sales, buys, profits, packages, POS, expenses, balances)."
                : "All amounts in EUR · Same buckets as Mobile Daily Entry: SIM, mobile & accessory sale/buy, R.Wind & R.Voda, repair, extra, POS, and total cash vs bank expenses per calendar day.",
            margin,
            margin + 22,
            { maxWidth: pw - margin * 2 },
          );
        }
      },
      didParseCell: (data) => {
        if (data.section === "head") {
          data.cell.styles.halign = data.column.index === 0 ? "left" : "right";
        }
        if (data.section === "body" && data.column.index > 0) {
          const colName = matrixForPdf.columns[data.column.index - 1];
          if (colName && isMobileSheetProfitColumn(colName)) {
            const v = matrixForPdf.rows[data.row.index]?.amounts[colName];
            if (typeof v === "number" && v < 0) {
              data.cell.styles.textColor = ROSE;
            }
          }
        }
        if (data.section === "foot" && data.column.index === 0) {
          data.cell.styles.halign = "left";
        }
        if (data.section === "foot" && data.column.index > 0) {
          data.cell.styles.halign = "right";
          const colName = matrixForPdf.columns[data.column.index - 1];
          if (colName && isMobileSheetProfitColumn(colName)) {
            const t = matrixForPdf.columnTotals[data.column.index - 1];
            if (typeof t === "number" && t < 0) {
              data.cell.styles.textColor = ROSE;
            }
          }
        }
      },
    });
  } else {
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
      head: [["Date", "Total sales", "Purchases", "Operating expenses", dailyProfitColumn]],
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
        const pw = doc.internal.pageSize.getWidth();
        paintPageBackground(doc, pw, doc.internal.pageSize.getHeight());
        if (data.pageNumber === firstTablePage) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(...EMERALD_SOFT);
          doc.text("Daily breakdown", margin, margin + 10);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(...MUTED);
          doc.text(
            "All amounts in EUR · Matches Transactions columns (purchases vs operating). Bar charts use purchases + operating combined.",
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
  }

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
