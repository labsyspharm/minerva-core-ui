import panelContentImageCSS from "./panel-content-image.module.css" with {
  type: "css",
};
import { toElement } from "../../../lib/elements";

class PanelContentImage extends HTMLElement {
  static name = "panel-content-image";

  static get _styleSheet() {
    return panelContentImageCSS;
  }

  get elementTemplate() {
    return toElement("div")`
      <slot name="images"></slot>
    `();
  }
}

export { PanelContentImage };
