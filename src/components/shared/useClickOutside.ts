import { type RefObject, useEffect, useRef } from "react";

/** While `armed`, a mousedown outside every node calls `onDismiss`. A missing node does not. */
export function useClickOutside(
  armed: boolean,
  onDismiss: () => void,
  refs: readonly RefObject<HTMLElement | null>[],
): void {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    if (!armed) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      for (const ref of refsRef.current) {
        const node = ref.current;
        if (!node || node.contains(target)) return;
      }
      onDismissRef.current();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [armed]);
}
