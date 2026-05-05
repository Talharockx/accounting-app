"use client";

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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm dark:bg-slate-950/70"
        aria-label="Close dialog"
        onClick={busy ? undefined : onCancel}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--lv-border)] bg-[var(--lv-glass-strong)] p-6 shadow-2xl shadow-slate-900/20 backdrop-blur-xl dark:shadow-black/40">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-[var(--lv-heading)]">
          {title}
        </h2>
        <p className="mt-2 text-sm text-[var(--lv-muted-strong)]">{description}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl border border-[var(--lv-border)] bg-[var(--lv-surface-soft)] px-4 py-2.5 text-sm font-medium text-[var(--lv-heading)] contrast-more:border-slate-400 contrast-more:bg-white hover:bg-[var(--lv-surface-muted)] disabled:opacity-50 dark:hover:bg-white/10"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
              destructive
                ? "bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500"
                : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400"
            }`}
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
