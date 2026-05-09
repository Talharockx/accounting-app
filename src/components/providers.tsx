"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";

function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- UI feedback on navigation
    setActive(true);
    const t = window.setTimeout(() => setActive(false), 420);
    return () => window.clearTimeout(t);
  }, [pathname]);

  return (
    <div
      className={`pointer-events-none fixed top-0 right-0 left-0 z-50 h-[3px] origin-left transition-transform duration-300 ease-out ${active ? "scale-x-100" : "scale-x-0"}`}
      aria-hidden
    >
      <div className="h-full w-full bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-500 opacity-95" />
    </div>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RouteProgress />
      {children}
      <Toaster
        richColors
        closeButton
        position="top-center"
        theme="dark"
        toastOptions={{
          classNames: {
            toast:
              "cursor-pointer rounded-xl border border-[#ffffff10] bg-[#151921]/96 text-[var(--lv-heading)] backdrop-blur-md shadow-xl",
          },
        }}
      />
    </>
  );
}
