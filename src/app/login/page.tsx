import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Welcome Back"
          subtitle="Hang tight—we are preparing your secure sign-in form."
        >
          <p className="text-center text-sm text-[var(--lv-muted-strong)]">Loading…</p>
        </AuthShell>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
