import type { jsPDF } from "jspdf";

/** Print-ready palette — white pages, black type (inks well / laser-friendly). */
export const PDF_WHITE: [number, number, number] = [255, 255, 255];
export const PDF_BLACK: [number, number, number] = [17, 17, 17];
export const PDF_MUTED: [number, number, number] = [75, 85, 99];
export const PDF_HEADER_BG: [number, number, number] = [243, 244, 246];
export const PDF_STRIPE: [number, number, number] = [249, 250, 251];
export const PDF_LINE: [number, number, number] = [156, 163, 175];
export const PDF_ACCENT: [number, number, number] = [31, 41, 55];
/** Negative amounts — dark enough to print, distinct from black. */
export const PDF_NEGATIVE: [number, number, number] = [153, 27, 27];

export function paintPrintPageBackground(doc: jsPDF, pageW: number, pageH: number): void {
  doc.setFillColor(...PDF_WHITE);
  doc.rect(0, 0, pageW, pageH, "F");
}

/** Shared autoTable styles for black-and-white reports. */
export const printTableBaseStyles = {
  font: "helvetica" as const,
  fontSize: 8,
  cellPadding: { top: 5, right: 6, bottom: 5, left: 6 },
  textColor: PDF_BLACK,
  lineColor: PDF_LINE,
  lineWidth: 0.35,
  valign: "middle" as const,
  fillColor: PDF_WHITE,
  overflow: "linebreak" as const,
};

export const printTableHeadStyles = {
  fillColor: PDF_HEADER_BG,
  textColor: PDF_BLACK,
  fontStyle: "bold" as const,
  lineWidth: 0.35,
  lineColor: PDF_LINE,
  valign: "middle" as const,
};

export const printTableAltRowStyles = {
  fillColor: PDF_STRIPE,
  lineWidth: 0.35,
  lineColor: PDF_LINE,
};

export const printTableFootStyles = {
  fillColor: PDF_HEADER_BG,
  textColor: PDF_BLACK,
  fontStyle: "bold" as const,
  lineWidth: 0.35,
  lineColor: PDF_LINE,
};
