export enum RasterLayers {
  Intensity = "intensity",
  Label = "label",
}

export enum SparseLayers {
  Rect = "rect",
  Polygon = "polygon",
  Ellipse = "ellipse",
  Arrow = "arrow",
  Text = "text",
  Svg = "svg",
}

export enum Corrections {
  Gamma = "gamma",
  Logarithmic = "log",
}

export enum Shaders {
  Outline = "outline",
  Filter = "filter",
  Fill = "fill",
  Dot = "dot",
}

export enum Units {
  WidthRatio = "w",
  HeightRatio = "h",
  Millimeter = "mm",
  ImagePixel = "px",
}

export enum Formats {
  OmeTiff = "ome_tiff",
  OmeZarr = "ome_zarr",
  ColorJpeg = "color_jpeg",
  ColorPng = "color_png",
  GrayPng = "gray_png",
}

export type Config = {
  images: IndexedImage<Formats>[];
  scenes?: (IndexAndName & Scene)[];
};

export type IndexedImage<F extends Formats> = IndexAndName &
  Image<RasterLayers, F>;

export type Image<R extends RasterLayers, F extends Formats> = {
  location: string;
  metadata: Metadata;
  markers: Marker[];
  shapes: [PixelShape, Shape];
  intent: R;
  format: F;
};

type Metadata = Partial<{
  publications: Publication[];
  creation: Date;
}>;

type Publication = {
  authors: string[];
  creation: Date;
  title: string;
  doi: string;
};

type Marker = Index &
  Partial<{
    channel_number: number;
    cycle_number: number;
    marker_name: string;
    filter: string;
    excitation_wavelength: number;
    emission_wavelength: number;
  }>;

export type Scene = {
  layers: (IndexAndName & Layer)[];
  camera: Camera;
  layout?: Layout;
};

type Layer = RasterIntensity | RasterLabel | Sparse;

type Camera = {
  center: Point;
  zoom: number;
};

export type Layout = {
  classNames?: string[];
  styles?: Record<string, string>;
};

type Unit = typeof Units;

type RasterIntensity = {
  transfers: { type: Corrections; value: number }[];
  intent: RasterLayers.Intensity;
  channels: IntensityChannel[];
};
type RasterLabel = {
  shaders: { type: Shaders; value: unknown }[];
  intent: RasterLayers.Label;
  channels: LabelChannel[];
};

type IntensityChannel = IndexAndName & {
  intensity: Vec<"min" | "max">;
  color: Vec<"r" | "g" | "b">;
};

type LabelChannel = IndexAndName & {
  color: Vec<"r" | "g" | "b">;
  opacity?: number;
};

type Sparse =
  | {
      intent: SparseLayers.Polygon;
      path: number[];
    }
  | {
      intent: SparseLayers.Svg;
      text: string;
    }
  | {
      intent: SparseLayers.Text;
      origin: Point;
      size: number;
      text: string;
    }
  | {
      intent: SparseLayers.Arrow;
      rotation: number;
      origin: Point;
      size: number;
    }
  | {
      intent: SparseLayers.Ellipse;
      origin: Point;
      shape: Shape;
    }
  | {
      intent: SparseLayers.Rect;
      origin: Point;
      shape: Shape;
    };

type Point = Vec<"x" | "y"> & Measure<keyof Unit>;
type Shape = Vec<"width" | "height"> & Measure<keyof Unit>;
type PixelShape = Vec<"width" | "height"> & Measure<"ImagePixel">;
type Measure<U extends keyof Unit> = Record<"unit", Unit[U]>;
type Vec<V extends string> = { [v in V]: number };
type IndexAndName = { name: string; index: number };
export type Index = Pick<IndexAndName, "index">;
