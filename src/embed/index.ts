/**
 * Library entry: `minerva-core-ui/story` → `lib/minerva.js` (+ `minerva-core-ui/story.css`).
 *
 * React: `<MinervaStory ref={handleRef} document=… />`.
 * Programmatic: the {@link MinervaHandle} from `ref` / `onReady`.
 * Agents / MCP: `handle.listCommands()` + `handle.execute(name, input)`.
 */

export type {
  MinervaCommandDescriptor,
  MinervaCommandInput,
  MinervaCommandName,
  MinervaCommandResult,
  MinervaErrorCode,
} from "@/api/commands";
export { MinervaCommandError } from "@/api/commands";
export type { MinervaHandle, MinervaStateListener } from "@/api/controller";
export type {
  MinervaBounds,
  MinervaChannelGroupState,
  MinervaChannelState,
  MinervaState,
  MinervaStatus,
  MinervaUngroupedChannelState,
  MinervaView,
  MinervaWaypointState,
} from "@/api/state";
export type { DocumentData as MinervaDocument } from "@/lib/stores/documentSchema";
export { MinervaStory, type MinervaStoryProps } from "./MinervaStory";
