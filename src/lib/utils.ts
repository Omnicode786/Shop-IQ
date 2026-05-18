import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | Date, pattern = "dd MMM yyyy") {
  return format(new Date(value), pattern);
}

export function relativeDate(value: string | Date) {
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export function toTitleCase(input: string) {
  return input
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toPlain<T>(value: T): any {
  return JSON.parse(JSON.stringify(value));
}

export function scoreToTone(score: number) {
  if (score >= 75) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  return "text-rose-500";
}
