import dialogContentCSS from './dialog-content.module.css' with { type: 'css' };
import { toElement } from '../../../../lib/elements';
import { Dialog } from './dialog/dialog';

class DialogContent extends HTMLElement {
  static name = 'dialog-content'
  static dialogElement = Dialog

  static get _styleSheet() {
    return dialogContentCSS;
  }

  get elementTemplate() {
    const el = this.defineElement(
      this.constructor.dialogElement
    );
    const content = () => {
      return toElement(el)``({});
    }
    return toElement('div')`
      ${content}
    `({});
  }
}

export { DialogContent }
