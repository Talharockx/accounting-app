import { cn } from "@/lib/utils/cn";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-[var(--lv-skeleton)] dark:bg-[var(--lv-skeleton-dark)]",
        className,
      )}
      {...props}
    />
  );
}
