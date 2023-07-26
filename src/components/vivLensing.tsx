import { LensExtension, ScaleBarLayer } from "@hms-dbmi/viv";
// import { getDefaultPalette, padColors } from '../utils';

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
  draw() {
    super.draw();
    const otherCoordinates = [100,200]; // Use the bounds below to convert these arbitrary screen coordinast to lensCenter
    const { unprojectLensBounds = [0, 0, 0, 0] } = this.state;
    const { bounds } = this.props;
    const [leftMouseBound, bottomMouseBound, rightMouseBound, topMouseBound] =
      unprojectLensBounds;
    const [left, bottom, right, top] = bounds;
    const leftMouseBoundScaled = (leftMouseBound - left) / (right - left);
    const bottomMouseBoundScaled = (bottomMouseBound - top) / (bottom - top);
    const rightMouseBoundScaled = (rightMouseBound - left) / (right - left);
    const topMouseBoundScaled = (topMouseBound - top) / (bottom - top);
    const majorLensAxis = (rightMouseBoundScaled - leftMouseBoundScaled) / 2;
    const minorLensAxis = (bottomMouseBoundScaled - topMouseBoundScaled) / 2;
    const lensCenter = [
      (rightMouseBoundScaled + leftMouseBoundScaled) / 2,
      (bottomMouseBoundScaled + topMouseBoundScaled) / 2
    ];
    // console.log('draw', this) 
  }
};
export { VivLensing };
