import type { ConfigWaypoint } from "../authoring/config";
import type { Waypoint } from "./documentSchema";

export type AuthoringWaypointExtra = Pick<
  ConfigWaypoint,
  "State" | "ViewState" | "Pan" | "Zoom"
>;

export type StoreWaypoint = Waypoint & {
  authoring?: AuthoringWaypointExtra;
};
