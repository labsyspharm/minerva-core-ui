/**
 * Images tab helpers: chip units (an H&E image is one "H&E" chip),
 * drag-and-drop between images and groups, and chip tone.
 */
import {
  type DragEvent,
  type DragEventHandler,
  useEffect,
  useState,
} from "react";
import type { ChannelChipTone } from "@/components/shared/channel/ChannelChip";
import type {
  Channel,
  ChannelGroup,
  ChannelGroupChannel,
} from "@/lib/stores/documentStore";
import {
  type ChannelState,
  channelActions,
  channelsOfImage,
  findChannel,
  isImageChannel,
  isRgbImage,
} from "./kit";

/** One chip: a channel, or an H&E image's planes as one unit (`id` = a plane). */
export type Unit = {
  key: string;
  id: string;
  name: string;
  rgb: boolean;
  imageId: string;
};
export type Member = Unit & { row: ChannelGroupChannel };

function toUnit(state: ChannelState, sc: Channel): Unit {
  return isImageChannel(sc) && isRgbImage(state, sc.imageId)
    ? {
        key: `rgb:${sc.imageId}`,
        id: sc.id,
        name: "H&E",
        rgb: true,
        imageId: sc.imageId,
      }
    : { key: sc.id, id: sc.id, name: sc.name, rgb: false, imageId: sc.imageId };
}

const dedupe = <T extends Unit>(list: T[]): T[] =>
  list.filter((u, i) => list.findIndex((v) => v.key === u.key) === i);

/** An image's chips in document order. */
export function imageUnits(state: ChannelState, imageId: string): Unit[] {
  return dedupe(channelsOfImage(state, imageId).map((sc) => toUnit(state, sc)));
}

/** A group's chips in row order. */
export function groupMembers(
  state: ChannelState,
  group: ChannelGroup,
): Member[] {
  return dedupe(
    group.channels.flatMap((row) => {
      const sc = findChannel(state, row.channelId);
      return sc ? [{ ...toUnit(state, sc), row }] : [];
    }),
  );
}

/** Groups whose rows include this unit, in group order. */
export function groupsUsing(state: ChannelState, unit: Unit): ChannelGroup[] {
  return state.groups.filter((g) =>
    g.channels.some((gc) => gc.channelId === unit.id),
  );
}

/** Filled when drawn, outlined when not; no color yet reads as such. */
export const toneOf = (hex: string, drawn: boolean): ChannelChipTone =>
  !hex ? "unassigned" : drawn ? "on" : "outlined";

export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Drag and drop. Any chip or list row can be dragged onto any group, at any
// time. A chip dragged out of a group and dropped outside every group leaves it.

const DRAG_MIME = "application/x-minerva-channel";
const FROM_MIME = "application/x-minerva-from-group";

/** Spread on a chip/row wrapper to make it draggable. */
export function dragSource(sourceId: string, fromGroupId?: string) {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(DRAG_MIME, sourceId);
      if (fromGroupId) {
        e.dataTransfer.setData(FROM_MIME, `${fromGroupId} ${sourceId}`);
      }
      e.dataTransfer.effectAllowed = fromGroupId ? "copyMove" : "copy";
    },
  };
}

/**
 * Spread on a group's element to accept dropped channels. `over` is true
 * while a channel hovers it, for a highlight.
 */
export function useGroupDrop(groupId: string): {
  over: boolean;
  dropProps: {
    onDragOver: DragEventHandler;
    onDragLeave: DragEventHandler;
    onDrop: DragEventHandler;
  };
} {
  const [over, setOver] = useState(false);
  const accepts = (e: DragEvent) => e.dataTransfer.types.includes(DRAG_MIME);
  return {
    over,
    dropProps: {
      onDragOver: (e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setOver(true);
      },
      onDragLeave: (e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setOver(false);
      },
      onDrop: (e) => {
        if (!accepts(e)) return;
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData(DRAG_MIME);
        const from = e.dataTransfer.getData(FROM_MIME);
        if (from && from.split(" ")[0] === groupId) return;
        channelActions.addToGroup(groupId, id);
      },
    },
  };
}

/** Mount once (the Images tab): a group's chip dropped outside every group leaves it. */
export function useRemoveOnDropOutside() {
  useEffect(() => {
    const over = (e: globalThis.DragEvent) => {
      if (e.defaultPrevented || !e.dataTransfer?.types.includes(FROM_MIME))
        return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    };
    const drop = (e: globalThis.DragEvent) => {
      const raw = e.dataTransfer?.getData(FROM_MIME);
      if (e.defaultPrevented || !raw) return;
      e.preventDefault();
      const [groupId, sourceId] = raw.split(" ");
      channelActions.removeFromGroup(groupId, sourceId);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, []);
}
