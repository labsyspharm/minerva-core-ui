import PlusSvg from "@/components/shared/icons/plus.svg?react";

type PlusIconProps = {
  title?: string;
  size?: number;
};

/** Shared plus glyph — wraps `icons/plus.svg` so callers share one asset. */
export function PlusIcon({ title, size = 14 }: PlusIconProps) {
  return (
    <PlusSvg
      aria-hidden={title ? undefined : true}
      aria-label={title}
      width={size}
      height={size}
    />
  );
}
