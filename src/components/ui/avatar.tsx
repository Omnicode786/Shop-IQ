import { cn } from "@/lib/utils";

export function Avatar({
  name,
  className
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <div
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border border-white/55 bg-[linear-gradient(135deg,rgba(37,99,235,0.14),rgba(14,165,233,0.10))] text-sm font-semibold text-primary shadow-[0_8px_18px_rgba(15,23,42,0.08)] transition-colors duration-300 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(96,165,250,0.2),rgba(45,212,191,0.12))] dark:shadow-[0_16px_32px_rgba(0,0,0,0.28)]",
        className
      )}
    >
      {initials}
    </div>
  );
}
