import { PanelItem } from "./panel-item";
import { toElement } from "../../../../lib/elements";
import { toElementState } from "../../../../lib/elements.js";
import panelItemGroupCSS from "./panel-item-group.module.css" with {
  type: "css",
};
import { RangeEditorChannel } from "./range-editor/range-editor-channel";
import { sourceItemMap } from "../../../../items/source-item-map";
import { sourceGroupChannels } from "../../../../items/source-group-channels";
import { CollapseGroup } from "./collapse/collapse-group";
import { CollapseChannel } from "./collapse/collapse-channel";
import { Chart } from "./chart/chart";

class PanelItemGroup extends sourceGroupChannels(
 PanelItem
) {
  static name = "panel-item-group";
  static collapseElement = CollapseGroup;

  static get _styleSheet() {
    [...PanelItem._styleSheet.cssRules].forEach((r) =>
      panelItemGroupCSS.insertRule(r.cssText),
    );
    return panelItemGroupCSS;
  }

  get itemIdentifiers() {
    return {
      GroupUUID: this.getAttribute("group_uuid"),
    };
  }

  get itemContents() {
    const rangeEditorElement = (RangeEditorChannel, {
      defaults: { UUID: "", GroupUUID: "" },
      attributes: ["dialog"],
    });
    const defineElement = toElementState(this._suffix, {
      defaults: {},
      constants: {
        item_registry: {
          GroupChannels: this.itemSources
        } 
      }
    })
    const collapseChannel = defineElement(CollapseChannel, {
      defaults: { expanded: true },
      attributes: ["expanded", "group_uuid", "channel_uuid"],
    });
/*    const chartElement = defineElement(Chart, {
      defaults: { },
    });
*/
    const channels = this.itemSources.map((channel, i) => {
      const source = this.getSourceChannel(channel);
      const item_title = () => source.Name;
      const chart = "";
/*      const chart = () => {
        return toElement(chartElement)``({
          class: () => `full histogram`,
          UUID: () => source.UUID,
        });
      };
*/
      const style = () => {
        const { R, G, B } = channel.Color;
        const rgb = `rgb(${R},${G},${B})`;
        return `--slider-background: ${rgb};`;
      };
      const rangeEditor = () => {
        return toElement(rangeEditorElement)``({
          GroupUUID: () => this.itemIdentifiers.GroupUUID,
          UUID: () => channel.UUID,
          style,
          class: "full",
        });
      };
      return toElement(collapseChannel)`
        <div class="grid one-line" slot="heading">
          <div class="item">
            ${item_title}
          </div>
        </div>
        <div slot="content" class="center grid">
          ${chart} 
          ${rangeEditor}
        </div>
      `({
        expanded: String(channel.State.Expanded),
        group_uuid: () => this.itemIdentifiers.GroupUUID,
        channel_uuid: () => channel.UUID,
        accordion: "true",
        class: "inner",
      });
    });
    return toElement("div")`${channels}`({
      class: "grid",
    });
  }

  get itemHeading() {
    const itemTitle = () => {
      return toElement("div")`${super.itemHeading}`();
    };
    const channelTitles = () => {
      const groupChannels = this.itemSources;
      return groupChannels.map((channel) => {
        if (this.elementState.expanded) {
          return "";
        }
        const source = this.getSourceChannel(channel);
        const name = () => {
          return source.Name;
        };
        return toElement("div")`${name}`({
          class: "flex item",
        });
      });
    };
    const channels = () => {
      return toElement("div")`${channelTitles}`({
        class: "flex wrap",
      });
    };
    return toElement("div")`${itemTitle}${channels}`({
      class: "grid",
    });
  }
}

export { PanelItemGroup };
