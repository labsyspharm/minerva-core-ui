import navCSS from "./nav.module.css" with { type: "css" };
import { toElement } from "../../../lib/elements";

/** Opens the export dialog; kept in sync with `nav-config` / `dialog_notices`. */
const EXPORT_DIALOG_ID = "EXPORT-DIALOG";

class Nav extends HTMLElement {
  static name = "nav";

  get elementTemplate() {
    const { tab_order } = this.elementState;
    const tab_items = this.itemsTemplate(tab_order, "tab");

    const overflow_trigger = toElement("button")`
      <span class="bar"></span>
      <span class="bar"></span>
      <span class="bar"></span>
    `({
      type: "button",
      class: "hamburger",
      "aria-label": "Menu",
      "aria-expanded": () =>
        this.elementState.overflowMenuOpen ? "true" : "false",
      "@click": (event) => {
        event.stopPropagation();
        this.elementState.overflowMenuOpen =
          !this.elementState.overflowMenuOpen;
      },
    });

    const export_btn = toElement("button")`
      <span>${() => {
        const { nav_config } = this.elementState;
        return nav_config[EXPORT_DIALOG_ID].label;
      }}</span>
    `({
      type: "button",
      class: "overflow-menu-item",
      "@click": (event) => {
        event.stopPropagation();
        this.elementState.overflowMenuOpen = false;
        this.elementState.dialog = EXPORT_DIALOG_ID;
      },
    });

    const dropdown = toElement("div")`
      ${export_btn}
    `({
      class: () =>
        this.elementState.overflowMenuOpen
          ? "overflow-dropdown open"
          : "overflow-dropdown",
      "aria-hidden": () =>
        this.elementState.overflowMenuOpen ? "false" : "true",
    });

    const overflow_wrap = toElement("div")`
      ${overflow_trigger}
      ${dropdown}
    `({
      class: "overflow-wrap",
    });

    return toElement("div")`
      <div class="stretch grid menu tabs tab-row">
        ${overflow_wrap}
        <div class="stretch grid menu tabs tab-strip">
          ${() => tab_items}
        </div>
      </div>
    `({
      class: "contents",
    });
  }
  itemsTemplate(item_list, role) {
    const { nav_config } = this.elementState;
    return item_list.map((item_id, i) => {
      const item = nav_config[item_id];
      const item_class = () => {
        return `center grid menu ${role}`;
      };
      return toElement("div")`
      <button class="${item_class}" role="${role}">
        <span>${() => item.label}</span>
      </button>`({
        class: "stretch grid menu",
        chosen: () => {
          const { tab, dialog } = this.elementState;
          return [tab, dialog].includes(item.id);
        },
        "@click": () => {
          const { nav_config } = this.elementState;
          const { role } = nav_config[item.id];
          this.elementState[role] = item.id;
        },
      });
    });
  }

  static get _styleSheet() {
    return navCSS;
  }
}

export { Nav };
