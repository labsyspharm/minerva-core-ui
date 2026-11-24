import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ChevronIcon } from "@/components/shared/common/ChevronIcon";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import styles from "./ClampedChips.module.css";
import { cx } from "./units";

/** Room kept at the last row's end for its "+N". */
const MORE_W = 30;

/**
 * Chips (each a `div` child; separators marked `data-sep`, extras such as
 * a "No match" note `data-aux`) clamped to `rows` rows, the last ending in a
 * "+N" that calls `onOpen`; all of them wrap when `open`. `sig` changes when
 * the set of chips does; a chip that only changes size is re-measured on its
 * own. Focus follows: "+N" moves it to the first chip it revealed, "show
 * fewer" back to the "+N".
 */
export function ClampedChips(props: {
  rows: number;
  open: boolean;
  onOpen: () => void;
  /** When given, an opened line too long to clamp ends in a "show fewer" chevron calling it. */
  onClose?: () => void;
  sig: string;
  className?: string;
  children: ReactNode;
}) {
  const { rows } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{
    hidden: number;
    left: number;
    top: number;
  } | null>(null);
  // Whether the line is (or, open, would be) cut off; the "−" needs it.
  const [wasCut, setWasCut] = useState(false);
  // Where focus goes once an open or close has rendered.
  const focusNext = useRef<number | "more" | null>(null);
  const firstHidden = useRef(0);
  const { open, sig } = props;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `sig` re-measures when chips come or go, open or not.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // `data-aux` children (an add button, the "−") are never cut off.
      const list = [
        ...el.querySelectorAll<HTMLElement>(":scope > div:not([data-aux])"),
      ];
      const end = (c: HTMLElement) => c.offsetLeft + c.offsetWidth;
      const isSep = (c?: HTMLElement) => c?.dataset.sep !== undefined;
      const clamped = !open;
      let n = list.length;
      const tops = [...new Set(list.map((c) => c.offsetTop))].sort(
        (a, b) => a - b,
      );
      if (tops.length > rows) {
        const lastTop = tops[rows - 1];
        n = list.findIndex((c) => c.offsetTop > lastTop);
        const room = el.clientWidth - MORE_W;
        while (
          clamped &&
          n > 0 &&
          (isSep(list[n - 1]) ||
            (list[n - 1].offsetTop === lastTop && end(list[n - 1]) > room))
        ) {
          n--;
        }
      }
      // Chips past the fit stay laid out (unseen), so they can be measured.
      for (const [i, c] of list.entries()) {
        c.style.visibility = clamped && i >= n ? "hidden" : "";
      }
      // Open, this counts what clamping would cut off.
      const hidden = list.slice(n).filter((c) => !isSep(c)).length;
      firstHidden.current = n;
      setWasCut(hidden > 0);
      const last = list[n - 1];
      const left = last ? end(last) + 4 : 0;
      const top = last ? last.offsetTop : 0;
      setFit((f) =>
        !clamped || !hidden
          ? null
          : f?.hidden === hidden && f.left === left && f.top === top
            ? f
            : { hidden, left, top },
      );
    };
    measure();
    // Measure again when the box or any chip changes size (the web font
    // arriving, a chip gaining or losing its edit chevron, a line wrapping).
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const c of el.querySelectorAll(":scope > div")) ro.observe(c);
    return () => ro.disconnect();
  }, [open, sig, rows]);

  useEffect(() => {
    const el = ref.current;
    const target = focusNext.current;
    if (!el || target === null) return;
    // The "+N" shows a render after closing; wait for it.
    const to =
      target === "more"
        ? el.querySelector<HTMLElement>(`.${styles.more}`)
        : el
            .querySelectorAll<HTMLElement>(":scope > div:not([data-aux])")
            [target]?.querySelector<HTMLElement>("button");
    if (!to) return;
    focusNext.current = null;
    to.focus();
  });

  return (
    <div
      ref={ref}
      className={cx(styles.clamp, open && styles.open, props.className)}
      style={{ "--rows": rows } as CSSProperties}
    >
      {props.children}
      {open && props.onClose && wasCut ? (
        <div data-aux="">
          <button
            type="button"
            className={cx(minervaTheme.focusRing, styles.less)}
            title="Show fewer"
            aria-label="Show fewer"
            onClick={() => {
              focusNext.current = "more";
              props.onClose?.();
            }}
          >
            <ChevronIcon direction="up" />
          </button>
        </div>
      ) : null}
      {fit ? (
        <button
          type="button"
          className={cx(minervaTheme.focusRing, styles.more)}
          style={{ left: fit.left, top: fit.top }}
          title="Show all"
          onClick={() => {
            focusNext.current = firstHidden.current;
            props.onOpen();
          }}
        >
          {`+${fit.hidden}`}
        </button>
      ) : null}
    </div>
  );
}
