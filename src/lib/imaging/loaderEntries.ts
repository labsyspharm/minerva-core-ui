import type { Loader } from "./viv";

/** One OME-TIFF pyramid + the document `Image.id` carried on flat source channels. */
export type OmeLoaderEntry = {
  loader: Loader;
  sourceImageId: string;
};

export type JpegLoaderEntry = {
  loader: Loader;
  sourceImageId: string;
  /** OME channel index → pyramid folder (map mutated in place; entry shell replaced to re-render). */
  channelFolders?: Record<number, string>;
  imagePath?: string;
  /**
   * Pyramid folders treated as loadable (disk listing ∪ hydrate-time group
   * hashes), normalized to lowercase. Sync only switches onto maps in this set.
   */
  availablePyramidFolders?: ReadonlySet<string>;
  /** Contrast-hash folder maps captured for each persisted channel group. */
  groupChannelFolders?: Readonly<
    Record<string, Readonly<Record<number, string>>>
  >;
};

export type LoaderListItem = {
  loader: Loader;
  modality: string;
  sourceImageId?: string;
};
export type LoaderList = LoaderListItem[];

export type MainSettings = {
  selections: readonly { c: number }[];
  contrastLimits: readonly [number, number][];
  colors: readonly [number, number, number][];
  channelsVisible?: readonly boolean[];
  sourceChannelIds?: readonly string[];
};
