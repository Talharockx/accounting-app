type GroceryWorkspacePlaceholderProps = {
  feature: string;
};

export function GroceryWorkspacePlaceholder({ feature }: GroceryWorkspacePlaceholderProps) {
  return (
    <div className="glass-panel rounded-[1.625rem] border border-dashed border-[color-mix(in_srgb,var(--lv-accent)_35%,transparent)] px-6 py-12 text-center sm:px-10">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em] text-[var(--lv-accent)]">
        Grocery workspace
      </p>
      <h2 className="mt-3 text-xl font-bold tracking-tight text-[var(--lv-heading)] sm:text-2xl">{feature}</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[var(--lv-muted-strong)]">
        Your grocery business is provisioned. Daily entry fields and reports for this type will be configured next—tell
        us what columns and totals you need and we will wire them in here.
      </p>
    </div>
  );
}
