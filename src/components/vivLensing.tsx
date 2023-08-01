import { LensExtension } from "@hms-dbmi/viv";


const defaultProps = {
  lensEnabled: { type: 'boolean', value: false, compare: true },
  lensSelection: { type: 'number', value: 0, compare: true },
  lensRadius: { type: 'number', value: 100, compare: true },
  lensBorderColor: { type: 'array', value: [255, 255, 255], compare: true },
  lensBorderRadius: { type: 'number', value: 0.02, compare: true },
  colors: { type: 'array', value: null, compare: true }
};


const fs = `\
// lens bounds for ellipse
uniform float majorLensAxis;
uniform float minorLensAxis;
uniform vec2 lensCenter;

// lens uniforms
uniform bool lensEnabled;
uniform int lensSelection;
uniform vec3 lensBorderColor;
uniform float lensBorderRadius;

// color palette
uniform vec3 colors[6];

bool frag_in_lens_bounds(vec2 vTexCoord) {
  // Check membership in what is (not visually, but effectively) an ellipse.
  // Since the fragment space is a unit square and the real coordinates could be longer than tall,
  // to get a circle visually we have to treat the check as that of an ellipse to get the effect of a circle.

  // Check membership in ellipse.
  return pow((lensCenter.x - vTexCoord.x) / majorLensAxis, 2.) + pow((lensCenter.y - vTexCoord.y) / minorLensAxis, 2.) < (1. - lensBorderRadius);
}

bool frag_on_lens_bounds(vec2 vTexCoord) {
  // Same as the above, except this checks the boundary.

  float ellipseDistance = pow((lensCenter.x - vTexCoord.x) / majorLensAxis, 2.) + pow((lensCenter.y - vTexCoord.y) / minorLensAxis, 2.);

  // Check membership on "bourndary" of ellipse.
  return ellipseDistance <= 1. && ellipseDistance >= (1. - lensBorderRadius);
}

// gets color relative to lens selection and lens opacity
vec3 get_color(vec2 vTexCoord, int channelIndex) {
  float lensOpacity = 1.00;
  bool isFragInLensBounds = frag_in_lens_bounds(vTexCoord);
  bool inLensAndUseLens = lensEnabled && isFragInLensBounds;
  bool isSelectedChannel = channelIndex == lensSelection;
  float factorOutside = 1.0 - float(isSelectedChannel);
  float factorInside = isSelectedChannel ? lensOpacity : (1.0 - lensOpacity);
  float factor = inLensAndUseLens ? factorInside : factorOutside;
  return factor * colors[channelIndex];
}


void mutate_color(inout vec3 rgb, float intensity0, float intensity1, float intensity2, float intensity3, float intensity4, float intensity5, vec2 vTexCoord){

  rgb += max(0., min(1., intensity0)) * get_color(vTexCoord, 0);
  rgb += max(0., min(1., intensity1)) * get_color(vTexCoord, 1);
  rgb += max(0., min(1., intensity2)) * get_color(vTexCoord, 2);
  rgb += max(0., min(1., intensity3)) * get_color(vTexCoord, 3);
  rgb += max(0., min(1., intensity4)) * get_color(vTexCoord, 4);
  rgb += max(0., min(1., intensity5)) * get_color(vTexCoord, 5);


}
`;


const VivLensing = class extends LensExtension {

  state: any;
  props: any;
  context: any;
  getCurrentLayer: any;
  defaultProps: any;
  parent: any;


  getShaders() {
    return {
      ...super.getShaders(),
      modules: [
        {
          name: "lens-module",
          fs,
          inject: {
            "fs:DECKGL_MUTATE_COLOR": `
       vec3 rgb = rgba.rgb;
       mutate_color(rgb, intensity0, intensity1, intensity2, intensity3, intensity4, intensity5, vTexCoord);
       rgba = vec4(rgb, 1.);
      `,
            "fs:#main-end": `
        //   bool isFragOnLensBounds = frag_on_lens_bounds(vTexCoord);
        //  gl_FragColor = (lensEnabled && isFragOnLensBounds) ? vec4(lensBorderColor, 1.) : gl_FragColor;
      `,
          },
        },
      ],
    };
  }
  initializeState() {
    // super.initializeState();
    if (this.context.deck) {
      this.context.deck.eventManager.on({
        pan: () => null,
        pointermove: () => null,
        pointerleave: () => null,
        wheel: () => null
      });
    }
  }

  draw(): void {
    const layer = this.getCurrentLayer();
    const { viewportId } = layer.props;
    const { lensRadius = defaultProps.lensRadius.value } = this.props;
    // If there is no viewportId, don't try to do anything.
    if (!viewportId) {
      layer.setState({ unprojectLensBounds: [0, 0, 0, 0] });
      return;
    }
    const mousePosition = { x: this.parent.context.userData.mousePosition[0], y: this.parent.context.userData.mousePosition[1] };
    const layerView = layer.context.deck.viewManager.views.filter(
      view => view.id === viewportId
    )[0];
    const viewState = layer.context.deck.viewManager.viewState[viewportId];
    const viewport = layerView.makeViewport({
      ...viewState,
      viewState
    });
    // If the mouse is in the viewport and the mousePosition exists, set
    // the state with the bounding box of the circle that will render as a lens.
    if (mousePosition && viewport.containsPixel(mousePosition)) {
      const offsetMousePosition = {
        x: mousePosition.x - viewport.x,
        y: mousePosition.y - viewport.y
      };
      const mousePositionBounds = [
        // left
        [offsetMousePosition.x - lensRadius, offsetMousePosition.y],
        // bottom
        [offsetMousePosition.x, offsetMousePosition.y + lensRadius],
        // right
        [offsetMousePosition.x + lensRadius, offsetMousePosition.y],
        // top
        [offsetMousePosition.x, offsetMousePosition.y - lensRadius]
      ];
      // Unproject from screen to world coordinates.
      const unprojectLensBounds = mousePositionBounds.map(
        (bounds, i) => viewport.unproject(bounds)[i % 2]
      );
      layer.setState({ unprojectLensBounds });
    } else {
      layer.setState({ unprojectLensBounds: [0, 0, 0, 0] });
    }
    super.draw();
  }



};



export { VivLensing };
