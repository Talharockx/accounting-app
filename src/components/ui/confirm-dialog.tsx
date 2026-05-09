"use client";

import { PressableButton } from "@/components/ui/pressable";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <button
        type="button"
        className="absolute inset-0 cursor-pointer bg-black/68 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={busy ? undefined : onCancel}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#ffffff10] bg-[#151921]/95 p-6 shadow-2xl shadow-black/55 backdrop-blur-md">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-[var(--lv-heading)]">
          {title}
        </h2>
        <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <PressableButton type="button" variant="secondary" className="min-h-12 w-full sm:w-auto" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </PressableButton>
          <PressableButton
            type="button"
            variant={destructive ? "danger" : "primary"}
            className="min-h-12 w-full sm:w-auto"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Please wait…" : confirmLabel}
          </PressableButton>
        </div>
      </div>
    </div>
  );
}
