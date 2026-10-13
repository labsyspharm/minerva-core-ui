import { afterEach, describe, expect, it, vi } from "vitest";

/** Records what each constructed worker was started from. */
class FakeWorker {
  static started: { url: string; options?: WorkerOptions }[] = [];
  constructor(url: string | URL, options?: WorkerOptions) {
    FakeWorker.started.push({ url: String(url), options });
  }
}

async function loadWithPage(origin: string) {
  vi.resetModules();
  FakeWorker.started = [];
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("location", {
    href: `${origin}/stories/crc/index.html`,
    origin,
  });
  const blobs = new Map<string, Blob>();
  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    const url = `blob:${origin}/${blobs.size}`;
    blobs.set(url, blob as Blob);
    return url;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const { SameOriginWorker } = await import("./sameOriginWorker");
  return { SameOriginWorker, blobs };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("SameOriginWorker", () => {
  it("starts a same-origin script directly", async () => {
    const { SameOriginWorker } = await loadWithPage("https://lab.example.org");
    new SameOriginWorker("/bundle/assets/psudo.worker.js", { type: "module" });
    expect(FakeWorker.started).toEqual([
      {
        url: "https://lab.example.org/bundle/assets/psudo.worker.js",
        options: { type: "module" },
      },
    ]);
  });

  it("imports a cross-origin module worker through a same-origin blob", async () => {
    const { SameOriginWorker, blobs } = await loadWithPage(
      "https://lab.example.org",
    );
    const cdn = "https://cdn.jsdelivr.net/npm/minerva-core-ui@1/bundle/w.js";
    new SameOriginWorker(cdn, { type: "module" });
    const [{ url, options }] = FakeWorker.started;
    expect(url.startsWith("blob:https://lab.example.org/")).toBe(true);
    expect(options).toEqual({ type: "module" });
    expect(await blobs.get(url)?.text()).toBe(`import ${JSON.stringify(cdn)};`);
  });

  it("uses importScripts for a cross-origin classic worker", async () => {
    const { SameOriginWorker, blobs } = await loadWithPage(
      "https://lab.example.org",
    );
    const cdn = "https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/worker.js";
    new SameOriginWorker(cdn);
    expect(await blobs.get(FakeWorker.started[0].url)?.text()).toBe(
      `importScripts(${JSON.stringify(cdn)});`,
    );
  });
});
