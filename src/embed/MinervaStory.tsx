import "@deck.gl/widgets/stylesheet.css";
import "@/components/shared/minervaTheme.global.css";
import type { CSSProperties } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { MinervaCommandInput, MinervaCommandName } from "@/api/commands";
import {
  createMinervaController,
  type MinervaController,
  type MinervaHandle,
} from "@/api/controller";
import type { MinervaState } from "@/api/state";
import {
  StoryPlayerApp,
  type StoryPlayerStatus,
} from "@/components/playback/StoryPlayerApp";
import type { StoryDocumentInput } from "@/lib/story/loadStoryDocument";
import styles from "./MinervaStory.module.css";

export type MinervaStoryProps = {
  /**
   * URL of a `document.json`, or its parsed contents. A new value loads a new
   * story, so keep object references stable (`useMemo` / module scope).
   */
  document: string | object;
  /** Resolves relative image paths when `document` is an object (default: page URL). */
  baseUrl?: string;

  /**
   * Declarative state, applied once the story is ready and again whenever a
   * value changes. Readers can still navigate in between; follow along with
   * `onStateChange`, or drive it imperatively through the ref.
   */
  waypoint?: number | string;
  /** Channel group id or name. */
  channelGroup?: string;
  /** Camera in image pixels; see the `setView` command. */
  view?: MinervaCommandInput<"setView">;

  /** Show the document title ribbon (default true). */
  showDocumentTitle?: boolean;
  /** Every state change: status, waypoint, channel group, visibility, camera. */
  onStateChange?: (state: MinervaState) => void;
  /** Each time a document is shown (its images may still be opening). */
  onReady?: (handle: MinervaHandle) => void;
  onError?: (error: string) => void;

  /** The embed fills its parent by default; these override that. */
  className?: string;
  style?: CSSProperties;
};

const DM_SANS_HREF =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap";

/** Add the DM Sans stylesheet once (the author app loads it from index.html). */
function ensureDmSans() {
  if (document.querySelector(`link[href="${DM_SANS_HREF}"]`)) return;
  const google = document.createElement("link");
  google.rel = "preconnect";
  google.href = "https://fonts.googleapis.com";
  const gstatic = document.createElement("link");
  gstatic.rel = "preconnect";
  gstatic.href = "https://fonts.gstatic.com";
  gstatic.crossOrigin = "anonymous";
  const sheet = document.createElement("link");
  sheet.rel = "stylesheet";
  sheet.href = DM_SANS_HREF;
  document.head.append(google, gstatic, sheet);
}

/** Viewer state lives in module-level stores, so one view per page. */
let mountedViews = 0;

const toInput = (
  document: MinervaStoryProps["document"],
  baseUrl?: string,
): StoryDocumentInput =>
  typeof document === "string" ? document : { document, baseUrl };

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Embeddable Minerva story viewer (the same tree as the CDN player).
 *
 * ```tsx
 * const ref = useRef<MinervaHandle>(null);
 * <MinervaStory ref={ref} document="story/document.json" waypoint={2} />
 * await ref.current.setChannelGroup("Immune");
 * ```
 */
export const MinervaStory = forwardRef<MinervaHandle, MinervaStoryProps>(
  function MinervaStory(props, ref) {
    const [controller] = useState(createMinervaController);
    useImperativeHandle(ref, () => controller.handle, [controller]);
    return <MinervaStoryView {...props} controller={controller} />;
  },
);

/** {@link MinervaStory} driven by a controller created outside React (CDN `play()`). */
export function MinervaStoryView(
  props: MinervaStoryProps & { controller: MinervaController },
) {
  const { document, baseUrl, waypoint, channelGroup, view, controller } = props;
  const { handle } = controller;

  // Latest callbacks for event handlers, without re-running effects.
  const callbacks = useRef(props);
  useLayoutEffect(() => {
    callbacks.current = props;
  });

  // The story to show: set from props, or by the `loadDocument` command.
  const [source, setSource] = useState(() => toInput(document, baseUrl));
  const [documentProps, setDocumentProps] = useState({ document, baseUrl });
  if (
    documentProps.document !== document ||
    documentProps.baseUrl !== baseUrl
  ) {
    setDocumentProps({ document, baseUrl });
    setSource(toInput(document, baseUrl));
  }

  useEffect(() => {
    controller.host.loadDocument = async (next) => {
      controller.setStatus("loading");
      setSource(next);
      await handle.whenReady();
    };
    return () => {
      controller.host.loadDocument = undefined;
    };
  }, [controller, handle]);

  useEffect(() => {
    ensureDmSans();
    mountedViews += 1;
    if (mountedViews > 1) {
      console.error(
        "[minerva] Only one Minerva view per page is supported; views share state.",
      );
    }
    return () => {
      mountedViews -= 1;
    };
  }, []);

  useEffect(
    () => handle.subscribe((s) => callbacks.current.onStateChange?.(s)),
    [handle],
  );

  const onStatusChange = (s: StoryPlayerStatus) => {
    if (s.status === "error") {
      controller.setStatus("error", s.error);
      callbacks.current.onError?.(s.error);
      return;
    }
    controller.setStatus(s.status);
    if (s.status === "ready") callbacks.current.onReady?.(handle);
  };

  // Declarative props → commands. Each prop is applied when the story becomes
  // ready (so a new document gets them too) and whenever it changes. Commands
  // run in order; after a waypoint change `Presentation` re-applies that
  // waypoint's group and camera on the next commit, so wait two frames before
  // layering `channelGroup` / `view` on top.
  const ready =
    useSyncExternalStore(handle.subscribe, handle.getState).status === "ready";
  const queue = useRef(Promise.resolve());
  const enqueue = useCallback(
    (name: MinervaCommandName, input: unknown) => {
      queue.current = queue.current.then(async () => {
        const result = await handle.execute(name, input);
        if (result.ok === false) {
          console.warn(`[minerva] ${name}: ${result.error}`);
        }
        if (name === "goToWaypoint") {
          await nextFrame();
          await nextFrame();
        }
      });
    },
    [handle],
  );
  useEffect(() => {
    if (ready && waypoint !== undefined) {
      enqueue("goToWaypoint", { waypoint });
    }
  }, [ready, waypoint, enqueue]);
  useEffect(() => {
    if (ready && channelGroup !== undefined) {
      enqueue("setChannelGroup", { group: channelGroup });
    }
  }, [ready, channelGroup, enqueue]);
  const viewKey = JSON.stringify(view ?? null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `view` is compared by value via viewKey
  useEffect(() => {
    if (ready && view !== undefined) enqueue("setView", view);
  }, [ready, viewKey, enqueue]);

  return (
    <div
      className={[styles.root, "minerva-seal", props.className]
        .filter(Boolean)
        .join(" ")}
      style={props.style}
    >
      <StoryPlayerApp
        source={source}
        showDocumentTitle={props.showDocumentTitle}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}
