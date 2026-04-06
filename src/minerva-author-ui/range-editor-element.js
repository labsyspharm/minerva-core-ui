import StyleRangeEditor from "./range-editor.module.css" with { type: "css" };
import globalCSS from "./global.module.css" with { type: "css" };
import { html } from "@arrow-js/core";
import { toElement } from "./lib/elements";

const toRangeEditor = (ItemRegistry, setGroupChannelRange, elements) => {
  const rangeInputElement = elements["range-slider"];

  class RangeEditor extends HTMLElement {
    static eventHandlerKeys = [];

    static get observedAttributes() {
      return ["lower_range", "upper_range"];
    }

    addStyles() {
      const shadow = this.shadowRoot;
      shadow.adoptedStyleSheets = [
        ...shadow.adoptedStyleSheets,
        StyleRangeEditor,
        globalCSS,
      ].filter((x) => x);
      return shadow;
    }

    async connectedCallback() {
      this.attachShadow({ mode: "open" });
      const shadow = this.addStyles();
      html`${this.elementTemplate}`(shadow);
    }

    _scale() {
      const dataType = this.dataType;
      const dist_count = parseInt(this.getAttribute("dist_count"), 10);
      const dist_scale = this.getAttribute("dist_scale");
      const chart_x_steps = Math.max(2, dist_count);
      const chart_x_max = parseInt(this.getAttribute("dist_max"), 10);
      const chart_x_origin = parseInt(this.getAttribute("dist_min"), 10);
      const chart_x_range = chart_x_max - chart_x_origin;
      const chart_x_scale = chart_x_steps / chart_x_range;
      const from_input = (value) => {
        let v_linear = chart_x_origin + value / chart_x_scale;
        let v = v_linear;
        if (dist_scale === "log") {
          // 2**0 is 1; allow true zero contrast when the log axis starts at 0.
          if (v_linear <= chart_x_origin) {
            v = chart_x_origin === 0 ? 0 : 2 ** chart_x_origin;
          } else {
            v = 2 ** v_linear;
          }
        }
        return Math.max(
          dataType.LowerRange,
          Math.min(dataType.UpperRange, v),
        );
      };
      const to_input = (value) => {
        if (dist_scale === "log") {
          if (chart_x_origin === 0 && value <= 0) {
            value = 0;
          } else {
            const minPositive =
              chart_x_origin === 0 ? 1 : 2 ** chart_x_origin;
            value = Math.log2(Math.max(minPositive, value));
          }
        }
        return Math.round(
          chart_x_scale *
            Math.max(0, Math.min(chart_x_range, value - chart_x_origin)),
        );
      };
      return { from_input, to_input, chart_x_steps };
    }

    _readDefaultLimits() {
      const lr = parseInt(this.getAttribute("lower_range"), 10);
      const ur = parseInt(this.getAttribute("upper_range"), 10);
      const dt = this.dataType;
      return {
        LowerRange: Number.isFinite(lr) ? lr : dt.LowerRange,
        UpperRange: Number.isFinite(ur) ? ur : dt.UpperRange,
      };
    }

    _pushRange(lower, upper) {
      setGroupChannelRange({
        LowerRange: lower,
        UpperRange: upper,
        group_uuid: this.getAttribute("group_uuid"),
        channel_uuid: this.getAttribute("channel_uuid"),
      });
    }

    _syncInputsUi(lo, hi) {
      const minEl = this.shadowRoot?.getElementById("contrast-range-min");
      const maxEl = this.shadowRoot?.getElementById("contrast-range-max");
      const lv = Math.round(lo);
      const hv = Math.round(hi);
      if (minEl) minEl.value = String(lv);
      if (maxEl) maxEl.value = String(hv);
    }

    _syncSliderUi(lo, hi) {
      const slider = this.shadowRoot?.getElementById("contrast-range-slider");
      if (!slider) return;
      const { to_input } = this._scale();
      const a = to_input(lo);
      const b = to_input(hi);
      slider.startValue = Math.min(a, b);
      slider.endValue = Math.max(a, b);
    }

    attributeChangedCallback() {
      if (!this.shadowRoot) return;
      const ae = this.shadowRoot.activeElement;
      if (ae?.classList?.contains("range-limit-input")) return;
      const lo = parseInt(this.getAttribute("lower_range"), 10);
      const hi = parseInt(this.getAttribute("upper_range"), 10);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) return;
      this._syncInputsUi(lo, hi);
      this._syncSliderUi(lo, hi);
    }

    get elementTemplate() {
      const { from_input, to_input, chart_x_steps } = this._scale();
      const defaultValues = this._readDefaultLimits();
      const self = this;
      const dt = this.dataType;

      const onSliderInput = (e) => {
        const start = e.target.startValue;
        const end = e.target.endValue;
        const LowerRange = Math.round(from_input(start));
        const UpperRange = Math.round(from_input(end));
        self._syncInputsUi(LowerRange, UpperRange);
        self._pushRange(LowerRange, UpperRange);
      };

      const onLimitBlur = () => {
        const minEl = self.shadowRoot?.getElementById("contrast-range-min");
        const maxEl = self.shadowRoot?.getElementById("contrast-range-max");
        if (!minEl || !maxEl) return;
        let lo = Number.parseFloat(minEl.value);
        let hi = Number.parseFloat(maxEl.value);
        if (!Number.isFinite(lo)) lo = dt.LowerRange;
        if (!Number.isFinite(hi)) hi = dt.UpperRange;
        lo = Math.round(Math.max(dt.LowerRange, Math.min(dt.UpperRange, lo)));
        hi = Math.round(Math.max(dt.LowerRange, Math.min(dt.UpperRange, hi)));
        if (lo > hi) {
          const t = lo;
          lo = hi;
          hi = t;
        }
        self._syncInputsUi(lo, hi);
        self._syncSliderUi(lo, hi);
        self._pushRange(lo, hi);
      };

      const onLimitKeydown = (e) => {
        if (e.key === "Enter") {
          e.target.blur();
        }
      };

      const minInput = toElement("input")``({
        type: "number",
        id: "contrast-range-min",
        class: "range-limit-input",
        value: String(Math.round(defaultValues.LowerRange)),
        "aria-label": "Contrast lower limit",
        min: String(dt.LowerRange),
        max: String(dt.UpperRange),
        "@blur": onLimitBlur,
        "@keydown": onLimitKeydown,
      });

      const maxInput = toElement("input")``({
        type: "number",
        id: "contrast-range-max",
        class: "range-limit-input",
        value: String(Math.round(defaultValues.UpperRange)),
        "aria-label": "Contrast upper limit",
        min: String(dt.LowerRange),
        max: String(dt.UpperRange),
        "@blur": onLimitBlur,
        "@keydown": onLimitKeydown,
      });

      const rangeInput = toElement(rangeInputElement)``({
        id: "contrast-range-slider",
        min: "0",
        max: String(chart_x_steps),
        "start-value": String(to_input(defaultValues.LowerRange)),
        "end-value": String(to_input(defaultValues.UpperRange)),
        class: "range-slider-cell",
        "@input": onSliderInput,
      });

      return toElement("div")`
        ${minInput}
        ${rangeInput}
        ${maxInput}
      `({
        class: "range-controls-row",
      });
    }

    get groupChannel() {
      const group = (ItemRegistry?.Groups || []).find((x) => {
        return x.UUID == this.getAttribute("group_uuid");
      }) || null;
      return (
        (group?.GroupChannels || []).find((x) => {
          return x.UUID == this.getAttribute("channel_uuid");
        }) || null
      );
    }

    get dataType() {
      return {
        LowerRange: 0,
        UpperRange: 65535,
      };
    }
  }
  return RangeEditor;
};

export { toRangeEditor };
