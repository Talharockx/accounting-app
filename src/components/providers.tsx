"use client";

import { ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    const t = window.setTimeout(() => setActive(false), 420);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return (
    <div
      className={`pointer-events-none fixed top-0 right-0 left-0 z-50 h-[3px] origin-left transition-transform duration-300 ease-out ${active ? "scale-x-100" : "scale-x-0"}`}
      aria-hidden
    >
      <div className="h-full w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 opacity-95 dark:from-cyan-300 dark:via-blue-400" />
    </div>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <RouteProgress />
      {children}
      <Toaster
        richColors
        closeButton
        position="top-center"
        toastOptions={{
          classNames: {
            toast:
              "rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur dark:border-white/15 dark:bg-slate-900/95 text-slate-900 dark:text-slate-50",
          },
        }}
      />
    </ThemeProvider>
  );
}
