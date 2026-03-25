//import { PageRoot } from './page-root.js';
import { toChannelItem } from './channel-item-element.js';
import { toRangeEditor } from './range-editor-element.js';
import { toRangeSlider } from './range-slider-element.js';

const toAuthorElement = (name, opts) => {
  const { ItemRegistry, ID } = opts;
  /* Page Root
  customElements.define(
    "page-root", eventReceiver(
      PageRoot, PageRoot.eventHandlerKeys
    )
  );
  */
  if (name === "channel-item") {
    const { 
      setGroupChannelRange, getSourceDistribution
    } = opts;
    const channelItemElement = `channel-item-${ID}`;
    const rangeEditorElement = `range-editor-${ID}`;
    const rangeSliderElement = `range-slider-${ID}`;
    customElements.define(
      rangeSliderElement, toRangeSlider()
    );
    customElements.define(
      rangeEditorElement, (
        toRangeEditor(
          ItemRegistry,
          setGroupChannelRange, {
          "range-slider": rangeSliderElement
          }
        )
      )
    );
    customElements.define(
      channelItemElement, (
        toChannelItem(
          ItemRegistry, 
          getSourceDistribution,
          {
            "range-editor": rangeEditorElement
          }
        )
      )
    );
    return channelItemElement;
  }
  return null 
};


export { toAuthorElement }
