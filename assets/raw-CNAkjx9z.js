import { B as BaseDecoder } from "./index-DI4Iot3g.js";
class RawDecoder extends BaseDecoder {
  decodeBlock(buffer) {
    return buffer;
  }
}
export {
  RawDecoder as default
};
