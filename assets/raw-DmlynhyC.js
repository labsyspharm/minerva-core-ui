import { B as BaseDecoder } from './decoder.worker-DskuWaKT.js';

class RawDecoder extends BaseDecoder {
  decodeBlock(buffer) {
    return buffer;
  }
}

export { RawDecoder as default };
