import type { DailyFinancialBreakdown, ReportsBusinessType } from "@/lib/dashboard/reports-metrics";

export type MonthlyReportPdfInput = {
  businessName: string;
  dateRangeLabel: string;
  businessTypeLabel: string;
  periodTitle: string;
  dailyRows: DailyFinancialBreakdown[];
  totals: { sales: number; expenses: number; profit: number };
};

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function safeFilePart(name: string): string {
  return name.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_").slice(0, 64) || "Business";
}

export async function generateMonthlyReportPdfBlob(input: MonthlyReportPdfInput): Promise<Blob> {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new JsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const margin = 48;
  let y = margin;

  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text("Monthly Performance Report", margin, y);
  y += 28;

  doc.setFontSize(12);
  doc.setTextColor(51, 65, 85);
  doc.text(input.businessName, margin, y);
  y += 18;
  doc.setFontSize(10);
  doc.text(`Business type: ${input.businessTypeLabel}`, margin, y);
  y += 14;
  doc.text(`Reporting period: ${input.periodTitle}`, margin, y);
  y += 14;
  doc.text(`Date range: ${input.dateRangeLabel}`, margin, y);
  y += 22;

  const body = input.dailyRows.map((row) => [
    row.date,
    money(row.sales),
    money(row.expenses),
    money(row.profit),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Date", "Total sales", "Total expenses", "Net profit / loss"]],
    body: body.length ? body : [["No entries", "-", "-", "-"]],
    theme: "striped",
    headStyles: {
      fillColor: [14, 116, 144],
      textColor: 255,
      fontStyle: "bold",
    },
    styles: {
      fontSize: 9,
      cellPadding: 8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3 && input.dailyRows.length > 0) {
        const raw = input.dailyRows[data.row.index]?.profit;
        if (typeof raw === "number" && raw < 0) {
          data.cell.styles.textColor = [185, 28, 28];
        }
      }
    },
  });

  type DocWithAutoTable = typeof doc & {
    lastAutoTable?: { finalY: number };
  };
  const finalY = (doc as DocWithAutoTable).lastAutoTable?.finalY ?? y + 120;
  let summaryY = finalY + 32;

  if (summaryY > doc.internal.pageSize.getHeight() - 120) {
    doc.addPage();
    summaryY = margin + 40;
  }

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Summary", margin, summaryY);
  summaryY += 20;

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Total sales (period): ${money(input.totals.sales)}`, margin, summaryY);
  summaryY += 16;
  doc.text(`Total expenses (period): ${money(input.totals.expenses)}`, margin, summaryY);
  summaryY += 16;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  const pl = input.totals.profit;
  doc.setTextColor(pl >= 0 ? 22 : 185, pl >= 0 ? 101 : 28, pl >= 0 ? 52 : 28);
  doc.text(`Net profit / loss: ${money(pl)}`, margin, summaryY);

  doc.setFont("helvetica", "normal");

  const blob = doc.output("blob");
  return blob;
}

export async function downloadMonthlyReportPdf(input: MonthlyReportPdfInput): Promise<void> {
  const blob = await generateMonthlyReportPdfBlob(input);
  const url = URL.createObjectURL(blob);
  const filename = `${safeFilePart(input.businessName)}_report_${input.periodTitle.replace(/\s+/g, "_")}.pdf`;
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
