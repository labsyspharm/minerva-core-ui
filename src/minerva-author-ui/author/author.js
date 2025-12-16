import authorCSS from './author.module.css' with { type: "css" };
import { toElement } from '../lib/elements';
import { PanelGrid } from './panel-grid/panel-grid';
import { NoticeGrid } from './notice-grid/notice-grid';

class Author extends HTMLElement {
  static name = 'author'

  static get _styleSheet() {
    return authorCSS;
  }

  get elementTemplate() {
    const notice_grid = this.defineElement(NoticeGrid, {
      attributes: ['open']
    });
    const panel_grid = this.defineElement(PanelGrid, {
      attributes: ['expanded'],
      defaults: { expanded: true }
    });
    return toElement('div')`
      <slot name="image"></slot>
      <${panel_grid} class="stretch grid panel outer">
        <slot slot="overlays" name="overlays"></slot>
        <slot slot="waypoints" name="waypoints"></slot>
      </${panel_grid}>
      <${notice_grid} class="notice" open="${
        () => this.elementState.notice != ''
      }"></${notice_grid}>
    `({
      class: 'root stretch grid'
    });
  }
}

export { Author };
