"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { TOAST_EVENT, type ToastInput, type ToastVariant } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ToastRecord = Required<ToastInput> & {
  id: string;
  state: "open" | "closing";
};

const icons: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: TriangleAlert,
  info: Info
};

function titleFor(variant: ToastVariant) {
  if (variant === "success") return "Success";
  if (variant === "error") return "Something went wrong";
  if (variant === "warning") return "Check this";
  return "ShopIQ";
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  useEffect(() => {
    function closeToast(id: string) {
      setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, state: "closing" } : toast)));
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 260);
    }

    function onToast(event: Event) {
      const detail = (event as CustomEvent<ToastInput>).detail;
      if (!detail?.description) return;
      const variant = detail.variant || "info";
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const nextToast: ToastRecord = {
        id,
        state: "open",
        variant,
        title: detail.title || titleFor(variant),
        description: detail.description
      };
      setToasts((current) => [nextToast, ...current].slice(0, 4));
      window.setTimeout(() => closeToast(id), 3000);
    }

    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="shopiq-toast-region" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => {
        const Icon = icons[toast.variant];

        return (
          <div key={toast.id} className={cn("shopiq-toast", `is-${toast.variant}`)} data-state={toast.state} role={toast.variant === "error" ? "alert" : "status"}>
            <span className="shopiq-toast-icon" aria-hidden="true">
              <Icon className="size-4" />
            </span>
            <span className="shopiq-toast-copy">
              <strong>{toast.title}</strong>
              <span>{toast.description}</span>
            </span>
            <button
              type="button"
              className="shopiq-toast-close"
              aria-label="Dismiss notification"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
