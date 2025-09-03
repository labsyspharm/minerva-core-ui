import Worker from './worker.js?worker';
import { fetchFrame } from './fetch-frame';
import { Pool } from 'geotiff';

/*
const defaultPoolSize = (
  globalThis?.navigator?.hardwareConcurrency ?? 4
);
*/

const defaultPoolSize = 0; // TODO

function createWorker() {
  return new Worker('./worker.js');
}

class FetchPool extends Pool {
  constructor() {
    super(defaultPoolSize, createWorker);
    this.subpathCounts = new Map();
  }

  async fetch({ series, subpath, signal }) {
    if (signal.aborted) {
      throw new Error("Request Aborted");
    }
    if (this._awaitingDecoder) {
      await this._awaitingDecoder;
    }
    if (signal.aborted) {
      throw new Error("Request Aborted");
    }
    const count = this.subpathCounts.get(subpath) || 0;
    if (this.size === 0) {
      const fetched = await fetchFrame(
        { series, subpath }
      );
      this.subpathCounts = new Map([
        ...this.subpathCounts,
        [ subpath, count + 1 ]
      ]);
      return fetched;
    }
    if (signal.aborted) {
      throw new Error("Request Aborted");
    }
    return (
      new Promise((resolve) => {
        const worker = this.workers.find(
          candidate => candidate.idle
        ) || this.workers[
          Math.floor(Math.random() * this.size)
        ];
        worker.idle = false;
        const id = this.messageId++;
        const onMessage = (e) => {
          if (e.data.id === id) {
            worker.idle = true;
            resolve(e.data.fetched);
            worker.worker.removeEventListener('message', onMessage);
          }
        };
        worker.worker.addEventListener('message', onMessage);
        worker.worker.postMessage({
          series, subpath
        });
      })
    );
  }
}

export { FetchPool }
