interface LensMagnifier {
  update(i: number, index: number, lensing: Lensing): void;
}

type Lens = {
  selections: {
    magnifier: LensMagnifier;
  };
};

interface ViewFinderSetup {
  wrangle(): void;
  render(): void;
}

type Lensing = {
  lenses: Lens;
  viewfinder: {
    setup: ViewFinderSetup;
  };
};

const filters = [
  // Channel groups
  {
    data: [],
    name: "fil_channel_groups",
    vis_name: "Channel groups",
    settings: {
      active: 1,
      async: true,
      default: 1,
      loading: false,
      max: 1,
      min: 0,
      step: 1,
      vf: true,
      vf_setup: "vis_data_template",
      iter: "px",
    },
    variables: {},
    set_pixel: (lensing: Lensing) => {
      // Trigger update
      lensing.viewfinder.setup.wrangle();
      lensing.viewfinder.setup.render();
    },
    update: (i, index, lensing: Lensing) => {
      // Magnify (simply pass through after filter)
      lensing.lenses.selections.magnifier.update(i, index, lensing);
    },
    fill: "rgba(255, 255, 255, 0)",
    stroke: "rgba(0, 0, 0, 1)",
  },
];

export default filters;
