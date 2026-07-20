import type { ConfigWaypoint } from "@/lib/authoring/config";
import { useAppStore } from "@/lib/stores/appStore";
import type { StoryShape } from "@/lib/stores/documentSchema";
import {
  documentShapes,
  documentWaypoints,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import {
  configWaypointsHaveLegacyArrowsOrOverlays,
  type LegacyExhibitWaypoint,
  migrateLegacyWaypointShapes,
  waypointsToConfigWaypoints,
  waypointToConfigWaypoint,
} from "@/lib/stores/storeUtils";
import { normalizeWaypointToBounds } from "@/lib/waypoints/waypoint";

export type WaypointSeedMirror = {
  Stories: LegacyExhibitWaypoint[];
  Shapes: StoryShape[];
};

export type WaypointSeedAction =
  | {
      type: "seedStore";
      stories: ConfigWaypoint[];
      shapes: StoryShape[];
    }
  | { type: "setShapes"; shapes: StoryShape[] }
  | { type: "syncMirror"; mirror: WaypointSeedMirror }
  | { type: "migratePan"; stories: ConfigWaypoint[] }
  | { type: "noop" };

const hasAuthoritativeBounds = (s: ConfigWaypoint) =>
  s.Bounds != null &&
  typeof s.Bounds.x0 === "number" &&
  typeof s.Bounds.x1 === "number" &&
  typeof s.Bounds.y0 === "number" &&
  typeof s.Bounds.y1 === "number";

const needsPanMigration = (s: ConfigWaypoint) =>
  (s.Pan != null || s.Zoom != null) && !hasAuthoritativeBounds(s);

/**
 * One tick of the Stories/Shapes seed + legacy migration bridge.
 * Callers apply the returned action to React mirror state / stores.
 */
export function planWaypointConfigSeedTick(args: {
  mirror: WaypointSeedMirror;
  viewportWidth: number;
  viewportHeight: number;
  imageWidth: number;
  imageHeight: number;
}): WaypointSeedAction {
  const {
    mirror,
    viewportWidth: cw,
    viewportHeight: ch,
    imageWidth,
    imageHeight,
  } = args;
  const configStories = mirror.Stories;
  const storeWaypoints = documentWaypoints(useDocumentStore.getState());

  if (!configStories?.length) return { type: "noop" };
  if (!cw || !ch) return { type: "noop" };

  // First paint: fill empty store from config once image dimensions exist so
  // `Arrows` / `Overlays` can be converted to `ShapeIds` + registry (`Shapes`)
  // before anything enters Zustand.
  if (storeWaypoints.length === 0) {
    if (imageWidth <= 0 || imageHeight <= 0) return { type: "noop" };
    const registry = mirror.Shapes ?? [];
    const {
      stories: migrated,
      shapes: mergedShapes,
      didMigrate,
    } = migrateLegacyWaypointShapes(
      configStories.map((s) => ({ ...s })),
      registry,
      imageWidth,
      imageHeight,
    );
    if (import.meta.env.DEV && didMigrate) {
      console.debug("[seed] legacy waypoint markers → shapes registry", {
        waypoints: migrated.length,
        shapesInRegistry: mergedShapes.length,
        shapeIdsPerWp: migrated.map((w) => w.shapeIds?.length ?? 0),
      });
    }
    return {
      type: "seedStore",
      stories: migrated.map((story) =>
        normalizeWaypointToBounds(story, imageWidth, imageHeight, cw, ch),
      ),
      shapes: mergedShapes,
    };
  }

  // Exhibit `Shapes` can arrive after `Stories`. Hydrate before the alignment
  // early-return so imports resolve even if ids are temporarily out of sync.
  if (
    (mirror.Shapes?.length ?? 0) > 0 &&
    documentShapes(useDocumentStore.getState()).length === 0
  ) {
    return { type: "setShapes", shapes: mirror.Shapes ?? [] };
  }

  const configAlignedWithStore =
    configStories.length === storeWaypoints.length &&
    configStories.every((c, i) => c.id === storeWaypoints[i]?.id);
  if (!configAlignedWithStore && storeWaypoints.length > 0) {
    return { type: "noop" };
  }

  // Push canonical Stories + Shapes from Zustand whenever the mirror still
  // shows legacy markers while aligned with the store (Strict Mode / stale
  // React state).
  if (
    configAlignedWithStore &&
    configWaypointsHaveLegacyArrowsOrOverlays(configStories)
  ) {
    const doc = useDocumentStore.getState();
    return {
      type: "syncMirror",
      mirror: {
        Stories: waypointsToConfigWaypoints(
          documentWaypoints(doc),
          useAppStore.getState().waypointAuthoring,
        ),
        Shapes: documentShapes(doc),
      },
    };
  }

  if (imageWidth > 0 && imageHeight > 0) {
    const authoringMap = useAppStore.getState().waypointAuthoring;
    const mask = storeWaypoints.map((sw) =>
      needsPanMigration(waypointToConfigWaypoint(sw, authoringMap.get(sw.id))),
    );
    if (mask.some(Boolean)) {
      return {
        type: "migratePan",
        stories: storeWaypoints.map((sw, i) => {
          const c = waypointToConfigWaypoint(sw, authoringMap.get(sw.id));
          return mask[i]
            ? normalizeWaypointToBounds(c, imageWidth, imageHeight, cw, ch)
            : c;
        }),
      };
    }
  }

  return { type: "noop" };
}

/** Apply {@link planWaypointConfigSeedTick} results to stores / mirror. */
export function applyWaypointSeedAction(
  action: WaypointSeedAction,
  handlers: {
    setStories: (stories: ConfigWaypoint[]) => void;
    setMirror: (mirror: WaypointSeedMirror) => void;
  },
): void {
  switch (action.type) {
    case "noop":
      return;
    case "seedStore":
      handlers.setStories(action.stories);
      useDocumentStore.getState().setShapes(action.shapes);
      return;
    case "setShapes":
      useDocumentStore.getState().setShapes(action.shapes);
      return;
    case "syncMirror":
      handlers.setMirror(action.mirror);
      return;
    case "migratePan":
      handlers.setStories(action.stories);
      return;
  }
}
