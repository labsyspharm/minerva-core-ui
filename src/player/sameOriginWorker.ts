/**
 * `Worker` that also starts scripts from another origin, as when the story
 * bundle is served from a CDN. Browsers refuse cross-origin worker URLs, so a
 * same-origin blob loads the real script (`import` for module workers,
 * `importScripts` for classic ones).
 */
export class SameOriginWorker extends Worker {
  constructor(scriptURL: string | URL, options?: WorkerOptions) {
    const url = new URL(scriptURL, location.href);
    if (url.origin === location.origin || url.protocol === "data:") {
      super(url, options);
      return;
    }
    // Revoke from inside the worker. Revoking here races WebKit's blob fetch.
    const revoke = "URL.revokeObjectURL(self.location.href);";
    const source =
      options?.type === "module"
        ? `${revoke}import ${JSON.stringify(url.href)};`
        : `${revoke}importScripts(${JSON.stringify(url.href)});`;
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
