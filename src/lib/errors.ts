/** Shown when Supabase/network calls fail unexpectedly (avoid raw crashes). */
export const SYSTEM_UNAVAILABLE =
  "System temporarily unavailable. Please check your connection and try again in a moment.";

export function getUserFriendlyError(err: unknown, fallback = SYSTEM_UNAVAILABLE): string {
  if (typeof err !== "object" || err === null) return fallback;

  const message =
    typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";

  if (!message) return fallback;

  const m = message.toLowerCase();
  if (
    m.includes("fetch") ||
    m.includes("network") ||
    m.includes("failed to load") ||
    m.includes("load failed") ||
    m.includes("timeout")
  ) {
    return SYSTEM_UNAVAILABLE;
  }

  if (
    m.includes("businesses_business_type_check") ||
    (m.includes("check constraint") && m.includes("business_type"))
  ) {
    return "Grocery is not enabled in your database yet. In Supabase → SQL Editor, run supabase/allow_grocery_business_type.sql, then try again.";
  }

  return message;
}
