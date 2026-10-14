/**
 * `Worker` that also starts scripts from another origin, as when the story
 * bundle is served from a CDN. Browsers refuse cross-origin worker URLs, so a
 * same-origin blob loads the real script with `import`.
 */
export class SameOriginWorker extends Worker {
  constructor(scriptURL: string | URL, options?: WorkerOptions) {
    const url = new URL(scriptURL, location.href);
    if (url.origin === location.origin || url.protocol === "data:") {
      super(url, options);
      return;
    }
    // Revoke from inside the worker. Revoking here races WebKit's blob fetch.
    const source = `URL.revokeObjectURL(self.location.href);import ${JSON.stringify(url.href)};`;
    const blob = URL.createObjectURL(
      new Blob([source], { type: "text/javascript" }),
    );
    try {
      super(blob, options);
    } catch (e) {
      URL.revokeObjectURL(blob);
      throw e;
    }
  }
}
