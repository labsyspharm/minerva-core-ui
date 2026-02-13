import { sourceSourceChannels } from "./source-source-channels";
import { sourceColors } from "./source-colors";

const sourceGroupChannels = (element = Object) =>
  class extends element {
    get itemSources() {
      const groups = this.elementState.item_registry?.Groups;
      const group = Object.values(groups).find(({ UUID }) => {
        return UUID == this.itemIdentifiers.GroupUUID;
      }) || null;
      return group ? group.GroupChannels : [];
    }

    getSourceChannel(group_channel) {
      const source_channel = group_channel.SourceChannel;
      const source = new (sourceSourceChannels(Object))();
      source.elementState = this.elementState;
      return (
        source.itemSources.find(({ UUID }) => {
          return UUID == source_channel.UUID;
        }) || null
      );
    }

    getSourceDistribution(group_channel) {
      const source_channel = this.getSourceChannel(group_channel);
      const source = new (sourceSourceChannels(Object))();
      source.elementState = this.elementState;
      if (source_channel) {
        return source.getSourceDistribution(source_channel);
      }
      return null;
    }

    getSourceDataType(group_channel) {
      const source_channel = this.getSourceChannel(group_channel);
      const source = new (sourceSourceChannels(Object))();
      source.elementState = this.elementState;
      if (source_channel) {
        return source.getSourceDataType(source_channel);
      }
      return null;
    }

  };

export { sourceGroupChannels };
