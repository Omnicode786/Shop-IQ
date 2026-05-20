export type TableSearchParams = Record<string, string | string[] | undefined>;

export type TableState = {
  page: number;
  pageSize: number;
  query: string;
  status: string;
  facet: string;
  dateFrom: string;
  dateTo: string;
  sort: string;
  order: "asc" | "desc";
  skip: number;
  take: number;
};

export type CrudPaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  query: string;
  status: string;
  facet: string;
  dateFrom: string;
  dateTo: string;
  sort: string;
  order: "asc" | "desc";
};

const PAGE_SIZES = [10, 25, 50, 100];

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanText(value: string | string[] | undefined) {
  return (firstValue(value) || "").trim();
}

function cleanChoice(value: string | string[] | undefined) {
  const text = cleanText(value);
  return text && text !== "all" ? text : "";
}

function cleanDate(value: string | string[] | undefined) {
  const text = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function toPositiveInteger(value: string | string[] | undefined, fallback: number) {
  const parsed = Number(firstValue(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readTableState(searchParams?: TableSearchParams, defaultPageSize = 25): TableState {
  const pageSizeCandidate = toPositiveInteger(searchParams?.pageSize, defaultPageSize);
  const pageSize = PAGE_SIZES.includes(pageSizeCandidate) ? pageSizeCandidate : defaultPageSize;
  const page = toPositiveInteger(searchParams?.page, 1);
  const order = cleanText(searchParams?.order).toLowerCase() === "asc" ? "asc" : "desc";

  return {
    page,
    pageSize,
    query: cleanText(searchParams?.q),
    status: cleanChoice(searchParams?.status),
    facet: cleanChoice(searchParams?.facet),
    dateFrom: cleanDate(searchParams?.dateFrom),
    dateTo: cleanDate(searchParams?.dateTo),
    sort: cleanText(searchParams?.sort),
    order,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

export function contains(value: string) {
  return { contains: value, mode: "insensitive" as const };
}

export function dateRange(field: string, from?: string, to?: string) {
  const range: Record<string, Date> = {};
  if (from) {
    const date = new Date(`${from}T00:00:00.000`);
    if (!Number.isNaN(date.getTime())) range.gte = date;
  }
  if (to) {
    const date = new Date(`${to}T23:59:59.999`);
    if (!Number.isNaN(date.getTime())) range.lte = date;
  }
  return Object.keys(range).length ? { [field]: range } : null;
}

export function paginationMeta(state: TableState, total: number): CrudPaginationMeta {
  return {
    page: state.page,
    pageSize: state.pageSize,
    total,
    query: state.query,
    status: state.status,
    facet: state.facet,
    dateFrom: state.dateFrom,
    dateTo: state.dateTo,
    sort: state.sort,
    order: state.order
  };
}
