import nanoid from '../lib/nanoid/nanoid'

const sourceHyperlinkItems = (element=Object) => (
  class extends element {
    get itemSources () {
      return this.elementState.item_registry?.Hyperlinks;
    }
    addNewItemSource ({ url })  {
      const UUID = nanoid(); 
      this.itemSources.push({ url, UUID });
      return UUID;
    }
  }
)

export { sourceHyperlinkItems }
