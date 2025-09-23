import { Pool } from 'geotiff';


// https://developer.mozilla.org/en-US/docs/Web/API/NavigatorConcurrentHardware/hardwareConcurrency
// We need to give a different way of getting this for safari, so 4 is probably a safe bet
// for parallel processing in the meantime.  More can't really hurt since they'll just block
// each other and not the UI thread, which is the real benefit.
const defaultPoolSize = globalThis?.navigator?.hardwareConcurrency ?? 4;

function createWorker() {
  console.log('createWorker');
  return new Worker(new URL('./decoder.worker.ts', import.meta.url), { type: 'module' });
}

export default class extends Pool {
  constructor(numWorkers: number) {
    super(numWorkers || defaultPoolSize, createWorker);

  }
}

