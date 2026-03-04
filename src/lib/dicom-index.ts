import type { LoaderPlane } from "./config";
import type { Loader } from "./viv";

export interface DicomLoader extends Loader {
  data: LoaderPlane[];
  metadata: Loader["metadata"];
}

export type DicomIndex = {
  series: string;
  modality: string;
  loader: DicomLoader;
  pyramids: {
    [k: string]: {
      width: number;
      height: number;
      extent: [number, number, number, number];
      frameMappings: {
        [k: string]: string[];
      };
      tileSize: number;
    }[];
  };
};
