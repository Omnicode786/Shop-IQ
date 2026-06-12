"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, WalletCards, X } from "lucide-react";
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

type PurchaseOption = {
  id: string;
  purchaseNo: string;
  supplierId: string | null;
  supplierName: string;
  dueAmount: number;
  total: number;
};

const MODAL_EXIT_MS = 380;

export function SupplierPaymentFlow({ suppliers, purchases, canCreate }: { suppliers: SupplierOption[]; purchases: PurchaseOption[]; canCreate: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [modalOrigin, setModalOrigin] = useState<ModalMotionOrigin | null>(null);
  const closeTimer = useRef<number | null>(null);
  const originElementRef = useRef<Element | null>(null);
  const closeFromKeyboardRef = useRef<() => void>(() => {});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    supplierId: "",
    purchaseId: "",
    method: "CASH",
    paidAmount: "",
    notes: ""
  });
  const filteredPurchases = purchases.filter((purchase) => !form.supplierId || purchase.supplierId === form.supplierId);
  const selectedPurchase = purchases.find((purchase) => purchase.id === form.purchaseId);

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
      supplierId: "",
      purchaseId: "",
      method: "CASH",
      paidAmount: "",
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
    setForm((current) => {
      if (key === "purchaseId") {
        const purchase = purchases.find((item) => item.id === value);
        return { ...current, purchaseId: value, supplierId: purchase?.supplierId || current.supplierId };
      }
      if (key === "supplierId") return { ...current, supplierId: value, purchaseId: current.purchaseId && purchases.find((item) => item.id === current.purchaseId)?.supplierId === value ? current.purchaseId : "" };
      return { ...current, [key]: value };
    });
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
    if (!form.purchaseId || !selectedPurchase) {
      stopWithMessage("Choose the purchase this supplier payment is settling.");
      return;
    }
    const amount = Number(form.paidAmount);
    if (isNaN(amount) || amount <= 0) {
      stopWithMessage("Enter a valid payment amount greater than zero.");
      return;
    }
    if (amount > selectedPurchase.dueAmount) {
      stopWithMessage(`Payment cannot exceed the remaining payable of PKR ${selectedPurchase.dueAmount.toLocaleString()}.`);
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: "SUPPLIER_OUT",
          supplierId: selectedPurchase.supplierId,
          purchaseId: form.purchaseId,
          method: form.method,
          amount,
          notes: form.notes
        }),
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to record payment.");

      toast.success("Supplier payment recorded successfully.");
      close({ force: true, resetAfter: true });
      router.refresh();
    } catch (error: any) {
      const errorMessage = error?.message || "Payment recording failed.";
      setMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  if (!canCreate) return null;

  return (
    <>
      <Button type="button" variant="outline" onClick={openFlow} className="w-full sm:w-auto">
        <CreditCard className="size-4" />
        Record payout
      </Button>
      {open ? (
        <ModalPortal>
        <div className="crud-modal-layer" data-state={closing ? "closing" : "open"} role="presentation">
          <button type="button" className="crud-modal-backdrop" data-state={closing ? "closing" : "open"} aria-label="Close payment flow" onClick={() => close()} />
          <div className="crud-modal motion-modal billing-flow-modal" data-state={closing ? "closing" : "open"} style={modalMotionStyle(modalOrigin)} role="dialog" aria-modal="true" aria-labelledby="supplier-payment-title">
            <form onSubmit={submit} noValidate>
              <div className="crud-modal-heading">
                <div className="min-w-0">
                  <p id="supplier-payment-title" className="text-lg font-semibold tracking-normal">Record supplier payment</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Record a supplier payout against a specific unpaid purchase.</p>
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => close()} title="Close payment flow">
                  <X className="size-4" />
                </Button>
              </div>
              {message ? <div role="alert" className="status-message mx-5 mt-4 border-destructive/20 bg-destructive/10 text-destructive">{message}</div> : null}
              <div className="crud-modal-body">
                <div className="billing-flow-steps">
                  <section className="billing-flow-section">
                    <div className="billing-flow-section-title">
                      <WalletCards className="size-4" />
                      <span>Payment details</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="crud-field sm:col-span-2">
                        <span className="crud-field-label">Supplier</span>
                        <select className="form-select" value={form.supplierId} onChange={(event) => update("supplierId", event.target.value)}>
                          <option value="">All suppliers with dues</option>
                          {suppliers.map((supplier) => (
                            <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.phone ? ` - ${supplier.phone}` : ""}</option>
                          ))}
                        </select>
                      </label>
                      <label className="crud-field sm:col-span-2">
                        <span className="crud-field-label">Purchase <i aria-hidden="true">*</i></span>
                        <select className="form-select" value={form.purchaseId} onChange={(event) => update("purchaseId", event.target.value)}>
                          <option value="">Select unpaid purchase</option>
                          {filteredPurchases.map((purchase) => (
                            <option key={purchase.id} value={purchase.id}>
                              {purchase.purchaseNo} - {purchase.supplierName} - due PKR {purchase.dueAmount.toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="crud-field">
                        <span className="crud-field-label">Method</span>
                        <select className="form-select" value={form.method} onChange={(event) => update("method", event.target.value)}>
                          <option value="CASH">Cash</option>
                          <option value="BANK_TRANSFER">Bank transfer</option>
                          <option value="CHEQUE">Cheque</option>
                          <option value="JAZZCASH">JazzCash</option>
                          <option value="EASYPAISA">EasyPaisa</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </label>
                      <label className="crud-field sm:col-span-2">
                        <span className="crud-field-label">Paid amount</span>
                        <Input type="number" min={0} max={selectedPurchase?.dueAmount || undefined} value={form.paidAmount} onChange={(event) => update("paidAmount", event.target.value)} />
                      </label>
                      <label className="crud-field sm:col-span-2">
                        <span className="crud-field-label">Notes</span>
                        <Textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} placeholder="Optional payment reference or note" />
                      </label>
                    </div>
                  </section>
                </div>
              </div>
              <div className="crud-modal-footer">
                <Button disabled={loading}>{loading ? "Recording..." : "Record payment"}</Button>
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
