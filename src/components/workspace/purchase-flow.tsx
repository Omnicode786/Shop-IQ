"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, Truck, WalletCards, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { captureModalOrigin, modalMotionStyle, ModalPortal, type ModalMotionOrigin } from "@/components/workspace/modal-portal";
import { toast } from "@/lib/toast";

type SupplierOption = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
};

type ProductOption = {
  id: string;
  name: string;
  unit?: string | null;
  packUnit?: string | null;
  packSize?: number | null;
  costPrice: number | string;
};

function money(value: number) {
  return `PKR ${Math.round(value || 0).toLocaleString()}`;
}

const MODAL_EXIT_MS = 380;

export function PurchaseFlow({ suppliers, products, canCreate }: { suppliers: SupplierOption[]; products: ProductOption[]; canCreate: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [modalOrigin, setModalOrigin] = useState<ModalMotionOrigin | null>(null);
  const closeTimer = useRef<number | null>(null);
  const originElementRef = useRef<Element | null>(null);
  const closeFromKeyboardRef = useRef<() => void>(() => {});
  const [createSupplier, setCreateSupplier] = useState(false);
  const [receiveMode, setReceiveMode] = useState<"base" | "pack">("base");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    supplierId: "",
    supplierName: "",
    supplierPhone: "",
    supplierAddress: "",
    productId: "",
    quantity: "1",
    unitCost: "",
    paidAmount: "0",
    notes: ""
  });

  const selectedProduct = useMemo(() => products.find((product) => product.id === form.productId), [form.productId, products]);
  const quantity = Math.max(1, Number(form.quantity || 1));
  const suggestedCost = selectedProduct ? Number(selectedProduct.costPrice || 0) : 0;
  const unitCost = Math.max(0, Number(form.unitCost || 0) || suggestedCost);
  const total = unitCost * quantity;
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

  useEffect(() => {
    if (selectedProduct && !form.unitCost) {
      setForm((current) => ({ ...current, unitCost: String(Number(selectedProduct.costPrice || 0)) }));
    }
  }, [form.unitCost, selectedProduct]);

  useEffect(() => {
    if (selectedProduct && !selectedProduct.packSize) {
      setReceiveMode("base");
    }
  }, [selectedProduct]);

  function resetForm() {
    setCreateSupplier(false);
    setForm({
      supplierId: "",
      supplierName: "",
      supplierPhone: "",
      supplierAddress: "",
      productId: "",
      quantity: "1",
      unitCost: "",
      paidAmount: "0",
      notes: ""
    });
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
      stopWithMessage("Choose a product before receiving stock.");
      return;
    }
    if (unitCost <= 0) {
      stopWithMessage("Enter a valid unit cost greater than zero.");
      return;
    }
    if (createSupplier && !form.supplierName.trim()) {
      stopWithMessage("Enter the new supplier name or switch back to selecting a supplier.");
      return;
    }
    if (!createSupplier && !form.supplierId) {
      stopWithMessage("Choose or create a supplier before receiving stock.");
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      let supplierId = form.supplierId || undefined;
      if (createSupplier) {
        const supplierResponse = await fetch("/api/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.supplierName,
            phone: form.supplierPhone,
            address: form.supplierAddress,
            supplierType: "General",
            notes: "Created during guided purchase receiving flow."
          }),
          cache: "no-store"
        });
        const supplierData = await supplierResponse.json().catch(() => ({}));
        if (!supplierResponse.ok) throw new Error(supplierData.error || "Unable to create supplier.");
        supplierId = supplierData.supplier?.id;
        toast.success("Supplier created successfully.");
      }

      const finalQuantity = receiveMode === "pack" ? quantity * (selectedProduct?.packSize || 1) : quantity;
      const finalUnitCost = receiveMode === "pack" ? unitCost / (selectedProduct?.packSize || 1) : unitCost;

      const purchaseResponse = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          paidAmount: paid,
          notes: form.notes,
          items: [{ productId: form.productId, quantity: finalQuantity, unitCost: finalUnitCost }]
        }),
        cache: "no-store"
      });
      const purchaseData = await purchaseResponse.json().catch(() => ({}));
      if (!purchaseResponse.ok) throw new Error(purchaseData.error || "Unable to create purchase.");

      toast.success("Purchase received successfully.");
      close({ force: true, resetAfter: true });
      router.refresh();
    } catch (error: any) {
      const errorMessage = error?.message || "Purchase flow failed.";
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
        <PackagePlus className="size-4" />
        Receive stock
      </Button>
      {open ? (
        <ModalPortal>
        <div className="crud-modal-layer" data-state={closing ? "closing" : "open"} role="presentation">
          <button type="button" className="crud-modal-backdrop" data-state={closing ? "closing" : "open"} aria-label="Close purchase flow" onClick={() => close()} />
          <div className="crud-modal motion-modal billing-flow-modal" data-state={closing ? "closing" : "open"} style={modalMotionStyle(modalOrigin)} role="dialog" aria-modal="true" aria-labelledby="purchase-flow-title">
            <form onSubmit={submit} noValidate>
              <div className="crud-modal-heading">
                <div className="min-w-0">
                  <p id="purchase-flow-title" className="text-lg font-semibold tracking-normal">Guided stock receiving</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Create the supplier and purchase intake without leaving this page.</p>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => close()} title="Close purchase flow">
                  <X className="size-4" />
                </Button>
              </div>
              {message ? <div role="alert" className="status-message mx-5 mt-4 border-destructive/20 bg-destructive/10 text-destructive">{message}</div> : null}
              <div className="crud-modal-body">
                <div className="billing-flow-steps">
                  <section className="billing-flow-section">
                    <div className="billing-flow-section-title">
                      <Truck className="size-4" />
                      <span>Supplier</span>
                    </div>
                    <div className="billing-toggle">
                      <button type="button" data-active={!createSupplier || undefined} onClick={() => setCreateSupplier(false)}>Select existing</button>
                      <button type="button" data-active={createSupplier || undefined} onClick={() => setCreateSupplier(true)}>Create new</button>
                    </div>
                    {createSupplier ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <label className="crud-field sm:col-span-3">
                          <span className="crud-field-label">Supplier name <i aria-hidden="true">*</i></span>
                          <Input value={form.supplierName} onChange={(event) => update("supplierName", event.target.value)} placeholder="Supplier name" />
                        </label>
                        <label className="crud-field">
                          <span className="crud-field-label">Phone</span>
                          <Input value={form.supplierPhone} onChange={(event) => update("supplierPhone", event.target.value)} inputMode="tel" placeholder="03xx..." />
                        </label>
                        <label className="crud-field sm:col-span-2">
                          <span className="crud-field-label">Address</span>
                          <Input value={form.supplierAddress} onChange={(event) => update("supplierAddress", event.target.value)} placeholder="Market / address" />
                        </label>
                      </div>
                    ) : (
                      <label className="crud-field">
                        <span className="crud-field-label">Supplier</span>
                        <select className="form-select" value={form.supplierId} onChange={(event) => update("supplierId", event.target.value)}>
                          <option value="">Select supplier</option>
                          {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.phone ? ` - ${supplier.phone}` : ""}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </section>

                  <section className="billing-flow-section">
                    <div className="billing-flow-section-title">
                      <PackagePlus className="size-4" />
                      <span>Stock intake</span>
                    </div>
                    {selectedProduct?.packSize ? (
                      <div className="billing-toggle mb-3">
                        <button type="button" data-active={receiveMode === "base" || undefined} onClick={() => setReceiveMode("base")}>Base units ({selectedProduct.unit || "pcs"})</button>
                        <button type="button" data-active={receiveMode === "pack" || undefined} onClick={() => setReceiveMode("pack")}>Packs ({selectedProduct.packUnit || "Box"} of {selectedProduct.packSize})</button>
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-[1.4fr_0.6fr_0.7fr]">
                      <label className="crud-field">
                        <span className="crud-field-label">Product <i aria-hidden="true">*</i></span>
                        <select className="form-select" value={form.productId} onChange={(event) => update("productId", event.target.value)}>
                          <option value="">Choose product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>{product.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="crud-field">
                        <span className="crud-field-label">{receiveMode === "pack" ? "Packs qty" : "Quantity"}</span>
                        <Input type="number" min={1} value={form.quantity} onChange={(event) => update("quantity", event.target.value)} />
                      </label>
                      <label className="crud-field">
                        <span className="crud-field-label">{receiveMode === "pack" ? "Cost per pack" : "Unit cost"}</span>
                        <Input type="number" min={0} value={form.unitCost} onChange={(event) => update("unitCost", event.target.value)} />
                      </label>
                    </div>
                  </section>

                  <section className="billing-flow-section">
                    <div className="billing-flow-section-title">
                      <WalletCards className="size-4" />
                      <span>Payment</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[0.7fr_0.9fr_1.4fr]">
                      <label className="crud-field">
                        <span className="crud-field-label">Paid amount</span>
                        <Input type="number" min={0} value={form.paidAmount} onChange={(event) => update("paidAmount", event.target.value)} />
                      </label>
                      <div className="billing-total-card">
                        <span>Total</span>
                        <strong>{money(total)}</strong>
                        <small>{due > 0 ? `${money(due)} payable` : "Fully paid"}</small>
                      </div>
                      <label className="crud-field">
                        <span className="crud-field-label">Notes</span>
                        <Textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Optional receiving note" />
                      </label>
                    </div>
                  </section>
                </div>
              </div>
              <div className="crud-modal-footer">
                <Button disabled={loading}>{loading ? "Receiving stock..." : "Receive stock"}</Button>
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
