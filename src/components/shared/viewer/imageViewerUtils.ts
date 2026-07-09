import { toSettings } from "@/lib/imaging/viv";

type ToSettingsInput = Parameters<typeof toSettings>[0];

export const toImageProps = (opts: {
  props: ToSettingsInput & Record<string, unknown>;
  buttons: Record<string, unknown>;
}) => {
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
