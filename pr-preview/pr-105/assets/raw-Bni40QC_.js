import { B as BaseDecoder } from "./index-DvBabS88.js";
class RawDecoder extends BaseDecoder {
  decodeBlock(buffer) {
    return buffer;
  }
}
export {
  RawDecoder as default
};
