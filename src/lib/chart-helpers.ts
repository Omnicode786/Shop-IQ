import { endOfDay, format, startOfDay, subDays } from "date-fns";

export type SegmentDatum = {
  name: string;
  value: number;
};

export type TimelineDatum = {
  label: string;
  value: number;
  secondary?: number;
};

export function toNumber(value: unknown) {
  return Number(value || 0);
}

export function compactNumber(value: number) {
  return Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function money(value: unknown) {
  return `PKR ${Math.round(toNumber(value)).toLocaleString()}`;
}

export function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function resolveSeriesWindow<T>(rows: T[], getDate: (row: T) => string | Date, days: number) {
  const now = new Date();
  const currentStart = startOfDay(subDays(now, days - 1));
  const currentEnd = endOfDay(now);
  const dates = rows
    .map((row) => new Date(getDate(row)))
    .filter((date) => !Number.isNaN(date.getTime()));

  const hasCurrentWindowData = dates.some((date) => date >= currentStart && date <= currentEnd);
  const anchor = hasCurrentWindowData || !dates.length
    ? now
    : dates.reduce((latest, date) => (date > latest ? date : latest), dates[0]);

  return {
    start: startOfDay(subDays(anchor, days - 1)),
    end: endOfDay(anchor),
    anchor
  };
}

export function buildDailySeries<T>(
  rows: T[],
  getDate: (row: T) => string | Date,
  getValue: (row: T) => number,
  days = 10,
  getSecondary?: (row: T) => number
): TimelineDatum[] {
  const { start, end, anchor } = resolveSeriesWindow(rows, getDate, days);
  const buckets = new Map<string, TimelineDatum>();

  for (let index = 0; index < days; index += 1) {
    const date = subDays(anchor, days - 1 - index);
    const key = format(date, "yyyy-MM-dd");
    buckets.set(key, { label: format(date, "dd MMM"), value: 0, secondary: getSecondary ? 0 : undefined });
  }

  for (const row of rows) {
    const date = new Date(getDate(row));
    if (Number.isNaN(date.getTime()) || date < start || date > end) continue;
    const key = format(date, "yyyy-MM-dd");
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.value += getValue(row);
    if (getSecondary) bucket.secondary = (bucket.secondary || 0) + getSecondary(row);
  }

  return [...buckets.values()];
}

export function statusSegments<T>(rows: T[], getStatus: (row: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const status = (getStatus(row) || "Unknown").replace(/_/g, " ").toLowerCase();
    const label = status.replace(/\b\w/g, (match) => match.toUpperCase());
    map.set(label, (map.get(label) || 0) + 1);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

export function sumByGroup<T>(
  rows: T[],
  getName: (row: T) => string | null | undefined,
  getValue: (row: T) => number,
  take = 7
) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const name = getName(row) || "General";
    map.set(name, (map.get(name) || 0) + getValue(row));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, take);
}

export function topRows<T>(
  rows: T[],
  getName: (row: T) => string,
  getValue: (row: T) => number,
  take = 6
) {
  return rows
    .map((row) => ({ name: getName(row), value: getValue(row) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, take);
}

export function stackedSegments(data: SegmentDatum[]) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  return data.map((item) => ({
    ...item,
    percent: percent(item.value, total)
  }));
}
