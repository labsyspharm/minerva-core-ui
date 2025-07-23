import { fetchFrame } from './fetch-frame';

const worker = self;

worker.addEventListener('message', async e => {
  const fetched = await fetchFrame(e);
  worker.postMessage({ fetched }, [fetched]);
});
