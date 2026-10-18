import Link from "next/link";

/** Site-wide attribution credit. */
export function MadeByCredit({ className }: { className?: string }) {
  return (
    <p
      className={
        className ??
        "py-4 text-center text-xs text-[var(--lv-muted-strong)]"
      }
    >
      Made by{" "}
      <Link
        href="https://syed-talha-hashmi.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-cyan-300 underline-offset-2 transition hover:text-cyan-200 hover:underline"
      >
        Syed Talha Hashmi
      </Link>
    </p>
  );
}
