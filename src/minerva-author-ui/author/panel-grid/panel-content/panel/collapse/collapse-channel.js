import collapseChannelCSS from "./collapse-channel.module.css" with {
  type: "css",
};
import { sourceGroupChannels } from "../../../../../items/source-group-channels";
import { Collapse } from "./collapse";

class CollapseChannel extends Collapse {
  static name = "collapse-channel";

  static get _styleSheet() {
    [...Collapse._styleSheet.cssRules].forEach((r) =>
      collapseChannelCSS.insertRule(r.cssText),
    );
    return collapseChannelCSS;
  }

  get itemIdentifiers() {
    return {
      GroupUUID: this.getAttribute("group_uuid"),
      ChannelUUID: this.getAttribute("channel_uuid"),
    };
  }

  get itemSources() {
    console.log(this._reactiveState);
    console.log(this.elementState);
    return [];
  }

  get itemSource() {
    return (
      (this.itemSources || []).find((x) => {
        return x.UUID == this.elementState.UUID;
      }) || null
    );
  }
}

export { CollapseChannel };
