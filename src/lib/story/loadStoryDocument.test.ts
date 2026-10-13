import { beforeEach, describe, expect, it, vi } from "vitest";
import { hydrateDocumentLoaders } from "@/lib/imaging/hydrateDocumentLoaders";
import type { DocumentData } from "@/lib/stores/documentSchema";
import { useDocumentStore } from "@/lib/stores/documentStore";
import { loadStoryDocument } from "./loadStoryDocument";

vi.mock("@/lib/featureTable", () => ({
  hydrateFeatureTables: vi.fn(async () => {}),
}));
vi.mock("@/lib/imaging/hydrateDocumentLoaders", () => ({
  hydrateDocumentLoaders: vi.fn(async () => ({
    jpegLoaderEntries: [],
    omeLoaderEntries: [],
    dicomIndexList: [],
  })),
}));

const story = (title: string) => ({
  metadata: { title },
  images: [],
  channelGroups: [],
  waypoints: [],
  shapes: [],
  featureTables: [],
});

/** `fetch` that answers only when `respond` is called (and ignores abort). */
function deferredFetch() {
  let respond: (body: unknown) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          respond = (body) => resolve(Response.json(body));
        }),
    ),
  );
  return { respond: (body: unknown) => respond(body) };
}

const shownTitle = () => useDocumentStore.getState().metadata.title;

beforeEach(() => {
  vi.unstubAllGlobals();
  useDocumentStore
    .getState()
    .hydrateFromDocument(story("A") as DocumentData, crypto.randomUUID());
});

describe("loadStoryDocument", () => {
  it("shows the story and returns its loaders", async () => {
    const server = deferredFetch();
    const onDocument = vi.fn();
    const loading = loadStoryDocument("https://example.org/b.json", {
      onDocument,
    });
    server.respond(story("B"));
    await expect(loading).resolves.toMatchObject({ omeLoaderEntries: [] });
    expect(shownTitle()).toBe("B");
    expect(onDocument).toHaveBeenCalledOnce();
  });

  it("leaves the stores alone when aborted before the document arrives", async () => {
    // A slow, superseded load must not replace the story shown after it.
    const server = deferredFetch();
    const abort = new AbortController();
    const onDocument = vi.fn();
    const loading = loadStoryDocument("https://example.org/b.json", {
      signal: abort.signal,
      onDocument,
    });
    abort.abort();
    server.respond(story("B"));
    await expect(loading).rejects.toMatchObject({ name: "AbortError" });
    expect(shownTitle()).toBe("A");
    expect(onDocument).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("https://example.org/b.json", {
      signal: abort.signal,
    });
  });

  it("rejects instead of returning loaders when aborted while images open", async () => {
    const server = deferredFetch();
    const abort = new AbortController();
    vi.mocked(hydrateDocumentLoaders).mockImplementationOnce(async () => {
      abort.abort();
      return {
        jpegLoaderEntries: [],
        omeLoaderEntries: [],
        dicomIndexList: [],
        deniedHandleKeys: [],
        missingHandleKeys: [],
        loaderErrors: [],
      };
    });
    const loading = loadStoryDocument("https://example.org/b.json", {
      signal: abort.signal,
    });
    server.respond(story("B"));
    await expect(loading).rejects.toMatchObject({ name: "AbortError" });
  });
});
