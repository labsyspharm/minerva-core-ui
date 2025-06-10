import * as React from "react";
import { VivView } from "./vivView";
import { toSettings } from "../lib/viv";

const toImageProps = (opts) => {
  const { props } = opts;
  const vivProps = {
    ...props,
    viewerConfigs: [{
      toSettings: toSettings(props, false)
    }, {
      toSettings: toSettings(props, true)
    }]
  };
  return vivProps;
};

const ImageView = (props) => {
  const { ...rest } = props;
  return <VivView {...{ ...rest }} />;
};

export { ImageView, toImageProps };
