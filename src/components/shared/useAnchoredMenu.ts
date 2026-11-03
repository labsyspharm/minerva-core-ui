import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useClickOutside } from "@/components/shared/useClickOutside";
import { anchoredMenuPosition } from "@/lib/viewer/anchoredMenuPosition";

/**
 * A `position: fixed` menu opened from a button. It is measured before paint
 * and opens below the button, or above when it does not fit. Above, it is
 * pinned by its bottom, and `align: "end"` pins its right edge, so a menu that
 * grows while open stays against the button.
 */
export function useAnchoredMenu(align: "start" | "end") {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const close = () => setOpen(false);
  const toggleFromButton = (btn: HTMLButtonElement) => {
    if (open) {
      close();
      return;
    }
    anchorRef.current = btn;
    setOpen(true);
  };
  useLayoutEffect(() => {
    if (!open || !anchorRef.current || !menuRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const menu = menuRef.current.getBoundingClientRect();
    const { top, left } = anchoredMenuPosition(anchor, menu, { align });
    setMenuStyle({
      ...(top + menu.height <= anchor.top
        ? { bottom: window.innerHeight - (top + menu.height) }
        : { top }),
      ...(align === "end"
        ? { right: window.innerWidth - (left + menu.width) }
        : { left }),
    });
  }, [open, align]);
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
