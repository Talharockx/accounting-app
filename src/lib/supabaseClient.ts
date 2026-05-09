import { createBrowserClient } from "@supabase/ssr";

import { authCookieSerialization } from "@/lib/supabase/auth-session-options";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables.");
}

/**
 * Browser client: persists session via HttpOnly-visible cookie bridge (SSR package default).
 * `persistSession`, `autoRefreshToken`, PKCE handled by `@supabase/ssr` — survives refresh/tab restore.
 *
 * Tokens are mirrored in browser storage chunks on `document.cookie` (readable by middleware); this is stronger
 * for Next.js middleware than plain localStorage-only clients.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookieOptions: authCookieSerialization,
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
