/** Long-lived auth cookies synced between browser SSR client and middleware — persists sessions across refreshes. */
export const authCookieSerialization = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};
