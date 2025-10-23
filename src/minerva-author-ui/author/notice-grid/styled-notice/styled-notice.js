import styledNoticeCSS from './styled-notice.module.css' with { type: 'css' };
import { WebDialog } from 'web-dialog';

class StyledNotice extends WebDialog {
  static name = 'styled-notice'

  static get _styleSheet() {
    return styledNoticeCSS;
  }
}

export { StyledNotice }
