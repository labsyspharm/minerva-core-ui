/**
 * Viv / pyramid loader plane types shared by imaging, SAM2, and filesystem code.
 * Kept out of `lib/authoring/config` so imaging does not depend on authoring.
 */

import type { DTYPE_VALUES } from "@vivjs/constants";

export type SupportedDtype = keyof typeof DTYPE_VALUES;
export type SupportedTypedArray = InstanceType<
  (typeof globalThis)[`${SupportedDtype}Array`]
>;

type Dtype =
  | "Uint8"
  | "Uint16"
  | "Uint32"
  | "Int8"
  | "Int16"
  | "Int32"
  | "Float32"
  | "Float64";

type SelectionConfig = {
  signal?: AbortSignal;
  selection: {
    t: number;
    z: number;
    c: number;
  };
};

type TileConfig = SelectionConfig & {
  x: number;
  y: number;
};

export type HasTile = {
  data: SupportedTypedArray;
  height: number;
  width: number;
};

export type LoaderPlane = {
  dtype: Dtype;
  shape: number[];
  tileSize: number;
  labels:
    | [...("t" | "c" | "z" | "y" | "x" | "_c")[], "y", "x", "_c"]
    | [...("t" | "c" | "z" | "y" | "x")[], "y", "x"];
  onTileError: (e: Error) => void;
  getRaster: (s: SelectionConfig) => Promise<HasTile>;
  getTile: (s: TileConfig) => Promise<HasTile>;
};

export type VivLoaderPlane = LoaderPlane & {
  labels: ["t", "c", "z", "y", "x"];
};
