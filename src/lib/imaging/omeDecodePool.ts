import { type DecodePool, Pool } from "@hms-dbmi/viv";
import DecoderWorker from "./workers/decoder.worker?worker";

export type { DecodePool };

/** Viv Pool, with a Vite `?worker` factory so the CDN IIFE can inline the decoder. */
export function createOmeDecodePool(): DecodePool {
  return new Pool(undefined, () => new DecoderWorker() as Worker);
}
