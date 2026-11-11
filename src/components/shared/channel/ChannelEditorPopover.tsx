import * as React from "react";
import {
  ColorPickerPopover,
  colorPickerAnchorPosition,
} from "@/components/shared/ColorPickerPopover";
import { useAuthorChannelNav } from "@/components/shared/channel/AuthorChannelNav";
import {
  type ChannelContrastEditorProps,
  contrastEditorPropsForGroupRow,
  contrastEditorPropsForSource,
  renderingForSource,
} from "@/components/shared/channel/ChannelContrastEditor";
import {
  ChannelRow,
  SegmentedToggle,
} from "@/components/shared/channel/ChannelRow";
import rowStyles from "@/components/shared/channel/ChannelRow.module.css";
import { featureTableRowExtras } from "@/components/shared/channel/FeatureTable";
import { StainPreview } from "@/components/shared/channel/StainPreview";
import {
  applyGroupRowVisibilities,
  applyStackVisibilities,
  isGroupRowVisible,
  isStackVisible,
  type VivIntensityCapVis,
  visibilitiesForRgbUnit,
  visibilityKindForMap,
  vivIntensityCapExceeded,
  withGroupRowVisible,
} from "@/lib/imaging/channelCompositor";
import {
  isImageChannel,
  isMaskChannel,
  isRgbDisplayChannel,
  type MaskVisualization,
} from "@/lib/imaging/channelKind";
import { getGmmPendingIds, subscribeGmmFit } from "@/lib/imaging/gmmScheduler";
import {
  defaultHeDeconvSplit,
  HE_CONTRAST_SCALE,
  HE_DECONV_COMPONENTS,
  HE_DECONV_LABELS,
  type HeDeconvComponent,
  type HeDeconvSplit,
  type HeSplitMode,
  type HeStainView,
} from "@/lib/imaging/heDeconvView";
import { heStainColorsForFit } from "@/lib/imaging/heStainColors";
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

export type ChannelColorTarget =
  | { scope: "source"; sourceId: string }
  | { scope: "group"; groupId: string; rowId: string }
  /** One separated stain of an RGB channel (session state, not the document). */
  | { scope: "he"; sourceId: string; component: HeDeconvComponent };

export function commitChannelColorTarget(target: ChannelColorTarget | null) {
  if (!target) return;
  const app = useAppStore.getState();
  const live = app.channelRendering;
  const doc = useDocumentStore.getState();
  if (target.scope === "he") {
    const colorLive = renderingForSource(
      live,
      target.sourceId,
      "color",
      target.component,
    );
    if (colorLive) {
      app.patchHeDeconv(target.sourceId, target.component, {
        color: [colorLive.r, colorLive.g, colorLive.b],
      });
    }
  } else if (target.scope === "source") {
    const colorLive = renderingForSource(live, target.sourceId, "color");
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
      ? renderingForSource(live, groupRow.channelId, "color")
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
  heDeconvByChannelId: Record<string, HeDeconvSplit>,
): string | null {
  if (target.scope === "he") {
    const live = renderingForSource(
      channelRendering,
      target.sourceId,
      "color",
      target.component,
    );
    if (live) return rgbToHex(live);
    const stain = heDeconvByChannelId[target.sourceId]?.[target.component];
    if (!stain) return null;
    const [r, g, b] = stain.color;
    return rgbToHex({ r, g, b });
  }
  if (target.scope === "source") {
    const live = renderingForSource(channelRendering, target.sourceId, "color");
    if (live) return rgbToHex(live);
    const sc = findSourceChannel(sourceChannels, target.sourceId);
    if (!sc) return null;
    return rgbToHex(effectiveSourceColor(sc, sourceChannels));
  }
  const g = channelGroups.find((x) => x.id === target.groupId);
  const gc = g?.channels.find((c) => c.id === target.rowId);
  if (!gc) return null;
  const sc = findSourceChannel(sourceChannels, gc.channelId);
  const live = renderingForSource(channelRendering, gc.channelId, "color");
  if (live) return rgbToHex(live);
  return rgbToHex(
    sc ? effectiveDisplayColor(sc, sourceChannels, gc) : gc.color,
  );
}

function sourceIdForColorTarget(
  target: ChannelColorTarget,
  channelGroups: readonly ChannelGroup[],
): string | undefined {
  if (target.scope !== "group") return target.sourceId;
  return channelGroups
    .find((group) => group.id === target.groupId)
    ?.channels.find((gc) => gc.id === target.rowId)?.channelId;
}

function previewLiveColor(target: ChannelColorTarget, hex: string) {
  const raw = hex.replace(/^#/, "").slice(0, 6);
  if (raw.length < 6) return;
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return;
  const sourceId = sourceIdForColorTarget(
    target,
    useDocumentStore.getState().channelGroups,
  );
  if (!sourceId) return;
  useAppStore.getState().setChannelRendering({
    kind: "color",
    sourceChannelId: sourceId,
    r,
    g,
    b,
    ...(target.scope === "he" ? { heComponent: target.component } : {}),
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
  const heDeconvByChannelId = useAppStore((s) => s.heDeconvByChannelId);
  const targetRef = React.useRef(target);
  targetRef.current = target;

  const sourceChannels = React.useMemo(
    () => flattenImageChannelsInDocumentOrder(images),
    [images],
  );
  const hex = target
    ? hexForColorTarget(
        target,
        channelRendering,
        sourceChannels,
        channelGroups,
        heDeconvByChannelId,
      )
    : null;
  const targetSourceId = target
    ? sourceIdForColorTarget(target, channelGroups)
    : undefined;
  const stain = Boolean(
    targetSourceId && findSourceChannel(sourceChannels, targetSourceId)?.stain,
  );

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
      footer={stain && hex ? <StainPreview hex={hex} /> : null}
      onChange={(c) => {
        if (!target) return;
        previewLiveColor(target, c.hex);
      }}
    />
  );
}

/** H&E stain sliders run over a stain's IF-like signal × HE_CONTRAST_SCALE, not a dtype. */
const HE_CONTRAST_DISTRIBUTION = {
  id: "",
  YValues: [] as number[],
  XScale: "linear" as const,
  YScale: "linear" as const,
  LowerRange: 0,
  UpperRange: HE_CONTRAST_SCALE,
};

function heStainColor(
  stain: HeStainView,
  live: ChannelRendering | null,
  sourceChannelId: string,
  component: HeDeconvComponent,
): { r: number; g: number; b: number } {
  const liveColor = renderingForSource(
    live,
    sourceChannelId,
    "color",
    component,
  );
  if (liveColor) return { r: liveColor.r, g: liveColor.g, b: liveColor.b };
  return { r: stain.color[0], g: stain.color[1], b: stain.color[2] };
}

function heDeconvContrastEditorProps(
  sc: Channel,
  component: HeDeconvComponent,
  stain: HeStainView,
  live: ChannelRendering | null,
  yValues: number[],
): ChannelContrastEditorProps {
  const c = heStainColor(stain, live, sc.id, component);
  const liveContrast = renderingForSource(live, sc.id, "contrast", component);
  return {
    groupId: "",
    channelId: `${sc.id}:${component}`,
    sourceChannelId: sc.id,
    channelLabel: HE_DECONV_LABELS[component],
    r: c.r,
    g: c.g,
    b: c.b,
    lowerLimit: liveContrast ? liveContrast.lower : stain.lower,
    upperLimit: liveContrast ? liveContrast.upper : stain.upper,
    distribution: { ...HE_CONTRAST_DISTRIBUTION, YValues: yValues },
    dtypeMax: HE_CONTRAST_SCALE,
    heComponent: component,
  };
}

/** Turning separation off keeps it, so turning it back on restores its settings. */
const lastHeSplits = new Map<string, HeDeconvSplit>();

/**
 * The Separate stains switch for a packed RGB channel's row (the stain shader
 * reads one packed RGB channel; planar RGB images get none).
 */
export function heSplitToggleProps(
  sc: Channel | undefined,
  sourceChannels: readonly Channel[],
  split: HeDeconvSplit | undefined,
): { heSplit?: boolean; onHeSplitChange?: (split: boolean) => void } {
  if (!sc || sc.samples !== 3 || !isRgbDisplayChannel(sc, sourceChannels)) {
    return {};
  }
  const id = sc.id;
  return {
    heSplit: Boolean(split),
    onHeSplitChange: (on) => {
      const app = useAppStore.getState();
      const current = app.heDeconvByChannelId[id];
      if (!on && current) lastHeSplits.set(id, current);
      app.setHeDeconv(
        id,
        on ? (lastHeSplits.get(id) ?? defaultHeDeconvSplit()) : null,
      );
    },
  };
}

const HE_SPLIT_MODES = [
  {
    value: "fluorescence",
    label: "Fluorescence",
    title:
      "Each stain as an IF channel: its density converted to an IF-like signal, glowing on black",
  },
  {
    value: "brightfield",
    label: "Brightfield",
    title: "Each stain as scanned: its own density on white glass",
  },
] as const satisfies readonly {
  value: HeSplitMode;
  label: string;
  title: string;
}[];

/**
 * Hematoxylin and eosin rows of an RGB channel whose stains are separated,
 * under the choice of how they draw. As fluorescence each is an IF channel
 * (visibility, color, a window over its signal); as brightfield each keeps
 * its fitted color and density, so only visibility is left to set.
 */
export function HeStainRows(props: {
  sc: Channel;
  contrastEditable: boolean;
  onPickColor: (target: ChannelColorTarget, anchor: DOMRect) => void;
}) {
  const { sc, contrastEditable, onPickColor } = props;
  const split = useAppStore((s) => s.heDeconvByChannelId[sc.id]);
  const fit = useAppStore((s) => s.heStainFitByChannelId[sc.id]);
  const channelRendering = useAppStore((s) => s.channelRendering);
  const patchHeDeconv = useAppStore((s) => s.patchHeDeconv);
  if (!split) return null;
  const brightfield = split.mode === "brightfield";
  const fittedColors = brightfield ? heStainColorsForFit(fit) : null;
  return (
    <div className={rowStyles.heStains}>
      <div className={rowStyles.heStainMode}>
        <SegmentedToggle
          ariaLabel="Draw the separated stains as"
          value={split.mode}
          options={HE_SPLIT_MODES}
          onChange={(mode) =>
            useAppStore.getState().setHeDeconv(sc.id, { ...split, mode })
          }
        />
      </div>
      <ul className={rowStyles.heStainList}>
        {HE_DECONV_COMPONENTS.map((component) => {
          const stain = split[component];
          const label = HE_DECONV_LABELS[component];
          const c = heStainColor(stain, channelRendering, sc.id, component);
          return (
            <li key={component} className={rowStyles.heStainBlock}>
              <ChannelRow
                visible={stain.visible}
                visibilityTitle={
                  stain.visible ? `Hide ${label}` : `Show ${label}`
                }
                visibilityAriaLabel={`Toggle visibility for ${label}`}
                onToggleVisibility={() =>
                  patchHeDeconv(sc.id, component, { visible: !stain.visible })
                }
                name={{
                  mode: "label",
                  name: label,
                  title: label,
                  className: rowStyles.stainName,
                }}
                {...(fittedColors
                  ? { fixedColorHex: rgbToHex(fittedColors[component]) }
                  : {
                      colorHex: rgbToHex(c),
                      colorTitle: `Pick color for ${label}`,
                      onColorClick: (
                        e: React.MouseEvent<HTMLButtonElement>,
                      ) => {
                        e.stopPropagation();
                        onPickColor(
                          { scope: "he", sourceId: sc.id, component },
                          e.currentTarget.getBoundingClientRect(),
                        );
                      },
                    })}
                contrast={
                  contrastEditable && stain.visible && !brightfield
                    ? {
                        ...heDeconvContrastEditorProps(
                          sc,
                          component,
                          stain,
                          channelRendering,
                          fit?.stains?.[component].histogram ?? [],
                        ),
                        histogramLoading: !fit,
                        onCommitRange: (lower, upper) =>
                          patchHeDeconv(sc.id, component, { lower, upper }),
                      }
                    : undefined
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChannelEditor(props: { chip: ImageChannelChip }) {
  const { chip } = props;
  const nav = useAuthorChannelNav();
  const images = useDocumentStore((s) => s.images);
  const channelGroups = useDocumentStore((s) => s.channelGroups);
  const featureTables = useDocumentStore((s) => s.featureTables);
  const setImages = useDocumentStore((s) => s.setImages);
  const setImagesAndChannelGroups = useDocumentStore(
    (s) => s.setImagesAndChannelGroups,
  );
  const storedStackVisibilities = useAppStore((s) => s.channelVisibilities);
  const storedGroupRowVisibilities = useAppStore(
    (s) => s.channelGroupRowVisibilities,
  );
  const channelRendering = useAppStore((s) => s.channelRendering);
  const setChannelVisibilities = useAppStore((s) => s.setChannelVisibilities);
  const setChannelGroupRowVisibilities = useAppStore(
    (s) => s.setChannelGroupRowVisibilities,
  );
  const activeChannelGroupId = useAppStore((s) => s.activeChannelGroupId);
  const heSplit = useAppStore((s) => s.heDeconvByChannelId[chip.sourceId]);
  const palettePendingIds = React.useSyncExternalStore(
    subscribeStackPalettePending,
    getStackPalettePendingIds,
    getStackPalettePendingIds,
  );
  const gmmPendingIds = React.useSyncExternalStore(
    subscribeGmmFit,
    getGmmPendingIds,
    getGmmPendingIds,
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
  const stackVisibilities = React.useMemo(
    () =>
      applyStackVisibilities(
        sourceChannels,
        storedStackVisibilities,
        visibilityKindForMap(storedStackVisibilities),
      ),
    [sourceChannels, storedStackVisibilities],
  );
  const groupRowVisibilities = React.useMemo(
    () =>
      applyGroupRowVisibilities(
        channelGroups,
        storedGroupRowVisibilities,
        visibilityKindForMap(storedGroupRowVisibilities),
      ),
    [channelGroups, storedGroupRowVisibilities],
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

  if (!sc) return null;

  const rgbDisplay = isRgbDisplayChannel(sc, sourceChannels);
  const visible = gc
    ? isGroupRowVisible(groupRowVisibilities, gc.id)
    : isStackVisible(stackVisibilities, sc.id);
  const color = effectiveDisplayColor(sc, sourceChannels, gc);
  const hex = assignedDisplayHex(sc, sourceChannels, gc, channelRendering);
  const palettePending = palettePendingIds.includes(sc.id);
  const showHistogram = isImageChannel(sc) && !rgbDisplay;
  const colorTargetForRow: ChannelColorTarget =
    gc && chip.groupId
      ? { scope: "group", groupId: chip.groupId, rowId: gc.id }
      : { scope: "source", sourceId: sc.id };

  const capVis: VivIntensityCapVis = {
    channels: sourceChannels,
    activeGroup: channelGroups.find((g) => g.id === activeChannelGroupId),
    channelGroups,
    stackVisibilities,
    groupRowVisibilities,
  };
  const fits = (
    next: Partial<
      Pick<VivIntensityCapVis, "stackVisibilities" | "groupRowVisibilities">
    >,
  ) => !vivIntensityCapExceeded(sc.imageId, { ...capVis, ...next });

  const rgbUnit = rgbDisplay
    ? visibilitiesForRgbUnit({
        rgbChannels: sourceChannels.filter(
          (c) => c.imageId === sc.imageId && isImageChannel(c),
        ),
        channelGroups,
        groupRowVisibilities,
        stackVisibilities,
        visible: !visible,
        groupId: chip.groupId ?? undefined,
      })
    : null;
  const nextGroupVis = gc
    ? withGroupRowVisible(groupRowVisibilities, channelGroups, gc.id, !visible)
    : null;
  const nextStackVis = {
    ...stackVisibilities,
    [sc.id]: !visible,
  };

  const toggleVisible = () => {
    if (rgbUnit) {
      if (
        !visible &&
        !fits({
          stackVisibilities: rgbUnit.channelVisibilities,
          groupRowVisibilities: rgbUnit.channelGroupRowVisibilities,
        })
      ) {
        return;
      }
      setChannelGroupRowVisibilities(rgbUnit.channelGroupRowVisibilities);
      setChannelVisibilities(rgbUnit.channelVisibilities);
      return;
    }
    if (nextGroupVis) {
      if (!visible && !fits({ groupRowVisibilities: nextGroupVis })) return;
      setChannelGroupRowVisibilities(nextGroupVis);
      return;
    }
    if (!visible && !fits({ stackVisibilities: nextStackVis })) return;
    setChannelVisibilities(nextStackVis);
  };

  const showBlocked = Boolean(
    rgbUnit
      ? !visible &&
          !fits({
            stackVisibilities: rgbUnit.channelVisibilities,
            groupRowVisibilities: rgbUnit.channelGroupRowVisibilities,
          })
      : isImageChannel(sc) &&
          !visible &&
          !fits(
            nextGroupVis
              ? { groupRowVisibilities: nextGroupVis }
              : { stackVisibilities: nextStackVis },
          ),
  );

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
  };

  const openColor = (target: ChannelColorTarget, anchor: DOMRect) => {
    commitChannelColorTarget(colorTarget);
    setColorTarget(target);
    setColorPos(colorPickerAnchorPosition(anchor));
  };

  const contrastEditable = showHistogram && Boolean(nav?.contrastEditable);
  const contrast = contrastEditable
    ? gc && chip.groupId
      ? {
          ...contrastEditorPropsForGroupRow(
            channelRendering,
            chip.groupId,
            gc,
            sc,
          ),
          histogramLoading,
        }
      : {
          ...contrastEditorPropsForSource(
            channelRendering,
            sc,
            color,
            effectiveSourceLimits(sc),
          ),
          histogramLoading,
        }
    : undefined;

  return (
    <>
      <ChannelRow
        visible={visible}
        fitting={gmmPendingIds.includes(sc.id)}
        visibilityTitle={visible ? `Hide ${sc.name}` : `Show ${sc.name}`}
        visibilityAriaLabel={`Toggle visibility for ${sc.name}`}
        visibilityBlocked={showBlocked}
        onToggleVisibility={toggleVisible}
        name={{
          mode: "editable",
          name: sc.name,
          meta: `Index ${sc.index}`,
          onBlur: rename,
        }}
        contrast={contrast}
        more={contrastEditable ? { fitContrastId: sc.id } : undefined}
        {...(rgbDisplay ? heSplitToggleProps(sc, sourceChannels, heSplit) : {})}
        {...(!rgbDisplay && isMaskChannel(sc)
          ? {
              isMask: true as const,
              maskVisualization: effectiveMaskVisualization(gc ?? sc),
              maskAriaLabel: `Mask display for ${sc.name}`,
              ...featureTableRowExtras(sc.id, featureTables),
              onMaskVisualizationChange: syncMask,
            }
          : !rgbDisplay
            ? {
                busy: palettePending,
                colorHex: hex,
                colorTitle: `Pick color for ${sc.name}`,
                onColorClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  openColor(
                    colorTargetForRow,
                    e.currentTarget.getBoundingClientRect(),
                  );
                },
              }
            : {})}
      />
      {rgbDisplay && visible && heSplit ? (
        <HeStainRows
          sc={sc}
          contrastEditable={Boolean(nav?.contrastEditable)}
          onPickColor={openColor}
        />
      ) : null}
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
