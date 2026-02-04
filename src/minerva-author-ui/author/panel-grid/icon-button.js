import iconButtonCSS from "./icon-button.module.css" with { type: "css" };
import { SimpleIconButtonLite } from "@haxtheweb/simple-icon/lib/simple-icon-button-lite.js";

class IconButton extends SimpleIconButtonLite {
  static name = "icon-button";

  static get _styleSheet() {
    return iconButtonCSS;
  }
}

export { IconButton };
