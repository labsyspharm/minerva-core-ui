import { B as BaseDecoder } from "./index-DP_NZupe.js";
class RawDecoder extends BaseDecoder {
  decodeBlock(buffer) {
    return buffer;
  }
}
export {
  RawDecoder as default
};
