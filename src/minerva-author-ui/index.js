//import { PageRoot } from './page-root.js';
import { toChannelItem } from './channel-item-element.js';

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
    const channelItemElement = `channel-item-${ID}`;
    customElements.define(
      channelItemElement, (
        toChannelItem(ItemRegistry)
      )
    );
    return channelItemElement;
  }
  return null 
};


const eventSender = (element) => {
  return class extends element {
    sendCustomEvent(key, detail) {
      this.shadowRoot.dispatchEvent(
        new CustomEvent(
          key, {
            detail, bubbles: true, composed: true
          }
        )
      );
    }
  }
}

const eventReceiver = (element, keys=[]) => {
  return class extends element {
    async connectedCallback() {
      await super.connectedCallback();
      keys.forEach(
        key => this.addEventListener(
          key, this.toEventHandler(key)
        )
      )
    }
  }
}

export { toAuthorElement }
