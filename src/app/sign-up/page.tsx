"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { GlassFormCard } from "@/components/ui/glass-form-card";
import { MidnightField } from "@/components/ui/midnight-field";
import { PressableButton } from "@/components/ui/pressable";
import { supabase } from "@/lib/supabaseClient";

export default function SignUpPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          business_name: businessName,
        },
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setSuccess("Account created successfully.");
    router.replace("/dashboard");
  };

  return (
    <AuthShell
      title="Create Your Account"
      subtitle="Start tracking sales, expenses, and repairs for your restaurant or mobile shop."
    >
      <GlassFormCard>
          <form className="flex flex-col gap-5" onSubmit={handleSignUp}>
            <MidnightField
              id="businessName"
              label="Business name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
            />

            <MidnightField id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

            <MidnightField
              id="password"
              label="Password (min 6 characters)"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />

            {error ? <p className="text-sm font-medium text-[var(--lv-traffic-critical)]">{error}</p> : null}
            {success ? <p className="text-sm font-medium text-[var(--lv-traffic-positive)]">{success}</p> : null}

            <PressableButton type="submit" className="min-h-12 w-full" disabled={loading}>
              {loading ? "Creating account…" : "Sign up"}
            </PressableButton>

            <p className="text-center text-sm text-[var(--lv-muted-strong)]">
              Already have an account?{" "}
              <Link href="/login" className="cursor-pointer font-semibold text-[var(--lv-accent)] hover:underline">
                Login
              </Link>
            </p>
          </form>
      </GlassFormCard>
    </AuthShell>
  );
}
