import * as React from "react";
import { OsdView } from "./osdView";
import { VivView } from "./vivView";
import { toSettings } from "../lib/viv";
import { useOutletContext } from "react-router-dom";
import type { HashContext } from "../lib/hashUtil";

type Viewers = "viv" | "osd";
type Prop = {
  viewer: Viewers;
};

const toImageProps = (opts) => {
  const { props, buttons } = opts;
  const vivProps = {
    ...props,
    viewerConfig: {
      ...buttons,
      toSettings: toSettings(props),
    },
  };
  const osdProps = {
    ...props,
    viewerConfig: {
      ...buttons,
    },
  };
  return (
    {
      viv: vivProps,
      osd: osdProps,
    }[props.viewer] || osdProps
  );
};

const ImageView = (props) => {
  const { viewer, ...rest } = props;
  const context = useOutletContext() as HashContext;
  const Component =
    {
      viv: VivView,
      osd: OsdView,
    }[viewer] || OsdView;
  return <Component {...{ ...rest, ...context }} />;
};

export { ImageView, toImageProps };
