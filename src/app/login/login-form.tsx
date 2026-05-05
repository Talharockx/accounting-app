"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { getUserFriendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabaseClient";

const isDev = process.env.NODE_ENV === "development";
const devSuperAdminEnabled =
  isDev && process.env.NEXT_PUBLIC_ENABLE_DEV_SUPER_ADMIN === "true";
const devSuperAdminEmail = process.env.NEXT_PUBLIC_DEV_SUPER_ADMIN_EMAIL ?? "";
const devSuperAdminPassword = process.env.NEXT_PUBLIC_DEV_SUPER_ADMIN_PASSWORD ?? "";

function safeInternalPath(candidate: string | null): string {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return "/dashboard";
  return candidate;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigateAfterLogin = () => {
    router.replace(safeInternalPath(searchParams.get("redirectedFrom")));
  };

  const handleDevSuperAdminLogin = async () => {
    if (!devSuperAdminEnabled || !devSuperAdminEmail || !devSuperAdminPassword) return;
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: devSuperAdminEmail,
        password: devSuperAdminPassword,
      });
      if (signInError) {
        setError(signInError.message);
        toast.error(signInError.message);
        setLoading(false);
        return;
      }
      toast.success("Signed in (dev shortcut).");
      navigateAfterLogin();
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    }
    setLoading(false);
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        toast.error(signInError.message);
        setLoading(false);
        return;
      }

      toast.success("Welcome back.");
      navigateAfterLogin();
    } catch (caught) {
      toast.error(getUserFriendlyError(caught));
    }
    setLoading(false);
  };

  return (
    <AuthShell
      title="Welcome Back"
      subtitle="Sign in to continue managing your restaurant or mobile shop accounting."
    >
      <form className="space-y-5" onSubmit={handleLogin}>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-[var(--lv-heading)]">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="lv-input"
            placeholder="you@business.com"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-[var(--lv-heading)]">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="lv-input"
            placeholder="Enter your password"
            required
          />
        </div>

        {error ? (
          <p className="text-sm text-rose-600 dark:text-rose-300" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.02] hover:from-blue-500 hover:to-blue-400 disabled:cursor-not-allowed disabled:opacity-70 dark:from-cyan-400 dark:to-blue-500 dark:text-slate-950 dark:hover:from-cyan-300 dark:hover:to-blue-400"
          disabled={loading}
        >
          {loading ? "Signing in…" : "Login"}
        </button>

        <p className="text-center text-sm text-[var(--lv-muted-strong)]">
          New to LedgerView?{" "}
          <Link href="/sign-up" className="font-medium text-[var(--lv-accent)] hover:underline">
            Create an account
          </Link>
        </p>

        {devSuperAdminEnabled ? (
          <div className="border-t border-[var(--lv-border)] pt-5">
            <p className="mb-3 text-center text-xs text-amber-800 dark:text-amber-200">
              Local testing only: session stays signed in until you sign out or clear site data.
            </p>
            <button
              type="button"
              onClick={handleDevSuperAdminLogin}
              disabled={loading}
              className="w-full rounded-xl border border-amber-500/35 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-70 dark:text-amber-100"
            >
              {loading ? "Signing in…" : "Super Admin (dev quick login)"}
            </button>
          </div>
        ) : null}
      </form>
    </AuthShell>
  );
}
