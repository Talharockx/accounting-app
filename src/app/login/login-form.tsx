"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/auth-shell";
import { GlassFormCard } from "@/components/ui/glass-form-card";
import { MidnightField } from "@/components/ui/midnight-field";
import { PressableButton } from "@/components/ui/pressable";
import { getUserFriendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabaseClient";

const isDev = process.env.NODE_ENV === "development";
const devSuperAdminEnabled = isDev && process.env.NEXT_PUBLIC_ENABLE_DEV_SUPER_ADMIN === "true";
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
      <GlassFormCard>
          <form className="flex flex-col gap-5" onSubmit={handleLogin}>
            <MidnightField id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

            <MidnightField
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error ? (
              <p className="text-sm font-medium text-[var(--lv-traffic-critical)]" role="alert">
                {error}
              </p>
            ) : null}

            <PressableButton type="submit" className="min-h-12 w-full" disabled={loading}>
              {loading ? "Signing in…" : "Login"}
            </PressableButton>

            <p className="text-center text-sm text-[var(--lv-muted-strong)]">
              New to LedgerView?{" "}
              <Link href="/sign-up" className="cursor-pointer font-semibold text-[var(--lv-accent)] hover:underline">
                Create an account
              </Link>
            </p>

            {devSuperAdminEnabled ? (
              <div className="border-t border-[#ffffff10] pt-5">
                <p className="mb-3 text-center text-xs text-[var(--lv-traffic-neutral)]">
                  Local testing only: session stays signed in until you sign out or clear site data.
                </p>
                <PressableButton
                  type="button"
                  variant="secondary"
                  className="min-h-12 w-full"
                  onClick={handleDevSuperAdminLogin}
                  disabled={loading}
                >
                  {loading ? "Signing in…" : "Super Admin (dev quick login)"}
                </PressableButton>
              </div>
            ) : null}
          </form>
      </GlassFormCard>
    </AuthShell>
  );
}
