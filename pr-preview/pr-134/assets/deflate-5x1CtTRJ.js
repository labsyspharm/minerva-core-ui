import { i as inflate_1 } from './pako.esm-KbdoS3Oq.js';
import { B as BaseDecoder } from './decoder.worker-C5_45Yb3.js';

class DeflateDecoder extends BaseDecoder {
  decodeBlock(buffer) {
    return inflate_1(new Uint8Array(buffer)).buffer;
  }
}

export { DeflateDecoder as default };
