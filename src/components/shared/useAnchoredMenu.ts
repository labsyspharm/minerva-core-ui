import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useClickOutside } from "@/components/shared/useClickOutside";

/**
 * A `position: fixed` menu opened from a button. It opens below the button, or
 * above when `estimateHeight` does not fit; above, it is pinned by its bottom
 * so a menu that grows while open (or is shorter than the estimate) stays
 * against the button.
 */
export function useAnchoredMenu(opts: {
  align: "start" | "end";
  estimateHeight: number;
}) {
  const { align, estimateHeight } = opts;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const close = () => setOpen(false);
  const toggleFromButton = (btn: HTMLButtonElement) => {
    if (open) {
      close();
      return;
    }
    const rect = btn.getBoundingClientRect();
    const openUp =
      rect.bottom + estimateHeight + 8 > window.innerHeight &&
      rect.top > estimateHeight;
    const vertical = openUp
      ? { bottom: window.innerHeight - rect.top + 4 }
      : { top: rect.bottom + 4 };
    setMenuStyle(
      align === "end"
        ? { ...vertical, right: Math.max(8, window.innerWidth - rect.right) }
        : {
            ...vertical,
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 188)),
          },
    );
    setOpen(true);
  };
  useClickOutside(open, close, [wrapRef, menuRef]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return { open, wrapRef, menuRef, menuStyle, toggleFromButton, close };
}
