import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type PressableVariants = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<PressableVariants, string> = {
  primary:
    "bg-[color-mix(in_srgb,var(--lv-accent)_78%,#0e7490)] text-[#080b11] hover:brightness-110 shadow-[0_12px_32px_-12px_color-mix(in_srgb,var(--lv-accent)_55%,transparent)]",
  secondary:
    "border border-[#ffffff10] bg-[#151921] text-[var(--lv-heading)] hover:bg-[color-mix(in_srgb,#151921_92%,white)] hover:border-[#ffffff24]",
  danger:
    "border border-[color-mix(in_srgb,var(--lv-traffic-critical)_45%,transparent)] bg-[color-mix(in_srgb,var(--lv-traffic-critical)_22%,#151921)] text-[var(--lv-traffic-critical)] hover:brightness-110",
  ghost: "border border-transparent text-[var(--lv-muted-strong)] hover:bg-[#ffffff07] hover:text-[var(--lv-heading)]",
};

type NativeButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function PressableButton({
  className,
  variant = "primary",
  children,
  type = "button",
  disabled,
  ...rest
}: NativeButtonProps & { variant?: PressableVariants }) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-12 cursor-pointer touch-manipulation items-center justify-center rounded-xl px-5 text-sm font-semibold tracking-tight transition-[transform,filter,opacity] duration-150",
        "active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100",
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
