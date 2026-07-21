import { i as inflate_1 } from "./pako.esm-KbdoS3Oq.js";
import { B as BaseDecoder } from "./index-1yg7D3na.js";
class DeflateDecoder extends BaseDecoder {
  decodeBlock(buffer) {
    return inflate_1(new Uint8Array(buffer)).buffer;
  }
}
export {
  DeflateDecoder as default
};
