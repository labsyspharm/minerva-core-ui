import StyleChannelItem from './channel-item.module.css' with { type: "css" };
import globalCSS from "./global.module.css" with { type: "css" };
import { html } from "@arrow-js/core";
import { toElement } from "./lib/elements";

const toChannelItem = (
  ItemRegistry, getSourceDistribution, elements
) => {
  const rangeEditorElement = elements["range-editor"];
  class ChannelItem extends HTMLElement {

    static eventHandlerKeys = [ ];

    addStyles() {
      const shadow = this.shadowRoot;
      shadow.adoptedStyleSheets = [
        ...shadow.adoptedStyleSheets,
        StyleChannelItem,
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
      return toElement("div")`
        ${this.chartTemplate}
        ${this.rangeTemplate}
      `({
        class: "center grid"
      });
    }

    get rangeTemplate() {
      const { distribution } = this;
      const {
        XScale, YValues, UpperRange, LowerRange
      } = distribution;
      const style = () => {
        const R = parseInt(this.getAttribute("r"));
        const G = parseInt(this.getAttribute("g"));
        const B = parseInt(this.getAttribute("b"));
        const rgb = `rgb(${R},${G},${B})`;
        return `--slider-background: ${rgb};`;
      };
      const rangeEditor = () => {
        return toElement(rangeEditorElement)``({
          group_uuid: () => this.getAttribute("group_uuid"),
          channel_uuid: () => this.getAttribute("channel_uuid"),
          lower_range: () => this.getAttribute("lower_range"),
          upper_range: () => this.getAttribute("upper_range"),
          dist_scale: XScale,
          dist_count: YValues.length,
          dist_max: UpperRange,
          dist_min: LowerRange,
          style,
          class: "full",
        });
      };
      return rangeEditor;
    }

    get chartTemplate() {
      const width = 100;
      const height = 15;
      const stroke = 1.5;
      const d = () => {
        const { YValues: values } = this.distribution;
        const line = [0, ...(values || []), 0];
        const flat = line.slice(1, -1).every((v) => v == line[1]);
        const max = Math.max(1, ...(flat ? [2 * line[1]] : line));
        const len = Math.max(2, line.length);
        return line.reduce((d, v, index) => {
          const i = Math.min(Math.max(index, 1), len - 2) - 1;
          const x = Math.min(Math.max(i / (len - 3), 0), 1);
          const y = Math.min(Math.max(1 - v / max, 0), 1);
          const action = d.length ? "L" : "M";
          return `${d} ${action} ${width * x} ${2 + (height - 2) * y}`;
        }, "");
      };
      return toElement("svg")`
        <path d="${d}" stroke-linejoin="round"/>
      `({
        viewBox: `${stroke * 2} 0 ${width - stroke * 4} ${height}`,
        preserveAspectRatio: "none",
        "clip-path": "inset(0% round 15px)",
        xmlns: "http://www.w3.org/2000/svg",
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

    get distribution() {
      const distribution = getSourceDistribution(
        this.getAttribute("source_uuid")
      )
      return (
        distribution || {
          XScale: "log",
          YScale: "linear",
          YValues: [],
          LowerRange: 1,
          UpperRange: 16,
        }
      );
    }
  }
  return ChannelItem;
}

export { toChannelItem };
