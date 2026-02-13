import foobarIpsum from "foobar-ipsum";
import nanoid from "../lib/nanoid/nanoid";

const list_colors = (n) => {
  const colors = [
    [13, 171, 255],
    [195, 255, 0],
    [255, 139, 0],
    [255, 0, 199],
  ].map(([r, g, b]) => ({
    R: r,
    G: g,
    B: b,
  }));
  return [...new Array(n).keys()].map(
    i => colors[i%colors.length]
  );
};

const lorem = new foobarIpsum({
  size: {
    sentence: 5,
    paragraph: 6,
  },
});

const to_image = () => {
  // TODO
  return { UUID: nanoid() };
};

const to_source_channel = (image, data_type, index) => {
  return {
    UUID: nanoid(),
    SourceIndex: index,
    Name: lorem.sentence(1),
    Distribution: [...new Array(100)].reduce(
      (d, v) => {
        const delta = 200 - Math.round(Math.random() * 400);
        return [...d, Math.max(0, d.slice(-1)[0] + delta)];
      },
      [500],
    ),
    SourceDataType: {
      ID: data_type.ID,
    },
    SourceImage: {
      UUID: image.UUID,
    },
  };
};

const to_group_channel = (color, channel, expanded) => {
  return {
    UUID: nanoid(),
    State: {
      Expanded: expanded,
    },
    LowerRange: 0,
    UpperRange: 65535,
    SourceChannel: {
      UUID: channel.UUID,
    },
    color
  };
};

const to_group = (source_channels, expanded) => {
  const colors = list_colors(source_channels.length);
  return {
    UUID: nanoid(),
    Name: lorem.sentence(1),
    State: {
      Expanded: expanded,
    },
    GroupChannels: source_channels.map((channel,i) => {
      to_group_channel(colors[i], channel, true);
    })
  };
};

const to_story = (expanded, length = 1) => {
  return {
    UUID: nanoid(),
    Name: lorem.sentence(3),
    Content: [...new Array(length)]
      .map(() => {
        return lorem.paragraph();
      })
      .join("\n\n"),
    State: {
      Expanded: expanded,
    },
  };
};

const to_item_registry = () => {
  const image = to_image();
  const n_channels = 24;

  const data_type = {
    ID: "uint16",
    LowerRange: 0,
    UpperRange: 65535,
  };
  const source_channels = [...new Array(n_channels).keys()].map((_, i) => {
    return to_source_channel(image, data_type, i);
  });
  const groups = [
    to_group(source_channels.slice(0,6), true),
    to_group(source_channels.slice(6,12), true),
    to_group(source_channels.slice(12,18), false),
    to_group(source_channels.slice(18,24), false),
  ];
  return {
    Name: "Example Story",
    Stories: [
      to_story(true, 1),
      to_story(true, 2),
      to_story(true, 3),
      to_story(false, 4),
    ],
    SourceChannels: source_channels,
    Groups: groups,
    Images: [image],
    DataTypes: [data_type],
    Hyperlinks: [],
  };
};

const item_registry = to_item_registry();

export { item_registry };
