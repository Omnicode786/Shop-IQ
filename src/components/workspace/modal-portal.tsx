"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type ModalMotionOrigin = {
  x: number;
  y: number;
  scale: number;
  width: number;
  height: number;
  radius: number;
};

export function captureModalOrigin(element: Element | null | undefined): ModalMotionOrigin | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const styles = window.getComputedStyle(element);
  const parsedRadius = Number.parseFloat(styles.borderTopLeftRadius || "0");
  const largestSide = Math.max(rect.width, rect.height);
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    scale: Math.max(0.055, Math.min(0.24, largestSide / 760)),
    width: rect.width,
    height: rect.height,
    radius: Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : rect.height / 2
  };
}

export function modalMotionStyle(origin: ModalMotionOrigin | null): CSSProperties {
  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const px = (value: number) => `${Math.round(value * 100) / 100}px`;
  const unit = (value: number) => String(Math.round(value * 10000) / 10000);
  if (!origin) {
    return {
      ["--modal-dx" as string]: "0px",
      ["--modal-dy" as string]: "18px",
      ["--modal-origin-scale" as string]: "0.96",
      ["--modal-origin-scale-x" as string]: "0.96",
      ["--modal-origin-scale-y" as string]: "0.96",
      ["--modal-origin-radius" as string]: "1.35rem"
    };
  }
  const targetWidth = Math.min(896, Math.max(320, viewportWidth - 24));
  const targetHeight = Math.min(704, Math.max(260, viewportHeight * 0.82));
  return {
    ["--modal-dx" as string]: px(origin.x - viewportWidth / 2),
    ["--modal-dy" as string]: px(origin.y - viewportHeight / 2),
    ["--modal-origin-scale" as string]: unit(origin.scale),
    ["--modal-origin-scale-x" as string]: unit(Math.max(0.045, Math.min(0.42, origin.width / targetWidth))),
    ["--modal-origin-scale-y" as string]: unit(Math.max(0.045, Math.min(0.32, origin.height / targetHeight))),
    ["--modal-origin-radius" as string]: px(Math.max(6, origin.radius))
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
