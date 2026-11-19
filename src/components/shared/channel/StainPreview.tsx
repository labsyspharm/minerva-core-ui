import { DEFAULT_HE_STAIN_COLORS } from "@/lib/imaging/heStainColors";
import { hexToRgb, type RgbColor } from "@/lib/imaging/sourceChannelStyle";
import { stainOver } from "@/lib/imaging/stainExtension";
import styles from "./StainPreview.module.css";

const STAIN_PREVIEW_STOPS = [0, 0.25, 0.5, 0.75, 1];

const tuple = ({ r, g, b }: RgbColor) => [r, g, b] as const;

/** Glass, and the reference H&E the palette keeps stains apart from. */
const STAIN_PREVIEW_BACKGROUNDS: {
  label: string;
  rgb: readonly [number, number, number];
}[] = [
  { label: "Glass", rgb: [255, 255, 255] },
  { label: "Eosin", rgb: tuple(DEFAULT_HE_STAIN_COLORS.eosin) },
  { label: "Hematoxylin", rgb: tuple(DEFAULT_HE_STAIN_COLORS.hematoxylin) },
];

/** No signal → full signal for `hex` as a stain over typical H&E colors. */
export function StainPreview({ hex }: { hex: string }) {
  const rgb = tuple(hexToRgb(hex));
  return (
    <div className={styles.stainPreview}>
      {STAIN_PREVIEW_BACKGROUNDS.map(({ label, rgb: under }) => {
        const stops = STAIN_PREVIEW_STOPS.map(
          (c) => `rgb(${stainOver(under, rgb, c).join(" ")})`,
        );
        return (
          <div key={label} className={styles.stainPreviewItem}>
            <div
              className={styles.stainPreviewRamp}
              title={`${label}: no signal → full signal`}
              style={{ background: `linear-gradient(to right, ${stops})` }}
            />
            <span className={styles.stainPreviewLabel}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
