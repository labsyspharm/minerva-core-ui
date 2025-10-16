import { sourceSourceChannels } from './source-source-channels';
import { sourceColors } from './source-colors';

const sourceGroupChannels = (element=Object) => (
  class extends element {

    get itemSources() {
      const group_channels = this.elementState.item_registry?.GroupChannels;
      return (group_channels || []).filter(({ Associations: x }) => {
        return x.Group.UUID == this.itemIdentifiers.GroupUUID; 
      });
    }

    getSourceChannel(group_channel) {
      const source_channel = group_channel.Associations.SourceChannel;
      const source = new (sourceSourceChannels(Object));
      source.elementState = this.elementState;
      return source.itemSources.find(({ UUID }) => {
        return UUID == source_channel.UUID;
      }) || null;
    }

    getSourceDistribution(group_channel) {
      const source_channel = this.getSourceChannel(group_channel);
      const source = new (sourceSourceChannels(Object));
      source.elementState = this.elementState;
      if (source_channel) {
        return source.getSourceDistribution(source_channel);
      }
      return null;
    }

    getSourceDataType(group_channel) {
      const source_channel = this.getSourceChannel(group_channel);
      const source = new (sourceSourceChannels(Object));
      source.elementState = this.elementState;
      if (source_channel) {
        return source.getSourceDataType(source_channel);
      }
      return null;
    }
    
    getSourceColor(group_channel) {
      const color = group_channel.Associations.Color;
      const source = new (sourceColors(Object));
      source.elementState = this.elementState;
      return source.itemSources.find(({ ID }) => {
        return ID === color?.ID;
      }) || null;
    }
  }
)

export { sourceGroupChannels }
