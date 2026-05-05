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

  return message;
}
