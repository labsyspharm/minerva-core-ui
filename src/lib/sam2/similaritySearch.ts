export type SimilarityConfig = {
  simQuantile: number;
  topKCandidates: number;
  minSimilarity: number;
  minComponentPatches: number;
  sizeRatioMin: number;
  sizeRatioMax: number;
  dedupIou: number;
  exemplarErodeK: number;
  bgDilateK: number;
  bgSubtractAlpha: number;
};

export const DEFAULT_SIMILARITY_CONFIG: SimilarityConfig = {
  simQuantile: 0.85,
  topKCandidates: 15,
  minSimilarity: 0.35,
  minComponentPatches: 3,
  sizeRatioMin: 0.2,
  sizeRatioMax: 4,
  dedupIou: 0.7,
  exemplarErodeK: 3,
  bgDilateK: 7,
  bgSubtractAlpha: 0.5,
};

export type CandidateRegion = {
  label: number;
  scoreP90: number;
  peakX: number;
  peakY: number;
  /** Grid coords of lowest-sim patch in bbox (for negative point, per plan Step 4). */
  negPeakX: number;
  negPeakY: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
};

export function l2Normalize(vec: Float32Array): void {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) sumSq += vec[i] * vec[i];
  const norm = Math.sqrt(sumSq) || 1e-6;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
}

function resizeNearest(
  src: Float32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Float32Array {
  const dst = new Float32Array(dstW * dstH);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y * srcH) / dstH));
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x * srcW) / dstW));
      dst[y * dstW + x] = src[sy * srcW + sx];
    }
  }
  return dst;
}

function binaryErode(
  src: Uint8Array,
  w: number,
  h: number,
  kernelRadius: number,
): Uint8Array {
  const dst = new Uint8Array(w * h);
  const r = Math.max(1, kernelRadius);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ok = true;
      for (let dy = -r; dy <= r && ok; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) {
            ok = false;
            break;
          }
          if (!src[ny * w + nx]) {
            ok = false;
            break;
          }
        }
      }
      if (ok) dst[y * w + x] = 1;
    }
  }
  return dst;
}

function binaryDilate(
  src: Uint8Array,
  w: number,
  h: number,
  kernelRadius: number,
): Uint8Array {
  const dst = new Uint8Array(w * h);
  const r = Math.max(1, kernelRadius);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let any = false;
      for (let dy = -r; dy <= r && !any; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          if (src[ny * w + nx]) {
            any = true;
            break;
          }
        }
      }
      if (any) dst[y * w + x] = 1;
    }
  }
  return dst;
}

type ConnectedComponentStats = {
  label: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
};

function connectedComponents(
  binary: Uint8Array,
  w: number,
  h: number,
): { labels: Int32Array; stats: ConnectedComponentStats[] } {
  const labels = new Int32Array(w * h);
  let nextLabel = 1;
  const stats: ConnectedComponentStats[] = [];

  const neighbors = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ] as const;

  for (let i = 0; i < w * h; i++) {
    if (!binary[i] || labels[i]) continue;
    const queue = [i];
    labels[i] = nextLabel;
    let area = 0;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    while (queue.length > 0) {
      const idx = queue.pop() as number;
      const x = idx % w;
      const y = Math.floor(idx / w);
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const ni = ny * w + nx;
        if (binary[ni] && !labels[ni]) {
          labels[ni] = nextLabel;
          queue.push(ni);
        }
      }
    }
    stats.push({ label: nextLabel, minX, minY, maxX, maxY, area });
    nextLabel++;
  }
  return { labels, stats };
}

function computeSimilarityMap(
  patchFeatures: Float32Array,
  numPatches: number,
  dim: number,
  qObj: Float32Array,
  qBg: Float32Array | null,
  alpha: number,
): Float32Array {
  const sim = new Float32Array(numPatches);
  for (let i = 0; i < numPatches; i++) {
    let dotObj = 0;
    let dotBg = 0;
    const offset = i * dim;
    for (let d = 0; d < dim; d++) {
      const v = patchFeatures[offset + d];
      dotObj += v * qObj[d];
      if (qBg) dotBg += v * qBg[d];
    }
    sim[i] = dotObj - alpha * dotBg;
  }
  return sim;
}

function extractCandidates(
  simMap: Float32Array,
  gridH: number,
  gridW: number,
  config: SimilarityConfig,
): CandidateRegion[] {
  const numPatches = gridH * gridW;
  const values = Array.from(simMap);
  values.sort((a, b) => a - b);
  const qIndex = Math.floor(config.simQuantile * (values.length - 1));
  const threshold = values[qIndex] ?? 0;

  const binary = new Uint8Array(numPatches);
  for (let i = 0; i < numPatches; i++) {
    binary[i] = simMap[i] >= threshold ? 1 : 0;
  }
  const aboveThreshold = [...binary].filter((v) => v).length;

  const { labels, stats } = connectedComponents(binary, gridW, gridH);
  let passedArea = 0;
  let passedSimilarity = 0;
  const regions: CandidateRegion[] = [];

  for (const st of stats) {
    if (st.area < config.minComponentPatches) continue;
    passedArea++;

    const scores: number[] = [];
    let peakScore = -Infinity;
    let peakX = st.minX;
    let peakY = st.minY;
    let negScore = Infinity;
    let negPeakX = st.minX;
    let negPeakY = st.minY;

    for (let y = st.minY; y <= st.maxY; y++) {
      for (let x = st.minX; x <= st.maxX; x++) {
        const idx = y * gridW + x;
        if (labels[idx] !== st.label) continue;
        const v = simMap[idx];
        scores.push(v);
        if (v > peakScore) {
          peakScore = v;
          peakX = x;
          peakY = y;
        }
        if (v < negScore) {
          negScore = v;
          negPeakX = x;
          negPeakY = y;
        }
      }
    }
    if (!scores.length) continue;
    scores.sort((a, b) => a - b);
    const p90 = scores[Math.floor(0.9 * (scores.length - 1))];
    if (p90 < config.minSimilarity) continue;
    passedSimilarity++;

    regions.push({
      label: st.label,
      scoreP90: p90,
      peakX,
      peakY,
      negPeakX,
      negPeakY,
      minX: st.minX,
      minY: st.minY,
      maxX: st.maxX,
      maxY: st.maxY,
      area: st.area,
    });
  }

  console.log("[findSimilarRegions] extractCandidates filters", {
    simQuantile: config.simQuantile,
    threshold: threshold.toFixed(4),
    aboveThreshold,
    componentsTotal: stats.length,
    passedMinComponentPatches: passedArea,
    passedMinSimilarity: passedSimilarity,
    minComponentPatches: config.minComponentPatches,
    minSimilarity: config.minSimilarity,
  });

  regions.sort((a, b) => b.scoreP90 - a.scoreP90);
  return regions.slice(0, config.topKCandidates);
}

export function candidateToSamCoords(
  candidate: CandidateRegion,
  patchSize: number,
  scaleXY: [number, number],
  samSize: number,
): {
  box: [number, number, number, number];
  peak: [number, number];
  negPeak: [number, number];
} {
  const [scaleX, scaleY] = scaleXY;

  const toSam = (xGrid: number, yGrid: number): [number, number] => {
    const dinoX = (xGrid + 0.5) * patchSize;
    const dinoY = (yGrid + 0.5) * patchSize;
    const samX = dinoX / scaleX;
    const samY = dinoY / scaleY;
    return [
      Math.max(0, Math.min(samSize, samX)),
      Math.max(0, Math.min(samSize, samY)),
    ];
  };

  const [x1, y1] = toSam(candidate.minX, candidate.minY);
  const [x2, y2] = toSam(candidate.maxX + 1, candidate.maxY + 1);
  const [px, py] = toSam(candidate.peakX, candidate.peakY);
  const [nx, ny] = toSam(candidate.negPeakX, candidate.negPeakY);

  return {
    box: [x1, y1, x2, y2],
    peak: [px, py],
    negPeak: [nx, ny],
  };
}

export function findSimilarRegions(params: {
  patchFeatures: Float32Array;
  gridH: number;
  gridW: number;
  dim: number;
  queryMask: Float32Array; // 256x256 SAM mask, values 0..1
  maskSize: number;
  config?: Partial<SimilarityConfig>;
}): CandidateRegion[] {
  const {
    patchFeatures,
    gridH,
    gridW,
    dim,
    queryMask,
    maskSize,
    config: overrides,
  } = params;
  const config: SimilarityConfig = {
    ...DEFAULT_SIMILARITY_CONFIG,
    ...overrides,
  };

  const numPatches = gridH * gridW;
  const queryFgPixels = [...queryMask].filter((v) => v > 0.25).length;
  console.log("[findSimilarRegions] Input", {
    gridH,
    gridW,
    dim,
    numPatches,
    maskSize,
    queryMaskFgPixels: queryFgPixels,
  });

  // Normalize patch features in-place, one vector per patch.
  for (let i = 0; i < numPatches; i++) {
    const start = i * dim;
    l2Normalize(patchFeatures.subarray(start, start + dim));
  }

  // Resize query mask from 256x256 to gridH x gridW using nearest-neighbor.
  const maskResized = resizeNearest(
    queryMask,
    maskSize,
    maskSize,
    gridW,
    gridH,
  );
  const maskBinary = new Uint8Array(gridW * gridH);
  for (let i = 0; i < maskResized.length; i++) {
    maskBinary[i] = maskResized[i] > 0.25 ? 1 : 0;
  }
  const maskBinaryFg = [...maskBinary].filter((v) => v).length;

  // Erode foreground to get a cleaner core. If erosion would eliminate the
  // exemplar (objCount=0), fall back to un-eroded mask so small objects still work.
  let fgCore: Uint8Array;
  const eroded = binaryErode(maskBinary, gridW, gridH, config.exemplarErodeK);
  const erodedCount = [...eroded].filter((v) => v).length;
  fgCore = erodedCount > 0 ? eroded : maskBinary;
  const objCount = [...fgCore].filter((v) => v).length;

  // Background ring = dilated mask minus original mask.
  const dilated = binaryDilate(maskBinary, gridW, gridH, config.bgDilateK);
  const bgRing = new Uint8Array(gridW * gridH);
  for (let i = 0; i < bgRing.length; i++) {
    bgRing[i] = dilated[i] && !maskBinary[i] ? 1 : 0;
  }
  const bgCount = [...bgRing].filter((v) => v).length;

  console.log("[findSimilarRegions] Mask pipeline", {
    maskResizedFg: maskBinaryFg,
    fgCoreAfterErode: objCount,
    bgRingPatches: bgCount,
    exemplarErodeK: config.exemplarErodeK,
  });

  // Pool exemplar embeddings.
  const qObj = new Float32Array(dim);
  const qBg = new Float32Array(dim);
  let objCountAcc = 0;
  let bgCountAcc = 0;

  for (let i = 0; i < numPatches; i++) {
    const offset = i * dim;
    if (fgCore[i]) {
      for (let d = 0; d < dim; d++) qObj[d] += patchFeatures[offset + d];
      objCountAcc++;
    } else if (bgRing[i]) {
      for (let d = 0; d < dim; d++) qBg[d] += patchFeatures[offset + d];
      bgCountAcc++;
    }
  }
  if (objCountAcc === 0) {
    console.warn(
      "[findSimilarRegions] objCount=0, no foreground patches — returning []",
    );
    return [];
  }
  for (let d = 0; d < dim; d++) qObj[d] /= objCountAcc;
  l2Normalize(qObj);

  let qBgNorm: Float32Array | null = null;
  if (bgCountAcc > 0) {
    for (let d = 0; d < dim; d++) qBg[d] /= bgCountAcc;
    l2Normalize(qBg);
    qBgNorm = qBg;
  }

  const simMap = computeSimilarityMap(
    patchFeatures,
    numPatches,
    dim,
    qObj,
    qBgNorm,
    config.bgSubtractAlpha,
  );

  const simVals = Array.from(simMap);
  simVals.sort((a, b) => a - b);
  const simMin = simVals[0] ?? 0;
  const simMax = simVals[simVals.length - 1] ?? 0;
  const simP50 = simVals[Math.floor(0.5 * simVals.length)] ?? 0;
  const simP90 = simVals[Math.floor(0.9 * simVals.length)] ?? 0;
  console.log("[findSimilarRegions] Similarity map", {
    min: simMin.toFixed(4),
    max: simMax.toFixed(4),
    p50: simP50.toFixed(4),
    p90: simP90.toFixed(4),
    minSimilarity: config.minSimilarity,
  });

  const candidates = extractCandidates(simMap, gridH, gridW, config);
  console.log("[findSimilarRegions] extractCandidates returned", {
    count: candidates.length,
    topKCandidates: config.topKCandidates,
  });
  return candidates;
}
