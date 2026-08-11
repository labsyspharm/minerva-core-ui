# Proposed Changes for `tiffwriter`

## Summary

`tiffwriter` should retain its current sequential `writeTiff()` API and add a lower-level, addressed writer for high-throughput callers.

The addressed writer should accept segments from any image or SubIFD in any completion order:

```ts
const writer = await createTiffWriter({
  sink,
  images,
});

await writer.writeSegment(
  {
    ifd: [channelIndex, levelIndex],
    index: tileIndex,
  },
  jpegBytes,
);

await writer.finish();
```

This one addition solves both important Minerva performance limitations:

1. Tiles within an IFD no longer wait for earlier, slower tiles.
2. Tiles from different channels and pyramid levels can be encoded and written concurrently.

The TIFF writer continues to own file layout, IFD construction, offsets, byte counts, SubIFD pointers, and sink serialization. Callers continue to own image loading, compression, transforms, worker scheduling, retries, and OME metadata.

## Current Limitation

The current API associates an ordered iterator with every image:

```ts
interface TiledSegments {
  kind: "tiles";
  tileWidth: number;
  tileHeight: number;
  data: AsyncIterable<Uint8Array> | Iterable<Uint8Array>;
}
```

`writeTiff()` drains those iterators depth-first:

```text
Image 0, level 0
Image 0, level 1
Image 0, level 2
Image 1, level 0
Image 1, level 1
Image 1, level 2
```

This creates two forms of head-of-line blocking:

- Within an IFD, tile `n + 1` cannot be yielded until tile `n` is ready.
- The producer for a later IFD is not pulled until all segments in earlier IFDs have been written.

Minerva currently works around the first limitation with an ordered prefetch buffer. That preserves JPEG worker parallelism, but completed tiles can wait in memory for an earlier slow tile, and work for later IFDs still does not begin early.

## Primary Change: Addressed Writer

Add a stateful writer API:

```ts
export async function createTiffWriter(
  options: CreateTiffWriterOptions,
): Promise<TiffWriter>;

export interface TiffWriter {
  writeSegment(address: SegmentAddress, bytes: Uint8Array): Promise<void>;

  finish(): Promise<TiffWriteResult>;
  abort(reason?: unknown): Promise<void>;
}
```

### Segment address

```ts
export interface SegmentAddress {
  /** Path through top-level images and nested SubIFDs. */
  ifd: readonly number[];

  /** Logical row-major tile or strip index within the target IFD. */
  index: number;
}
```

Examples:

```ts
// First top-level image, full resolution.
{ ifd: [0], index: 17 }

// First SubIFD of the first top-level image.
{ ifd: [0, 0], index: 17 }

// Second SubIFD of the third top-level image.
{ ifd: [2, 1], index: 17 }
```

The address describes logical TIFF placement. It does not determine physical byte order. Segments may be physically appended in whatever order they finish.

### Separate layout from segment data

The addressed API needs image descriptions that do not contain iterators:

```ts
export interface TiffImageLayout {
  width: number;
  height: number;

  segments: {
    kind: "tiles";
    tileWidth: number;
    tileHeight: number;
  };

  tags?: readonly TiffTag[];
  subImages?: readonly TiffImageLayout[];
}

export interface CreateTiffWriterOptions {
  sink: RandomAccessSink;
  format?: "bigtiff" | "classic";
  byteOrder?: "little-endian" | "big-endian";
  images: readonly TiffImageLayout[];
  closeSink?: boolean;
  signal?: AbortSignal;
}
```

BigTIFF remains the default.

## Concurrent Write Semantics

`writeSegment()` should be safe to call concurrently:

```ts
await Promise.all(
  jobs.map(async (job) => {
    const bytes = await encode(job);
    await writer.writeSegment(job.address, bytes);
  }),
);
```

The writer should:

1. Validate and reserve the logical address synchronously.
2. Place the write into one internal sink queue.
3. Append the segment when it reaches the front of that queue.
4. Record the physical offset at the logical segment index.
5. Resolve the promise after the sink write completes.

The internal queue preserves sink safety without imposing logical tile order. Its physical order is the order in which completed encodes call `writeSegment()`.

### Buffer ownership

The caller retains ownership of `bytes`, but must not mutate or release it until `writeSegment()` resolves:

```ts
const bytes = await encode(job);
await writer.writeSegment(job.address, bytes);
// The caller may now reuse or release bytes.
```

The writer should not defensively copy every segment. Resolving after the physical write provides a simple lifetime rule and avoids unnecessary memory bandwidth.

### Backpressure

Worker loops that await `writeSegment()` naturally bound pending data to approximately the number of active workers:

```ts
while (true) {
  const job = nextJob();
  if (!job) return;

  const bytes = await encode(job);
  await writer.writeSegment(job.address, bytes);
}
```

An explicit `maxPendingBytes` option should only be added if callers need to submit writes without awaiting them. It is not required for the initial addressed API.

## Keep `writeTiff()` as the Baseline API

The existing sequential API should remain supported:

```ts
await writeTiff({
  sink,
  images: imagesWithIterators,
});
```

Internally, it should become a wrapper around `createTiffWriter()`:

```ts
export async function writeTiff(
  options: WriteTiffOptions,
): Promise<TiffWriteResult> {
  const writer = await createTiffWriter({
    ...options,
    images: removeSegmentData(options.images),
  });

  try {
    for (const entry of walkImages(options.images)) {
      let index = 0;
      for await (const bytes of entry.image.segments.data) {
        await writer.writeSegment({ ifd: entry.ifd, index }, bytes);
        index += 1;
      }
    }

    return await writer.finish();
  } catch (error) {
    await writer.abort(error);
    throw error;
  }
}
```

This provides one implementation of TIFF layout and finalization rather than maintaining separate sequential and addressed writers.

## Do Not Add Eager Multi-IFD Pulling

The package should not add machinery that concurrently primes every per-IFD iterator.

Eager iterator pulling would require:

- Coordinating multiple iterators.
- Selecting fairly between producers.
- Managing a shared prefetch budget.
- Handling cancellation and iterator cleanup.
- Buffering completed segments before they can be consumed.

The global addressed writer solves the same problem more directly. The caller already has the information needed to schedule work across images and levels.

Minerva can create one job list containing all channels and pyramid levels, then submit encoded results to the shared writer as they finish.

## Required Address Validation

`writeSegment()` must reject:

- An empty IFD path.
- A nonexistent top-level image.
- A nonexistent SubIFD index.
- A segment index that is negative, nonintegral, or outside the target IFD.
- A duplicate segment address.
- A non-`Uint8Array` segment.
- An empty segment.
- A submission after `finish()` begins.
- A submission after the writer has failed or been aborted.

Address reservation must happen before the asynchronous sink queue is entered. Otherwise, two concurrent calls could both pass duplicate checks before either one records its offset.

A segment slot should have explicit state:

```ts
type SegmentState =
  | { status: "missing" }
  | { status: "reserved" }
  | { status: "written"; offset: bigint; byteCount: bigint };
```

If the physical write fails, the entire writer should enter a failed state. It should not permit the caller to retry only that logical segment because the sink may be partially written or unusable.

## Finalization

`finish()` should:

1. Atomically transition the writer from `open` to `finishing`.
2. Reject further calls to `writeSegment()`.
3. Await the internal sink queue.
4. Fail if any IFD contains missing or merely reserved segments.
5. Validate classic TIFF offset limits.
6. Patch every `TileOffsets` and `TileByteCounts` array.
7. Truncate the sink to the final byte length.
8. Close the sink when `closeSink` is enabled.
9. Transition to `finished` and return the result.

Calling `finish()` more than once should reject with a clear writer-state error.

## Abort and Failure Behavior

Add an explicit lifecycle state:

```ts
type WriterState =
  | "opening"
  | "open"
  | "finishing"
  | "finished"
  | "failed"
  | "aborted";
```

`abort(reason)` should:

1. Transition the writer to `aborted` unless it is already finished.
2. Reject new segment submissions.
3. Cause queued, not-yet-started writes to reject.
4. Await or safely settle the currently active sink write.
5. Call `sink.abort(reason)` when the writer owns the sink.
6. Preserve the first write failure as the primary error.

Planning and initial metadata writing should be inside this lifecycle boundary so that validation failures do not leave an owned browser writable open.

## Minerva Migration

### Remove ordered per-IFD buffering

Minerva should replace `orderedEncodedTiles()` with global jobs:

```ts
interface OmeTiffJob {
  address: SegmentAddress;
  channelIndex: number;
  levelIndex: number;
  tileIndex: number;
  x: number;
  y: number;
}
```

Jobs should be generated across every exported channel and pyramid level:

```ts
const jobs = channels.flatMap((channel, channelIndex) =>
  levels.flatMap((level, levelIndex) =>
    tileJobsForLevel(level).map((tile) => ({
      address: {
        ifd: levelIndex === 0 ? [channelIndex] : [channelIndex, levelIndex - 1],
        index: tile.tileIndex,
      },
      channelIndex,
      levelIndex,
      tileIndex: tile.tileIndex,
      x: tile.x,
      y: tile.y,
    })),
  ),
);
```

### Use worker loops

```ts
const writer = await createTiffWriter({
  sink: browserFileSink(writable),
  images: tiffLayouts,
  signal,
});

let nextJobIndex = 0;

async function workerLoop() {
  while (!signal.aborted) {
    const jobIndex = nextJobIndex;
    nextJobIndex += 1;

    if (jobIndex >= jobs.length) return;
    const job = jobs[jobIndex];

    const jpeg = await readTransformAndEncode(job);
    await writer.writeSegment(job.address, new Uint8Array(jpeg));
    onProgress?.(1);
  }
}

try {
  await Promise.all(
    Array.from({ length: jpegExportConcurrency() }, () => workerLoop()),
  );

  await writer.finish();
} catch (error) {
  await writer.abort(error);
  throw error;
}
```

This restores the useful behavior of Minerva's previous custom writer:

- All channels and levels can encode concurrently.
- Fast tiles do not wait for slow logical predecessors.
- JPEG bytes are written in completion order.
- TIFF offset arrays still describe the correct logical tile order.

Minerva continues to own retry behavior. A job should be retried before its segment address is submitted to `writeSegment()`.

## Other Hardening Changes

The addressed API should be accompanied by a few small correctness improvements.

### Validate tag values

Validate values before calling `DataView` setters:

- `BYTE`: integer `0..255`.
- `SBYTE`: integer `-128..127`.
- `SHORT`: integer `0..65535`.
- `SSHORT`: integer `-32768..32767`.
- `LONG` and `IFD`: integer `0..4294967295`.
- `SLONG`: integer `-2147483648..2147483647`.
- `LONG8` and `IFD8`: unsigned 64-bit integer.
- `SLONG8`: signed 64-bit integer.
- `RATIONAL` and `SRATIONAL`: valid integer pairs with a nonzero denominator.
- `FLOAT` and `DOUBLE`: numeric values with documented handling of nonfinite values.

Do not allow `DataView` to silently wrap invalid values.

### Validate structural dimensions

`ImageWidth`, `ImageLength`, `TileWidth`, and `TileLength` are currently serialized as `LONG`. Require them to fit unsigned 32-bit values unless the BigTIFF dialect deliberately emits `LONG8` for larger dimensions.

Also validate that the calculated tile count is a positive safe integer and a valid JavaScript array length.

### Enforce dialect-specific types

Reject these user tag types when `format: "classic"`:

- `LONG8`
- `SLONG8`
- `IFD8`

### Revalidate public tag objects

Validate tag IDs and types inside layout planning even when callers construct `TiffTag` objects directly instead of using `tiffTag()`.

### Isolate browser types

Move the File System Access adapter to a browser subpath:

```ts
import { browserFileSink } from "tiffwriter/browser";
```

The main package should not expose `FileSystemWritableFileStream` in its rolled TypeScript declaration. This keeps the core usable in Node projects without DOM type libraries.

### Fix the published plan link

Either include `plan.md` in the npm package's `files` list or link to it using an absolute GitHub URL.

## Suggested Internal Structure

```text
src/
  createTiffWriter.ts    # stateful addressed API
  writeTiff.ts           # sequential convenience wrapper
  writerState.ts         # lifecycle and segment reservation
  layout.ts              # shared IFD and patch-site planning
  serializer.ts          # shared metadata and offset serialization
  tags.ts
  dialects/
    classic.ts
    bigtiff.ts
  sinks/
    types.ts
    memory.ts
    browser.ts
```

`createTiffWriter()` and `writeTiff()` must use the same layout, serializer, dialect, validation, and sink code.

## Changes That Should Not Be Added

Do not add these to solve Minerva's performance problem:

- JPEG or other codecs.
- Cube-root or contrast transforms.
- A worker-pool implementation.
- Automatic pyramid generation.
- OME metadata generation.
- Retry policy.
- Concurrent priming of all per-IFD iterators.
- A second independent TIFF serializer.

The addressed writer provides the required extension point without expanding the package into an imaging framework.

## Recommended Implementation Order

1. Separate image layout types from iterator-bearing sequential image types.
2. Extract the current initialization, layout, serialization, and finalization into `createTiffWriter()`.
3. Implement writer states and synchronous segment-address reservation.
4. Add the serialized sink queue and concurrent `writeSegment()` API.
5. Reimplement `writeTiff()` as a sequential wrapper.
6. Add strict tag, dimension, tile-count, and dialect validation.
7. Move `browserFileSink` to a browser subpath export.
8. Update the published documentation and `plan.md` link.
9. Migrate Minerva from ordered iterators to global addressed worker jobs.

## Acceptance Criteria

The change is complete when:

- Existing sequential `writeTiff()` callers continue to work.
- BigTIFF remains the default.
- Classic TIFF remains an explicit option.
- `createTiffWriter()` accepts concurrent `writeSegment()` calls.
- Segments from any top-level image or SubIFD may arrive in any order.
- Physical segment order may differ from logical tile order.
- Offsets and byte counts are recorded at the correct logical indices.
- Duplicate and out-of-range addresses fail before sink writes.
- `finish()` fails when any segment is missing.
- A sink failure places the whole writer in a failed state.
- Segment buffers are not copied unnecessarily.
- Minerva can schedule one global job set across all channels and levels.
- Minerva no longer needs its ordered JPEG promise map.
- Codec, transfer, OME, pyramid-generation, and worker policies remain outside `tiffwriter`.

## Final Recommendation

Add one advanced, global addressed writer and make the existing sequential function a wrapper around it:

```text
createTiffWriter
  -> concurrent, addressed, completion-order segment writes

writeTiff
  -> simple ordered-iterator wrapper over createTiffWriter
```

This recovers Minerva's previous export throughput without changing the package's central purpose: reliably assembling caller-supplied bytes into TIFF and BigTIFF containers.
