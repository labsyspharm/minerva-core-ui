import { PanelItem } from './panel-item';
import { toElement } from '../../../../lib/elements';
import panelItemGroupCSS from './panel-item-group.css' assert { type: 'css' };
import { RangeEditorChannel } from './range-editor/range-editor-channel'
import { sourceItemMap } from '../../../../items/source-item-map'
import { sourceGroupItems } from '../../../../items/source-group-items'
import { sourceGroupChannels } from '../../../../items/source-group-channels'
import { sourceSourceChannels } from '../../../../items/source-source-channels'
import { useItemIdentifier } from '../../../../filters/use-item-identifier'
import { CollapseGroup } from './collapse/collapse-group';
import { CollapseChannel } from './collapse/collapse-channel';
import { Chart } from './chart/chart';

const itemMap = {
  'group-channels': sourceGroupChannels()
}

class PanelItemGroup extends sourceItemMap(
  itemMap, sourceGroupItems(PanelItem)
) {

  static name = 'panel-item-group'
  static collapseElement = CollapseGroup

  static get _styleSheet() {
    [...PanelItem._styleSheet.cssRules].forEach(
      r => panelItemGroupCSS.insertRule(r.cssText)
    )
    return panelItemGroupCSS;
  }

  get itemIdentifiers() {
    return {
      GroupUUID: this.elementState.UUID
    }
  }

  get itemContents() {
    const rangeEditorElement = this.defineElement(
      RangeEditorChannel, {
        defaults: { UUID: '', GroupUUID:  '' },
        attributes: [ 'dialog' ]
      }
    );
    const collapseChannel = this.defineElement(
      CollapseChannel, {
        defaults: { UUID: '', GroupUUID:  '', expanded: true },
        attributes: [ 'expanded' ]
      }
    );
    const chartElement = this.defineElement(Chart, {
      defaults: { UUID: '' }
    });
    const groupChannels = this.itemMap.get('group-channels');
    const channels = groupChannels.itemSources.map((channel, i) => {
      const source = groupChannels.getSourceChannel(channel);
      const item_title = () => source.Properties.Name;
      const chart = () => {
        return toElement(chartElement)``({
          class: () => `full histogram`,
          UUID: () => source.UUID
        });
      }
      const style = () => {
        const color = groupChannels.getSourceColor(channel);
        const { R, G, B, Space } = color?.Properties || {};
        const rgb = Space !== "sRGB" ? "" : (
          `rgb(${R},${G},${B})`
        );
        return `--slider-background: ${rgb};`;
      }
      const rangeEditor = () => {
        return toElement(rangeEditorElement)``({
          GroupUUID: () => this.itemIdentifiers.GroupUUID,
          UUID: () => channel.UUID,
          style, class: "full"
        });
      }
      return toElement(collapseChannel)`
        <div class="grid one-line" slot="heading">
          <div class="item">
            ${item_title}
          </div>
        </div>
        <div slot="content" class="center grid">
          ${chart} 
          ${rangeEditor}
        </div>
      `({
        expanded: String(channel.State.Expanded),
        GroupUUID: () => this.itemIdentifiers.GroupUUID,
        accordion: 'true',
        UUID: channel.UUID,
        class: 'inner'
      });
    });
    return toElement('div')`${channels}`({
      class: "grid"
    });
  }

  get itemHeading () {
    const itemTitle = () => {
      return toElement('div')`${super.itemHeading}`();
    }
    const channelTitles = () => {
      const groupChannels = this.itemMap.get('group-channels');
      return groupChannels.itemSources.map(channel => {
        if (this.elementState.expanded) {
          return '';
        }
        const source = groupChannels.getSourceChannel(channel);
        const name = () => {
          return source.Properties.Name;
        }
        return toElement('div')`${name}`({
          class: 'flex item'
        });
      })
    }
    const channels = () => {
      return toElement('div')`${channelTitles}`({
        class: 'flex wrap'
      });
    }
    return toElement('div')`${itemTitle}${channels}`({
      class: 'grid'
    })
  }
}

export { PanelItemGroup }
