// @vitest-environment jsdom
import { act, createRef, type ReactNode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MinervaHandle } from "@/api/controller";
import type { MinervaState } from "@/api/state";
import type { OmeLoaderEntry } from "@/lib/imaging/loaderEntries";
import {
  loadStoryDocument,
  type StoryDocumentInput,
} from "@/lib/story/loadStoryDocument";
import { MinervaStory, sameStoryDocument } from "./MinervaStory";

// The viewer needs WebGL; these tests are about which story loads when.
vi.mock("@/components/playback/StoryPlaybackView", () => ({
  StoryPlaybackView: () => null,
}));
vi.mock("@/components/playback/Presentation", () => ({
  Presentation: (props: { children: ReactNode }) => props.children,
}));
vi.mock("@/lib/story/loadStoryDocument", () => ({
  loadStoryDocument: vi.fn(),
}));

type Load = {
  input: StoryDocumentInput;
  signal?: AbortSignal;
  /** Document in the stores (`onDocument`), then images opened. */
  finish: () => Promise<void>;
};
let loads: Load[] = [];

beforeEach(() => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  loads = [];
  vi.mocked(loadStoryDocument).mockImplementation(
    (input, opts) =>
      new Promise((resolve) => {
        loads.push({
          input,
          signal: opts?.signal,
          finish: () =>
            act(async () => {
              opts?.onDocument?.();
              resolve({
                jpegLoaderEntries: [],
                omeLoaderEntries: [{} as OmeLoaderEntry],
                dicomIndexList: [],
              });
            }),
        });
      }),
  );
});

let root: Root | null = null;
const render = (node: ReactNode) =>
  act(async () => {
    if (!root) root = createRoot(document.createElement("div"));
    root.render(node);
  });
afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
});

describe("sameStoryDocument", () => {
  it("compares URLs by value and documents by content", () => {
    expect(sameStoryDocument("a.json", "a.json")).toBe(true);
    expect(sameStoryDocument("a.json", "b.json")).toBe(false);
    expect(sameStoryDocument({ a: 1 }, { a: 1 })).toBe(true);
    expect(sameStoryDocument({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameStoryDocument("a.json", { a: 1 })).toBe(false);
  });
});

describe("<MinervaStory> loading", () => {
  it("keeps the story when the host re-renders with an equal new object", async () => {
    // The pattern that froze host pages: a fresh document object every
    // render, and a re-render on every state change.
    const story = { metadata: { title: "A" } };
    let seen = 0;
    function Host() {
      const [, setState] = useState<MinervaState | null>(null);
      return (
        <MinervaStory
          document={{ ...story }}
          onStateChange={(s) => {
            seen += 1;
            setState(s);
          }}
        />
      );
    }
    await render(<Host />);
    await loads[0].finish();
    expect(seen).toBeGreaterThan(0);
    expect(loads).toHaveLength(1);

    await render(<MinervaStory document={{ metadata: { title: "B" } }} />);
    expect(loads).toHaveLength(2);
    expect(loads[0].signal?.aborted).toBe(true);
  });

  it("loadDocument reloads the story already shown", async () => {
    const ref = createRef<MinervaHandle>();
    const handle = () => {
      if (!ref.current) throw new Error("not mounted");
      return ref.current;
    };
    await render(<MinervaStory ref={ref} document="a.json" />);
    await loads[0].finish();
    expect(handle().getState().status).toBe("ready");

    let reloaded: Promise<MinervaState> | undefined;
    await act(async () => {
      reloaded = handle().loadDocument("a.json");
    });
    expect(loads).toHaveLength(2);
    expect(loads[1].input).toBe("a.json");
    await loads[1].finish();
    await expect(reloaded).resolves.toMatchObject({ status: "ready" });
    // Commands work again (they failed with not_ready while it was stuck).
    const next = await handle().execute("getState");
    expect(next.ok).toBe(true);
  });

  it("aborts the load in progress on a new document and on unmount", async () => {
    await render(<MinervaStory document="a.json" />);
    await render(<MinervaStory document="b.json" />);
    expect(loads.map((l) => l.input)).toEqual(["a.json", "b.json"]);
    expect(loads[0].signal?.aborted).toBe(true);
    expect(loads[1].signal?.aborted).toBe(false);

    await act(async () => root?.unmount());
    root = null;
    expect(loads[1].signal?.aborted).toBe(true);
  });
});
