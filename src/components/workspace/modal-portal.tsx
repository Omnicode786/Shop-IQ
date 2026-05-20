"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ModalMotionOrigin = {
  x: number;
  y: number;
  scale: number;
};

export function captureModalOrigin(element: Element | null | undefined): ModalMotionOrigin | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const largestSide = Math.max(rect.width, rect.height);
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    scale: Math.max(0.055, Math.min(0.24, largestSide / 760))
  };
}

export function modalMotionStyle(origin: ModalMotionOrigin | null): CSSProperties {
  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  if (!origin) {
    return {
      ["--modal-dx" as string]: "0px",
      ["--modal-dy" as string]: "18px",
      ["--modal-origin-scale" as string]: "0.96"
    };
  }
  return {
    ["--modal-dx" as string]: `${origin.x - viewportWidth / 2}px`,
    ["--modal-dy" as string]: `${origin.y - viewportHeight / 2}px`,
    ["--modal-origin-scale" as string]: String(origin.scale)
  };
}

export function ModalPortal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
}
