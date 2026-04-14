const sourceGroupItems = (element = Object) =>
  class extends element {
    get itemSources() {
      return this.elementState.item_registry?.ChannelGroups;
    }
  };

export { sourceGroupItems };
