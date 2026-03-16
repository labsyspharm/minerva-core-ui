import { toSettings } from "@/lib/viv";

export const toImageProps = (opts: { props: any; buttons: any }) => {
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
