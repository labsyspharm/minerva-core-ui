import { PanelContent } from "./panel-content";
import { PanelStory } from "./panel/panel-story";
import { toElement } from "../../../lib/elements";

class PanelContentStory extends PanelContent {
  static name = "panel-content-story";
  //static panelElement = PanelStory

  get elementDescription() {
    const { item_registry } = this.elementState;
    return item_registry.Name;
  }

  get elementTemplate() {
    return toElement("div")`
      <slot name="waypoints"></slot>
    `();
  }
}

export { PanelContentStory };
