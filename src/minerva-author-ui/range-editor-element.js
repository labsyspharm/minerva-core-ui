import StyleRangeEditor from './range-editor.module.css' with { type: "css" };
import globalCSS from "./global.module.css" with { type: "css" };
import { html } from "@arrow-js/core";
import { toElement } from "./lib/elements";

const toRangeEditor = (
  ItemRegistry, setGroupChannelRange, elements
) => {
  const rangeInputElement = elements["range-slider"];

  class RangeEditor extends HTMLElement {
    static eventHandlerKeys = [ ];

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

    get elementTemplate() {
      const dataType = this.dataType;
      const dist_count = parseInt(this.getAttribute("dist_count"));
      const dist_scale = this.getAttribute("dist_scale");
      const chart_x_steps = Math.max(2, dist_count);
      const chart_x_max = parseInt(this.getAttribute("dist_max"));
      const chart_x_origin = parseInt(this.getAttribute("dist_min"));
      const chart_x_range = chart_x_max - chart_x_origin;
      const chart_x_scale = chart_x_steps / chart_x_range;
      const from_input = (value) => {
        value = chart_x_origin + value / chart_x_scale;
        if (dist_scale === "log") {
          value = 2 ** value;
        }
        return Math.max(
          dataType.LowerRange,
          Math.min(dataType.UpperRange, value),
        );
      };
      const to_input = (value) => {
        if (dist_scale === "log") {
          value = Math.log2(Math.max(1, value));
        }
        return Math.round(
          chart_x_scale *
            Math.max(0, Math.min(chart_x_range, value - chart_x_origin)),
        );
      };
      const defaultValues = {
        LowerRange: parseInt(this.getAttribute("lower_range")),
        UpperRange: parseInt(this.getAttribute("upper_range"))
      };
      const rangeInput = toElement(rangeInputElement)``({
        min: "0",
        max: String(chart_x_steps),
        "start-value": String(to_input(defaultValues.LowerRange)),
        "end-value": String(to_input(defaultValues.UpperRange)),
        class: "full grid",
        "@input": (e) => {
          const start = e.target.startValue;
          const end = e.target.endValue;
          const LowerRange = from_input(start);
          const UpperRange = from_input(end);
          setGroupChannelRange({
            LowerRange, UpperRange,
            group_uuid: this.getAttribute("group_uuid"),
            channel_uuid: this.getAttribute("channel_uuid"),
          })
        },
      });
      return toElement("div")`${rangeInput}`({
        class: "full grid",
      });
    }

    get groupChannel() {
      const group = (ItemRegistry?.Groups || []).find((x) => {
        return x.UUID == this.getAttribute("group_uuid");
      }) || null;
      return (group?.GroupChannels || []).find((x) => {
        return x.UUID == this.getAttribute("channel_uuid");
      }) || null;
    }

    get dataType() {
      return {
        LowerRange: 0,
        UpperRange: 65535,
      }
    }

  }
  return RangeEditor;
}

export { toRangeEditor };
