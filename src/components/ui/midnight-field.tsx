"use client";

import { cn } from "@/lib/utils/cn";

/**
 * Minimalist underline-style field with glow ring on focus; ≥48px touch target stacks label + control.
 */
export function MidnightField({
  id,
  label,
  type = "text",
  className,
  inputClassName,
  disabled,
  required,
  value,
  onChange,
  name,
  autoComplete,
  min,
  max,
  step,
  inputMode,
  rows,
  minLength,
  maxLength,
}: {
  id: string;
  label: string;
  type?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  required?: boolean;
  value?: string | number | readonly string[];
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  name?: string;
  autoComplete?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  rows?: number;
  minLength?: number;
  maxLength?: number;
}) {
  const common =
    "w-full rounded-t-lg rounded-b-none border border-b border-transparent border-[#ffffff10] border-b-[#ffffff10] bg-[color-mix(in_srgb,var(--lv-card)_75%,transparent)] px-4 py-[0.6875rem] text-[15px] text-[var(--lv-heading)] outline-none backdrop-blur-sm transition-[box-shadow,border-color,filter] duration-200 focus-visible:border-transparent focus-visible:shadow-[0_0_0_1px_color-mix(in_srgb,var(--lv-accent)_52%,transparent),0_0_22px_-5px_color-mix(in_srgb,var(--lv-accent)_45%,transparent)] disabled:opacity-55";

  if (typeof rows === "number" || type === "textarea") {
    return (
      <div className={cn("w-full space-y-2", className)}>
        <label htmlFor={id} className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[var(--lv-muted-strong)]">
          {label}
        </label>
        <textarea
          id={id}
          name={name}
          rows={rows ?? 5}
          disabled={disabled}
          required={required}
          placeholder=""
          value={value as string | undefined}
          onChange={onChange as React.ChangeEventHandler<HTMLTextAreaElement>}
          className={cn(
            "min-h-[136px] w-full resize-y rounded-xl bg-[color-mix(in_srgb,var(--lv-card)_75%,transparent)] px-4 py-3 text-[15px] text-[var(--lv-heading)] outline-none ring-1 ring-inset ring-[#ffffff10] backdrop-blur-sm transition-[box-shadow,border-color] duration-200 focus-visible:shadow-[0_0_0_1px_color-mix(in_srgb,var(--lv-accent)_52%,transparent),0_0_22px_-5px_color-mix(in_srgb,var(--lv-accent)_45%,transparent)] disabled:opacity-55",
            inputClassName,
          )}
        />
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-2", className)}>
      <label htmlFor={id} className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[var(--lv-muted-strong)]">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        disabled={disabled}
        required={required}
        value={value}
        onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
        autoComplete={autoComplete}
        min={min}
        max={max}
        step={step}
        inputMode={inputMode}
        minLength={minLength}
        maxLength={maxLength}
        className={cn(
          common,
          "peer min-h-12 rounded-lg ring-1 ring-inset ring-[#ffffff10]",
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          inputClassName,
        )}
      />
    </div>
  );
}
