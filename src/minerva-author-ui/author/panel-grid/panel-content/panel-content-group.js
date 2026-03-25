import panelContentGroupCSS from "./panel-content-group.module.css" with {
  type: "css",
};
import { toElement } from "../../../lib/elements";

class PanelContentGroup extends HTMLElement {
  static name = "panel-content-group";

  static get _styleSheet() {
    return panelContentGroupCSS;
  }

  get elementTemplate() {
    return toElement("div")`
      <slot name="groups"></slot>
    `();
  }
}


export { PanelContentGroup };
