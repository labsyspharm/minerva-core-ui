import {LayerExtension} from '@deck.gl/core';

class DimmerExtension extends LayerExtension {
  getShaders() {
    return {
      ...super.getShaders(),
      inject: {
        "fs:DECKGL_FILTER_COLOR": `
          color = vec4(1.0, 0.0, 0.0, 1.0);
        `,
      },
    };
  }
}

export { DimmerExtension };
