/** YYYY-MM-DD in the user's local timezone */
export function formatLocalISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getTodayLocalISO(now = new Date()): string {
  return formatLocalISODate(now);
}

/** Monday-start week-to-date (Monday through today, inclusive). */
export function getWeekToDateRangeLocal(now = new Date()): { start: string; end: string } {
  const copy = new Date(now);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(copy);
  monday.setDate(copy.getDate() + diffToMonday);
  return {
    start: formatLocalISODate(monday),
    end: formatLocalISODate(copy),
  };
}

export function compareISODates(a: string, b: string): number {
  return a.localeCompare(b);
}

export function addCalendarDaysISO(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return formatLocalISODate(dt);
}

/** Inclusive ISO range [start,end] within one calendar month. */
export function getMonthBoundariesISO(year: number, monthIndex0Based: number): { start: string; end: string } {
  const start = formatLocalISODate(new Date(year, monthIndex0Based, 1));
  const end = formatLocalISODate(new Date(year, monthIndex0Based + 1, 0));
  return { start, end };
}

export function eachISODateInclusive(startISO: string, endISO: string): string[] {
  if (compareISODates(startISO, endISO) > 0) return [];
  const out: string[] = [];
  let cur = startISO;
  for (let i = 0; i < 400 && compareISODates(cur, endISO) <= 0; i += 1) {
    out.push(cur);
    cur = addCalendarDaysISO(cur, 1);
  }
  return out;
}

/** `YYYY-MM` from year + month index. */
export function toMonthInputValue(year: number, monthIndex0Based: number): string {
  return `${year}-${String(monthIndex0Based + 1).padStart(2, "0")}`;
}

export function parseMonthInputValue(value: string): { year: number; monthIndex: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11 || Number.isNaN(year)) return null;
  return { year, monthIndex: month };
}

export function minISODate(a: string, b: string): string {
  return compareISODates(a, b) <= 0 ? a : b;
}

export function maxISODate(a: string, b: string): string {
  return compareISODates(a, b) >= 0 ? a : b;
}
