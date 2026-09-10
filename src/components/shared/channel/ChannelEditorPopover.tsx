import * as React from "react";
import {
  ColorPickerPopover,
  colorPickerAnchorPosition,
} from "@/components/shared/ColorPickerPopover";
import { useAuthorChannelNav } from "@/components/shared/channel/AuthorChannelNav";
import {
  ChannelContrastEditor,
  colorRenderingForSource,
  contrastEditorPropsForGroupRow,
  contrastEditorPropsForSource,
} from "@/components/shared/channel/ChannelContrastEditor";
import { ChannelRow } from "@/components/shared/channel/ChannelRow";
import {
  isGroupRowVisible,
  isStackVisible,
} from "@/lib/imaging/channelCompositor";
import {
  isImageChannel,
  isMaskChannel,
  isRgbDisplayChannel,
  type MaskVisualization,
} from "@/lib/imaging/channelKind";
import { sourceDistributionYValuesLength } from "@/lib/imaging/histogramLazy";
import type { ImageChannelChip } from "@/lib/imaging/imageChannelOverview";
import {
  getStackPalettePendingIds,
  subscribeStackPalettePending,
} from "@/lib/imaging/psudoPalette";
import {
  assignedDisplayHex,
  effectiveDisplayColor,
  effectiveMaskVisualization,
  effectiveSourceColor,
  effectiveSourceLimits,
  rgbToHex,
} from "@/lib/imaging/sourceChannelStyle";
import { type ChannelRendering, useAppStore } from "@/lib/stores/appStore";
import type { Channel, ChannelGroup } from "@/lib/stores/documentStore";
import {
  findSourceChannel,
  flattenImageChannelsInDocumentOrder,
  useDocumentStore,
} from "@/lib/stores/documentStore";
import { patchSourceChannelOnImages } from "@/lib/stores/storeUtils";
import row from "./ChannelRow.module.css";

export type ChannelColorTarget =
  | { scope: "source"; sourceId: string }
  | { scope: "group"; groupId: string; rowId: string };

export function commitChannelColorTarget(target: ChannelColorTarget | null) {
  if (!target) return;
  const live = useAppStore.getState().channelRendering;
  const doc = useDocumentStore.getState();
  if (target.scope === "source") {
    const colorLive = colorRenderingForSource(live, target.sourceId);
    if (colorLive) {
      doc.setImages(
        patchSourceChannelOnImages(doc.images, target.sourceId, {
          color: { r: colorLive.r, g: colorLive.g, b: colorLive.b },
        }),
      );
    }
  } else {
    const groupRow = doc.channelGroups
      .find((g) => g.id === target.groupId)
      ?.channels.find((gc) => gc.id === target.rowId);
    const colorLive = groupRow
      ? colorRenderingForSource(live, groupRow.channelId)
      : null;
    if (colorLive) {
      doc.setChannelGroups(
        doc.channelGroups.map((g) =>
          g.id !== target.groupId
            ? g
            : {
                ...g,
                channels: g.channels.map((gc) =>
                  gc.id === target.rowId
                    ? {
                        ...gc,
                        color: {
                          r: colorLive.r,
                          g: colorLive.g,
                          b: colorLive.b,
                        },
                      }
                    : gc,
                ),
              },
        ),
      );
    }
  }
  useAppStore.getState().clearChannelRendering();
}

function hexForColorTarget(
  target: ChannelColorTarget,
  channelRendering: ChannelRendering | null,
  sourceChannels: Channel[],
  channelGroups: readonly ChannelGroup[],
): string | null {
  if (target.scope === "source") {
    const live = colorRenderingForSource(channelRendering, target.sourceId);
    if (live) return rgbToHex(live);
    const sc = findSourceChannel(sourceChannels, target.sourceId);
    if (!sc) return null;
    return rgbToHex(effectiveSourceColor(sc, sourceChannels));
  }
  const g = channelGroups.find((x) => x.id === target.groupId);
  const gc = g?.channels.find((c) => c.id === target.rowId);
  if (!gc) return null;
  const sc = findSourceChannel(sourceChannels, gc.channelId);
  const live = colorRenderingForSource(channelRendering, gc.channelId);
  if (live) return rgbToHex(live);
  return rgbToHex(
    sc ? effectiveDisplayColor(sc, sourceChannels, gc) : gc.color,
  );
}

function previewLiveColor(target: ChannelColorTarget, hex: string) {
  const raw = hex.replace(/^#/, "").slice(0, 6);
  if (raw.length < 6) return;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return;
  const doc = useDocumentStore.getState();
  const sourceId =
    target.scope === "source"
      ? target.sourceId
      : doc.channelGroups
          .find((group) => group.id === target.groupId)
          ?.channels.find((gc) => gc.id === target.rowId)?.channelId;
  if (!sourceId) return;
  useAppStore.getState().setChannelRendering({
    kind: "color",
    sourceChannelId: sourceId,
    r,
    g,
    b,
  });
}

export function ChannelColorPicker(props: {
  target: ChannelColorTarget | null;
  position: { top: number; left: number } | null;
  onDismiss: () => void;
}) {
  const { target, position, onDismiss } = props;
  const images = useDocumentStore((s) => s.images);
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const channelRendering = useAppStore((s) => s.channelRendering);
  const targetRef = React.useRef(target);
  targetRef.current = target;

  const sourceChannels = React.useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );
  const hex = target
    ? hexForColorTarget(target, channelRendering, sourceChannels, channelGroups)
    : null;

  React.useEffect(
    () => () => {
      commitChannelColorTarget(targetRef.current);
    },
    [],
  );

  const close = () => {
    commitChannelColorTarget(target);
    targetRef.current = null;
    onDismiss();
  };

  return (
    <ColorPickerPopover
      position={target && position && hex ? position : null}
      onClose={close}
      color={`#${hex ?? "000000"}`}
      showAlpha={false}
      onChange={(c) => {
        if (!target) return;
        previewLiveColor(target, c.hex);
      }}
    />
  );
}

export function ChannelEditor(props: { chip: ImageChannelChip }) {
  const { chip } = props;
  const nav = useAuthorChannelNav();
  const images = useDocumentStore((s) => s.images);
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const setImages = useDocumentStore((s) => s.setImages);
  const setImagesAndChannelGroups = useDocumentStore(
    (s) => s.setImagesAndChannelGroups,
  );
  const stackVisibilities = useAppStore((s) => s.channelVisibilities);
  const groupRowVisibilities = useAppStore(
    (s) => s.channelGroupRowVisibilities,
  );
  const channelRendering = useAppStore((s) => s.channelRendering);
  const setChannelVisibilities = useAppStore((s) => s.setChannelVisibilities);
  const setChannelGroupRowVisibilities = useAppStore(
    (s) => s.setChannelGroupRowVisibilities,
  );
  const palettePendingIds = React.useSyncExternalStore(
    subscribeStackPalettePending,
    getStackPalettePendingIds,
    getStackPalettePendingIds,
  );
  const [colorTarget, setColorTarget] =
    React.useState<ChannelColorTarget | null>(null);
  const [colorPos, setColorPos] = React.useState<{
    top: number;
    left: number;
  } | null>(null);
  const [histogramLoading, setHistogramLoading] = React.useState(false);

  const sourceChannels = React.useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );
  const sc = findSourceChannel(sourceChannels, chip.sourceId);
  const gc =
    chip.groupId && chip.groupRowId
      ? (channelGroups
          .find((g) => g.id === chip.groupId)
          ?.channels.find((ch) => ch.id === chip.groupRowId) ?? null)
      : null;
  const distLen = sc ? sourceDistributionYValuesLength(sc) : 0;

  React.useEffect(() => {
    if (
      !chip.sourceId ||
      !sc ||
      !isImageChannel(sc) ||
      distLen > 0 ||
      isRgbDisplayChannel(sc, sourceChannels)
    ) {
      setHistogramLoading(false);
      return;
    }
    let cancelled = false;
    setHistogramLoading(true);
    void nav
      ?.ensureChannelHistograms?.([chip.sourceId])
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setHistogramLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nav, chip.sourceId, distLen, sc, sourceChannels]);

  React.useEffect(
    () => () => {
      useAppStore.getState().setMaskVisualizationPreview(null);
    },
    [],
  );

  if (!sc) return null;

  const rgbDisplay = isRgbDisplayChannel(sc, sourceChannels);
  const visible = gc
    ? isGroupRowVisible(groupRowVisibilities, gc.id)
    : isStackVisible(stackVisibilities, sc.id);
  const color = effectiveDisplayColor(sc, sourceChannels, gc);
  const hex = assignedDisplayHex(sc, sourceChannels, gc);
  const palettePending = palettePendingIds.includes(sc.id);
  const showHistogram = isImageChannel(sc) && !rgbDisplay && !isMaskChannel(sc);
  const colorTargetForRow: ChannelColorTarget =
    gc && chip.groupId
      ? { scope: "group", groupId: chip.groupId, rowId: gc.id }
      : { scope: "source", sourceId: sc.id };

  const toggleVisible = () => {
    if (gc) {
      setChannelGroupRowVisibilities({
        ...groupRowVisibilities,
        [gc.id]: !visible,
      });
      return;
    }
    setChannelVisibilities({
      ...stackVisibilities,
      [sc.id]: !visible,
    });
  };

  const rename = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === sc.name) return;
    setImages(patchSourceChannelOnImages(images, sc.id, { name: trimmed }));
  };

  const syncMask = (viz: MaskVisualization) => {
    const nextImages = patchSourceChannelOnImages(images, sc.id, {
      maskVisualization: viz,
    });
    const nextGroups = channelGroups.map((g) => ({
      ...g,
      channels: g.channels.map((rowCh) => {
        if (gc) {
          return g.id === chip.groupId && rowCh.id === gc.id
            ? { ...rowCh, maskVisualization: viz }
            : rowCh;
        }
        return rowCh.channelId === sc.id
          ? { ...rowCh, maskVisualization: viz }
          : rowCh;
      }),
    }));
    setImagesAndChannelGroups(nextImages, nextGroups);
    useAppStore.getState().setMaskVisualizationPreview(null);
  };

  const openColor = (el: HTMLButtonElement) => {
    commitChannelColorTarget(colorTarget);
    setColorTarget(colorTargetForRow);
    setColorPos(colorPickerAnchorPosition(el.getBoundingClientRect()));
  };

  const contrast = showHistogram ? (
    gc && chip.groupId ? (
      <ChannelContrastEditor
        {...contrastEditorPropsForGroupRow(
          channelRendering,
          chip.groupId,
          gc,
          sc,
        )}
        histogramLoading={histogramLoading}
      />
    ) : (
      <ChannelContrastEditor
        {...contrastEditorPropsForSource(
          channelRendering,
          sc,
          color,
          effectiveSourceLimits(sc),
        )}
        histogramLoading={histogramLoading}
      />
    )
  ) : null;

  return (
    <>
      <ChannelRow
        rowClassName={row.rootChannelRow}
        visible={visible}
        visibilityTitle={visible ? `Hide ${sc.name}` : `Show ${sc.name}`}
        visibilityAriaLabel={`Toggle visibility for ${sc.name}`}
        onToggleVisibility={toggleVisible}
        name={{
          mode: "editable",
          name: sc.name,
          meta: `Index ${sc.index}`,
          onBlur: rename,
        }}
        {...(!rgbDisplay && isMaskChannel(sc)
          ? {
              isMask: true as const,
              maskVisualization: effectiveMaskVisualization(gc ?? sc),
              maskAriaLabel: `Mask display for ${sc.name}`,
              onMaskVisualizationChange: syncMask,
              onMaskVisualizationPreview: (viz: MaskVisualization | null) => {
                useAppStore
                  .getState()
                  .setMaskVisualizationPreview(
                    viz ? { sourceChannelId: sc.id, visualization: viz } : null,
                  );
              },
            }
          : !rgbDisplay
            ? {
                busy: palettePending,
                colorHex: hex,
                colorTitle: `Pick color for ${sc.name}`,
                onColorClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  openColor(e.currentTarget);
                },
              }
            : {})}
      />
      {contrast}
      {colorTarget && colorPos ? (
        <ChannelColorPicker
          target={colorTarget}
          position={colorPos}
          onDismiss={() => {
            setColorTarget(null);
            setColorPos(null);
          }}
        />
      ) : null}
    </>
  );
}
