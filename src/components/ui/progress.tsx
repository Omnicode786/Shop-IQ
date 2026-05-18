import { cn } from "@/lib/utils";

export function Progress({
  value,
  className
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-2.5 w-full overflow-hidden rounded-full bg-muted/85 shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.32)]",
        className
      )}
    >
      <div
        className="h-full rounded-full bg-[linear-gradient(90deg,rgba(37,99,235,0.98),rgba(14,165,233,0.9))] shadow-[0_0_22px_rgba(37,99,235,0.18)] transition-[width] duration-500 dark:bg-[linear-gradient(90deg,rgba(96,165,250,0.98),rgba(45,212,191,0.9))] dark:shadow-[0_0_24px_rgba(96,165,250,0.18)]"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}
