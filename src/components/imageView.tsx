import * as React from "react";
import { VivView } from "./vivView";
import { toSettings } from "../lib/viv";

const toImageProps = (opts) => {
  const { props, buttons } = opts;
  const vivProps = {
    ...props,
    viewerConfig: {
      ...buttons,
      toSettings: toSettings(props),
    },
  };
  return vivProps;
};

const ImageView = (props) => {
  const { overlayLayers, activeTool, onOverlayInteraction, ...rest } = props;
  return <VivView {...rest} overlayLayers={overlayLayers} activeTool={activeTool} onOverlayInteraction={onOverlayInteraction} />;
};

export { ImageView, toImageProps };
