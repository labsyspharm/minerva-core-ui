import type { Loader } from "../lib/viv";

type DicomData = {
  labels: string[];
  shape: number[];
};

export interface DicomLoader extends Loader {
  data: DicomData[];
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
        [k: string]: any;
      };
      tileSize: number;
    }[];
  };
};
