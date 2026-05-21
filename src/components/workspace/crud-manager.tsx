"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ComponentProps, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Edit3, Eye, Filter, Info, Plus, Search, ShieldAlert, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { captureModalOrigin, modalMotionStyle, ModalPortal, type ModalMotionOrigin } from "@/components/workspace/modal-portal";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Option = { label: string; value: string };
type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "email" | "password" | "textarea" | "select";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number;
  options?: Option[];
  hideOnEdit?: boolean;
  hideOnCreate?: boolean;
  span?: "full" | "half";
  min?: number;
  max?: number;
  step?: string | number;
  autoComplete?: string;
};
type Column = { key: string; label: string; render?: (row: any) => ReactNode; className?: string };
type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  query?: string;
  status?: string;
  facet?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: "asc" | "desc";
};
type FilterConfig = {
  statusKey?: string | null;
  statusOptions?: string[];
  facetKey?: string | null;
  facetLabel?: string;
  facetOptions?: string[];
  dateKey?: string | null;
  dateLabel?: string;
};
type Props = {
  title: string;
  description?: string;
  endpoint: string;
  rows: any[];
  fields: Field[];
  columns: Column[];
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  canUpdateRow?: (row: any) => boolean;
  canDeleteRow?: (row: any) => boolean;
  canUpdateRowKey?: string;
  canDeleteRowKey?: string;
  createLabel?: string;
  createAction?: ReactNode;
  deleteLabel?: string;
  deleteVerb?: string;
  emptyState?: string;
  submitShape?: "invoice" | "purchase";
  canViewDetails?: boolean;
  pagination?: PaginationMeta;
  filterConfig?: FilterConfig;
  displayMode?: "table" | "single-card";
};

const MODAL_EXIT_MS = 460;

function valueFor(row: any, key: string) {
  const value = row?.[key];
  if (value === null || value === undefined) return "";
  return value;
}

function isBlank(value: unknown) {
  return value === "" || value === null || value === undefined;
}

function defaultForm(fields: Field[], row?: any) {
  return fields.reduce<Record<string, any>>((acc, field) => {
    acc[field.key] = row ? valueFor(row, field.key) : field.defaultValue ?? "";
    return acc;
  }, {});
}

function normalizeBlank(field: Field, mode: "create" | "edit") {
  if (field.type === "number") return mode === "edit" ? undefined : 0;
  if (field.type === "password") return undefined;
  if (field.type === "select" && field.key.endsWith("Id")) return mode === "edit" ? null : undefined;
  if (field.type === "select") return undefined;
  return mode === "edit" && !field.required ? null : undefined;
}

function normalizeByFields(form: Record<string, any>, fields: Field[], mode: "create" | "edit") {
  const payload: Record<string, any> = {};
  for (const field of fields) {
    const value = form[field.key];
    const empty = isBlank(value);
    payload[field.key] = field.type === "number" ? (empty ? normalizeBlank(field, mode) : Number(value)) : empty ? normalizeBlank(field, mode) : value;
  }
  return payload;
}

function isNonNegativeNumberField(field: Field) {
  return field.type === "number" && /(amount|balance|cost|discount|limit|price|quantity|reorder|score|stock|tax|total)/i.test(field.key);
}

function inputModeFor(field: Field): "text" | "email" | "numeric" | "decimal" | "tel" | undefined {
  if (field.type === "email") return "email";
  if (field.key.toLowerCase().includes("phone")) return "tel";
  if (field.type === "number") return field.key.toLowerCase().includes("quantity") || field.key.toLowerCase().includes("stock") ? "numeric" : "decimal";
  return undefined;
}

function autoCompleteFor(field: Field) {
  if (field.autoComplete) return field.autoComplete;
  const key = field.key.toLowerCase();
  if (field.type === "password") return "new-password";
  if (field.type === "email" || key.includes("email")) return "email";
  if (key.includes("phone")) return "tel";
  if (key.includes("name")) return "name";
  if (key.includes("address")) return "street-address";
  return "off";
}

function validateForm(fields: Field[], form: Record<string, any>, mode: "create" | "edit", endpoint: string, submitShape?: Props["submitShape"]) {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = form[field.key];
    const empty = isBlank(value);
    if (field.required && empty) {
      errors[field.key] = `${field.label} is required.`;
      continue;
    }
    if (empty) continue;
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim())) {
      errors[field.key] = "Enter a valid email address.";
    }
    if (field.type === "password" && String(value).length > 0 && String(value).length < 8) {
      errors[field.key] = "Password must be at least 8 characters.";
    }
    if (field.type === "number") {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) {
        errors[field.key] = `${field.label} must be a valid number.`;
        continue;
      }
      const min = field.min ?? (isNonNegativeNumberField(field) ? 0 : undefined);
      if (min !== undefined && numberValue < min) errors[field.key] = `${field.label} must be ${min === 0 ? "zero or more" : `at least ${min}`}.`;
      if (field.max !== undefined && numberValue > field.max) errors[field.key] = `${field.label} must be ${field.max} or less.`;
      if (field.key === "reliabilityScore" && (numberValue < 0 || numberValue > 100)) errors[field.key] = "Reliability score must be between 0 and 100.";
      if ((field.key === "amount" || (mode === "create" && ["quantity", "unitCost"].includes(field.key))) && numberValue <= 0) {
        errors[field.key] = `${field.label} must be greater than zero.`;
      }
    }
  }

  if (endpoint.includes("/payments")) {
    const direction = form.direction || "CUSTOMER_IN";
    if (direction === "CUSTOMER_IN" && !form.customerId && !form.invoiceId) {
      errors.customerId = "Choose a customer or link an invoice.";
    }
    if (direction === "SUPPLIER_OUT" && !form.supplierId && !form.purchaseId) {
      errors.supplierId = "Choose a supplier or link a purchase.";
    }
  }
  if (submitShape === "invoice" && mode === "create" && !form.productId) errors.productId = "Choose a product for this invoice.";
  if (submitShape === "purchase" && mode === "create" && !form.productId) errors.productId = "Choose a product for this purchase.";
  return errors;
}

function issueMap(issues: any) {
  const fieldErrors = issues?.fieldErrors || {};
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .map(([key, value]) => [key, Array.isArray(value) ? value.find(Boolean) : value])
      .filter(([, value]) => Boolean(value))
  ) as Record<string, string>;
}

function statusVariant(value: string): ComponentProps<typeof Badge>["variant"] {
  const normalized = value.toLowerCase();
  if (["active", "paid", "completed"].includes(normalized)) return "success";
  if (["partial", "draft", "pending"].includes(normalized)) return "warning";
  if (["cancelled", "archived", "inactive"].includes(normalized)) return "destructive";
  return "outline";
}

function cellContent(column: Column, row: any) {
  if (column.render) return column.render(row);
  const value = valueFor(row, column.key);
  if (!value) return "-";
  if (column.key.toLowerCase().includes("status")) {
    return <Badge variant={statusVariant(String(value))}>{String(value).toLowerCase()}</Badge>;
  }
  return String(value);
}

function isNumericColumn(key: string) {
  return /(amount|balance|cost|discount|due|limit|paid|payable|price|quantity|reorder|revenue|score|stock|tax|total|value|qty|sold|count)$/i.test(key);
}

function isDateLikeKey(key: string) {
  return /(date|createdAt|updatedAt|paidAt|visitAt|joiningDate)$/i.test(key);
}

function rowDateValue(row: any, key?: string | null) {
  if (!key) return null;
  const value = row?.[key];
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function endOfLocalDay(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function distinctValues(rows: any[], key?: string | null) {
  if (!key) return [];
  return Array.from(new Set(rows.map((row) => valueFor(row, key)).filter((value) => !isBlank(value)).map(String))).sort((a, b) => a.localeCompare(b));
}

function rowLabel(row: any) {
  return row.name || row.invoiceNo || row.purchaseNo || row.paymentNo || row.email || "this record";
}

function entityLabel(title: string, createLabel: string) {
  const cleanCreate = createLabel.replace(/^(add|create|new)\s+/i, "").trim();
  if (cleanCreate) return cleanCreate.charAt(0).toUpperCase() + cleanCreate.slice(1);
  const cleanTitle = title.replace(/\s+/g, " ").trim();
  return cleanTitle.endsWith("s") ? cleanTitle.slice(0, -1) : cleanTitle || "Record";
}

function prettifyKey(key: string) {
  return key
    .replace(/Display$/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .trim();
}

function formatDetailValue(value: unknown): string {
  if (isBlank(value)) return "-";
  if (value instanceof Date) return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
  if (typeof value === "string") {
    const maybeDate = /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : null;
    if (maybeDate && !Number.isNaN(maybeDate.getTime())) return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(maybeDate);
    return value;
  }
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (Array.isArray(value)) return `${value.length.toLocaleString()} linked ${value.length === 1 ? "record" : "records"}`;
  if (typeof value === "object") {
    const record = value as Record<string, any>;
    return record.name || record.invoiceNo || record.purchaseNo || record.email || record.id || JSON.stringify(record);
  }
  return String(value);
}

function detailItems(row: any, fields: Field[], columns: Column[]) {
  const seen = new Set<string>();
  const keys = [
    ...columns.map((column) => ({ key: column.key, label: column.label })),
    ...fields.filter((field) => field.type !== "password").map((field) => ({ key: field.key, label: field.label })),
    ...["status", "createdAt", "updatedAt", "notes"].map((key) => ({ key, label: prettifyKey(key) }))
  ];

  return keys
    .filter((item) => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return row && Object.prototype.hasOwnProperty.call(row, item.key);
    })
    .map((item) => ({ ...item, value: formatDetailValue(row[item.key]) }));
}

export function CrudManager({
  title,
  description,
  endpoint,
  rows,
  fields,
  columns,
  canCreate,
  canUpdate,
  canDelete,
  canUpdateRow,
  canDeleteRow,
  canUpdateRowKey,
  canDeleteRowKey,
  createLabel = "Add record",
  createAction,
  deleteLabel = "Delete",
  deleteVerb = deleteLabel,
  emptyState = "No records found.",
  submitShape,
  canViewDetails = true,
  pagination,
  filterConfig,
  displayMode = "table"
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const serverPaged = Boolean(pagination);
  const [mode, setMode] = useState<"closed" | "create" | "edit">("closed");
  const [activeRow, setActiveRow] = useState<any>(null);
  const [detailRow, setDetailRow] = useState<any>(null);
  const [deleteRow, setDeleteRow] = useState<any>(null);
  const [modalOrigin, setModalOrigin] = useState<ModalMotionOrigin | null>(null);
  const [modalClosing, setModalClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const originElementRef = useRef<Element | null>(null);
  const closeDialogRef = useRef<() => void>(() => {});
  const [form, setForm] = useState<Record<string, any>>(defaultForm(fields));
  const [query, setQuery] = useState(pagination?.query ?? "");
  const [statusFilter, setStatusFilter] = useState(pagination?.status || "all");
  const [facetFilter, setFacetFilter] = useState(pagination?.facet || "all");
  const [dateFrom, setDateFrom] = useState(pagination?.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(pagination?.dateTo ?? "");
  const [page, setPage] = useState(pagination?.page ?? 1);
  const [pageSize, setPageSize] = useState(pagination?.pageSize ?? 10);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const dialogOpen = mode !== "closed" || Boolean(detailRow) || Boolean(deleteRow);
  const singleCardMode = displayMode === "single-card";
  const activeFields = useMemo(() => fields.filter((field) => (mode === "edit" ? !field.hideOnEdit : !field.hideOnCreate)), [fields, mode]);
  const detailList = useMemo(() => detailRow ? detailItems(detailRow, fields, columns) : [], [columns, detailRow, fields]);
  const hasActionColumn = canViewDetails || canUpdate || canDelete;
  const derivedStatusKey = useMemo(() => {
    const columnKey = columns.find((column) => /status/i.test(column.key))?.key;
    if (columnKey && rows.some((row) => !isBlank(valueFor(row, columnKey)))) return columnKey;
    return rows.some((row) => !isBlank(row?.status)) ? "status" : null;
  }, [columns, rows]);
  const statusKey = filterConfig?.statusKey === undefined ? derivedStatusKey : filterConfig.statusKey;
  const statusOptions = useMemo(() => filterConfig?.statusOptions?.length ? filterConfig.statusOptions : distinctValues(rows, statusKey), [filterConfig?.statusOptions, rows, statusKey]);
  const derivedDateKey = useMemo(() => {
    const candidates = [
      "invoiceDate",
      "purchaseDate",
      "paidAt",
      "joiningDate",
      "lastVisitAt",
      "createdAt",
      "updatedAt",
      ...columns.map((column) => column.key).filter((key) => !/display$/i.test(key))
    ];
    return candidates.find((key) => isDateLikeKey(key) && rows.some((row) => rowDateValue(row, key))) || null;
  }, [columns, rows]);
  const dateKey = filterConfig?.dateKey === undefined ? derivedDateKey : filterConfig.dateKey;
  const dateLabel = filterConfig?.dateLabel || columns.find((column) => column.key === dateKey)?.label || (dateKey ? prettifyKey(dateKey) : "Date");
  const derivedFacetKey = useMemo(() => {
    const candidates = ["direction", "role", "categoryDisplay", "supplierDisplay", "customerDisplay", "type", "channel", "city", "area"];
    return candidates.find((key) => {
      if (key === statusKey) return false;
      const values = distinctValues(rows, key);
      return values.length > 1 && values.length <= 12;
    }) || null;
  }, [rows, statusKey]);
  const facetKey = filterConfig?.facetKey === undefined ? derivedFacetKey : filterConfig.facetKey;
  const facetLabel = filterConfig?.facetLabel || columns.find((column) => column.key === facetKey)?.label || (facetKey ? prettifyKey(facetKey) : "Filter");
  const facetOptions = useMemo(() => filterConfig?.facetOptions?.length ? filterConfig.facetOptions : distinctValues(rows, facetKey), [facetKey, filterConfig?.facetOptions, rows]);
  const detailCanUpdate = Boolean(
    detailRow &&
    canUpdate &&
    (canUpdateRow ? canUpdateRow(detailRow) : canUpdateRowKey ? Boolean(detailRow[canUpdateRowKey]) : true)
  );
  const filteredRows = useMemo(() => {
    if (serverPaged) return rows;
    const normalized = query.trim().toLowerCase();
    const from = startOfLocalDay(dateFrom);
    const to = endOfLocalDay(dateTo);

    return rows.filter((row) => {
      const matchesQuery = !normalized || columns.some((column) => String(valueFor(row, column.key)).toLowerCase().includes(normalized));
      const matchesStatus = statusFilter === "all" || String(valueFor(row, statusKey || "")) === statusFilter;
      const matchesFacet = facetFilter === "all" || String(valueFor(row, facetKey || "")) === facetFilter;
      const rowDate = rowDateValue(row, dateKey);
      const matchesFrom = !from || Boolean(rowDate && rowDate >= from);
      const matchesTo = !to || Boolean(rowDate && rowDate <= to);

      return matchesQuery && matchesStatus && matchesFacet && matchesFrom && matchesTo;
    });
  }, [columns, dateFrom, dateKey, dateTo, facetFilter, facetKey, query, rows, serverPaged, statusFilter, statusKey]);
  const hasActiveFilters = Boolean(query.trim() || statusFilter !== "all" || facetFilter !== "all" || dateFrom || dateTo);
  const currentPage = serverPaged ? pagination?.page || 1 : page;
  const currentPageSize = serverPaged ? pagination?.pageSize || pageSize : pageSize;
  const totalRecords = serverPaged ? pagination?.total || 0 : filteredRows.length;
  const totalPages = currentPageSize === 0 ? 1 : Math.max(1, Math.ceil(totalRecords / currentPageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = currentPageSize === 0 ? 0 : (safePage - 1) * currentPageSize;
  const pageRows = serverPaged ? rows : currentPageSize === 0 ? filteredRows : filteredRows.slice(pageStart, pageStart + currentPageSize);
  const visibleStart = totalRecords ? pageStart + 1 : 0;
  const visibleEnd = serverPaged ? Math.min(pageStart + rows.length, totalRecords) : currentPageSize === 0 ? totalRecords : Math.min(pageStart + currentPageSize, totalRecords);
  const updateServerParams = useCallback((updates: Record<string, string | number | null | undefined>) => {
    if (!serverPaged) return;
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      const normalized = value === null || value === undefined ? "" : String(value);
      if (!normalized || normalized === "all") {
        params.delete(key);
      } else {
        params.set(key, normalized);
      }
    }
    const next = params.toString();
    startTransition(() => {
      router.push(next ? `${pathname}?${next}` : pathname, { scroll: false });
    });
  }, [pathname, router, searchParams, serverPaged, startTransition]);

  useEffect(() => {
    if (!serverPaged) return;
    setQuery(pagination?.query ?? "");
    setStatusFilter(pagination?.status || "all");
    setFacetFilter(pagination?.facet || "all");
    setDateFrom(pagination?.dateFrom ?? "");
    setDateTo(pagination?.dateTo ?? "");
    setPage(pagination?.page ?? 1);
    setPageSize(pagination?.pageSize ?? 10);
  }, [pagination?.dateFrom, pagination?.dateTo, pagination?.facet, pagination?.page, pagination?.pageSize, pagination?.query, pagination?.status, serverPaged]);

  useEffect(() => {
    if (!serverPaged) return;
    const handle = window.setTimeout(() => {
      const currentQuery = searchParams.get("q") || "";
      if (query.trim() !== currentQuery) updateServerParams({ q: query.trim(), page: "1" });
    }, 360);
    return () => window.clearTimeout(handle);
  }, [query, searchParams, serverPaged, updateServerParams]);

  useEffect(() => {
    if (serverPaged) return;
    setPage(1);
  }, [dateFrom, dateTo, facetFilter, pageSize, query, serverPaged, statusFilter]);

  useEffect(() => {
    if (serverPaged) return;
    if (page > totalPages) setPage(totalPages);
  }, [page, serverPaged, totalPages]);

  useEffect(() => {
    if (!dialogOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [dialogOpen]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  function modalOriginFromEvent(event?: MouseEvent<HTMLElement>) {
    originElementRef.current = event?.currentTarget || null;
    return captureModalOrigin(event?.currentTarget);
  }

  function liveModalOrigin() {
    const element = originElementRef.current;
    if (!element?.isConnected) return null;
    const rect = element.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
    return visible ? captureModalOrigin(element) : null;
  }

  function clearCloseTimer() {
    if (!closeTimer.current) return;
    window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  function finishDialogClose({ clearMessage = false } = {}) {
    clearCloseTimer();
    setModalOrigin(liveModalOrigin());
    setModalClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setMode("closed");
      setActiveRow(null);
      setDetailRow(null);
      setDeleteRow(null);
      setFieldErrors({});
      if (clearMessage) setMessage(null);
      setModalClosing(false);
      closeTimer.current = null;
    }, MODAL_EXIT_MS);
  }

  function openCreate(event?: MouseEvent<HTMLElement>) {
    clearCloseTimer();
    setModalOrigin(modalOriginFromEvent(event));
    setModalClosing(false);
    setActiveRow(null);
    setDetailRow(null);
    setDeleteRow(null);
    setForm(defaultForm(fields));
    setMessage(null);
    setFieldErrors({});
    setMode("create");
  }

  function openEdit(row: any, event?: MouseEvent<HTMLElement>) {
    clearCloseTimer();
    if (event) setModalOrigin(modalOriginFromEvent(event));
    setModalClosing(false);
    setActiveRow(row);
    setDetailRow(null);
    setDeleteRow(null);
    setForm(defaultForm(fields, row));
    setMessage(null);
    setFieldErrors({});
    setMode("edit");
  }

  function openDetails(row: any, event?: MouseEvent<HTMLElement>) {
    clearCloseTimer();
    setModalOrigin(modalOriginFromEvent(event));
    setModalClosing(false);
    setActiveRow(row);
    setDetailRow(row);
    setDeleteRow(null);
    setMessage(null);
    setMode("closed");
  }

  function closeForm() {
    setMode("closed");
    setFieldErrors({});
  }

  function closeDialog() {
    if (loading) return;
    finishDialogClose({ clearMessage: true });
  }
  closeDialogRef.current = closeDialog;

  useEffect(() => {
    if (!dialogOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat || modalClosing) return;
      event.preventDefault();
      closeDialogRef.current();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [dialogOpen, modalClosing]);

  function updateField(key: string, value: unknown) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "closed") return;
    const validationErrors = validateForm(activeFields, form, mode, endpoint, submitShape);
    if (Object.keys(validationErrors).length) {
      setFieldErrors(validationErrors);
      setMessage("Please fix the highlighted fields before saving.");
      toast.warning("Please fix the highlighted fields before saving.");
      const firstKey = Object.keys(validationErrors)[0];
      window.setTimeout(() => (document.getElementsByName(firstKey)[0] as HTMLElement | undefined)?.focus(), 0);
      return;
    }
    setLoading(true);
    setMessage(null);
    setFieldErrors({});
    try {
      const method = mode === "edit" ? "PATCH" : "POST";
      const url = mode === "edit" ? `${endpoint}/${activeRow.id}` : endpoint;
      const basePayload = normalizeByFields(form, activeFields, mode);
      const payload =
        submitShape === "invoice" && mode === "create"
          ? {
              invoiceNo: basePayload.invoiceNo,
              customerId: basePayload.customerId,
              discount: basePayload.discount,
              tax: basePayload.tax,
              loyaltyDiscount: basePayload.loyaltyDiscount,
              paidAmount: basePayload.paidAmount,
              cashierCounter: basePayload.cashierCounter,
              channel: basePayload.channel,
              promoCode: basePayload.promoCode,
              receiptNo: basePayload.receiptNo,
              notes: basePayload.notes,
              items: [{ productId: basePayload.productId, quantity: basePayload.quantity || 1, ...(basePayload.unitPrice ? { unitPrice: basePayload.unitPrice } : {}) }]
            }
          : submitShape === "purchase" && mode === "create"
            ? {
                purchaseNo: basePayload.purchaseNo,
                supplierId: basePayload.supplierId,
                paidAmount: basePayload.paidAmount,
                notes: basePayload.notes,
                items: [{ productId: basePayload.productId, quantity: basePayload.quantity || 1, unitCost: basePayload.unitCost }]
              }
            : basePayload;
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const nextFieldErrors = issueMap(data.issues);
        if (Object.keys(nextFieldErrors).length) setFieldErrors(nextFieldErrors);
        const firstIssue = Object.values(nextFieldErrors).find(Boolean);
        throw new Error(firstIssue || data.error || "Request failed.");
      }
      toast.success(`${entityLabel(title, createLabel)} ${mode === "edit" ? "updated" : "created"} successfully.`);
      finishDialogClose({ clearMessage: true });
      router.refresh();
    } catch (error: any) {
      const errorMessage = error?.message || "Something went wrong.";
      setMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function requestDelete(row: any, event?: MouseEvent<HTMLElement>) {
    clearCloseTimer();
    setModalOrigin(modalOriginFromEvent(event));
    setModalClosing(false);
    setMode("closed");
    setDetailRow(null);
    setDeleteRow(row);
    setMessage(null);
  }

  async function confirmDelete(row: any) {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${endpoint}/${row.id}`, { method: "DELETE", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Request failed.");
      toast.success(`${rowLabel(row)} ${deleteVerb.toLowerCase()} successfully.`);
      finishDialogClose({ clearMessage: true });
      router.refresh();
    } catch (error: any) {
      const errorMessage = error?.message || "Delete failed.";
      setMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  function resetFilters() {
    setQuery("");
    setStatusFilter("all");
    setFacetFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    if (serverPaged) {
      updateServerParams({ q: null, status: null, facet: null, dateFrom: null, dateTo: null, page: "1" });
    }
  }

  return (
    <Card className="crud-card overflow-hidden">
      <CardHeader className="crud-header">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{totalRecords.toLocaleString()} records</Badge>
              {canCreate || canUpdate || canDelete ? <Badge variant="success">Role enabled</Badge> : <Badge variant="outline">Read only</Badge>}
            </div>
            <CardTitle className="text-xl tracking-normal">{title}</CardTitle>
            {description ? <CardDescription className="max-w-3xl">{description}</CardDescription> : null}
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            {canCreate ? (
              createAction ?? (
                <Button onClick={(event) => openCreate(event)} className="shrink-0">
                  <Plus className="size-4" />
                  {createLabel}
                </Button>
              )
            ) : canUpdate || canDelete ? (
              <Badge variant="secondary" className="min-h-10 px-4">Existing records only</Badge>
            ) : (
              <Badge variant="outline" className="min-h-10 px-4">
                <ShieldAlert className="size-3.5" /> Read-only for your role
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!singleCardMode ? (
        <div className="crud-table-toolbar">
          <div className="crud-search-box">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-10" placeholder={`Search by name, number, status or ${title.toLowerCase()}...`} />
          </div>
          <div className="crud-filter-row" aria-label={`${title} filters`}>
            {statusOptions.length > 1 ? (
              <label className="crud-filter-control">
                <span>Status</span>
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    if (serverPaged) updateServerParams({ status: event.target.value, page: "1" });
                  }}
                >
                  <option value="all">All statuses</option>
                  {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ) : null}
            {facetKey && facetOptions.length > 1 ? (
              <label className="crud-filter-control">
                <span>{facetLabel}</span>
                <select
                  className="form-select"
                  value={facetFilter}
                  onChange={(event) => {
                    setFacetFilter(event.target.value);
                    if (serverPaged) updateServerParams({ facet: event.target.value, page: "1" });
                  }}
                >
                  <option value="all">All {facetLabel.toLowerCase()}</option>
                  {facetOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            ) : null}
            {dateKey ? (
              <>
                <label className="crud-filter-control">
                  <span>{dateLabel} from</span>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => {
                      setDateFrom(event.target.value);
                      if (serverPaged) updateServerParams({ dateFrom: event.target.value, page: "1" });
                    }}
                  />
                </label>
                <label className="crud-filter-control">
                  <span>{dateLabel} to</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(event) => {
                      setDateTo(event.target.value);
                      if (serverPaged) updateServerParams({ dateTo: event.target.value, page: "1" });
                    }}
                  />
                </label>
              </>
            ) : null}
            <label className="crud-filter-control crud-limit-control">
              <span>Rows</span>
              <select
                className="form-select"
                value={String(currentPageSize)}
                onChange={(event) => {
                  const nextSize = Number(event.target.value);
                  setPageSize(nextSize);
                  if (serverPaged) updateServerParams({ pageSize: nextSize, page: "1" });
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                {!serverPaged ? <option value="0">All</option> : null}
              </select>
            </label>
            {hasActiveFilters ? (
              <Button type="button" variant="outline" size="sm" onClick={resetFilters} className="crud-reset-filter">
                <Filter className="size-3.5" />
                Reset
              </Button>
            ) : null}
          </div>
        </div>
        ) : null}
        {message && !dialogOpen ? <div className="status-message mx-4 mt-4 border-destructive/20 bg-destructive/10 text-destructive sm:mx-5">{message}</div> : null}
      {dialogOpen ? (
        <ModalPortal>
          <div className="crud-modal-layer" data-state={modalClosing ? "closing" : "open"} role="presentation">
            <button type="button" className="crud-modal-backdrop" data-state={modalClosing ? "closing" : "open"} aria-label="Close dialog" onClick={closeDialog} />
            <div
              className={cn("crud-modal motion-modal", mode === "closed" && detailRow && "crud-modal-details", deleteRow && "crud-modal-confirm")}
              data-state={modalClosing ? "closing" : "open"}
              style={modalMotionStyle(modalOrigin)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="crud-modal-title"
            >
              {mode !== "closed" ? (
                <form onSubmit={submit} noValidate>
                  <div className="crud-modal-heading">
                    <div className="min-w-0">
                      <p id="crud-modal-title" className="truncate text-lg font-semibold tracking-normal">{mode === "edit" ? `Update ${rowLabel(activeRow)}` : createLabel}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">Only the fields needed for this action are shown here.</p>
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={closeDialog} title="Close form">
                      <X className="size-4" />
                    </Button>
                  </div>
                  {message ? <div role="alert" className="status-message mx-5 mt-4 border-destructive/20 bg-destructive/10 text-destructive">{message}</div> : null}
                  <div className="crud-modal-body">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {activeFields.map((field) => {
                        const error = fieldErrors[field.key];
                        const min = field.min ?? (isNonNegativeNumberField(field) ? 0 : undefined);

                        return (
                          <label
                            key={field.key}
                            data-invalid={Boolean(error) || undefined}
                            className={cn("crud-field", field.span === "full" && "sm:col-span-2 xl:col-span-3", field.span === "half" && "xl:col-span-2")}
                          >
                            <span className="crud-field-label">
                              {field.label}
                              {field.required ? <i aria-hidden="true">*</i> : null}
                            </span>
                            {field.type === "textarea" ? (
                              <Textarea
                                name={field.key}
                                value={form[field.key] ?? ""}
                                onChange={(event) => updateField(field.key, event.target.value)}
                                placeholder={field.placeholder}
                                aria-invalid={Boolean(error)}
                                aria-describedby={error ? `${field.key}-error` : undefined}
                                autoComplete={autoCompleteFor(field)}
                              />
                            ) : field.type === "select" ? (
                              <select
                                name={field.key}
                                value={form[field.key] ?? ""}
                                onChange={(event) => updateField(field.key, event.target.value)}
                                aria-invalid={Boolean(error)}
                                aria-describedby={error ? `${field.key}-error` : undefined}
                                className="form-select"
                              >
                                <option value="">Select {field.label}</option>
                                {field.options?.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <Input
                                name={field.key}
                                type={field.type || "text"}
                                value={form[field.key] ?? ""}
                                onChange={(event) => updateField(field.key, event.target.value)}
                                placeholder={field.placeholder}
                                aria-invalid={Boolean(error)}
                                aria-describedby={error ? `${field.key}-error` : undefined}
                                min={min}
                                max={field.max}
                                step={field.step ?? (field.type === "number" ? "any" : undefined)}
                                inputMode={inputModeFor(field)}
                                autoComplete={autoCompleteFor(field)}
                              />
                            )}
                            {error ? <span id={`${field.key}-error`} className="crud-field-error">{error}</span> : null}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="crud-modal-footer">
                    <Button disabled={loading} className="w-full sm:w-auto">
                      {loading ? "Saving..." : mode === "edit" ? "Save changes" : "Create"}
                    </Button>
                    <Button type="button" variant="outline" onClick={closeDialog} className="w-full sm:w-auto">
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}

              {detailRow && mode === "closed" ? (
                <section aria-live="polite">
                  <div className="crud-modal-heading">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="crud-detail-icon">
                        <Info className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p id="crud-modal-title" className="truncate text-lg font-semibold tracking-normal">Details for {rowLabel(detailRow)}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">Review the full record without entering edit mode.</p>
                      </div>
                    </div>
                    <div className="ml-auto flex shrink-0 gap-2">
                      {detailCanUpdate ? (
                        <Button type="button" size="sm" variant="outline" onClick={(event) => openEdit(detailRow, event)} disabled={loading}>
                          <Edit3 className="size-3.5" />
                          Edit
                        </Button>
                      ) : null}
                      <Button type="button" size="icon" variant="outline" onClick={closeDialog} title="Close details">
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="crud-modal-body">
                    <div className="crud-detail-grid">
                      {detailList.map((item) => (
                        <div key={item.key} className="crud-detail-item">
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}

              {deleteRow && mode === "closed" ? (
                <section aria-live="polite">
                  <div className="crud-modal-heading">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="crud-detail-icon bg-destructive/12 text-destructive">
                        <Trash2 className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p id="crud-modal-title" className="truncate text-lg font-semibold tracking-normal">{deleteVerb} {rowLabel(deleteRow)}?</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">This action is protected and will update the record according to your role permissions.</p>
                      </div>
                    </div>
                    <Button type="button" size="icon" variant="outline" onClick={closeDialog} title="Close confirmation" disabled={loading}>
                      <X className="size-4" />
                    </Button>
                  </div>
                  {message ? <div role="alert" className="status-message mx-5 mt-4 border-destructive/20 bg-destructive/10 text-destructive">{message}</div> : null}
                  <div className="crud-modal-body">
                    <div className="crud-delete-panel">
                      <p className="text-sm leading-6 text-muted-foreground">Confirm that you want to {deleteVerb.toLowerCase()} this record. You can cancel and return exactly where you started.</p>
                      <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Selected record</span>
                        <strong className="mt-1 block truncate text-base">{rowLabel(deleteRow)}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="crud-modal-footer">
                    <Button type="button" variant="destructive" onClick={() => confirmDelete(deleteRow)} disabled={loading}>
                      {loading ? `${deleteVerb}...` : deleteVerb}
                    </Button>
                    <Button type="button" variant="outline" onClick={closeDialog} disabled={loading}>
                      Cancel
                    </Button>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
          </ModalPortal>
        ) : null}
        {singleCardMode ? (
          <div className="crud-single-record-wrap">
            {rows[0] ? (
              (() => {
                const row = rows[0];
                const rowUpdateAllowed = canUpdateRow ? canUpdateRow(row) : canUpdateRowKey ? Boolean(row[canUpdateRowKey]) : true;
                const rowDeleteAllowed = canDeleteRow ? canDeleteRow(row) : canDeleteRowKey ? Boolean(row[canDeleteRowKey]) : true;
                const rowCanUpdate = Boolean(canUpdate && rowUpdateAllowed);
                const rowCanDelete = Boolean(canDelete && rowDeleteAllowed);

                return (
                  <div className="crud-single-record-card">
                    <div className="min-w-0">
                      <div className="crud-single-record-heading">
                        <span className="crud-detail-icon">
                          <Info className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p>{rowLabel(row)}</p>
                          <span>Primary workspace shop profile</span>
                        </div>
                      </div>
                      <div className="crud-single-record-grid">
                        {columns.map((column) => (
                          <div key={column.key} className="crud-single-record-field">
                            <span>{column.label}</span>
                            <strong>{cellContent(column, row)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="crud-single-record-actions">
                      {canViewDetails ? (
                        <Button size="sm" variant="secondary" onClick={(event) => openDetails(row, event)} disabled={loading}>
                          <Eye className="size-3.5" />
                          Details
                        </Button>
                      ) : null}
                      {rowCanUpdate ? (
                        <Button size="sm" variant="outline" onClick={(event) => openEdit(row, event)} disabled={loading}>
                          <Edit3 className="size-3.5" />
                          Edit
                        </Button>
                      ) : null}
                      {rowCanDelete ? (
                        <Button size="sm" variant="destructive" onClick={(event) => requestDelete(row, event)} disabled={loading}>
                          <Trash2 className="size-3.5" />
                          {deleteLabel}
                        </Button>
                      ) : null}
                      {!canViewDetails && !rowCanUpdate && !rowCanDelete ? <Badge variant="outline">Protected</Badge> : null}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="crud-single-record-card">
                <div className="empty-state">{emptyState}</div>
              </div>
            )}
          </div>
        ) : (
          <>
        <div className={cn("crud-table-scroll relative overflow-x-auto", isPending && "is-loading")}>
          {isPending ? (
            <div className="crud-table-pending" aria-live="polite" aria-label="Loading records">
              <span />
              <span />
              <span />
            </div>
          ) : null}
          <table className="crud-table w-full min-w-[760px] text-sm">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className={cn("px-5 py-4 text-left", isNumericColumn(column.key) && "text-right", column.className)}>
                    {column.label}
                  </th>
                ))}
                {hasActionColumn ? <th className="px-5 py-4 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {pageRows.length ? (
                pageRows.map((row) => {
                  const rowUpdateAllowed = canUpdateRow ? canUpdateRow(row) : canUpdateRowKey ? Boolean(row[canUpdateRowKey]) : true;
                  const rowDeleteAllowed = canDeleteRow ? canDeleteRow(row) : canDeleteRowKey ? Boolean(row[canDeleteRowKey]) : true;
                  const rowCanUpdate = Boolean(canUpdate && rowUpdateAllowed);
                  const rowCanDelete = Boolean(canDelete && rowDeleteAllowed);

                  return (
                    <tr key={row.id} className="border-t border-border/60 align-top">
                      {columns.map((column) => (
                        <td key={column.key} data-label={column.label} className={cn("px-5 py-4", isNumericColumn(column.key) && "text-right tabular-nums", column.className)}>
                          {cellContent(column, row)}
                        </td>
                      ))}
                      {hasActionColumn ? (
                        <td data-label="Actions" className="px-5 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            {canViewDetails ? (
                              <Button size="sm" variant="secondary" onClick={(event) => openDetails(row, event)} disabled={loading}>
                                <Eye className="size-3.5" />
                                Details
                              </Button>
                            ) : null}
                            {rowCanUpdate ? (
                              <Button size="sm" variant="outline" onClick={(event) => openEdit(row, event)} disabled={loading}>
                                <Edit3 className="size-3.5" />
                                Edit
                              </Button>
                            ) : null}
                            {rowCanDelete ? (
                              <Button size="sm" variant="destructive" onClick={(event) => requestDelete(row, event)} disabled={loading}>
                                <Trash2 className="size-3.5" />
                                {deleteLabel}
                              </Button>
                            ) : null}
                            {!canViewDetails && !rowCanUpdate && !rowCanDelete ? <Badge variant="outline">Protected</Badge> : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columns.length + (hasActionColumn ? 1 : 0)} className="px-4 py-12">
                    <div className="empty-state">{hasActiveFilters ? "No records match the current filters." : emptyState}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="crud-table-footer">
          <p>
            Showing <strong>{visibleStart.toLocaleString()}-{visibleEnd.toLocaleString()}</strong> of <strong>{totalRecords.toLocaleString()}</strong>
            {!serverPaged && filteredRows.length !== rows.length ? <span> filtered from {rows.length.toLocaleString()}</span> : null}
          </p>
          <div className="crud-pagination">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (serverPaged) updateServerParams({ page: Math.max(1, safePage - 1) });
                else setPage((current) => Math.max(1, current - 1));
              }}
              disabled={safePage <= 1 || currentPageSize === 0 || isPending}
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </Button>
            <span>Page {safePage.toLocaleString()} of {totalPages.toLocaleString()}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (serverPaged) updateServerParams({ page: Math.min(totalPages, safePage + 1) });
                else setPage((current) => Math.min(totalPages, current + 1));
              }}
              disabled={safePage >= totalPages || currentPageSize === 0 || isPending}
            >
              Next
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
