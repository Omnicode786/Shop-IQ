"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, ReceiptText, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { captureModalOrigin, modalMotionStyle, ModalPortal, type ModalMotionOrigin } from "@/components/workspace/modal-portal";
import { toast } from "@/lib/toast";

type CustomerOption = {
  id: string;
  name: string;
  phone?: string | null;
  area?: string | null;
};

type ProductOption = {
  id: string;
  name: string;
  unit?: string | null;
  stockQty: number;
  salePrice: number | string;
};

function money(value: number) {
  return `PKR ${Math.round(value || 0).toLocaleString()}`;
}

const MODAL_EXIT_MS = 380;

export function BillingFlow({ customers, products, canCreate }: { customers: CustomerOption[]; products: ProductOption[]; canCreate: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [modalOrigin, setModalOrigin] = useState<ModalMotionOrigin | null>(null);
  const closeTimer = useRef<number | null>(null);
  const originElementRef = useRef<Element | null>(null);
  const closeFromKeyboardRef = useRef<() => void>(() => {});
  const [createCustomer, setCreateCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerId: "",
    customerName: "",
    customerPhone: "",
    customerArea: "",
    productId: "",
    quantity: "1",
    paidAmount: "0",
    discount: "0",
    channel: "POS",
    notes: ""
  });

  const selectedProduct = useMemo(() => products.find((product) => product.id === form.productId), [form.productId, products]);
  const quantity = Math.max(1, Number(form.quantity || 1));
  const discount = Math.max(0, Number(form.discount || 0));
  const subtotal = selectedProduct ? Number(selectedProduct.salePrice || 0) * quantity : 0;
  const total = Math.max(0, subtotal - discount);
  const paid = Math.min(Math.max(0, Number(form.paidAmount || 0)), total);
  const due = Math.max(0, total - paid);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  function resetForm() {
    setForm({
      customerId: "",
      customerName: "",
      customerPhone: "",
      customerArea: "",
      productId: "",
      quantity: "1",
      paidAmount: "0",
      discount: "0",
      channel: "POS",
      notes: ""
    });
    setCreateCustomer(false);
  }

  function openFlow(event: MouseEvent<HTMLElement>) {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    originElementRef.current = event.currentTarget;
    setModalOrigin(captureModalOrigin(event.currentTarget));
    setClosing(false);
    setOpen(true);
  }

  function liveModalOrigin() {
    const element = originElementRef.current;
    if (!element?.isConnected) return null;
    const rect = element.getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
    return visible ? captureModalOrigin(element) : null;
  }

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  }

  function close({ force = false, resetAfter = false } = {}) {
    if (loading && !force) return;
    setModalOrigin(liveModalOrigin());
    setClosing(true);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
      setMessage(null);
      if (resetAfter) resetForm();
      closeTimer.current = null;
    }, MODAL_EXIT_MS);
  }
  closeFromKeyboardRef.current = () => close();

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.repeat || closing) return;
      event.preventDefault();
      closeFromKeyboardRef.current();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closing, open]);

  function stopWithMessage(text: string) {
    setMessage(text);
    toast.warning(text);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canCreate) return;
    if (!form.productId) {
      stopWithMessage("Choose a product before creating the invoice.");
      return;
    }
    if (!selectedProduct || selectedProduct.stockQty < quantity) {
      stopWithMessage(`${selectedProduct?.name || "Selected product"} does not have enough stock.`);
      return;
    }
    if (createCustomer && !form.customerName.trim()) {
      stopWithMessage("Enter the new customer name or switch back to walk-in/select customer.");
      return;
    }
    if (due > 0 && !createCustomer && !form.customerId) {
      stopWithMessage("Choose or create a customer when any invoice amount will remain due.");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      let customerId = form.customerId || undefined;
      if (createCustomer) {
        const customerResponse = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.customerName,
            phone: form.customerPhone,
            area: form.customerArea,
            customerType: "WALK_IN_LOYALTY",
            notes: "Created during guided billing flow."
          }),
          cache: "no-store"
        });
        const customerData = await customerResponse.json().catch(() => ({}));
        if (!customerResponse.ok) throw new Error(customerData.error || "Unable to create customer.");
        customerId = customerData.customer?.id;
        toast.success("Customer created successfully.");
      }

      const invoiceResponse = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          discount,
          tax: 0,
          loyaltyDiscount: 0,
          paidAmount: paid,
          channel: form.channel,
          notes: form.notes,
          items: [{ productId: form.productId, quantity }]
        }),
        cache: "no-store"
      });
      const invoiceData = await invoiceResponse.json().catch(() => ({}));
      if (!invoiceResponse.ok) throw new Error(invoiceData.error || "Unable to create invoice.");

      toast.success("Invoice created successfully.");
      close({ force: true, resetAfter: true });
      router.refresh();
    } catch (error: any) {
      const errorMessage = error?.message || "Billing flow failed.";
      setMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (!canCreate) return null;

  return (
    <>
      <Button type="button" onClick={openFlow} className="w-full sm:w-auto">
        <ReceiptText className="size-4" />
        Create invoice
      </Button>
      {open ? (
        <ModalPortal>
        <div className="crud-modal-layer" data-state={closing ? "closing" : "open"} role="presentation">
          <button type="button" className="crud-modal-backdrop" data-state={closing ? "closing" : "open"} aria-label="Close billing flow" onClick={() => close()} />
          <div className="crud-modal motion-modal billing-flow-modal" data-state={closing ? "closing" : "open"} style={modalMotionStyle(modalOrigin)} role="dialog" aria-modal="true" aria-labelledby="billing-flow-title">
            <form onSubmit={submit} noValidate>
              <div className="crud-modal-heading">
                <div className="min-w-0">
                  <p id="billing-flow-title" className="text-lg font-semibold tracking-normal">Guided billing flow</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Create the customer and invoice in one focused workflow.</p>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => close()} title="Close billing flow">
                  <X className="size-4" />
                </Button>
              </div>
              {message ? <div role="alert" className="status-message mx-5 mt-4 border-destructive/20 bg-destructive/10 text-destructive">{message}</div> : null}
              <div className="crud-modal-body">
                <div className="billing-flow-steps">
                  <section className="billing-flow-section">
                    <div className="billing-flow-section-title">
                      <UserPlus className="size-4" />
                      <span>Customer</span>
                    </div>
                    <div className="billing-toggle">
                      <button type="button" data-active={!createCustomer || undefined} onClick={() => setCreateCustomer(false)}>Select existing</button>
                      <button type="button" data-active={createCustomer || undefined} onClick={() => setCreateCustomer(true)}>Create new</button>
                    </div>
                    {createCustomer ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="crud-field sm:col-span-3">
                          <span className="crud-field-label">Customer name <i aria-hidden="true">*</i></span>
                          <Input value={form.customerName} onChange={(event) => update("customerName", event.target.value)} placeholder="Customer name" />
                        </label>
                        <label className="crud-field">
                          <span className="crud-field-label">Phone</span>
                          <Input value={form.customerPhone} onChange={(event) => update("customerPhone", event.target.value)} placeholder="03xx..." inputMode="tel" />
                        </label>
                        <label className="crud-field sm:col-span-2">
                          <span className="crud-field-label">Area</span>
                          <Input value={form.customerArea} onChange={(event) => update("customerArea", event.target.value)} placeholder="Area / block" />
                        </label>
                      </div>
                    ) : (
                      <label className="crud-field">
                        <span className="crud-field-label">Customer</span>
                        <select className="form-select" value={form.customerId} onChange={(event) => update("customerId", event.target.value)}>
                          <option value="">Walk-in customer</option>
                          {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>{customer.name}{customer.phone ? ` - ${customer.phone}` : ""}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </section>

                  <section className="billing-flow-section">
                    <div className="billing-flow-section-title">
                      <ReceiptText className="size-4" />
                      <span>Invoice item</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1.4fr_0.6fr_0.7fr]">
                      <label className="crud-field">
                        <span className="crud-field-label">Product <i aria-hidden="true">*</i></span>
                        <select className="form-select" value={form.productId} onChange={(event) => update("productId", event.target.value)}>
                          <option value="">Choose product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>{product.name} - {product.stockQty} {product.unit || "pcs"} left</option>
                          ))}
                        </select>
                      </label>
                      <label className="crud-field">
                        <span className="crud-field-label">Quantity</span>
                        <Input type="number" min={1} value={form.quantity} onChange={(event) => update("quantity", event.target.value)} />
                      </label>
                      <label className="crud-field">
                        <span className="crud-field-label">Discount</span>
                        <Input type="number" min={0} value={form.discount} onChange={(event) => update("discount", event.target.value)} />
                      </label>
                    </div>
                  </section>

                  <section className="billing-flow-section">
                    <div className="billing-flow-section-title">
                      <CreditCard className="size-4" />
                      <span>Payment</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="crud-field">
                        <span className="crud-field-label">Paid amount</span>
                        <Input type="number" min={0} value={form.paidAmount} onChange={(event) => update("paidAmount", event.target.value)} />
                      </label>
                      <label className="crud-field">
                        <span className="crud-field-label">Channel</span>
                        <select className="form-select" value={form.channel} onChange={(event) => update("channel", event.target.value)}>
                          <option value="POS">POS</option>
                          <option value="LOYALTY">Loyalty counter</option>
                          <option value="B2B">B2B / bulk</option>
                        </select>
                      </label>
                      <div className="billing-total-card">
                        <span>Total</span>
                        <strong>{money(total)}</strong>
                        <small>{due > 0 ? `${money(due)} due` : "Fully paid"}</small>
                      </div>
                      <label className="crud-field sm:col-span-3">
                        <span className="crud-field-label">Notes</span>
                        <Textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Optional invoice note" />
                      </label>
                    </div>
                  </section>
                </div>
              </div>
              <div className="crud-modal-footer">
                <Button disabled={loading}>{loading ? "Creating invoice..." : "Create invoice"}</Button>
                <Button type="button" variant="outline" onClick={() => close()}>Cancel</Button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
