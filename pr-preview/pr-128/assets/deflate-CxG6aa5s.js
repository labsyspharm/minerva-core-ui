import { i as inflate_1 } from "./pako.esm-KbdoS3Oq.js";
import { B as BaseDecoder } from "./index-D79a3oya.js";
class DeflateDecoder extends BaseDecoder {
  decodeBlock(buffer) {
    return inflate_1(new Uint8Array(buffer)).buffer;
  }
}
export {
  DeflateDecoder as default
};
