import { addDecoder, getDecoder } from 'geotiff';
import { LZWDecoder } from './decoders.ts';


// addDecoder([undefined, 1], () => Promise.resolve(RawDecoder));
// addDecoder(5, () => Promise.resolve(LZWDecoder), true);


// @ts-expect-error - We are in a worker context
const worker: ServiceWorker = self;

worker.addEventListener('message', async e => {
  addDecoder(5, () => Promise.resolve(LZWDecoder), true);
  // addDecoder([undefined, 1], () => Promise.resolve(RawDecoder));
  // @ts-expect-error - FIXME: we should have strict types
  const { jobId, fileDirectory, buffer } = e.data;
  const decoder = await getDecoder(fileDirectory);
  const decoded = await decoder.decode(fileDirectory, buffer);
  console.log('decoded', decoder, decoded);
  worker.postMessage({ decoded, jobId }, [decoded]);
});
