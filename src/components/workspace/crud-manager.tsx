"use client";

import { useMemo, useState, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Eye, Info, Plus, Search, ShieldAlert, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  deleteLabel?: string;
  deleteVerb?: string;
  emptyState?: string;
  submitShape?: "invoice" | "purchase";
  canViewDetails?: boolean;
};

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

function rowLabel(row: any) {
  return row.name || row.invoiceNo || row.purchaseNo || row.paymentNo || row.email || "this record";
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
  deleteLabel = "Delete",
  deleteVerb = deleteLabel,
  emptyState = "No records found.",
  submitShape,
  canViewDetails = true
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"closed" | "create" | "edit">("closed");
  const [activeRow, setActiveRow] = useState<any>(null);
  const [detailRow, setDetailRow] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>(defaultForm(fields));
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const activeFields = useMemo(() => fields.filter((field) => (mode === "edit" ? !field.hideOnEdit : !field.hideOnCreate)), [fields, mode]);
  const detailList = useMemo(() => detailRow ? detailItems(detailRow, fields, columns) : [], [columns, detailRow, fields]);
  const hasActionColumn = canViewDetails || canUpdate || canDelete;
  const detailCanUpdate = Boolean(
    detailRow &&
    canUpdate &&
    (canUpdateRow ? canUpdateRow(detailRow) : canUpdateRowKey ? Boolean(detailRow[canUpdateRowKey]) : true)
  );
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter((row) =>
      columns.some((column) => String(valueFor(row, column.key)).toLowerCase().includes(normalized))
    );
  }, [columns, query, rows]);

  function openCreate() {
    setActiveRow(null);
    setDetailRow(null);
    setForm(defaultForm(fields));
    setMessage(null);
    setFieldErrors({});
    setMode("create");
  }

  function openEdit(row: any) {
    setActiveRow(row);
    setDetailRow(null);
    setForm(defaultForm(fields, row));
    setMessage(null);
    setFieldErrors({});
    setMode("edit");
  }

  function openDetails(row: any) {
    setActiveRow(row);
    setDetailRow(row);
    setMessage(null);
    setMode("closed");
  }

  function closeForm() {
    setMode("closed");
    setFieldErrors({});
  }

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
      setMode("closed");
      setDetailRow(null);
      router.refresh();
    } catch (error: any) {
      setMessage(error?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function remove(row: any) {
    if (!window.confirm(`${deleteVerb} ${rowLabel(row)}?`)) return;
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`${endpoint}/${row.id}`, { method: "DELETE", cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Request failed.");
      router.refresh();
    } catch (error: any) {
      setMessage(error?.message || "Delete failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="crud-card overflow-hidden">
      <CardHeader className="crud-header">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{rows.length.toLocaleString()} records</Badge>
              {canCreate || canUpdate || canDelete ? <Badge variant="success">Role enabled</Badge> : <Badge variant="outline">Read only</Badge>}
            </div>
            <CardTitle className="text-xl tracking-normal">{title}</CardTitle>
            {description ? <CardDescription className="max-w-3xl">{description}</CardDescription> : null}
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <div className="relative min-w-0 flex-1 xl:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 pl-10" placeholder={`Search ${title.toLowerCase()}...`} />
            </div>
            {canCreate ? (
              <Button onClick={openCreate} className="shrink-0">
                <Plus className="size-4" />
                {createLabel}
              </Button>
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
        {message ? <div className="status-message mx-4 mt-4 border-destructive/20 bg-destructive/10 text-destructive sm:mx-5">{message}</div> : null}
        {mode !== "closed" ? (
          <form onSubmit={submit} className="crud-form-panel" noValidate>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{mode === "edit" ? `Update ${rowLabel(activeRow)}` : createLabel}</p>
                <p className="text-xs leading-5 text-muted-foreground">Saved through role-aware API routes with validation and exception handling.</p>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={closeForm} title="Close form">
                <X className="size-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {activeFields.map((field) => {
                const error = fieldErrors[field.key];
                const min = field.min ?? (isNonNegativeNumberField(field) ? 0 : undefined);

                return (
                  <label
                    key={field.key}
                    data-invalid={Boolean(error) || undefined}
                    className={cn("crud-field", field.span === "full" && "sm:col-span-2 xl:col-span-4", field.span === "half" && "xl:col-span-2")}
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
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button disabled={loading} className="w-full sm:w-auto">
                {loading ? "Saving..." : mode === "edit" ? "Save changes" : "Create"}
              </Button>
              <Button type="button" variant="outline" onClick={closeForm} className="w-full sm:w-auto">
                Cancel
              </Button>
            </div>
          </form>
        ) : null}
        {detailRow ? (
          <section className="crud-detail-panel" aria-live="polite">
            <div className="crud-detail-heading">
              <span className="crud-detail-icon">
                <Info className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">Details for {rowLabel(detailRow)}</p>
                <p className="text-xs leading-5 text-muted-foreground">Review the full record without entering edit mode.</p>
              </div>
              <div className="ml-auto flex shrink-0 gap-2">
                {detailCanUpdate ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => openEdit(detailRow)} disabled={loading}>
                    <Edit3 className="size-3.5" />
                    Edit
                  </Button>
                ) : null}
                <Button type="button" size="icon" variant="outline" onClick={() => setDetailRow(null)} title="Close details">
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            <div className="crud-detail-grid">
              {detailList.map((item) => (
                <div key={item.key} className="crud-detail-item">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className={cn("px-5 py-4 text-left", column.className)}>
                    {column.label}
                  </th>
                ))}
                {hasActionColumn ? <th className="px-5 py-4 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length ? (
                filteredRows.map((row) => {
                  const rowUpdateAllowed = canUpdateRow ? canUpdateRow(row) : canUpdateRowKey ? Boolean(row[canUpdateRowKey]) : true;
                  const rowDeleteAllowed = canDeleteRow ? canDeleteRow(row) : canDeleteRowKey ? Boolean(row[canDeleteRowKey]) : true;
                  const rowCanUpdate = Boolean(canUpdate && rowUpdateAllowed);
                  const rowCanDelete = Boolean(canDelete && rowDeleteAllowed);

                  return (
                    <tr key={row.id} className="border-t border-border/60 align-top">
                      {columns.map((column) => (
                        <td key={column.key} className={cn("px-5 py-4", column.className)}>
                          {cellContent(column, row)}
                        </td>
                      ))}
                      {hasActionColumn ? (
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            {canViewDetails ? (
                              <Button size="sm" variant="secondary" onClick={() => openDetails(row)} disabled={loading}>
                                <Eye className="size-3.5" />
                                Details
                              </Button>
                            ) : null}
                            {rowCanUpdate ? (
                              <Button size="sm" variant="outline" onClick={() => openEdit(row)} disabled={loading}>
                                <Edit3 className="size-3.5" />
                                Edit
                              </Button>
                            ) : null}
                            {rowCanDelete ? (
                              <Button size="sm" variant="destructive" onClick={() => remove(row)} disabled={loading}>
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
                    <div className="empty-state">{query ? "No matching records found." : emptyState}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
