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
  simQuantile: 0.9,
  topKCandidates: 10,
  minSimilarity: 0.5,
  minComponentPatches: 4,
  sizeRatioMin: 0.3,
  sizeRatioMax: 3,
  dedupIou: 0.75,
  exemplarErodeK: 3,
  bgDilateK: 7,
  bgSubtractAlpha: 0.5,
};

export type CandidateRegion = {
  label: number;
  scoreP90: number;
  peakX: number;
  peakY: number;
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

  const { labels, stats } = connectedComponents(binary, gridW, gridH);
  const regions: CandidateRegion[] = [];

  for (const st of stats) {
    if (st.area < config.minComponentPatches) continue;

    const scores: number[] = [];
    let peakScore = -Infinity;
    let peakX = st.minX;
    let peakY = st.minY;

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
      }
    }
    if (!scores.length) continue;
    scores.sort((a, b) => a - b);
    const p90 = scores[Math.floor(0.9 * (scores.length - 1))];
    if (p90 < config.minSimilarity) continue;

    regions.push({
      label: st.label,
      scoreP90: p90,
      peakX,
      peakY,
      minX: st.minX,
      minY: st.minY,
      maxX: st.maxX,
      maxY: st.maxY,
      area: st.area,
    });
  }

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

  return {
    box: [x1, y1, x2, y2],
    peak: [px, py],
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

  // Erode foreground to get a cleaner core.
  const fgCore = binaryErode(maskBinary, gridW, gridH, config.exemplarErodeK);

  // Background ring = dilated mask minus original mask.
  const dilated = binaryDilate(maskBinary, gridW, gridH, config.bgDilateK);
  const bgRing = new Uint8Array(gridW * gridH);
  for (let i = 0; i < bgRing.length; i++) {
    bgRing[i] = dilated[i] && !maskBinary[i] ? 1 : 0;
  }

  // Pool exemplar embeddings.
  const qObj = new Float32Array(dim);
  const qBg = new Float32Array(dim);
  let objCount = 0;
  let bgCount = 0;

  for (let i = 0; i < numPatches; i++) {
    const offset = i * dim;
    if (fgCore[i]) {
      for (let d = 0; d < dim; d++) qObj[d] += patchFeatures[offset + d];
      objCount++;
    } else if (bgRing[i]) {
      for (let d = 0; d < dim; d++) qBg[d] += patchFeatures[offset + d];
      bgCount++;
    }
  }
  if (objCount === 0) return [];
  for (let d = 0; d < dim; d++) qObj[d] /= objCount;
  l2Normalize(qObj);

  let qBgNorm: Float32Array | null = null;
  if (bgCount > 0) {
    for (let d = 0; d < dim; d++) qBg[d] /= bgCount;
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

  return extractCandidates(simMap, gridH, gridW, config);
}
