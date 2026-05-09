import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { authCookieSerialization } from "@/lib/supabase/auth-session-options";

function missingEnvError(): never {
  throw new Error(
    "Missing Supabase environment variables. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
      "(e.g. in Vercel Project Settings → Environment Variables, available at build time).",
  );
}

let singleton: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (singleton) return singleton;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    missingEnvError();
  }

  singleton = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    cookieOptions: authCookieSerialization,
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return singleton;
}

/**
 * Browser client — lazy so `next build` can prerender routes when env vars are only present at runtime misconfiguration
 * briefly leaves this unused; failures surface on first `.auth`/`.from` use with a clearer error.
 *
 * Persisted session: `@supabase/ssr` cookie bridge — survives refresh/tab restore when middleware uses matching cookieOptions.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const inst = getClient();
    const value = Reflect.get(inst as object, prop, inst);
    if (typeof value === "function") {
      return value.bind(inst);
    }
    return value;
  },
});
