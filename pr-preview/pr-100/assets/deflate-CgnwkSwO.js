import { i as inflate_1 } from "./pako.esm-KbdoS3Oq.js";
import { B as BaseDecoder } from "./index-PB8e2UgU.js";
class DeflateDecoder extends BaseDecoder {
  decodeBlock(buffer) {
    return inflate_1(new Uint8Array(buffer)).buffer;
  }
}
export {
  DeflateDecoder as default
};
