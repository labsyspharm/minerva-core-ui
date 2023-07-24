import { LensExtension, ScaleBarLayer} from "@hms-dbmi/viv";
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
// Return a float for boolean arithmetic calculation.
float get_use_color_float(vec2 vTexCoord, int channelIndex) {
  bool isFragInLensBounds = frag_in_lens_bounds(vTexCoord);
  bool inLensAndUseLens = lensEnabled && isFragInLensBounds;
  bool isSelectedChannel = channelIndex == lensSelection;
  return float(int((inLensAndUseLens && isSelectedChannel) || (!inLensAndUseLens && !isSelectedChannel)));
//   return 1.0;
 
}

vec3 get_color(vec2 vTexCoord, int channelIndex) {
  float useColorValue = get_use_color_float(vTexCoord, channelIndex);
  return mix(vec3(0., 0., 0.), vec3(colors[channelIndex]), useColorValue);
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
          bool isFragOnLensBounds = frag_on_lens_bounds(vTexCoord);
         gl_FragColor = (lensEnabled && isFragOnLensBounds) ? vec4(lensBorderColor, 1.) : gl_FragColor;
      `,
          },
        },
      ],
    };
  }
};
export { VivLensing };
