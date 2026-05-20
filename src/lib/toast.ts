export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastInput = {
  title?: string;
  description: string;
  variant?: ToastVariant;
};

export const TOAST_EVENT = "shopiq:toast";

function emitToast(input: ToastInput) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastInput>(TOAST_EVENT, {
      detail: {
        variant: input.variant || "info",
        title: input.title,
        description: input.description
      }
    })
  );
}

export const toast = {
  success(description: string, title = "Success") {
    emitToast({ title, description, variant: "success" });
  },
  error(description: string, title = "Something went wrong") {
    emitToast({ title, description, variant: "error" });
  },
  warning(description: string, title = "Check this") {
    emitToast({ title, description, variant: "warning" });
  },
  info(description: string, title = "ShopIQ") {
    emitToast({ title, description, variant: "info" });
  }
};
