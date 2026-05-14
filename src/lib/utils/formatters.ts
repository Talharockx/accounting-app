/** LedgerView default: Euro, European number formatting. */
export const APP_CURRENCY = "EUR";
export const CURRENCY_LOCALE = "de-DE";

export function formatCurrency(value: number, currency: string = APP_CURRENCY): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    /** Avoid 1.515,00 € — shop users read four-digit cash totals as confusing; match plain sheet style. */
    useGrouping: false,
  }).format(value);
}

/** Chart tooltips / dense KPIs — whole currency units, no cents. */
export function formatCurrencyWhole(value: number, currency: string = APP_CURRENCY): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: false,
  }).format(value);
}
