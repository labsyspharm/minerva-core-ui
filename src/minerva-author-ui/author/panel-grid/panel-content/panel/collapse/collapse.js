import collapseCSS from "./collapse.module.css" with { type: "css" };
import { updateElementState } from "../../../../../lib/element-state";
import { A11yCollapse } from "@haxtheweb/a11y-collapse";

class Collapse extends A11yCollapse {
  static name = "collapse";

  static get _styleSheet() {
    return collapseCSS;
  }

  connectedCallback() {
    super.connectedCallback();
    this.expanded = this.expanded;
    this.addEventListener("a11y-collapse-attached", () => {
      const icon = this.shadowRoot.querySelector("#expand");
      icon.removeAttribute("aria-hidden");
      icon.setAttribute("tabindex", "1");
    });
  }

  get itemSource() {
    return null;
  }

  get expanded() {
    const item = this.itemSource;
    if (item) {
      return this.getItemState("Expanded");
    }
    return false;
  }

  set expanded(v) {
    const item = this.itemSource;
    if (item) {
      this.setItemState("Expanded", v);
    }
    const prefix = "icons:radio-button-";
    this.icon = prefix + ["unchecked", "checked"][+v];
    return true;
  }
  setItemState(item_key, value) {
    const { State = {} } = this.itemSource;
    State[item_key] = value;
    const key = {
      "Expanded": "expanded"
    }[item_key] || item_key;
    updateElementState(this.elementState, key, value);
  }
}

export { Collapse };
