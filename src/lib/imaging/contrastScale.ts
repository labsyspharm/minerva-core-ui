/** Internal slider resolution; not tied to histogram bin count so handles move smoothly. */
export const SLIDER_DOMAIN_STEPS = 8192;

export type ContrastScaleInput = {
  distScale: string;
  distMin: number;
  distMax: number;
  dtypeMin?: number;
  dtypeMax?: number;
};

export type ContrastScale = {
  fromSlider: (value: number) => number;
  toSlider: (value: number) => number;
  sliderSteps: number;
  dtypeMin: number;
  dtypeMax: number;
};

const DEFAULT_DTYPE_MIN = 0;
const DEFAULT_DTYPE_MAX = 65535;

/** Map slider steps ↔ intensity values (linear or log axis). Ported from range-editor-element.js */
export function buildContrastScale(input: ContrastScaleInput): ContrastScale {
  const dtypeMin = input.dtypeMin ?? DEFAULT_DTYPE_MIN;
  const dtypeMax = input.dtypeMax ?? DEFAULT_DTYPE_MAX;
  const chart_x_steps = SLIDER_DOMAIN_STEPS;
  const chart_x_max = input.distMax;
  const chart_x_origin = input.distMin;
  const chart_x_range = chart_x_max - chart_x_origin;
  const chart_x_scale = chart_x_steps / chart_x_range;

  const fromSlider = (value: number): number => {
    const v_linear = chart_x_origin + value / chart_x_scale;
    let v = v_linear;
    if (input.distScale === "log") {
      if (v_linear <= chart_x_origin) {
        v = chart_x_origin === 0 ? 0 : 2 ** chart_x_origin;
      } else {
        v = 2 ** v_linear;
      }
    }
    return Math.max(dtypeMin, Math.min(dtypeMax, v));
  };

  const toSlider = (value: number): number => {
    let v = value;
    if (input.distScale === "log") {
      if (chart_x_origin === 0 && v <= 0) {
        v = 0;
      } else {
        const minPositive = chart_x_origin === 0 ? 1 : 2 ** chart_x_origin;
        v = Math.log2(Math.max(minPositive, v));
      }
    }
    return Math.round(
      chart_x_scale * Math.max(0, Math.min(chart_x_range, v - chart_x_origin)),
    );
  };

  return {
    fromSlider,
    toSlider,
    sliderSteps: chart_x_steps,
    dtypeMin,
    dtypeMax,
  };
}

/** Build SVG path `d` for histogram sparkline (channel-item-element chartTemplate). */
export function histogramSparklinePath(
  values: number[] | undefined,
  width = 100,
  height = 11,
): string {
  const stroke = 1.15;
  const line = [0, ...(values || []), 0];
  const flat = line.slice(1, -1).every((v) => v === line[1]);
  const max = Math.max(1, ...(flat ? [2 * line[1]] : line));
  const len = Math.max(2, line.length);
  return line.reduce((d, v, index) => {
    const i = Math.min(Math.max(index, 1), len - 2) - 1;
    const x = Math.min(Math.max(i / (len - 3), 0), 1);
    const y = Math.min(Math.max(1 - v / max, 0), 1);
    const action = d.length ? "L" : "M";
    return `${d} ${action} ${width * x} ${2 + (height - 2) * y}`;
  }, "");
}
