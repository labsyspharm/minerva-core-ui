import fieldCSS from './text-field.module.css' with { type: 'css' };
import { TextField as TF } from '@vaadin/text-field';

class TextField extends TF {
  static name = 'text-field'

  static get _styleSheet() {
    return fieldCSS;
  }
}

export { TextField }
