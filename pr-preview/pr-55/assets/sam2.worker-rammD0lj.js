var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
/*!
 * ONNX Runtime Web v1.24.1
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
var Wn = Object.defineProperty;
var gf = Object.getOwnPropertyDescriptor;
var yf = Object.getOwnPropertyNames;
var bf = Object.prototype.hasOwnProperty;
var Gn = ((t) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(t, { get: (e, r) => (typeof require < "u" ? require : e)[r] }) : t)(function(t) {
  if (typeof require < "u") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + t + '" is not supported');
});
var V$1 = (t, e) => () => (t && (e = t(t = 0)), e);
var Vt = (t, e) => {
  for (var r in e) Wn(t, r, { get: e[r], enumerable: true });
}, wf = (t, e, r, n) => {
  if (e && typeof e == "object" || typeof e == "function") for (let o of yf(e)) !bf.call(t, o) && o !== r && Wn(t, o, { get: () => e[o], enumerable: !(n = gf(e, o)) || n.enumerable });
  return t;
};
var Yt$1 = (t) => wf(Wn({}, "__esModule", { value: true }), t);
var $r, Et, kt, _f, za$1, Hn = V$1(() => {
  $r = /* @__PURE__ */ new Map(), Et = [], kt = (t, e, r) => {
    if (e && typeof e.init == "function" && typeof e.createInferenceSessionHandler == "function") {
      let n = $r.get(t);
      if (n === void 0) $r.set(t, { backend: e, priority: r });
      else {
        if (n.priority > r) return;
        if (n.priority === r && n.backend !== e) throw new Error(`cannot register backend "${t}" using priority ${r}`);
      }
      if (r >= 0) {
        let o = Et.indexOf(t);
        o !== -1 && Et.splice(o, 1);
        for (let i = 0; i < Et.length; i++) if ($r.get(Et[i]).priority <= r) {
          Et.splice(i, 0, t);
          return;
        }
        Et.push(t);
      }
      return;
    }
    throw new TypeError("not a valid backend");
  }, _f = async (t) => {
    let e = $r.get(t);
    if (!e) return "backend not found.";
    if (e.initialized) return e.backend;
    if (e.aborted) return e.error;
    {
      let r = !!e.initPromise;
      try {
        return r || (e.initPromise = e.backend.init(t)), await e.initPromise, e.initialized = true, e.backend;
      } catch (n) {
        return r || (e.error = `${n}`, e.aborted = true), e.error;
      } finally {
        delete e.initPromise;
      }
    }
  }, za$1 = async (t) => {
    let e = t.executionProviders || [], r = e.map((d) => typeof d == "string" ? d : d.name), n = r.length === 0 ? Et : r, o, i = [], s = /* @__PURE__ */ new Set();
    for (let d of n) {
      let c = await _f(d);
      typeof c == "string" ? i.push({ name: d, err: c }) : (o || (o = c), o === c && s.add(d));
    }
    if (!o) throw new Error(`no available backend found. ERR: ${i.map((d) => `[${d.name}] ${d.err}`).join(", ")}`);
    for (let { name: d, err: c } of i) r.includes(d) && console.warn(`removing requested execution provider "${d}" from session options because it is not available: ${c}`);
    let u = e.filter((d) => s.has(typeof d == "string" ? d : d.name));
    return [o, new Proxy(t, { get: (d, c) => c === "executionProviders" ? u : Reflect.get(d, c) })];
  };
});
var Da$1 = V$1(() => {
  Hn();
});
var Ba$1, Ma$1 = V$1(() => {
  Ba$1 = "1.24.1";
});
var Ra$1, ke, Fn = V$1(() => {
  Ma$1();
  Ra$1 = "warning", ke = { wasm: {}, webgl: {}, webgpu: {}, versions: { common: Ba$1 }, set logLevel(t) {
    if (t !== void 0) {
      if (typeof t != "string" || ["verbose", "info", "warning", "error", "fatal"].indexOf(t) === -1) throw new Error(`Unsupported logging level: ${t}`);
      Ra$1 = t;
    }
  }, get logLevel() {
    return Ra$1;
  } };
  Object.defineProperty(ke, "logLevel", { enumerable: true });
});
var ye, Ua$1 = V$1(() => {
  Fn();
  ye = ke;
});
var Na$1, Va$1, La$1 = V$1(() => {
  Na$1 = (t, e) => {
    let r = typeof document < "u" ? document.createElement("canvas") : new OffscreenCanvas(1, 1);
    r.width = t.dims[3], r.height = t.dims[2];
    let n = r.getContext("2d");
    if (n != null) {
      let o, i;
      (e == null ? void 0 : e.tensorLayout) !== void 0 && e.tensorLayout === "NHWC" ? (o = t.dims[2], i = t.dims[3]) : (o = t.dims[3], i = t.dims[2]);
      let s = (e == null ? void 0 : e.format) !== void 0 ? e.format : "RGB", u = e == null ? void 0 : e.norm, d, c;
      u === void 0 || u.mean === void 0 ? d = [255, 255, 255, 255] : typeof u.mean == "number" ? d = [u.mean, u.mean, u.mean, u.mean] : (d = [u.mean[0], u.mean[1], u.mean[2], 0], u.mean[3] !== void 0 && (d[3] = u.mean[3])), u === void 0 || u.bias === void 0 ? c = [0, 0, 0, 0] : typeof u.bias == "number" ? c = [u.bias, u.bias, u.bias, u.bias] : (c = [u.bias[0], u.bias[1], u.bias[2], 0], u.bias[3] !== void 0 && (c[3] = u.bias[3]));
      let p = i * o, m = 0, g = p, b = p * 2, y = -1;
      s === "RGBA" ? (m = 0, g = p, b = p * 2, y = p * 3) : s === "RGB" ? (m = 0, g = p, b = p * 2) : s === "RBG" && (m = 0, b = p, g = p * 2);
      for (let w = 0; w < i; w++) for (let S = 0; S < o; S++) {
        let x = (t.data[m++] - c[0]) * d[0], $ = (t.data[g++] - c[1]) * d[1], T = (t.data[b++] - c[2]) * d[2], I = y === -1 ? 255 : (t.data[y++] - c[3]) * d[3];
        n.fillStyle = "rgba(" + x + "," + $ + "," + T + "," + I + ")", n.fillRect(S, w, 1, 1);
      }
      if ("toDataURL" in r) return r.toDataURL();
      throw new Error("toDataURL is not supported");
    } else throw new Error("Can not access image data");
  }, Va$1 = (t, e) => {
    let r = typeof document < "u" ? document.createElement("canvas").getContext("2d") : new OffscreenCanvas(1, 1).getContext("2d"), n;
    if (r != null) {
      let o, i, s;
      (e == null ? void 0 : e.tensorLayout) !== void 0 && e.tensorLayout === "NHWC" ? (o = t.dims[2], i = t.dims[1], s = t.dims[3]) : (o = t.dims[3], i = t.dims[2], s = t.dims[1]);
      let u = e !== void 0 && e.format !== void 0 ? e.format : "RGB", d = e == null ? void 0 : e.norm, c, p;
      d === void 0 || d.mean === void 0 ? c = [255, 255, 255, 255] : typeof d.mean == "number" ? c = [d.mean, d.mean, d.mean, d.mean] : (c = [d.mean[0], d.mean[1], d.mean[2], 255], d.mean[3] !== void 0 && (c[3] = d.mean[3])), d === void 0 || d.bias === void 0 ? p = [0, 0, 0, 0] : typeof d.bias == "number" ? p = [d.bias, d.bias, d.bias, d.bias] : (p = [d.bias[0], d.bias[1], d.bias[2], 0], d.bias[3] !== void 0 && (p[3] = d.bias[3]));
      let m = i * o;
      if (e !== void 0 && (e.format !== void 0 && s === 4 && e.format !== "RGBA" || s === 3 && e.format !== "RGB" && e.format !== "BGR")) throw new Error("Tensor format doesn't match input tensor dims");
      let g = 4, b = 0, y = 1, w = 2, S = 3, x = 0, $ = m, T = m * 2, I = -1;
      u === "RGBA" ? (x = 0, $ = m, T = m * 2, I = m * 3) : u === "RGB" ? (x = 0, $ = m, T = m * 2) : u === "RBG" && (x = 0, T = m, $ = m * 2), n = r.createImageData(o, i);
      for (let E = 0; E < i * o; b += g, y += g, w += g, S += g, E++) n.data[b] = (t.data[x++] - p[0]) * c[0], n.data[y] = (t.data[$++] - p[1]) * c[1], n.data[w] = (t.data[T++] - p[2]) * c[2], n.data[S] = I === -1 ? 255 : (t.data[I++] - p[3]) * c[3];
    } else throw new Error("Can not access image data");
    return n;
  };
});
var qn, Wa$1, Ga$1, Ha$1, Fa$1, qa$1, Ka$1 = V$1(() => {
  xr();
  qn = (t, e) => {
    if (t === void 0) throw new Error("Image buffer must be defined");
    if (e.height === void 0 || e.width === void 0) throw new Error("Image height and width must be defined");
    if (e.tensorLayout === "NHWC") throw new Error("NHWC Tensor layout is not supported yet");
    let { height: r, width: n } = e, o = e.norm ?? { mean: 255, bias: 0 }, i, s;
    typeof o.mean == "number" ? i = [o.mean, o.mean, o.mean, o.mean] : i = [o.mean[0], o.mean[1], o.mean[2], o.mean[3] ?? 255], typeof o.bias == "number" ? s = [o.bias, o.bias, o.bias, o.bias] : s = [o.bias[0], o.bias[1], o.bias[2], o.bias[3] ?? 0];
    let u = e.format !== void 0 ? e.format : "RGBA", d = e.tensorFormat !== void 0 && e.tensorFormat !== void 0 ? e.tensorFormat : "RGB", c = r * n, p = d === "RGBA" ? new Float32Array(c * 4) : new Float32Array(c * 3), m = 4, g = 0, b = 1, y = 2, w = 3, S = 0, x = c, $ = c * 2, T = -1;
    u === "RGB" && (m = 3, g = 0, b = 1, y = 2, w = -1), d === "RGBA" ? T = c * 3 : d === "RBG" ? (S = 0, $ = c, x = c * 2) : d === "BGR" && ($ = 0, x = c, S = c * 2);
    for (let E = 0; E < c; E++, g += m, y += m, b += m, w += m) p[S++] = (t[g] + s[0]) / i[0], p[x++] = (t[b] + s[1]) / i[1], p[$++] = (t[y] + s[2]) / i[2], T !== -1 && w !== -1 && (p[T++] = (t[w] + s[3]) / i[3]);
    return d === "RGBA" ? new De("float32", p, [1, 4, r, n]) : new De("float32", p, [1, 3, r, n]);
  }, Wa$1 = async (t, e) => {
    let r = typeof HTMLImageElement < "u" && t instanceof HTMLImageElement, n = typeof ImageData < "u" && t instanceof ImageData, o = typeof ImageBitmap < "u" && t instanceof ImageBitmap, i = typeof t == "string", s, u = e ?? {}, d = () => {
      if (typeof document < "u") return document.createElement("canvas");
      if (typeof OffscreenCanvas < "u") return new OffscreenCanvas(1, 1);
      throw new Error("Canvas is not supported");
    }, c = (p) => typeof HTMLCanvasElement < "u" && p instanceof HTMLCanvasElement || p instanceof OffscreenCanvas ? p.getContext("2d") : null;
    if (r) {
      let p = d();
      p.width = t.width, p.height = t.height;
      let m = c(p);
      if (m != null) {
        let g = t.height, b = t.width;
        if (e !== void 0 && e.resizedHeight !== void 0 && e.resizedWidth !== void 0 && (g = e.resizedHeight, b = e.resizedWidth), e !== void 0) {
          if (u = e, e.tensorFormat !== void 0) throw new Error("Image input config format must be RGBA for HTMLImageElement");
          u.tensorFormat = "RGBA", u.height = g, u.width = b;
        } else u.tensorFormat = "RGBA", u.height = g, u.width = b;
        m.drawImage(t, 0, 0), s = m.getImageData(0, 0, b, g).data;
      } else throw new Error("Can not access image data");
    } else if (n) {
      let p, m;
      if (e !== void 0 && e.resizedWidth !== void 0 && e.resizedHeight !== void 0 ? (p = e.resizedHeight, m = e.resizedWidth) : (p = t.height, m = t.width), e !== void 0 && (u = e), u.format = "RGBA", u.height = p, u.width = m, e !== void 0) {
        let g = d();
        g.width = m, g.height = p;
        let b = c(g);
        if (b != null) b.putImageData(t, 0, 0), s = b.getImageData(0, 0, m, p).data;
        else throw new Error("Can not access image data");
      } else s = t.data;
    } else if (o) {
      if (e === void 0) throw new Error("Please provide image config with format for Imagebitmap");
      let p = d();
      p.width = t.width, p.height = t.height;
      let m = c(p);
      if (m != null) {
        let g = t.height, b = t.width;
        return m.drawImage(t, 0, 0, b, g), s = m.getImageData(0, 0, b, g).data, u.height = g, u.width = b, qn(s, u);
      } else throw new Error("Can not access image data");
    } else {
      if (i) return new Promise((p, m) => {
        let g = d(), b = c(g);
        if (!t || !b) return m();
        let y = new Image();
        y.crossOrigin = "Anonymous", y.src = t, y.onload = () => {
          g.width = y.width, g.height = y.height, b.drawImage(y, 0, 0, g.width, g.height);
          let w = b.getImageData(0, 0, g.width, g.height);
          u.height = g.height, u.width = g.width, p(qn(w.data, u));
        };
      });
      throw new Error("Input data provided is not supported - aborted tensor creation");
    }
    if (s !== void 0) return qn(s, u);
    throw new Error("Input data provided is not supported - aborted tensor creation");
  }, Ga$1 = (t, e) => {
    let { width: r, height: n, download: o, dispose: i } = e, s = [1, n, r, 4];
    return new De({ location: "texture", type: "float32", texture: t, dims: s, download: o, dispose: i });
  }, Ha$1 = (t, e) => {
    let { dataType: r, dims: n, download: o, dispose: i } = e;
    return new De({ location: "gpu-buffer", type: r ?? "float32", gpuBuffer: t, dims: n, download: o, dispose: i });
  }, Fa$1 = (t, e) => {
    let { dataType: r, dims: n, download: o, dispose: i } = e;
    return new De({ location: "ml-tensor", type: r ?? "float32", mlTensor: t, dims: n, download: o, dispose: i });
  }, qa$1 = (t, e, r) => new De({ location: "cpu-pinned", type: t, data: e, dims: r ?? [e.length] });
});
var Pt, Xt$1, ja$1, Za$1, Qa$1 = V$1(() => {
  Pt = /* @__PURE__ */ new Map([["float32", Float32Array], ["uint8", Uint8Array], ["int8", Int8Array], ["uint16", Uint16Array], ["int16", Int16Array], ["int32", Int32Array], ["bool", Uint8Array], ["float64", Float64Array], ["uint32", Uint32Array], ["int4", Uint8Array], ["uint4", Uint8Array]]), Xt$1 = /* @__PURE__ */ new Map([[Float32Array, "float32"], [Uint8Array, "uint8"], [Int8Array, "int8"], [Uint16Array, "uint16"], [Int16Array, "int16"], [Int32Array, "int32"], [Float64Array, "float64"], [Uint32Array, "uint32"]]), ja$1 = false, Za$1 = () => {
    if (!ja$1) {
      ja$1 = true;
      let t = typeof BigInt64Array < "u" && BigInt64Array.from, e = typeof BigUint64Array < "u" && BigUint64Array.from, r = globalThis.Float16Array, n = typeof r < "u" && r.from;
      t && (Pt.set("int64", BigInt64Array), Xt$1.set(BigInt64Array, "int64")), e && (Pt.set("uint64", BigUint64Array), Xt$1.set(BigUint64Array, "uint64")), n ? (Pt.set("float16", r), Xt$1.set(r, "float16")) : Pt.set("float16", Uint16Array);
    }
  };
});
var Ya$1, Xa$1, Ja$1 = V$1(() => {
  xr();
  Ya$1 = (t) => {
    let e = 1;
    for (let r = 0; r < t.length; r++) {
      let n = t[r];
      if (typeof n != "number" || !Number.isSafeInteger(n)) throw new TypeError(`dims[${r}] must be an integer, got: ${n}`);
      if (n < 0) throw new RangeError(`dims[${r}] must be a non-negative integer, got: ${n}`);
      e *= n;
    }
    return e;
  }, Xa$1 = (t, e) => {
    switch (t.location) {
      case "cpu":
        return new De(t.type, t.data, e);
      case "cpu-pinned":
        return new De({ location: "cpu-pinned", data: t.data, type: t.type, dims: e });
      case "texture":
        return new De({ location: "texture", texture: t.texture, type: t.type, dims: e });
      case "gpu-buffer":
        return new De({ location: "gpu-buffer", gpuBuffer: t.gpuBuffer, type: t.type, dims: e });
      case "ml-tensor":
        return new De({ location: "ml-tensor", mlTensor: t.mlTensor, type: t.type, dims: e });
      default:
        throw new Error(`tensorReshape: tensor location ${t.location} is not supported`);
    }
  };
});
var De, xr = V$1(() => {
  La$1();
  Ka$1();
  Qa$1();
  Ja$1();
  De = class {
    constructor(e, r, n) {
      Za$1();
      let o, i;
      if (typeof e == "object" && "location" in e) switch (this.dataLocation = e.location, o = e.type, i = e.dims, e.location) {
        case "cpu-pinned": {
          let u = Pt.get(o);
          if (!u) throw new TypeError(`unsupported type "${o}" to create tensor from pinned buffer`);
          if (!(e.data instanceof u)) throw new TypeError(`buffer should be of type ${u.name}`);
          this.cpuData = e.data;
          break;
        }
        case "texture": {
          if (o !== "float32") throw new TypeError(`unsupported type "${o}" to create tensor from texture`);
          this.gpuTextureData = e.texture, this.downloader = e.download, this.disposer = e.dispose;
          break;
        }
        case "gpu-buffer": {
          if (o !== "float32" && o !== "float16" && o !== "int32" && o !== "int64" && o !== "uint32" && o !== "uint8" && o !== "bool" && o !== "uint4" && o !== "int4") throw new TypeError(`unsupported type "${o}" to create tensor from gpu buffer`);
          this.gpuBufferData = e.gpuBuffer, this.downloader = e.download, this.disposer = e.dispose;
          break;
        }
        case "ml-tensor": {
          if (o !== "float32" && o !== "float16" && o !== "int32" && o !== "int64" && o !== "uint32" && o !== "uint64" && o !== "int8" && o !== "uint8" && o !== "bool" && o !== "uint4" && o !== "int4") throw new TypeError(`unsupported type "${o}" to create tensor from MLTensor`);
          this.mlTensorData = e.mlTensor, this.downloader = e.download, this.disposer = e.dispose;
          break;
        }
        default:
          throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`);
      }
      else {
        let u, d;
        if (typeof e == "string") if (o = e, d = n, e === "string") {
          if (!Array.isArray(r)) throw new TypeError("A string tensor's data must be a string array.");
          u = r;
        } else {
          let c = Pt.get(e);
          if (c === void 0) throw new TypeError(`Unsupported tensor type: ${e}.`);
          if (Array.isArray(r)) {
            if (e === "float16" && c === Uint16Array || e === "uint4" || e === "int4") throw new TypeError(`Creating a ${e} tensor from number array is not supported. Please use ${c.name} as data.`);
            e === "uint64" || e === "int64" ? u = c.from(r, BigInt) : u = c.from(r);
          } else if (r instanceof c) u = r;
          else if (r instanceof Uint8ClampedArray) if (e === "uint8") u = Uint8Array.from(r);
          else throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");
          else if (e === "float16" && r instanceof Uint16Array && c !== Uint16Array) u = new globalThis.Float16Array(r.buffer, r.byteOffset, r.length);
          else throw new TypeError(`A ${o} tensor's data must be type of ${c}`);
        }
        else if (d = r, Array.isArray(e)) {
          if (e.length === 0) throw new TypeError("Tensor type cannot be inferred from an empty array.");
          let c = typeof e[0];
          if (c === "string") o = "string", u = e;
          else if (c === "boolean") o = "bool", u = Uint8Array.from(e);
          else throw new TypeError(`Invalid element type of data array: ${c}.`);
        } else if (e instanceof Uint8ClampedArray) o = "uint8", u = Uint8Array.from(e);
        else {
          let c = Xt$1.get(e.constructor);
          if (c === void 0) throw new TypeError(`Unsupported type for tensor data: ${e.constructor}.`);
          o = c, u = e;
        }
        if (d === void 0) d = [u.length];
        else if (!Array.isArray(d)) throw new TypeError("A tensor's dims must be a number array");
        i = d, this.cpuData = u, this.dataLocation = "cpu";
      }
      let s = Ya$1(i);
      if (this.cpuData && s !== this.cpuData.length && !((o === "uint4" || o === "int4") && Math.ceil(s / 2) === this.cpuData.length)) throw new Error(`Tensor's size(${s}) does not match data length(${this.cpuData.length}).`);
      this.type = o, this.dims = i, this.size = s;
    }
    static async fromImage(e, r) {
      return Wa$1(e, r);
    }
    static fromTexture(e, r) {
      return Ga$1(e, r);
    }
    static fromGpuBuffer(e, r) {
      return Ha$1(e, r);
    }
    static fromMLTensor(e, r) {
      return Fa$1(e, r);
    }
    static fromPinnedBuffer(e, r, n) {
      return qa$1(e, r, n);
    }
    toDataURL(e) {
      return Na$1(this, e);
    }
    toImageData(e) {
      return Va$1(this, e);
    }
    get data() {
      if (this.ensureValid(), !this.cpuData) throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");
      return this.cpuData;
    }
    get location() {
      return this.dataLocation;
    }
    get texture() {
      if (this.ensureValid(), !this.gpuTextureData) throw new Error("The data is not stored as a WebGL texture.");
      return this.gpuTextureData;
    }
    get gpuBuffer() {
      if (this.ensureValid(), !this.gpuBufferData) throw new Error("The data is not stored as a WebGPU buffer.");
      return this.gpuBufferData;
    }
    get mlTensor() {
      if (this.ensureValid(), !this.mlTensorData) throw new Error("The data is not stored as a WebNN MLTensor.");
      return this.mlTensorData;
    }
    async getData(e) {
      switch (this.ensureValid(), this.dataLocation) {
        case "cpu":
        case "cpu-pinned":
          return this.data;
        case "texture":
        case "gpu-buffer":
        case "ml-tensor": {
          if (!this.downloader) throw new Error("The current tensor is not created with a specified data downloader.");
          if (this.isDownloading) throw new Error("The current tensor is being downloaded.");
          try {
            this.isDownloading = true;
            let r = await this.downloader();
            return this.downloader = void 0, this.dataLocation = "cpu", this.cpuData = r, e && this.disposer && (this.disposer(), this.disposer = void 0), r;
          } finally {
            this.isDownloading = false;
          }
        }
        default:
          throw new Error(`cannot get data from location: ${this.dataLocation}`);
      }
    }
    dispose() {
      if (this.isDownloading) throw new Error("The current tensor is being downloaded.");
      this.disposer && (this.disposer(), this.disposer = void 0), this.cpuData = void 0, this.gpuTextureData = void 0, this.gpuBufferData = void 0, this.mlTensorData = void 0, this.downloader = void 0, this.isDownloading = void 0, this.dataLocation = "none";
    }
    ensureValid() {
      if (this.dataLocation === "none") throw new Error("The tensor is disposed.");
    }
    reshape(e) {
      if (this.ensureValid(), this.downloader || this.disposer) throw new Error("Cannot reshape a tensor that owns GPU resource.");
      return Xa$1(this, e);
    }
  };
});
var Ke$1, Kn = V$1(() => {
  xr();
  Ke$1 = De;
});
var Sr, es$1, Ne, Me, wt, _t, jn = V$1(() => {
  Fn();
  Sr = (t, e) => {
    (typeof ke.trace > "u" ? !ke.wasm.trace : !ke.trace) || console.timeStamp(`${t}::ORT::${e}`);
  }, es$1 = (t, e) => {
    var _a2;
    let r = ((_a2 = new Error().stack) == null ? void 0 : _a2.split(/\r\n|\r|\n/g)) || [], n = false;
    for (let o = 0; o < r.length; o++) {
      if (n && !r[o].includes("TRACE_FUNC")) {
        let i = `FUNC_${t}::${r[o].trim().split(" ")[1]}`;
        e && (i += `::${e}`), Sr("CPU", i);
        return;
      }
      r[o].includes("TRACE_FUNC") && (n = true);
    }
  }, Ne = (t) => {
    (typeof ke.trace > "u" ? !ke.wasm.trace : !ke.trace) || es$1("BEGIN", t);
  }, Me = (t) => {
    (typeof ke.trace > "u" ? !ke.wasm.trace : !ke.trace) || es$1("END", t);
  }, wt = (t) => {
    (typeof ke.trace > "u" ? !ke.wasm.trace : !ke.trace) || console.time(`ORT::${t}`);
  }, _t = (t) => {
    (typeof ke.trace > "u" ? !ke.wasm.trace : !ke.trace) || console.timeEnd(`ORT::${t}`);
  };
});
var Tr, ts$1 = V$1(() => {
  Hn();
  Kn();
  jn();
  Tr = class t {
    constructor(e) {
      this.handler = e;
    }
    async run(e, r, n) {
      Ne(), wt("InferenceSession.run");
      let o = {}, i = {};
      if (typeof e != "object" || e === null || e instanceof Ke$1 || Array.isArray(e)) throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");
      let s = true;
      if (typeof r == "object") {
        if (r === null) throw new TypeError("Unexpected argument[1]: cannot be null.");
        if (r instanceof Ke$1) throw new TypeError("'fetches' cannot be a Tensor");
        if (Array.isArray(r)) {
          if (r.length === 0) throw new TypeError("'fetches' cannot be an empty array.");
          s = false;
          for (let c of r) {
            if (typeof c != "string") throw new TypeError("'fetches' must be a string array or an object.");
            if (this.outputNames.indexOf(c) === -1) throw new RangeError(`'fetches' contains invalid output name: ${c}.`);
            o[c] = null;
          }
          if (typeof n == "object" && n !== null) i = n;
          else if (typeof n < "u") throw new TypeError("'options' must be an object.");
        } else {
          let c = false, p = Object.getOwnPropertyNames(r);
          for (let m of this.outputNames) if (p.indexOf(m) !== -1) {
            let g = r[m];
            (g === null || g instanceof Ke$1) && (c = true, s = false, o[m] = g);
          }
          if (c) {
            if (typeof n == "object" && n !== null) i = n;
            else if (typeof n < "u") throw new TypeError("'options' must be an object.");
          } else i = r;
        }
      } else if (typeof r < "u") throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");
      for (let c of this.inputNames) if (typeof e[c] > "u") throw new Error(`input '${c}' is missing in 'feeds'.`);
      if (s) for (let c of this.outputNames) o[c] = null;
      let u = await this.handler.run(e, o, i), d = {};
      for (let c in u) if (Object.hasOwnProperty.call(u, c)) {
        let p = u[c];
        p instanceof Ke$1 ? d[c] = p : d[c] = new Ke$1(p.type, p.data, p.dims);
      }
      return _t("InferenceSession.run"), Me(), d;
    }
    async release() {
      return this.handler.dispose();
    }
    static async create(e, r, n, o) {
      Ne(), wt("InferenceSession.create");
      let i, s = {};
      if (typeof e == "string") {
        if (i = e, typeof r == "object" && r !== null) s = r;
        else if (typeof r < "u") throw new TypeError("'options' must be an object.");
      } else if (e instanceof Uint8Array) {
        if (i = e, typeof r == "object" && r !== null) s = r;
        else if (typeof r < "u") throw new TypeError("'options' must be an object.");
      } else if (e instanceof ArrayBuffer || typeof SharedArrayBuffer < "u" && e instanceof SharedArrayBuffer) {
        let p = e, m = 0, g = e.byteLength;
        if (typeof r == "object" && r !== null) s = r;
        else if (typeof r == "number") {
          if (m = r, !Number.isSafeInteger(m)) throw new RangeError("'byteOffset' must be an integer.");
          if (m < 0 || m >= p.byteLength) throw new RangeError(`'byteOffset' is out of range [0, ${p.byteLength}).`);
          if (g = e.byteLength - m, typeof n == "number") {
            if (g = n, !Number.isSafeInteger(g)) throw new RangeError("'byteLength' must be an integer.");
            if (g <= 0 || m + g > p.byteLength) throw new RangeError(`'byteLength' is out of range (0, ${p.byteLength - m}].`);
            if (typeof o == "object" && o !== null) s = o;
            else if (typeof o < "u") throw new TypeError("'options' must be an object.");
          } else if (typeof n < "u") throw new TypeError("'byteLength' must be a number.");
        } else if (typeof r < "u") throw new TypeError("'options' must be an object.");
        i = new Uint8Array(p, m, g);
      } else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");
      let [u, d] = await za$1(s), c = await u.createInferenceSessionHandler(i, d);
      return _t("InferenceSession.create"), Me(), new t(c);
    }
    startProfiling() {
      this.handler.startProfiling();
    }
    endProfiling() {
      this.handler.endProfiling();
    }
    get inputNames() {
      return this.handler.inputNames;
    }
    get outputNames() {
      return this.handler.outputNames;
    }
    get inputMetadata() {
      return this.handler.inputMetadata;
    }
    get outputMetadata() {
      return this.handler.outputMetadata;
    }
  };
});
var vf, rs$1 = V$1(() => {
  ts$1();
  vf = Tr;
});
var ns$1 = V$1(() => {
});
var os$1 = V$1(() => {
});
var is$1 = V$1(() => {
});
var as$1 = V$1(() => {
});
var Zn = {};
Vt(Zn, { InferenceSession: () => vf, TRACE: () => Sr, TRACE_EVENT_BEGIN: () => wt, TRACE_EVENT_END: () => _t, TRACE_FUNC_BEGIN: () => Ne, TRACE_FUNC_END: () => Me, Tensor: () => Ke$1, env: () => ye, registerBackend: () => kt });
var Ve$1 = V$1(() => {
  Da$1();
  Ua$1();
  rs$1();
  Kn();
  ns$1();
  os$1();
  jn();
  is$1();
  as$1();
});
var Ir = V$1(() => {
});
var ls$1 = {};
Vt(ls$1, { default: () => $f });
var us$1, ds$1, $f, cs$1 = V$1(() => {
  var _a2;
  Qn();
  vt();
  Cr();
  us$1 = "ort-wasm-proxy-worker", ds$1 = ((_a2 = globalThis.self) == null ? void 0 : _a2.name) === us$1;
  ds$1 && (self.onmessage = (t) => {
    let { type: e, in: r } = t.data;
    try {
      switch (e) {
        case "init-wasm":
          Ar(r.wasm).then(() => {
            Er(r).then(() => {
              postMessage({ type: e });
            }, (n) => {
              postMessage({ type: e, err: n });
            });
          }, (n) => {
            postMessage({ type: e, err: n });
          });
          break;
        case "init-ep": {
          let { epName: n, env: o } = r;
          kr(o, n).then(() => {
            postMessage({ type: e });
          }, (i) => {
            postMessage({ type: e, err: i });
          });
          break;
        }
        case "copy-from": {
          let { buffer: n } = r, o = Jt$1(n);
          postMessage({ type: e, out: o });
          break;
        }
        case "create": {
          let { model: n, options: o } = r;
          Pr(n, o).then((i) => {
            postMessage({ type: e, out: i });
          }, (i) => {
            postMessage({ type: e, err: i });
          });
          break;
        }
        case "release":
          Or(r), postMessage({ type: e });
          break;
        case "run": {
          let { sessionId: n, inputIndices: o, inputs: i, outputIndices: s, options: u } = r;
          zr(n, o, i, s, new Array(s.length).fill(null), u).then((d) => {
            d.some((c) => c[3] !== "cpu") ? postMessage({ type: e, err: "Proxy does not support non-cpu tensor location." }) : postMessage({ type: e, out: d }, Br([...i, ...d]));
          }, (d) => {
            postMessage({ type: e, err: d });
          });
          break;
        }
        case "end-profiling":
          Dr(r), postMessage({ type: e });
          break;
        default:
      }
    } catch (n) {
      postMessage({ type: e, err: n });
    }
  });
  $f = ds$1 ? null : (t) => new Worker(t ?? Le, { type: "module", name: us$1 });
});
var ms$1 = {};
Vt(ms$1, { default: () => xf });
async function ps$1(t = {}) {
  var _a3, _b;
  var e = t, r = !!globalThis.window, n = !!globalThis.WorkerGlobalScope, o = n && ((_a3 = self.name) == null ? void 0 : _a3.startsWith("em-pthread"));
  e.mountExternalData = (a, l) => {
    a.startsWith("./") && (a = a.substring(2)), (e.Zc || (e.Zc = /* @__PURE__ */ new Map())).set(a, l);
  }, e.unmountExternalData = () => {
    delete e.Zc;
  }, globalThis.SharedArrayBuffer ?? new WebAssembly.Memory({ initial: 0, maximum: 0, ae: true }).buffer.constructor;
  let i = (a) => async (...l) => {
    var _a4;
    try {
      if (e.$c) throw Error("Session already started");
      let h = e.$c = { Nd: l[0], errors: [] }, f = await a(...l);
      if (e.$c !== h) throw Error("Session mismatch");
      (_a4 = e.gd) == null ? void 0 : _a4.flush();
      let _ = h.errors;
      if (0 < _.length) {
        let C = await Promise.all(_);
        if (C = C.filter((P) => P), 0 < C.length) throw Error(C.join(`
`));
      }
      return f;
    } finally {
      e.$c = null;
    }
  };
  e.jsepInit = (a, l) => {
    if (a === "webgpu") {
      [e.gd, e.Dd, e.Hd, e.jd, e.Gd, e.ac, e.Id, e.Kd, e.Ed, e.Fd, e.Jd] = l;
      let h = e.gd;
      e.jsepRegisterBuffer = (f, _, C, P) => h.registerBuffer(f, _, C, P), e.jsepGetBuffer = (f) => h.getBuffer(f), e.jsepCreateDownloader = (f, _, C) => h.createDownloader(f, _, C), e.jsepOnCreateSession = (f) => {
        h.onCreateSession(f);
      }, e.jsepOnReleaseSession = (f) => {
        h.onReleaseSession(f);
      }, e.jsepOnRunStart = (f) => h.onRunStart(f), e.Ld = (f, _) => {
        h.upload(f, _);
      };
    } else if (a === "webnn") {
      let h = l[0];
      [e.Zd, e.vd, e.webnnEnsureTensor, e.xd, e.webnnDownloadTensor, e.Yd, e.webnnEnableTraceEvent] = l.slice(1), e.webnnReleaseTensorId = e.vd, e.webnnUploadTensor = e.xd, e.webnnRegisterMLContext = e.Yd, e.webnnOnRunStart = (f) => h.onRunStart(f), e.webnnOnRunEnd = h.onRunEnd.bind(h), e.webnnOnReleaseSession = (f) => {
        h.onReleaseSession(f);
      }, e.webnnCreateMLTensorDownloader = (f, _) => h.createMLTensorDownloader(f, _), e.webnnRegisterMLTensor = (f, _, C, P) => h.registerMLTensor(f, _, C, P), e.webnnCreateMLContext = (f) => h.createMLContext(f), e.webnnRegisterMLConstant = (f, _, C, P, B, G) => h.registerMLConstant(f, _, C, P, B, e.Zc, G), e.webnnRegisterGraphInput = h.registerGraphInput.bind(h), e.webnnIsGraphInput = h.isGraphInput.bind(h), e.webnnRegisterGraphOutput = h.registerGraphOutput.bind(h), e.webnnIsGraphOutput = h.isGraphOutput.bind(h), e.webnnCreateTemporaryTensor = h.createTemporaryTensor.bind(h), e.webnnIsGraphInputOutputTypeSupported = h.isGraphInputOutputTypeSupported.bind(h);
    }
  };
  let s = () => {
    let a = (l) => (...h) => {
      let f = et2;
      return h = l(...h), et2 != f ? new Promise((_, C) => {
        En = { resolve: _, reject: C };
      }) : h;
    };
    (() => {
      for (let l of ["_OrtAppendExecutionProvider", "_OrtCreateSession", "_OrtRun", "_OrtRunWithBinding", "_OrtBindInput"]) e[l] = a(e[l]);
    })(), i !== void 0 && (e._OrtRun = i(e._OrtRun), e._OrtRunWithBinding = i(e._OrtRunWithBinding)), s = void 0;
  };
  e.asyncInit = () => {
    s == null ? void 0 : s();
  };
  var u, d, c = (a, l) => {
    throw l;
  }, p = import.meta.url, m = "";
  if (r || n) {
    try {
      m = new URL(".", p).href;
    } catch {
    }
    n && (d = (a) => {
      var l = new XMLHttpRequest();
      return l.open("GET", a, false), l.responseType = "arraybuffer", l.send(null), new Uint8Array(l.response);
    }), u = async (a) => {
      if (z2(a)) return new Promise((h, f) => {
        var _ = new XMLHttpRequest();
        _.open("GET", a, true), _.responseType = "arraybuffer", _.onload = () => {
          _.status == 200 || _.status == 0 && _.response ? h(_.response) : f(_.status);
        }, _.onerror = f, _.send(null);
      });
      var l = await fetch(a, { credentials: "same-origin" });
      if (l.ok) return l.arrayBuffer();
      throw Error(l.status + " : " + l.url);
    };
  }
  var g, b, y, w, S, x, $ = console.log.bind(console), T = console.error.bind(console), I = $, E = T, A = false, z2 = (a) => a.startsWith("file://");
  function v() {
    ht2.buffer != N.buffer && Te();
  }
  if (o) {
    let a = function(l) {
      try {
        var h = l.data, f = h.Uc;
        if (f === "load") {
          let _ = [];
          self.onmessage = (C) => _.push(C), x = () => {
            postMessage({ Uc: "loaded" });
            for (let C of _) a(C);
            self.onmessage = a;
          };
          for (let C of h.Ad) e[C] && !e[C].proxy || (e[C] = (...P) => {
            postMessage({ Uc: "callHandler", zd: C, args: P });
          }, C == "print" && (I = e[C]), C == "printErr" && (E = e[C]));
          ht2 = h.Vd, Te(), b = h.Wd, Se(), vr();
        } else if (f === "run") {
          (function(_) {
            var C = (v(), W)[_ + 52 >>> 2 >>> 0];
            _ = (v(), W)[_ + 56 >>> 2 >>> 0], Wi(C, C - _), de2(C);
          })(h.Tc), Dn(h.Tc, 0, 0, 1, 0, 0), Go(), In(h.Tc), M || (Mi(), M = true);
          try {
            op(h.Pd, h.dd);
          } catch (_) {
            if (_ != "unwind") throw _;
          }
        } else h.target !== "setimmediate" && (f === "checkMailbox" ? M && fr2() : f && (E(`worker: received unknown command ${f}`), E(h)));
      } catch (_) {
        throw Ri(), _;
      }
    };
    var M = false;
    self.onunhandledrejection = (l) => {
      throw l.reason || l;
    }, self.onmessage = a;
  }
  var N, K, q, Q, D, W, j, Y, Z, te, ie, we = false;
  function Te() {
    var a = ht2.buffer;
    e.HEAP8 = N = new Int8Array(a), q = new Int16Array(a), e.HEAPU8 = K = new Uint8Array(a), Q = new Uint16Array(a), e.HEAP32 = D = new Int32Array(a), e.HEAPU32 = W = new Uint32Array(a), j = new Float32Array(a), Y = new Float64Array(a), Z = new BigInt64Array(a), te = new BigUint64Array(a);
  }
  function re() {
    we = true, o ? x() : ct.tb();
  }
  function U(a) {
    throw E(a = "Aborted(" + a + ")"), A = true, a = new WebAssembly.RuntimeError(a + ". Build with -sASSERTIONS for more info."), S == null ? void 0 : S(a), a;
  }
  function X() {
    return { a: { ma: Em, hb: Am, g: ip, J: ap, f: sp, o: up, h: dp, ha: lp, b: cp, T: pp, Ia: Zo, n: mp, _: Jo, Ya: ei, Ea: ti, Ga: ri, Za: ni, Wa: oi, Pa: ii, Va: ai, ka: si, Fa: ui, Ca: di, Xa: li, Da: ci, cb: fp, ea: gp, xa: yp, va: wp, da: vp, O: $p, H: xp, wa: Sp, Z: Pp, ya: Op, Sa: zp, Aa: Bp, Ja: Mp, ta: Rp, fa: Up, Ra: In, $a: Np, R: Gp, s: jp, c: Sn, ib: Zp, y: Qp, M: Yp, D: Xp, m: Jp, t: wi, jb: em, I: tm, S: rm, j: nm, v: om, r: im, l: am, Ma: sm, Na: um, Oa: dm, Ka: xi, La: Si, ua: Ti, eb: cm, bb: fm, u: hm, aa: gm, ga: ym, ab: pm, V: bm, _a: wm, Ba: _m, F: lm, U: vm, la: wr, za: xm, gb: $m, fb: Sm, Ta: Ei, Ua: ki, Ha: wn, $: Pi, ja: Oi, Qa: zi, ia: Di, lb: mf, na: af, mb: pf, oa: of, G: Zm, d: zm, q: Pm, w: km, B: Gm, pb: tf, K: qm, x: Bm, pa: rf, X: sf, ba: ef, nb: cf, ob: lf, ra: Qm, qa: Jm, qb: Ym, N: Km, Y: nf, e: Dm, A: Mm, k: Om, kb: ff, p: Um, z: Nm, C: Rm, E: Vm, L: Hm, rb: jm, Q: uf, ca: Fm, W: df, sb: Wm, sa: Lm, P: Xm, i: Im, a: ht2, db: dr2 } };
  }
  async function Se() {
    function a(f, _) {
      var C = ct = f.exports;
      f = {};
      for (let [P, B] of Object.entries(C)) typeof B == "function" ? (C = Vp(B), f[P] = C) : f[P] = B;
      return ct = f, ct = function() {
        var P = ct, B = (H) => (ue2) => H(ue2) >>> 0, G = (H) => () => H() >>> 0;
        return (P = Object.assign({}, P)).ub = B(P.ub), P.Yb = G(P.Yb), P._b = B(P._b), P.mc = B(P.mc), P.nc = G(P.nc), P.rc = B(P.rc), P;
      }(), Lo.push(ct.$b), Bi = (f = ct).ub, Mi = f.vb, e._OrtInit = f.wb, e._OrtGetLastError = f.xb, e._OrtCreateSessionOptions = f.yb, e._OrtAppendExecutionProvider = f.zb, e._OrtAddFreeDimensionOverride = f.Ab, e._OrtAddSessionConfigEntry = f.Bb, e._OrtReleaseSessionOptions = f.Cb, e._OrtCreateSession = f.Db, e._OrtReleaseSession = f.Eb, e._OrtGetInputOutputCount = f.Fb, e._OrtGetInputOutputMetadata = f.Gb, e._OrtFree = f.Hb, e._OrtCreateTensor = f.Ib, e._OrtGetTensorData = f.Jb, e._OrtReleaseTensor = f.Kb, e._OrtCreateRunOptions = f.Lb, e._OrtAddRunConfigEntry = f.Mb, e._OrtReleaseRunOptions = f.Nb, e._OrtCreateBinding = f.Ob, e._OrtBindInput = f.Pb, e._OrtBindOutput = f.Qb, e._OrtClearBoundOutputs = f.Rb, e._OrtReleaseBinding = f.Sb, e._OrtRunWithBinding = f.Tb, e._OrtRun = f.Ub, e._OrtEndProfiling = f.Vb, e._JsepOutput = f.Wb, e._JsepGetNodeName = f.Xb, _r = f.Yb, tt2 = e._free = f.Zb, Zt2 = e._malloc = f._b, Dn = f.bc, Ri = f.cc, Ui = f.dc, Ni = f.ec, Bn = f.fc, Vi = f.gc, Li = f.hc, ce2 = f.ic, Qt2 = f.jc, Wi = f.kc, de2 = f.lc, Mn = f.mc, le = f.nc, Gi = f.oc, Rn = f.pc, Hi = f.qc, Fi = f.rc, qi = f.sc, Un = f.tc, Ki = f.uc, ji = f.vc, Zi = f.wc, Qi = f.xc, Yi = f.yc, Xi = f.zc, Ji = f.Ac, ea = f.Bc, ta = f.Cc, ra = f.Dc, na = f.Ec, oa = f.Fc, ia = f.Gc, aa = f.Hc, sa = f.Ic, ua = f.Jc, da = f.Kc, la = f.Lc, ca = f.Mc, pa = f.Nc, ma = f.Oc, fa = f.Pc, ha = f.Rc, ga = f.Sc, ya = f.bd, ba = f.cd, wa = f.hd, _a2 = f.kd, va = f.ld, $a2 = f.md, xa = f.nd, Sa = f.od, Ta = f.pd, Ia = f.qd, Ca2 = f.rd, Aa = f.wd, Ea = f.Rd, ka2 = f.Sd, Pa2 = f.Td, Oa2 = f.Ud, b = _, ct;
    }
    var l, h = X();
    return e.instantiateWasm ? new Promise((f) => {
      e.instantiateWasm(h, (_, C) => {
        f(a(_, C));
      });
    }) : o ? a(new WebAssembly.Instance(b, X()), b) : (ie ?? (ie = e.locateFile ? e.locateFile ? e.locateFile("ort-wasm-simd-threaded.jsep.wasm", m) : m + "ort-wasm-simd-threaded.jsep.wasm" : new URL("" + new URL("ort-wasm-simd-threaded.jsep-6MnTkKum.wasm", import.meta.url).href, import.meta.url).href), l = await async function(f) {
      var _ = ie;
      if (!g && !z2(_)) try {
        var C = fetch(_, { credentials: "same-origin" });
        return await WebAssembly.instantiateStreaming(C, f);
      } catch (P) {
        E(`wasm streaming compile failed: ${P}`), E("falling back to ArrayBuffer instantiation");
      }
      return async function(P, B) {
        try {
          var G = await async function(H) {
            if (!g) try {
              var ue2 = await u(H);
              return new Uint8Array(ue2);
            } catch {
            }
            if (H == ie && g) H = new Uint8Array(g);
            else {
              if (!d) throw "both async and sync fetching of the wasm failed";
              H = d(H);
            }
            return H;
          }(P);
          return await WebAssembly.instantiate(G, B);
        } catch (H) {
          E(`failed to asynchronously prepare wasm: ${H}`), U(H);
        }
      }(_, f);
    }(h), a(l.instance, l.module));
  }
  class Be {
    constructor(l) {
      __publicField(this, "name", "ExitStatus");
      this.message = `Program terminated with exit(${l})`, this.status = l;
    }
  }
  var ze2 = (a) => {
    a.terminate(), a.onmessage = () => {
    };
  }, Xe = [], Ce = 0, $e2 = null, Fe = (a) => {
    ft.length == 0 && (Fo(), Ho(ft[0]));
    var l = ft.pop();
    if (!l) return 6;
    Kt2.push(l), It2[a.Tc] = l, l.Tc = a.Tc;
    var h = { Uc: "run", Pd: a.Od, dd: a.dd, Tc: a.Tc };
    return l.postMessage(h, a.ud), 0;
  }, Ue = 0, ve = (a, l, ...h) => {
    var f, _ = 16 * h.length, C = le(), P = Mn(_), B = P >>> 3;
    for (f of h) typeof f == "bigint" ? ((v(), Z)[B++ >>> 0] = 1n, (v(), Z)[B++ >>> 0] = f) : ((v(), Z)[B++ >>> 0] = 0n, (v(), Y)[B++ >>> 0] = f);
    return a = Ui(a, 0, _, P, l), de2(C), a;
  };
  function dr2(a) {
    if (o) return ve(0, 1, a);
    if (y = a, !(0 < Ue)) {
      for (var l of Kt2) ze2(l);
      for (l of ft) ze2(l);
      ft = [], Kt2 = [], It2 = {}, A = true;
    }
    c(0, new Be(a));
  }
  function Vo(a) {
    if (o) return ve(1, 0, a);
    wn(a);
  }
  var wn = (a) => {
    if (y = a, o) throw Vo(a), "unwind";
    dr2(a);
  }, ft = [], Kt2 = [], Lo = [], It2 = {}, Wo = (a) => {
    var l = a.Tc;
    delete It2[l], ft.push(a), Kt2.splice(Kt2.indexOf(a), 1), a.Tc = 0, Ni(l);
  };
  function Go() {
    Lo.forEach((a) => a());
  }
  var Ho = (a) => new Promise((l) => {
    a.onmessage = (_) => {
      var C = _.data;
      if (_ = C.Uc, C.ad && C.ad != _r()) {
        var P = It2[C.ad];
        P ? P.postMessage(C, C.ud) : E(`Internal error! Worker sent a message "${_}" to target pthread ${C.ad}, but that thread no longer exists!`);
      } else _ === "checkMailbox" ? fr2() : _ === "spawnThread" ? Fe(C) : _ === "cleanupThread" ? mr2(() => {
        Wo(It2[C.Qd]);
      }) : _ === "loaded" ? (a.loaded = true, l(a)) : C.target === "setimmediate" ? a.postMessage(C) : _ === "uncaughtException" ? a.onerror(C.error) : _ === "callHandler" ? e[C.zd](...C.args) : _ && E(`worker sent an unknown command ${_}`);
    }, a.onerror = (_) => {
      throw E(`worker sent an error! ${_.filename}:${_.lineno}: ${_.message}`), _;
    };
    var h, f = [];
    for (h of []) e.propertyIsEnumerable(h) && f.push(h);
    a.postMessage({ Uc: "load", Ad: f, Vd: ht2, Wd: b });
  });
  function Fo() {
    var a = new Worker((() => {
      let l = URL;
      return import.meta.url > "file:" && import.meta.url < "file;" ? new l("ort.bundle.min.mjs", import.meta.url) : new URL(import.meta.url);
    })(), { type: "module", workerData: "em-pthread", name: "em-pthread" });
    ft.push(a);
  }
  var ht2, op = (a, l) => {
    Ue = 0, a = Un(a, l), 0 < Ue ? y = a : Bn(a);
  }, lr2 = [], cr2 = 0;
  function ip(a) {
    var l = new _n(a >>>= 0);
    return (v(), N)[l.Vc + 12 >>> 0] == 0 && (qo(l, true), cr2--), Ko(l, false), lr2.push(l), Fi(a);
  }
  var Ut = 0, ap = () => {
    ce2(0, 0);
    var a = lr2.pop();
    Gi(a.ed), Ut = 0;
  };
  function qo(a, l) {
    l = l ? 1 : 0, (v(), N)[a.Vc + 12 >>> 0] = l;
  }
  function Ko(a, l) {
    l = l ? 1 : 0, (v(), N)[a.Vc + 13 >>> 0] = l;
  }
  class _n {
    constructor(l) {
      this.ed = l, this.Vc = l - 24;
    }
  }
  var vn = (a) => {
    var l = Ut;
    if (!l) return Qt2(0), 0;
    var h = new _n(l);
    (v(), W)[h.Vc + 16 >>> 2 >>> 0] = l;
    var f = (v(), W)[h.Vc + 4 >>> 2 >>> 0];
    if (!f) return Qt2(0), l;
    for (var _ of a) {
      if (_ === 0 || _ === f) break;
      if (Hi(_, f, h.Vc + 16)) return Qt2(_), l;
    }
    return Qt2(f), l;
  };
  function sp() {
    return vn([]);
  }
  function up(a) {
    return vn([a >>> 0]);
  }
  function dp(a, l, h, f) {
    return vn([a >>> 0, l >>> 0, h >>> 0, f >>> 0]);
  }
  var lp = () => {
    var a = lr2.pop();
    a || U("no exception to throw");
    var l = a.ed;
    throw (v(), N)[a.Vc + 13 >>> 0] == 0 && (lr2.push(a), Ko(a, true), qo(a, false), cr2++), Rn(l), Ut = l;
  };
  function cp(a, l, h) {
    var f = new _n(a >>>= 0);
    throw l >>>= 0, h >>>= 0, (v(), W)[f.Vc + 16 >>> 2 >>> 0] = 0, (v(), W)[f.Vc + 4 >>> 2 >>> 0] = l, (v(), W)[f.Vc + 8 >>> 2 >>> 0] = h, Rn(a), cr2++, Ut = a;
  }
  var pp = () => cr2;
  function jo(a, l, h, f) {
    return o ? ve(2, 1, a, l, h, f) : Zo(a, l, h, f);
  }
  function Zo(a, l, h, f) {
    if (a >>>= 0, l >>>= 0, h >>>= 0, f >>>= 0, !globalThis.SharedArrayBuffer) return 6;
    var _ = [];
    return o && _.length === 0 ? jo(a, l, h, f) : (a = { Od: h, Tc: a, dd: f, ud: _ }, o ? (a.Uc = "spawnThread", postMessage(a, _), 0) : Fe(a));
  }
  function mp(a) {
    throw Ut || (Ut = a >>> 0), Ut;
  }
  var Qo = globalThis.TextDecoder && new TextDecoder(), Yo = (a, l, h, f) => {
    if (h = l + h, f) return h;
    for (; a[l] && !(l >= h); ) ++l;
    return l;
  }, Xo = (a, l = 0, h, f) => {
    if (16 < (h = Yo(a, l >>>= 0, h, f)) - l && a.buffer && Qo) return Qo.decode(a.buffer instanceof ArrayBuffer ? a.subarray(l, h) : a.slice(l, h));
    for (f = ""; l < h; ) {
      var _ = a[l++];
      if (128 & _) {
        var C = 63 & a[l++];
        if ((224 & _) == 192) f += String.fromCharCode((31 & _) << 6 | C);
        else {
          var P = 63 & a[l++];
          65536 > (_ = (240 & _) == 224 ? (15 & _) << 12 | C << 6 | P : (7 & _) << 18 | C << 12 | P << 6 | 63 & a[l++]) ? f += String.fromCharCode(_) : (_ -= 65536, f += String.fromCharCode(55296 | _ >> 10, 56320 | 1023 & _));
        }
      } else f += String.fromCharCode(_);
    }
    return f;
  }, Ae = (a, l, h) => (a >>>= 0) ? Xo((v(), K), a, l, h) : "";
  function Jo(a, l, h) {
    return o ? ve(3, 1, a, l, h) : 0;
  }
  function ei(a, l) {
    if (o) return ve(4, 1, a, l);
  }
  function ti(a, l) {
    if (o) return ve(5, 1, a, l);
  }
  function ri(a, l, h) {
    if (o) return ve(6, 1, a, l, h);
  }
  function ni(a, l, h) {
    return o ? ve(7, 1, a, l, h) : 0;
  }
  function oi(a, l) {
    if (o) return ve(8, 1, a, l);
  }
  function ii(a, l, h) {
    if (o) return ve(9, 1, a, l, h);
  }
  function ai(a, l, h, f) {
    if (o) return ve(10, 1, a, l, h, f);
  }
  function si(a, l, h, f) {
    if (o) return ve(11, 1, a, l, h, f);
  }
  function ui(a, l, h, f) {
    if (o) return ve(12, 1, a, l, h, f);
  }
  function di(a) {
    if (o) return ve(13, 1, a);
  }
  function li(a, l) {
    if (o) return ve(14, 1, a, l);
  }
  function ci(a, l, h) {
    if (o) return ve(15, 1, a, l, h);
  }
  var fp = () => U(""), Je = (a) => {
    a >>>= 0;
    for (var l = ""; ; ) {
      var h = (v(), K)[a++ >>> 0];
      if (!h) return l;
      l += String.fromCharCode(h);
    }
  }, $n = {}, xn = {}, Nt = class extends Error {
    constructor(a) {
      super(a), this.name = "BindingError";
    }
  };
  function lt(a, l, h = {}) {
    return function(f, _, C = {}) {
      var P = _.name;
      if (!f) throw new Nt(`type "${P}" must have a positive integer typeid pointer`);
      if (xn.hasOwnProperty(f)) {
        if (C.Bd) return;
        throw new Nt(`Cannot register type '${P}' twice`);
      }
      xn[f] = _, $n.hasOwnProperty(f) && (_ = $n[f], delete $n[f], _.forEach((B) => B()));
    }(a, l, h);
  }
  var pi = (a, l, h) => {
    switch (l) {
      case 1:
        return h ? (f) => (v(), N)[f >>> 0] : (f) => (v(), K)[f >>> 0];
      case 2:
        return h ? (f) => (v(), q)[f >>> 1 >>> 0] : (f) => (v(), Q)[f >>> 1 >>> 0];
      case 4:
        return h ? (f) => (v(), D)[f >>> 2 >>> 0] : (f) => (v(), W)[f >>> 2 >>> 0];
      case 8:
        return h ? (f) => (v(), Z)[f >>> 3 >>> 0] : (f) => (v(), te)[f >>> 3 >>> 0];
      default:
        throw new TypeError(`invalid integer width (${l}): ${a}`);
    }
  };
  function gp(a, l, h, f, _) {
    a >>>= 0, h >>>= 0, l = Je(l >>> 0);
    let C = (P) => P;
    if (f = f === 0n) {
      let P = 8 * h;
      C = (B) => BigInt.asUintN(P, B), _ = C(_);
    }
    lt(a, { name: l, Qc: C, Xc: (P, B) => (typeof B == "number" && (B = BigInt(B)), B), Wc: pi(l, h, !f), Yc: null });
  }
  function yp(a, l, h, f) {
    lt(a >>>= 0, { name: l = Je(l >>> 0), Qc: function(_) {
      return !!_;
    }, Xc: function(_, C) {
      return C ? h : f;
    }, Wc: function(_) {
      return this.Qc((v(), K)[_ >>> 0]);
    }, Yc: null });
  }
  var mi = [], Ct = [0, 1, , 1, null, 1, true, 1, false, 1];
  function Sn(a) {
    9 < (a >>>= 0) && --Ct[a + 1] == 0 && (Ct[a] = void 0, mi.push(a));
  }
  var Ge2 = (a) => {
    if (!a) throw new Nt(`Cannot use deleted val. handle = ${a}`);
    return Ct[a];
  }, qe = (a) => {
    switch (a) {
      case void 0:
        return 2;
      case null:
        return 4;
      case true:
        return 6;
      case false:
        return 8;
      default:
        let l = mi.pop() || Ct.length;
        return Ct[l] = a, Ct[l + 1] = 1, l;
    }
  };
  function Tn(a) {
    return this.Qc((v(), W)[a >>> 2 >>> 0]);
  }
  var bp = { name: "emscripten::val", Qc: (a) => {
    var l = Ge2(a);
    return Sn(a), l;
  }, Xc: (a, l) => qe(l), Wc: Tn, Yc: null };
  function wp(a) {
    return lt(a >>> 0, bp);
  }
  var _p = (a, l) => {
    switch (l) {
      case 4:
        return function(h) {
          return this.Qc((v(), j)[h >>> 2 >>> 0]);
        };
      case 8:
        return function(h) {
          return this.Qc((v(), Y)[h >>> 3 >>> 0]);
        };
      default:
        throw new TypeError(`invalid float width (${l}): ${a}`);
    }
  };
  function vp(a, l, h) {
    h >>>= 0, lt(a >>>= 0, { name: l = Je(l >>> 0), Qc: (f) => f, Xc: (f, _) => _, Wc: _p(l, h), Yc: null });
  }
  function $p(a, l, h, f, _) {
    a >>>= 0, h >>>= 0, l = Je(l >>> 0);
    let C = (B) => B;
    if (f === 0) {
      var P = 32 - 8 * h;
      C = (B) => B << P >>> P, _ = C(_);
    }
    lt(a, { name: l, Qc: C, Xc: (B, G) => G, Wc: pi(l, h, f !== 0), Yc: null });
  }
  function xp(a, l, h) {
    function f(C) {
      var P = (v(), W)[C >>> 2 >>> 0];
      return C = (v(), W)[C + 4 >>> 2 >>> 0], new _((v(), N).buffer, C, P);
    }
    var _ = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array][l];
    lt(a >>>= 0, { name: h = Je(h >>> 0), Qc: f, Wc: f }, { Bd: true });
  }
  var gt = (a, l, h) => {
    var f = (v(), K);
    if (l >>>= 0, 0 < h) {
      var _ = l;
      h = l + h - 1;
      for (var C = 0; C < a.length; ++C) {
        var P = a.codePointAt(C);
        if (127 >= P) {
          if (l >= h) break;
          f[l++ >>> 0] = P;
        } else if (2047 >= P) {
          if (l + 1 >= h) break;
          f[l++ >>> 0] = 192 | P >> 6, f[l++ >>> 0] = 128 | 63 & P;
        } else if (65535 >= P) {
          if (l + 2 >= h) break;
          f[l++ >>> 0] = 224 | P >> 12, f[l++ >>> 0] = 128 | P >> 6 & 63, f[l++ >>> 0] = 128 | 63 & P;
        } else {
          if (l + 3 >= h) break;
          f[l++ >>> 0] = 240 | P >> 18, f[l++ >>> 0] = 128 | P >> 12 & 63, f[l++ >>> 0] = 128 | P >> 6 & 63, f[l++ >>> 0] = 128 | 63 & P, C++;
        }
      }
      f[l >>> 0] = 0, a = l - _;
    } else a = 0;
    return a;
  }, pr2 = (a) => {
    for (var l = 0, h = 0; h < a.length; ++h) {
      var f = a.charCodeAt(h);
      127 >= f ? l++ : 2047 >= f ? l += 2 : 55296 <= f && 57343 >= f ? (l += 4, ++h) : l += 3;
    }
    return l;
  };
  function Sp(a, l) {
    lt(a >>>= 0, { name: l = Je(l >>> 0), Qc(h) {
      var f = (v(), W)[h >>> 2 >>> 0];
      return f = Ae(h + 4, f, true), tt2(h), f;
    }, Xc(h, f) {
      f instanceof ArrayBuffer && (f = new Uint8Array(f));
      var _ = typeof f == "string";
      if (!(_ || ArrayBuffer.isView(f) && f.BYTES_PER_ELEMENT == 1)) throw new Nt("Cannot pass non-string to std::string");
      var C = _ ? pr2(f) : f.length, P = Zt2(4 + C + 1), B = P + 4;
      return (v(), W)[P >>> 2 >>> 0] = C, _ ? gt(f, B, C + 1) : (v(), K).set(f, B >>> 0), h !== null && h.push(tt2, P), P;
    }, Wc: Tn, Yc(h) {
      tt2(h);
    } });
  }
  var fi = globalThis.TextDecoder ? new TextDecoder("utf-16le") : void 0, Tp = (a, l, h) => {
    if (a >>>= 1, 16 < (l = Yo((v(), Q), a, l / 2, h)) - a && fi) return fi.decode((v(), Q).slice(a, l));
    for (h = ""; a < l; ++a) {
      var f = (v(), Q)[a >>> 0];
      h += String.fromCharCode(f);
    }
    return h;
  }, Ip = (a, l, h) => {
    if (h ?? (h = 2147483647), 2 > h) return 0;
    var f = l;
    h = (h -= 2) < 2 * a.length ? h / 2 : a.length;
    for (var _ = 0; _ < h; ++_) {
      var C = a.charCodeAt(_);
      (v(), q)[l >>> 1 >>> 0] = C, l += 2;
    }
    return (v(), q)[l >>> 1 >>> 0] = 0, l - f;
  }, Cp = (a) => 2 * a.length, Ap = (a, l, h) => {
    var f = "";
    a >>>= 2;
    for (var _ = 0; !(_ >= l / 4); _++) {
      var C = (v(), W)[a + _ >>> 0];
      if (!C && !h) break;
      f += String.fromCodePoint(C);
    }
    return f;
  }, Ep = (a, l, h) => {
    if (l >>>= 0, h ?? (h = 2147483647), 4 > h) return 0;
    var f = l;
    h = f + h - 4;
    for (var _ = 0; _ < a.length; ++_) {
      var C = a.codePointAt(_);
      if (65535 < C && _++, (v(), D)[l >>> 2 >>> 0] = C, (l += 4) + 4 > h) break;
    }
    return (v(), D)[l >>> 2 >>> 0] = 0, l - f;
  }, kp = (a) => {
    for (var l = 0, h = 0; h < a.length; ++h) 65535 < a.codePointAt(h) && h++, l += 4;
    return l;
  };
  function Pp(a, l, h) {
    if (a >>>= 0, l >>>= 0, h = Je(h >>>= 0), l === 2) var f = Tp, _ = Ip, C = Cp;
    else f = Ap, _ = Ep, C = kp;
    lt(a, { name: h, Qc: (P) => {
      var B = (v(), W)[P >>> 2 >>> 0];
      return B = f(P + 4, B * l, true), tt2(P), B;
    }, Xc: (P, B) => {
      if (typeof B != "string") throw new Nt(`Cannot pass non-string to C++ string type ${h}`);
      var G = C(B), H = Zt2(4 + G + l);
      return (v(), W)[H >>> 2 >>> 0] = G / l, _(B, H + 4, G + l), P !== null && P.push(tt2, H), H;
    }, Wc: Tn, Yc(P) {
      tt2(P);
    } });
  }
  function Op(a, l) {
    lt(a >>>= 0, { Cd: true, name: l = Je(l >>> 0), Qc: () => {
    }, Xc: () => {
    } });
  }
  function zp(a) {
    Dn(a >>> 0, !n, 1, !r, 131072, false), Go();
  }
  var mr2 = (a) => {
    if (!A) try {
      if (a(), !(0 < Ue)) try {
        o ? _r() && Bn(y) : wn(y);
      } catch (l) {
        l instanceof Be || l == "unwind" || c(0, l);
      }
    } catch (l) {
      l instanceof Be || l == "unwind" || c(0, l);
    }
  }, Dp = !Atomics.waitAsync || ((_b = globalThis.navigator) == null ? void 0 : _b.userAgent) && 91 > Number((navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./) || [])[2]);
  function In(a) {
    a >>>= 0, Dp || (Atomics.waitAsync((v(), D), a >>> 2, a).value.then(fr2), a += 128, Atomics.store((v(), D), a >>> 2, 1));
  }
  var fr2 = () => mr2(() => {
    var a = _r();
    a && (In(a), Li());
  });
  function Bp(a, l) {
    (a >>>= 0) == l >>> 0 ? setTimeout(fr2) : o ? postMessage({ ad: a, Uc: "checkMailbox" }) : (a = It2[a]) && a.postMessage({ Uc: "checkMailbox" });
  }
  var Cn = [];
  function Mp(a, l, h, f, _) {
    for (l >>>= 0, _ >>>= 0, Cn.length = 0, h = _ >>> 3, f = _ + f >>> 3; h < f; ) {
      var C;
      C = (v(), Z)[h++ >>> 0] ? (v(), Z)[h++ >>> 0] : (v(), Y)[h++ >>> 0], Cn.push(C);
    }
    return (l ? Nn[l] : Cm[a])(...Cn);
  }
  var Rp = () => {
    Ue = 0;
  };
  function Up(a) {
    a >>>= 0, o ? postMessage({ Uc: "cleanupThread", Qd: a }) : Wo(It2[a]);
  }
  function Np(a) {
  }
  var hr2 = (a) => {
    try {
      a();
    } catch (l) {
      U(l);
    }
  };
  function Vp(a) {
    var l = (...h) => {
      gr.push(a);
      try {
        return a(...h);
      } finally {
        A || (gr.pop(), et2 && yt2 === 1 && gr.length === 0 && (yt2 = 0, Ue += 1, hr2(ka2), typeof Fibers < "u" && Fibers.ce()));
      }
    };
    return yi.set(a, l), l;
  }
  var yt2 = 0, et2 = null, hi = 0, gr = [], An = /* @__PURE__ */ new Map(), gi = /* @__PURE__ */ new Map(), yi = /* @__PURE__ */ new Map(), Lp = 0, En = null, Wp = [], bi = (a) => function(l) {
    if (!A) {
      if (yt2 === 0) {
        var h = false, f = false;
        l((_ = 0) => {
          if (!A && (hi = _, h = true, f)) {
            yt2 = 2, hr2(() => Pa2(et2)), typeof MainLoop < "u" && MainLoop.yd && MainLoop.resume(), _ = false;
            try {
              var C = function() {
                var G = (v(), D)[et2 + 8 >>> 2 >>> 0];
                return G = gi.get(G), G = yi.get(G), --Ue, G();
              }();
            } catch (G) {
              C = G, _ = true;
            }
            var P = false;
            if (!et2) {
              var B = En;
              B && (En = null, (_ ? B.reject : B.resolve)(C), P = true);
            }
            if (_ && !P) throw C;
          }
        }), f = true, h || (yt2 = 1, et2 = function() {
          var _ = Zt2(65548), C = _ + 12;
          if ((v(), W)[_ >>> 2 >>> 0] = C, (v(), W)[_ + 4 >>> 2 >>> 0] = C + 65536, C = gr[0], !An.has(C)) {
            var P = Lp++;
            An.set(C, P), gi.set(P, C);
          }
          return C = An.get(C), (v(), D)[_ + 8 >>> 2 >>> 0] = C, _;
        }(), typeof MainLoop < "u" && MainLoop.yd && MainLoop.pause(), hr2(() => Ea(et2)));
      } else yt2 === 2 ? (yt2 = 0, hr2(Oa2), tt2(et2), et2 = null, Wp.forEach(mr2)) : U(`invalid state: ${yt2}`);
      return hi;
    }
  }((l) => {
    a().then(l);
  });
  function Gp(a) {
    return a >>>= 0, bi(async () => {
      var l = await Ge2(a);
      return qe(l);
    });
  }
  var kn = [], Hp = (a) => {
    var l = kn.length;
    return kn.push(a), l;
  }, Fp = (a, l) => {
    for (var h = Array(a), f = 0; f < a; ++f) {
      var _ = f, C = (v(), W)[l + 4 * f >>> 2 >>> 0], P = xn[C];
      if (P === void 0) throw a = `parameter ${f}`, C = Bi(C), l = Je(C), tt2(C), new Nt(`${a} has unknown type ${l}`);
      h[_] = P;
    }
    return h;
  }, qp = (a, l, h) => {
    var f = [];
    return a = a(f, h), f.length && ((v(), W)[l >>> 2 >>> 0] = qe(f)), a;
  }, Kp = {}, yr2 = (a) => {
    var l = Kp[a];
    return l === void 0 ? Je(a) : l;
  };
  function jp(a, l, h) {
    var [f, ..._] = Fp(a, l >>> 0);
    l = f.Xc.bind(f);
    var C = _.map((G) => G.Wc.bind(G));
    a--;
    var P = { toValue: Ge2 };
    switch (a = C.map((G, H) => {
      var ue2 = `argFromPtr${H}`;
      return P[ue2] = G, `${ue2}(args${H ? "+" + 8 * H : ""})`;
    }), h) {
      case 0:
        var B = "toValue(handle)";
        break;
      case 2:
        B = "new (toValue(handle))";
        break;
      case 3:
        B = "";
        break;
      case 1:
        P.getStringOrSymbol = yr2, B = "toValue(handle)[getStringOrSymbol(methodName)]";
    }
    return B += `(${a})`, f.Cd || (P.toReturnWire = l, P.emval_returnValue = qp, B = `return emval_returnValue(toReturnWire, destructorsRef, ${B})`), B = `return function (handle, methodName, destructorsRef, args) {
  ${B}
  }`, h = new Function(Object.keys(P), B)(...Object.values(P)), B = `methodCaller<(${_.map((G) => G.name)}) => ${f.name}>`, Hp(Object.defineProperty(h, "name", { value: B }));
  }
  function Zp(a, l) {
    return l >>>= 0, (a = Ge2(a >>> 0)) == Ge2(l);
  }
  function Qp(a) {
    return (a >>>= 0) ? (a = yr2(a), qe(globalThis[a])) : qe(globalThis);
  }
  function Yp(a) {
    return a = yr2(a >>> 0), qe(e[a]);
  }
  function Xp(a, l) {
    return l >>>= 0, a = Ge2(a >>> 0), l = Ge2(l), qe(a[l]);
  }
  function Jp(a) {
    9 < (a >>>= 0) && (Ct[a + 1] += 1);
  }
  function wi(a, l, h, f, _) {
    return kn[a >>> 0](l >>> 0, h >>> 0, f >>> 0, _ >>> 0);
  }
  function em(a, l, h, f, _) {
    return wi(a >>> 0, l >>> 0, h >>> 0, f >>> 0, _ >>> 0);
  }
  function tm() {
    return qe([]);
  }
  function rm(a) {
    a = Ge2(a >>> 0);
    for (var l = Array(a.length), h = 0; h < a.length; h++) l[h] = a[h];
    return qe(l);
  }
  function nm(a) {
    return qe(yr2(a >>> 0));
  }
  function om() {
    return qe({});
  }
  function im(a) {
    for (var l = Ge2(a >>>= 0); l.length; ) {
      var h = l.pop();
      l.pop()(h);
    }
    Sn(a);
  }
  function am(a, l, h) {
    l >>>= 0, h >>>= 0, a = Ge2(a >>> 0), l = Ge2(l), h = Ge2(h), a[l] = h;
  }
  function sm(a, l) {
    a = -9007199254740992 > a || 9007199254740992 < a ? NaN : Number(a), l >>>= 0, a = new Date(1e3 * a), (v(), D)[l >>> 2 >>> 0] = a.getUTCSeconds(), (v(), D)[l + 4 >>> 2 >>> 0] = a.getUTCMinutes(), (v(), D)[l + 8 >>> 2 >>> 0] = a.getUTCHours(), (v(), D)[l + 12 >>> 2 >>> 0] = a.getUTCDate(), (v(), D)[l + 16 >>> 2 >>> 0] = a.getUTCMonth(), (v(), D)[l + 20 >>> 2 >>> 0] = a.getUTCFullYear() - 1900, (v(), D)[l + 24 >>> 2 >>> 0] = a.getUTCDay(), a = (a.getTime() - Date.UTC(a.getUTCFullYear(), 0, 1, 0, 0, 0, 0)) / 864e5 | 0, (v(), D)[l + 28 >>> 2 >>> 0] = a;
  }
  var _i = (a) => a % 4 == 0 && (a % 100 != 0 || a % 400 == 0), vi = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335], $i = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  function um(a, l) {
    a = -9007199254740992 > a || 9007199254740992 < a ? NaN : Number(a), l >>>= 0, a = new Date(1e3 * a), (v(), D)[l >>> 2 >>> 0] = a.getSeconds(), (v(), D)[l + 4 >>> 2 >>> 0] = a.getMinutes(), (v(), D)[l + 8 >>> 2 >>> 0] = a.getHours(), (v(), D)[l + 12 >>> 2 >>> 0] = a.getDate(), (v(), D)[l + 16 >>> 2 >>> 0] = a.getMonth(), (v(), D)[l + 20 >>> 2 >>> 0] = a.getFullYear() - 1900, (v(), D)[l + 24 >>> 2 >>> 0] = a.getDay();
    var h = (_i(a.getFullYear()) ? vi : $i)[a.getMonth()] + a.getDate() - 1 | 0;
    (v(), D)[l + 28 >>> 2 >>> 0] = h, (v(), D)[l + 36 >>> 2 >>> 0] = -60 * a.getTimezoneOffset(), h = new Date(a.getFullYear(), 6, 1).getTimezoneOffset();
    var f = new Date(a.getFullYear(), 0, 1).getTimezoneOffset();
    a = 0 | (h != f && a.getTimezoneOffset() == Math.min(f, h)), (v(), D)[l + 32 >>> 2 >>> 0] = a;
  }
  function dm(a) {
    a >>>= 0;
    var l = new Date((v(), D)[a + 20 >>> 2 >>> 0] + 1900, (v(), D)[a + 16 >>> 2 >>> 0], (v(), D)[a + 12 >>> 2 >>> 0], (v(), D)[a + 8 >>> 2 >>> 0], (v(), D)[a + 4 >>> 2 >>> 0], (v(), D)[a >>> 2 >>> 0], 0), h = (v(), D)[a + 32 >>> 2 >>> 0], f = l.getTimezoneOffset(), _ = new Date(l.getFullYear(), 6, 1).getTimezoneOffset(), C = new Date(l.getFullYear(), 0, 1).getTimezoneOffset(), P = Math.min(C, _);
    return 0 > h ? (v(), D)[a + 32 >>> 2 >>> 0] = +(_ != C && P == f) : 0 < h != (P == f) && (_ = Math.max(C, _), l.setTime(l.getTime() + 6e4 * ((0 < h ? P : _) - f))), (v(), D)[a + 24 >>> 2 >>> 0] = l.getDay(), h = (_i(l.getFullYear()) ? vi : $i)[l.getMonth()] + l.getDate() - 1 | 0, (v(), D)[a + 28 >>> 2 >>> 0] = h, (v(), D)[a >>> 2 >>> 0] = l.getSeconds(), (v(), D)[a + 4 >>> 2 >>> 0] = l.getMinutes(), (v(), D)[a + 8 >>> 2 >>> 0] = l.getHours(), (v(), D)[a + 12 >>> 2 >>> 0] = l.getDate(), (v(), D)[a + 16 >>> 2 >>> 0] = l.getMonth(), (v(), D)[a + 20 >>> 2 >>> 0] = l.getYear(), a = l.getTime(), BigInt(isNaN(a) ? -1 : a / 1e3);
  }
  function xi(a, l, h, f, _, C, P) {
    return o ? ve(16, 1, a, l, h, f, _, C, P) : -52;
  }
  function Si(a, l, h, f, _, C) {
    if (o) return ve(17, 1, a, l, h, f, _, C);
  }
  var jt2 = {}, lm = () => performance.timeOrigin + performance.now();
  function Ti(a, l) {
    if (o) return ve(18, 1, a, l);
    if (jt2[a] && (clearTimeout(jt2[a].id), delete jt2[a]), !l) return 0;
    var h = setTimeout(() => {
      delete jt2[a], mr2(() => Vi(a, performance.timeOrigin + performance.now()));
    }, l);
    return jt2[a] = { id: h, be: l }, 0;
  }
  function cm(a, l, h, f) {
    a >>>= 0, l >>>= 0, h >>>= 0, f >>>= 0;
    var _ = (/* @__PURE__ */ new Date()).getFullYear(), C = new Date(_, 0, 1).getTimezoneOffset();
    _ = new Date(_, 6, 1).getTimezoneOffset();
    var P = Math.max(C, _);
    (v(), W)[a >>> 2 >>> 0] = 60 * P, (v(), D)[l >>> 2 >>> 0] = +(C != _), a = (l = (B) => {
      var G = Math.abs(B);
      return `UTC${0 <= B ? "-" : "+"}${String(Math.floor(G / 60)).padStart(2, "0")}${String(G % 60).padStart(2, "0")}`;
    })(C), l = l(_), _ < C ? (gt(a, h, 17), gt(l, f, 17)) : (gt(a, f, 17), gt(l, h, 17));
  }
  var pm = () => Date.now();
  function fm(a, l, h) {
    if (h >>>= 0, !(0 <= a && 3 >= a)) return 28;
    if (a === 0) a = Date.now();
    else {
      a = performance.timeOrigin + performance.now();
    }
    return a = Math.round(1e6 * a), (v(), Z)[h >>> 3 >>> 0] = BigInt(a), 0;
  }
  var Pn = [], Ii = (a, l) => {
    Pn.length = 0;
    for (var h; h = (v(), K)[a++ >>> 0]; ) {
      var f = h != 105;
      l += (f &= h != 112) && l % 8 ? 4 : 0, Pn.push(h == 112 ? (v(), W)[l >>> 2 >>> 0] : h == 106 ? (v(), Z)[l >>> 3 >>> 0] : h == 105 ? (v(), D)[l >>> 2 >>> 0] : (v(), Y)[l >>> 3 >>> 0]), l += f ? 8 : 4;
    }
    return Pn;
  };
  function hm(a, l, h) {
    return a >>>= 0, l = Ii(l >>> 0, h >>> 0), Nn[a](...l);
  }
  function gm(a, l, h) {
    return a >>>= 0, l = Ii(l >>> 0, h >>> 0), Nn[a](...l);
  }
  var ym = () => {
  };
  function bm(a, l) {
    return E(Ae(a >>> 0, l >>> 0));
  }
  var wm = () => {
    throw Ue += 1, "unwind";
  };
  function _m() {
    return 4294901760;
  }
  var vm = () => navigator.hardwareConcurrency, At2 = {}, br2 = (a) => {
    var l;
    return (l = /\bwasm-function\[\d+\]:(0x[0-9a-f]+)/.exec(a)) ? +l[1] : (l = /:(\d+):\d+(?:\)|$)/.exec(a)) ? 2147483648 | +l[1] : 0;
  }, Ci = (a) => {
    for (var l of a) (a = br2(l)) && (At2[a] = l);
  };
  function $m() {
    var a = Error().stack.toString().split(`
`);
    return a[0] == "Error" && a.shift(), Ci(a), At2.sd = br2(a[3]), At2.Md = a, At2.sd;
  }
  function wr(a) {
    if (!(a = At2[a >>> 0])) return 0;
    var l;
    if (l = /^\s+at .*\.wasm\.(.*) \(.*\)$/.exec(a)) a = l[1];
    else if (l = /^\s+at (.*) \(.*\)$/.exec(a)) a = l[1];
    else {
      if (!(l = /^(.+?)@/.exec(a))) return 0;
      a = l[1];
    }
    tt2(wr.td ?? 0), l = pr2(a) + 1;
    var h = Zt2(l);
    return h && gt(a, h, l), wr.td = h, wr.td;
  }
  function xm(a) {
    a >>>= 0;
    var l = (v(), K).length;
    if (a <= l || 4294901760 < a) return false;
    for (var h = 1; 4 >= h; h *= 2) {
      var f = l * (1 + 0.2 / h);
      f = Math.min(f, a + 100663296);
      e: {
        f = (Math.min(4294901760, 65536 * Math.ceil(Math.max(a, f) / 65536)) - ht2.buffer.byteLength + 65535) / 65536 | 0;
        try {
          ht2.grow(f), Te();
          var _ = 1;
          break e;
        } catch {
        }
        _ = void 0;
      }
      if (_) return true;
    }
    return false;
  }
  function Sm(a, l, h) {
    if (a >>>= 0, l >>>= 0, At2.sd == a) var f = At2.Md;
    else (f = Error().stack.toString().split(`
`))[0] == "Error" && f.shift(), Ci(f);
    for (var _ = 3; f[_] && br2(f[_]) != a; ) ++_;
    for (a = 0; a < h && f[a + _]; ++a) (v(), D)[l + 4 * a >>> 2 >>> 0] = br2(f[a + _]);
    return a;
  }
  var On, zn = {}, Ai = () => {
    var _a4;
    if (!On) {
      var a, l = { USER: "web_user", LOGNAME: "web_user", PATH: "/", PWD: "/", HOME: "/home/web_user", LANG: (((_a4 = globalThis.navigator) == null ? void 0 : _a4.language) ?? "C").replace("-", "_") + ".UTF-8", _: "./this.program" };
      for (a in zn) zn[a] === void 0 ? delete l[a] : l[a] = zn[a];
      var h = [];
      for (a in l) h.push(`${a}=${l[a]}`);
      On = h;
    }
    return On;
  };
  function Ei(a, l) {
    if (o) return ve(19, 1, a, l);
    a >>>= 0, l >>>= 0;
    var h, f = 0, _ = 0;
    for (h of Ai()) {
      var C = l + f;
      (v(), W)[a + _ >>> 2 >>> 0] = C, f += gt(h, C, 1 / 0) + 1, _ += 4;
    }
    return 0;
  }
  function ki(a, l) {
    if (o) return ve(20, 1, a, l);
    a >>>= 0, l >>>= 0;
    var h = Ai();
    for (var f of ((v(), W)[a >>> 2 >>> 0] = h.length, a = 0, h)) a += pr2(f) + 1;
    return (v(), W)[l >>> 2 >>> 0] = a, 0;
  }
  function Pi(a) {
    return o ? ve(21, 1, a) : 52;
  }
  function Oi(a, l, h, f) {
    return o ? ve(22, 1, a, l, h, f) : 52;
  }
  function zi(a, l, h, f) {
    return o ? ve(23, 1, a, l, h, f) : 70;
  }
  var Tm = [null, [], []];
  function Di(a, l, h, f) {
    if (o) return ve(24, 1, a, l, h, f);
    l >>>= 0, h >>>= 0, f >>>= 0;
    for (var _ = 0, C = 0; C < h; C++) {
      var P = (v(), W)[l >>> 2 >>> 0], B = (v(), W)[l + 4 >>> 2 >>> 0];
      l += 8;
      for (var G = 0; G < B; G++) {
        var H = a, ue2 = (v(), K)[P + G >>> 0], pe = Tm[H];
        ue2 === 0 || ue2 === 10 ? ((H === 1 ? I : E)(Xo(pe)), pe.length = 0) : pe.push(ue2);
      }
      _ += B;
    }
    return (v(), W)[f >>> 2 >>> 0] = _, 0;
  }
  function Im(a) {
    return a >>> 0;
  }
  o || function() {
    for (var a = e.numThreads - 1; a--; ) Fo();
    Xe.push(async () => {
      var l = async function() {
        if (!o) return Promise.all(ft.map(Ho));
      }();
      Ce++, await l, --Ce == 0 && $e2 && (l = $e2, $e2 = null, l());
    });
  }(), o || (ht2 = new WebAssembly.Memory({ initial: 256, maximum: 65536, shared: true }), Te()), e.wasmBinary && (g = e.wasmBinary), e.stackSave = () => le(), e.stackRestore = (a) => de2(a), e.stackAlloc = (a) => Mn(a), e.setValue = function(a, l, h = "i8") {
    switch (h.endsWith("*") && (h = "*"), h) {
      case "i1":
      case "i8":
        (v(), N)[a >>> 0] = l;
        break;
      case "i16":
        (v(), q)[a >>> 1 >>> 0] = l;
        break;
      case "i32":
        (v(), D)[a >>> 2 >>> 0] = l;
        break;
      case "i64":
        (v(), Z)[a >>> 3 >>> 0] = BigInt(l);
        break;
      case "float":
        (v(), j)[a >>> 2 >>> 0] = l;
        break;
      case "double":
        (v(), Y)[a >>> 3 >>> 0] = l;
        break;
      case "*":
        (v(), W)[a >>> 2 >>> 0] = l;
        break;
      default:
        U(`invalid type for setValue: ${h}`);
    }
  }, e.getValue = function(a, l = "i8") {
    switch (l.endsWith("*") && (l = "*"), l) {
      case "i1":
      case "i8":
        return (v(), N)[a >>> 0];
      case "i16":
        return (v(), q)[a >>> 1 >>> 0];
      case "i32":
        return (v(), D)[a >>> 2 >>> 0];
      case "i64":
        return (v(), Z)[a >>> 3 >>> 0];
      case "float":
        return (v(), j)[a >>> 2 >>> 0];
      case "double":
        return (v(), Y)[a >>> 3 >>> 0];
      case "*":
        return (v(), W)[a >>> 2 >>> 0];
      default:
        U(`invalid type for getValue: ${l}`);
    }
  }, e.UTF8ToString = Ae, e.stringToUTF8 = gt, e.lengthBytesUTF8 = pr2;
  var Bi, Mi, _r, tt2, Zt2, Dn, Ri, Ui, Ni, Bn, Vi, Li, ce2, Qt2, Wi, de2, Mn, le, Gi, Rn, Hi, Fi, qi, Un, Ki, ji, Zi, Qi, Yi, Xi, Ji, ea, ta, ra, na, oa, ia, aa, sa, ua, da, la, ca, pa, ma, fa, ha, ga, ya, ba, wa, _a2, va, $a2, xa, Sa, Ta, Ia, Ca2, Aa, Ea, ka2, Pa2, Oa2, ct, Cm = [dr2, Vo, jo, Jo, ei, ti, ri, ni, oi, ii, ai, si, ui, di, li, ci, xi, Si, Ti, Ei, ki, Pi, Oi, zi, Di], Nn = { 927244: (a, l, h, f, _) => {
    if (e === void 0 || !e.Zc) return 1;
    if ((a = Ae(Number(a >>> 0))).startsWith("./") && (a = a.substring(2)), !(a = e.Zc.get(a))) return 2;
    if (l = Number(l >>> 0), h = Number(h >>> 0), f = Number(f >>> 0), l + h > a.byteLength) return 3;
    try {
      let C = a.subarray(l, l + h);
      switch (_) {
        case 0:
          (v(), K).set(C, f >>> 0);
          break;
        case 1:
          e.Xd ? e.Xd(f, C) : e.Ld(f, C);
          break;
        default:
          return 4;
      }
      return 0;
    } catch {
      return 4;
    }
  }, 928068: (a, l, h) => {
    e.xd(a, (v(), K).subarray(l >>> 0, l + h >>> 0));
  }, 928132: () => e.Zd(), 928174: (a) => {
    e.vd(a);
  }, 928211: () => {
    e.Ed();
  }, 928242: () => {
    e.Fd();
  }, 928271: () => {
    e.Jd();
  }, 928296: (a) => e.Dd(a), 928329: (a) => e.Hd(a), 928361: (a, l, h) => {
    e.jd(Number(a), Number(l), Number(h), true);
  }, 928424: (a, l, h) => {
    e.jd(Number(a), Number(l), Number(h));
  }, 928481: () => typeof wasmOffsetConverter < "u", 928538: (a) => {
    e.ac("Abs", a, void 0);
  }, 928589: (a) => {
    e.ac("Neg", a, void 0);
  }, 928640: (a) => {
    e.ac("Floor", a, void 0);
  }, 928693: (a) => {
    e.ac("Ceil", a, void 0);
  }, 928745: (a) => {
    e.ac("Reciprocal", a, void 0);
  }, 928803: (a) => {
    e.ac("Sqrt", a, void 0);
  }, 928855: (a) => {
    e.ac("Exp", a, void 0);
  }, 928906: (a) => {
    e.ac("Erf", a, void 0);
  }, 928957: (a) => {
    e.ac("Sigmoid", a, void 0);
  }, 929012: (a, l, h) => {
    e.ac("HardSigmoid", a, { alpha: l, beta: h });
  }, 929091: (a) => {
    e.ac("Log", a, void 0);
  }, 929142: (a) => {
    e.ac("Sin", a, void 0);
  }, 929193: (a) => {
    e.ac("Cos", a, void 0);
  }, 929244: (a) => {
    e.ac("Tan", a, void 0);
  }, 929295: (a) => {
    e.ac("Asin", a, void 0);
  }, 929347: (a) => {
    e.ac("Acos", a, void 0);
  }, 929399: (a) => {
    e.ac("Atan", a, void 0);
  }, 929451: (a) => {
    e.ac("Sinh", a, void 0);
  }, 929503: (a) => {
    e.ac("Cosh", a, void 0);
  }, 929555: (a) => {
    e.ac("Asinh", a, void 0);
  }, 929608: (a) => {
    e.ac("Acosh", a, void 0);
  }, 929661: (a) => {
    e.ac("Atanh", a, void 0);
  }, 929714: (a) => {
    e.ac("Tanh", a, void 0);
  }, 929766: (a) => {
    e.ac("Not", a, void 0);
  }, 929817: (a, l, h) => {
    e.ac("Clip", a, { min: l, max: h });
  }, 929886: (a) => {
    e.ac("Clip", a, void 0);
  }, 929938: (a, l) => {
    e.ac("Elu", a, { alpha: l });
  }, 929996: (a) => {
    e.ac("Gelu", a, void 0);
  }, 930048: (a) => {
    e.ac("Relu", a, void 0);
  }, 930100: (a, l) => {
    e.ac("LeakyRelu", a, { alpha: l });
  }, 930164: (a, l) => {
    e.ac("ThresholdedRelu", a, { alpha: l });
  }, 930234: (a, l) => {
    e.ac("Cast", a, { to: l });
  }, 930292: (a) => {
    e.ac("Add", a, void 0);
  }, 930343: (a) => {
    e.ac("Sub", a, void 0);
  }, 930394: (a) => {
    e.ac("Mul", a, void 0);
  }, 930445: (a) => {
    e.ac("Div", a, void 0);
  }, 930496: (a) => {
    e.ac("Pow", a, void 0);
  }, 930547: (a) => {
    e.ac("Equal", a, void 0);
  }, 930600: (a) => {
    e.ac("Greater", a, void 0);
  }, 930655: (a) => {
    e.ac("GreaterOrEqual", a, void 0);
  }, 930717: (a) => {
    e.ac("Less", a, void 0);
  }, 930769: (a) => {
    e.ac("LessOrEqual", a, void 0);
  }, 930828: (a, l, h, f, _) => {
    e.ac("ReduceMean", a, { keepDims: !!l, noopWithEmptyAxes: !!h, axes: f ? Array.from((v(), D).subarray(Number(f) >>> 0, Number(_) >>> 0)) : [] });
  }, 931003: (a, l, h, f, _) => {
    e.ac("ReduceMax", a, { keepDims: !!l, noopWithEmptyAxes: !!h, axes: f ? Array.from((v(), D).subarray(Number(f) >>> 0, Number(_) >>> 0)) : [] });
  }, 931177: (a, l, h, f, _) => {
    e.ac("ReduceMin", a, { keepDims: !!l, noopWithEmptyAxes: !!h, axes: f ? Array.from((v(), D).subarray(Number(f) >>> 0, Number(_) >>> 0)) : [] });
  }, 931351: (a, l, h, f, _) => {
    e.ac("ReduceProd", a, { keepDims: !!l, noopWithEmptyAxes: !!h, axes: f ? Array.from((v(), D).subarray(Number(f) >>> 0, Number(_) >>> 0)) : [] });
  }, 931526: (a, l, h, f, _) => {
    e.ac("ReduceSum", a, { keepDims: !!l, noopWithEmptyAxes: !!h, axes: f ? Array.from((v(), D).subarray(Number(f) >>> 0, Number(_) >>> 0)) : [] });
  }, 931700: (a, l, h, f, _) => {
    e.ac("ReduceL1", a, { keepDims: !!l, noopWithEmptyAxes: !!h, axes: f ? Array.from((v(), D).subarray(Number(f) >>> 0, Number(_) >>> 0)) : [] });
  }, 931873: (a, l, h, f, _) => {
    e.ac("ReduceL2", a, { keepDims: !!l, noopWithEmptyAxes: !!h, axes: f ? Array.from((v(), D).subarray(Number(f) >>> 0, Number(_) >>> 0)) : [] });
  }, 932046: (a, l, h, f, _) => {
    e.ac("ReduceLogSum", a, { keepDims: !!l, noopWithEmptyAxes: !!h, axes: f ? Array.from((v(), D).subarray(Number(f) >>> 0, Number(_) >>> 0)) : [] });
  }, 932223: (a, l, h, f, _) => {
    e.ac("ReduceSumSquare", a, { keepDims: !!l, noopWithEmptyAxes: !!h, axes: f ? Array.from((v(), D).subarray(Number(f) >>> 0, Number(_) >>> 0)) : [] });
  }, 932403: (a, l, h, f, _) => {
    e.ac("ReduceLogSumExp", a, { keepDims: !!l, noopWithEmptyAxes: !!h, axes: f ? Array.from((v(), D).subarray(Number(f) >>> 0, Number(_) >>> 0)) : [] });
  }, 932583: (a) => {
    e.ac("Where", a, void 0);
  }, 932636: (a, l, h) => {
    e.ac("Transpose", a, { perm: l ? Array.from((v(), D).subarray(Number(l) >>> 0, Number(h) >>> 0)) : [] });
  }, 932760: (a, l, h, f) => {
    e.ac("DepthToSpace", a, { blocksize: l, mode: Ae(h), format: f ? "NHWC" : "NCHW" });
  }, 932893: (a, l, h, f) => {
    e.ac("DepthToSpace", a, { blocksize: l, mode: Ae(h), format: f ? "NHWC" : "NCHW" });
  }, 933026: (a, l, h, f, _, C, P, B, G, H, ue2, pe, _e, xe2, bt2) => {
    e.ac("ConvTranspose", a, { format: G ? "NHWC" : "NCHW", autoPad: l, dilations: [h], group: f, kernelShape: [_], pads: [C, P], strides: [B], wIsConst: () => !!(v(), N)[H >>> 0], outputPadding: ue2 ? Array.from((v(), D).subarray(Number(ue2) >>> 0, Number(pe) >>> 0)) : [], outputShape: _e ? Array.from((v(), D).subarray(Number(_e) >>> 0, Number(xe2) >>> 0)) : [], activation: Ae(bt2) });
  }, 933459: (a, l, h, f, _, C, P, B, G, H, ue2, pe, _e, xe2) => {
    e.ac("ConvTranspose", a, { format: B ? "NHWC" : "NCHW", autoPad: l, dilations: Array.from((v(), D).subarray(Number(h) >>> 0, 2 + (Number(h) >>> 0) >>> 0)), group: f, kernelShape: Array.from((v(), D).subarray(Number(_) >>> 0, 2 + (Number(_) >>> 0) >>> 0)), pads: Array.from((v(), D).subarray(Number(C) >>> 0, 4 + (Number(C) >>> 0) >>> 0)), strides: Array.from((v(), D).subarray(Number(P) >>> 0, 2 + (Number(P) >>> 0) >>> 0)), wIsConst: () => !!(v(), N)[G >>> 0], outputPadding: H ? Array.from((v(), D).subarray(Number(H) >>> 0, Number(ue2) >>> 0)) : [], outputShape: pe ? Array.from((v(), D).subarray(Number(pe) >>> 0, Number(_e) >>> 0)) : [], activation: Ae(xe2) });
  }, 934120: (a, l, h, f, _, C, P, B, G, H, ue2, pe, _e, xe2, bt2) => {
    e.ac("ConvTranspose", a, { format: G ? "NHWC" : "NCHW", autoPad: l, dilations: [h], group: f, kernelShape: [_], pads: [C, P], strides: [B], wIsConst: () => !!(v(), N)[H >>> 0], outputPadding: ue2 ? Array.from((v(), D).subarray(Number(ue2) >>> 0, Number(pe) >>> 0)) : [], outputShape: _e ? Array.from((v(), D).subarray(Number(_e) >>> 0, Number(xe2) >>> 0)) : [], activation: Ae(bt2) });
  }, 934553: (a, l, h, f, _, C, P, B, G, H, ue2, pe, _e, xe2) => {
    e.ac("ConvTranspose", a, { format: B ? "NHWC" : "NCHW", autoPad: l, dilations: Array.from((v(), D).subarray(Number(h) >>> 0, 2 + (Number(h) >>> 0) >>> 0)), group: f, kernelShape: Array.from((v(), D).subarray(Number(_) >>> 0, 2 + (Number(_) >>> 0) >>> 0)), pads: Array.from((v(), D).subarray(Number(C) >>> 0, 4 + (Number(C) >>> 0) >>> 0)), strides: Array.from((v(), D).subarray(Number(P) >>> 0, 2 + (Number(P) >>> 0) >>> 0)), wIsConst: () => !!(v(), N)[G >>> 0], outputPadding: H ? Array.from((v(), D).subarray(Number(H) >>> 0, Number(ue2) >>> 0)) : [], outputShape: pe ? Array.from((v(), D).subarray(Number(pe) >>> 0, Number(_e) >>> 0)) : [], activation: Ae(xe2) });
  }, 935214: (a, l) => {
    e.ac("GlobalAveragePool", a, { format: l ? "NHWC" : "NCHW" });
  }, 935305: (a, l, h, f, _, C, P, B, G, H, ue2, pe, _e, xe2) => {
    e.ac("AveragePool", a, { format: xe2 ? "NHWC" : "NCHW", auto_pad: l, ceil_mode: h, count_include_pad: f, storage_order: _, dilations: C ? Array.from((v(), D).subarray(Number(C) >>> 0, Number(P) >>> 0)) : [], kernel_shape: B ? Array.from((v(), D).subarray(Number(B) >>> 0, Number(G) >>> 0)) : [], pads: H ? Array.from((v(), D).subarray(Number(H) >>> 0, Number(ue2) >>> 0)) : [], strides: pe ? Array.from((v(), D).subarray(Number(pe) >>> 0, Number(_e) >>> 0)) : [] });
  }, 935784: (a, l) => {
    e.ac("GlobalAveragePool", a, { format: l ? "NHWC" : "NCHW" });
  }, 935875: (a, l, h, f, _, C, P, B, G, H, ue2, pe, _e, xe2) => {
    e.ac("AveragePool", a, { format: xe2 ? "NHWC" : "NCHW", auto_pad: l, ceil_mode: h, count_include_pad: f, storage_order: _, dilations: C ? Array.from((v(), D).subarray(Number(C) >>> 0, Number(P) >>> 0)) : [], kernel_shape: B ? Array.from((v(), D).subarray(Number(B) >>> 0, Number(G) >>> 0)) : [], pads: H ? Array.from((v(), D).subarray(Number(H) >>> 0, Number(ue2) >>> 0)) : [], strides: pe ? Array.from((v(), D).subarray(Number(pe) >>> 0, Number(_e) >>> 0)) : [] });
  }, 936354: (a, l) => {
    e.ac("GlobalMaxPool", a, { format: l ? "NHWC" : "NCHW" });
  }, 936441: (a, l, h, f, _, C, P, B, G, H, ue2, pe, _e, xe2) => {
    e.ac("MaxPool", a, { format: xe2 ? "NHWC" : "NCHW", auto_pad: l, ceil_mode: h, count_include_pad: f, storage_order: _, dilations: C ? Array.from((v(), D).subarray(Number(C) >>> 0, Number(P) >>> 0)) : [], kernel_shape: B ? Array.from((v(), D).subarray(Number(B) >>> 0, Number(G) >>> 0)) : [], pads: H ? Array.from((v(), D).subarray(Number(H) >>> 0, Number(ue2) >>> 0)) : [], strides: pe ? Array.from((v(), D).subarray(Number(pe) >>> 0, Number(_e) >>> 0)) : [] });
  }, 936916: (a, l) => {
    e.ac("GlobalMaxPool", a, { format: l ? "NHWC" : "NCHW" });
  }, 937003: (a, l, h, f, _, C, P, B, G, H, ue2, pe, _e, xe2) => {
    e.ac("MaxPool", a, { format: xe2 ? "NHWC" : "NCHW", auto_pad: l, ceil_mode: h, count_include_pad: f, storage_order: _, dilations: C ? Array.from((v(), D).subarray(Number(C) >>> 0, Number(P) >>> 0)) : [], kernel_shape: B ? Array.from((v(), D).subarray(Number(B) >>> 0, Number(G) >>> 0)) : [], pads: H ? Array.from((v(), D).subarray(Number(H) >>> 0, Number(ue2) >>> 0)) : [], strides: pe ? Array.from((v(), D).subarray(Number(pe) >>> 0, Number(_e) >>> 0)) : [] });
  }, 937478: (a, l, h, f, _) => {
    e.ac("Gemm", a, { alpha: l, beta: h, transA: f, transB: _ });
  }, 937582: (a) => {
    e.ac("MatMul", a, void 0);
  }, 937636: (a, l, h, f) => {
    e.ac("ArgMax", a, { keepDims: !!l, selectLastIndex: !!h, axis: f });
  }, 937744: (a, l, h, f) => {
    e.ac("ArgMin", a, { keepDims: !!l, selectLastIndex: !!h, axis: f });
  }, 937852: (a, l) => {
    e.ac("Softmax", a, { axis: l });
  }, 937915: (a, l) => {
    e.ac("Concat", a, { axis: l });
  }, 937975: (a, l, h, f, _) => {
    e.ac("Split", a, { axis: l, numOutputs: h, splitSizes: f ? Array.from((v(), D).subarray(Number(f) >>> 0, Number(_) >>> 0)) : [] });
  }, 938131: (a) => {
    e.ac("Expand", a, void 0);
  }, 938185: (a, l) => {
    e.ac("Gather", a, { axis: Number(l) });
  }, 938256: (a, l) => {
    e.ac("GatherElements", a, { axis: Number(l) });
  }, 938335: (a, l) => {
    e.ac("GatherND", a, { batch_dims: Number(l) });
  }, 938414: (a, l, h, f, _, C, P, B, G, H, ue2) => {
    e.ac("Resize", a, { antialias: l, axes: h ? Array.from((v(), D).subarray(Number(h) >>> 0, Number(f) >>> 0)) : [], coordinateTransformMode: Ae(_), cubicCoeffA: C, excludeOutside: P, extrapolationValue: B, keepAspectRatioPolicy: Ae(G), mode: Ae(H), nearestMode: Ae(ue2) });
  }, 938776: (a, l, h, f, _, C, P) => {
    e.ac("Slice", a, { starts: l ? Array.from((v(), D).subarray(Number(l) >>> 0, Number(h) >>> 0)) : [], ends: f ? Array.from((v(), D).subarray(Number(f) >>> 0, Number(_) >>> 0)) : [], axes: C ? Array.from((v(), D).subarray(Number(C) >>> 0, Number(P) >>> 0)) : [] });
  }, 939040: (a) => {
    e.ac("Tile", a, void 0);
  }, 939092: (a, l, h) => {
    e.ac("InstanceNormalization", a, { epsilon: l, format: h ? "NHWC" : "NCHW" });
  }, 939206: (a, l, h) => {
    e.ac("InstanceNormalization", a, { epsilon: l, format: h ? "NHWC" : "NCHW" });
  }, 939320: (a) => {
    e.ac("Range", a, void 0);
  }, 939373: (a, l) => {
    e.ac("Einsum", a, { equation: Ae(l) });
  }, 939454: (a, l, h, f, _) => {
    e.ac("Pad", a, { mode: l, value: h, pads: f ? Array.from((v(), D).subarray(Number(f) >>> 0, Number(_) >>> 0)) : [] });
  }, 939597: (a, l, h, f, _, C) => {
    e.ac("BatchNormalization", a, { epsilon: l, momentum: h, spatial: !!_, trainingMode: !!f, format: C ? "NHWC" : "NCHW" });
  }, 939766: (a, l, h, f, _, C) => {
    e.ac("BatchNormalization", a, { epsilon: l, momentum: h, spatial: !!_, trainingMode: !!f, format: C ? "NHWC" : "NCHW" });
  }, 939935: (a, l, h) => {
    e.ac("CumSum", a, { exclusive: Number(l), reverse: Number(h) });
  }, 940032: (a, l, h) => {
    e.ac("DequantizeLinear", a, { axis: l, blockSize: h });
  }, 940122: (a, l, h, f, _) => {
    e.ac("GridSample", a, { align_corners: l, mode: Ae(h), padding_mode: Ae(f), format: _ ? "NHWC" : "NCHW" });
  }, 940292: (a, l, h, f, _) => {
    e.ac("GridSample", a, { align_corners: l, mode: Ae(h), padding_mode: Ae(f), format: _ ? "NHWC" : "NCHW" });
  }, 940462: (a, l) => {
    e.ac("ScatterND", a, { reduction: Ae(l) });
  }, 940547: (a, l, h, f, _, C, P, B, G) => {
    e.ac("Attention", a, { numHeads: l, isUnidirectional: h, maskFilterValue: f, scale: _, doRotary: C, qkvHiddenSizes: P ? Array.from((v(), D).subarray(Number(B) >>> 0, Number(B) + P >>> 0)) : [], pastPresentShareBuffer: !!G });
  }, 940819: (a) => {
    e.ac("BiasAdd", a, void 0);
  }, 940874: (a) => {
    e.ac("BiasSplitGelu", a, void 0);
  }, 940935: (a) => {
    e.ac("FastGelu", a, void 0);
  }, 940991: (a, l, h, f, _, C, P, B, G, H, ue2, pe, _e, xe2, bt2, Vn) => {
    e.ac("Conv", a, { format: pe ? "NHWC" : "NCHW", auto_pad: l, dilations: h ? Array.from((v(), D).subarray(Number(h) >>> 0, Number(f) >>> 0)) : [], group: _, kernel_shape: C ? Array.from((v(), D).subarray(Number(C) >>> 0, Number(P) >>> 0)) : [], pads: B ? Array.from((v(), D).subarray(Number(B) >>> 0, Number(G) >>> 0)) : [], strides: H ? Array.from((v(), D).subarray(Number(H) >>> 0, Number(ue2) >>> 0)) : [], w_is_const: () => !!(v(), N)[Number(_e) >>> 0], activation: Ae(xe2), activation_params: bt2 ? Array.from((v(), j).subarray(Number(bt2) >>> 0, Number(Vn) >>> 0)) : [] });
  }, 941575: (a) => {
    e.ac("Gelu", a, void 0);
  }, 941627: (a, l, h, f, _, C, P, B, G) => {
    e.ac("GroupQueryAttention", a, { numHeads: l, kvNumHeads: h, scale: f, softcap: _, doRotary: C, rotaryInterleaved: P, smoothSoftmax: B, localWindowSize: G });
  }, 941844: (a, l, h, f) => {
    e.ac("LayerNormalization", a, { axis: l, epsilon: h, simplified: !!f });
  }, 941955: (a, l, h, f) => {
    e.ac("LayerNormalization", a, { axis: l, epsilon: h, simplified: !!f });
  }, 942066: (a, l, h, f, _, C) => {
    e.ac("MatMulNBits", a, { k: l, n: h, accuracyLevel: f, bits: _, blockSize: C });
  }, 942193: (a, l, h, f, _, C) => {
    e.ac("MultiHeadAttention", a, { numHeads: l, isUnidirectional: h, maskFilterValue: f, scale: _, doRotary: C });
  }, 942352: (a, l) => {
    e.ac("QuickGelu", a, { alpha: l });
  }, 942416: (a, l, h, f, _) => {
    e.ac("RotaryEmbedding", a, { interleaved: !!l, numHeads: h, rotaryEmbeddingDim: f, scale: _ });
  }, 942555: (a, l, h) => {
    e.ac("SkipLayerNormalization", a, { epsilon: l, simplified: !!h });
  }, 942657: (a, l, h) => {
    e.ac("SkipLayerNormalization", a, { epsilon: l, simplified: !!h });
  }, 942759: (a, l, h, f) => {
    e.ac("GatherBlockQuantized", a, { gatherAxis: l, quantizeAxis: h, blockSize: f });
  }, 942880: (a) => {
    e.Id(a);
  }, 942914: (a, l) => e.Kd(Number(a), Number(l), e.$c.Nd, e.$c.errors) };
  function Am(a, l, h) {
    return bi(async () => {
      await e.Gd(Number(a), Number(l), Number(h));
    });
  }
  function Em() {
    return typeof wasmOffsetConverter < "u";
  }
  function km(a, l, h, f) {
    var _ = le();
    try {
      return ea(a, l, h, f);
    } catch (C) {
      if (de2(_), C !== C + 0) throw C;
      ce2(1, 0);
    }
  }
  function Pm(a, l, h) {
    var f = le();
    try {
      return Qi(a, l, h);
    } catch (_) {
      if (de2(f), _ !== _ + 0) throw _;
      ce2(1, 0);
    }
  }
  function Om(a, l, h) {
    var f = le();
    try {
      qi(a, l, h);
    } catch (_) {
      if (de2(f), _ !== _ + 0) throw _;
      ce2(1, 0);
    }
  }
  function zm(a, l) {
    var h = le();
    try {
      return Un(a, l);
    } catch (f) {
      if (de2(h), f !== f + 0) throw f;
      ce2(1, 0);
    }
  }
  function Dm(a) {
    var l = le();
    try {
      Ki(a);
    } catch (h) {
      if (de2(l), h !== h + 0) throw h;
      ce2(1, 0);
    }
  }
  function Bm(a, l, h, f, _, C, P) {
    var B = le();
    try {
      return Xi(a, l, h, f, _, C, P);
    } catch (G) {
      if (de2(B), G !== G + 0) throw G;
      ce2(1, 0);
    }
  }
  function Mm(a, l) {
    var h = le();
    try {
      ta(a, l);
    } catch (f) {
      if (de2(h), f !== f + 0) throw f;
      ce2(1, 0);
    }
  }
  function Rm(a, l, h, f, _, C) {
    var P = le();
    try {
      ji(a, l, h, f, _, C);
    } catch (B) {
      if (de2(P), B !== B + 0) throw B;
      ce2(1, 0);
    }
  }
  function Um(a, l, h, f) {
    var _ = le();
    try {
      Ji(a, l, h, f);
    } catch (C) {
      if (de2(_), C !== C + 0) throw C;
      ce2(1, 0);
    }
  }
  function Nm(a, l, h, f, _) {
    var C = le();
    try {
      Zi(a, l, h, f, _);
    } catch (P) {
      if (de2(C), P !== P + 0) throw P;
      ce2(1, 0);
    }
  }
  function Vm(a, l, h, f, _, C, P) {
    var B = le();
    try {
      na(a, l, h, f, _, C, P);
    } catch (G) {
      if (de2(B), G !== G + 0) throw G;
      ce2(1, 0);
    }
  }
  function Lm(a, l, h, f, _, C, P) {
    var B = le();
    try {
      oa(a, l, h, f, _, C, P);
    } catch (G) {
      if (de2(B), G !== G + 0) throw G;
      ce2(1, 0);
    }
  }
  function Wm(a, l, h, f, _, C, P, B) {
    var G = le();
    try {
      ua(a, l, h, f, _, C, P, B);
    } catch (H) {
      if (de2(G), H !== H + 0) throw H;
      ce2(1, 0);
    }
  }
  function Gm(a, l, h, f, _) {
    var C = le();
    try {
      return ra(a, l, h, f, _);
    } catch (P) {
      if (de2(C), P !== P + 0) throw P;
      ce2(1, 0);
    }
  }
  function Hm(a, l, h, f, _, C, P, B) {
    var G = le();
    try {
      da(a, l, h, f, _, C, P, B);
    } catch (H) {
      if (de2(G), H !== H + 0) throw H;
      ce2(1, 0);
    }
  }
  function Fm(a, l, h, f, _, C, P, B, G, H, ue2, pe) {
    var _e = le();
    try {
      ia(a, l, h, f, _, C, P, B, G, H, ue2, pe);
    } catch (xe2) {
      if (de2(_e), xe2 !== xe2 + 0) throw xe2;
      ce2(1, 0);
    }
  }
  function qm(a, l, h, f, _, C) {
    var P = le();
    try {
      return aa(a, l, h, f, _, C);
    } catch (B) {
      if (de2(P), B !== B + 0) throw B;
      ce2(1, 0);
    }
  }
  function Km(a, l, h) {
    var f = le();
    try {
      return la(a, l, h);
    } catch (_) {
      if (de2(f), _ !== _ + 0) throw _;
      return ce2(1, 0), 0n;
    }
  }
  function jm(a, l, h, f, _, C, P, B, G) {
    var H = le();
    try {
      Yi(a, l, h, f, _, C, P, B, G);
    } catch (ue2) {
      if (de2(H), ue2 !== ue2 + 0) throw ue2;
      ce2(1, 0);
    }
  }
  function Zm(a) {
    var l = le();
    try {
      return ca(a);
    } catch (h) {
      if (de2(l), h !== h + 0) throw h;
      ce2(1, 0);
    }
  }
  function Qm(a, l, h) {
    var f = le();
    try {
      return pa(a, l, h);
    } catch (_) {
      if (de2(f), _ !== _ + 0) throw _;
      ce2(1, 0);
    }
  }
  function Ym(a, l) {
    var h = le();
    try {
      return Aa(a, l);
    } catch (f) {
      if (de2(h), f !== f + 0) throw f;
      return ce2(1, 0), 0n;
    }
  }
  function Xm(a, l, h, f, _) {
    var C = le();
    try {
      ma(a, l, h, f, _);
    } catch (P) {
      if (de2(C), P !== P + 0) throw P;
      ce2(1, 0);
    }
  }
  function Jm(a) {
    var l = le();
    try {
      return fa(a);
    } catch (h) {
      if (de2(l), h !== h + 0) throw h;
      return ce2(1, 0), 0n;
    }
  }
  function ef(a, l, h, f, _, C) {
    var P = le();
    try {
      return _a2(a, l, h, f, _, C);
    } catch (B) {
      if (de2(P), B !== B + 0) throw B;
      ce2(1, 0);
    }
  }
  function tf(a, l, h, f, _, C) {
    var P = le();
    try {
      return va(a, l, h, f, _, C);
    } catch (B) {
      if (de2(P), B !== B + 0) throw B;
      ce2(1, 0);
    }
  }
  function rf(a, l, h, f, _, C, P, B) {
    var G = le();
    try {
      return sa(a, l, h, f, _, C, P, B);
    } catch (H) {
      if (de2(G), H !== H + 0) throw H;
      ce2(1, 0);
    }
  }
  function nf(a, l, h, f, _) {
    var C = le();
    try {
      return $a2(a, l, h, f, _);
    } catch (P) {
      if (de2(C), P !== P + 0) throw P;
      return ce2(1, 0), 0n;
    }
  }
  function of(a, l, h, f) {
    var _ = le();
    try {
      return xa(a, l, h, f);
    } catch (C) {
      if (de2(_), C !== C + 0) throw C;
      ce2(1, 0);
    }
  }
  function af(a, l, h, f) {
    var _ = le();
    try {
      return Sa(a, l, h, f);
    } catch (C) {
      if (de2(_), C !== C + 0) throw C;
      ce2(1, 0);
    }
  }
  function sf(a, l, h, f, _, C, P, B, G, H, ue2, pe) {
    var _e = le();
    try {
      return Ta(a, l, h, f, _, C, P, B, G, H, ue2, pe);
    } catch (xe2) {
      if (de2(_e), xe2 !== xe2 + 0) throw xe2;
      ce2(1, 0);
    }
  }
  function uf(a, l, h, f, _, C, P, B, G, H, ue2) {
    var pe = le();
    try {
      ba(a, l, h, f, _, C, P, B, G, H, ue2);
    } catch (_e) {
      if (de2(pe), _e !== _e + 0) throw _e;
      ce2(1, 0);
    }
  }
  function df(a, l, h, f, _, C, P, B, G, H, ue2, pe, _e, xe2, bt2, Vn) {
    var hf = le();
    try {
      wa(a, l, h, f, _, C, P, B, G, H, ue2, pe, _e, xe2, bt2, Vn);
    } catch (Ln) {
      if (de2(hf), Ln !== Ln + 0) throw Ln;
      ce2(1, 0);
    }
  }
  function lf(a, l, h, f) {
    var _ = le();
    try {
      return Ia(a, l, h, f);
    } catch (C) {
      if (de2(_), C !== C + 0) throw C;
      ce2(1, 0);
    }
  }
  function cf(a, l, h, f, _) {
    var C = le();
    try {
      return Ca2(a, l, h, f, _);
    } catch (P) {
      if (de2(C), P !== P + 0) throw P;
      ce2(1, 0);
    }
  }
  function pf(a, l, h) {
    var f = le();
    try {
      return ha(a, l, h);
    } catch (_) {
      if (de2(f), _ !== _ + 0) throw _;
      ce2(1, 0);
    }
  }
  function mf(a, l, h) {
    var f = le();
    try {
      return ga(a, l, h);
    } catch (_) {
      if (de2(f), _ !== _ + 0) throw _;
      ce2(1, 0);
    }
  }
  function ff(a, l, h, f) {
    var _ = le();
    try {
      ya(a, l, h, f);
    } catch (C) {
      if (de2(_), C !== C + 0) throw C;
      ce2(1, 0);
    }
  }
  function vr() {
    if (0 < Ce) $e2 = vr;
    else if (o) w == null ? void 0 : w(e), re();
    else {
      for (var a = Xe; 0 < a.length; ) a.shift()(e);
      0 < Ce ? $e2 = vr : (e.calledRun = true, A || (re(), w == null ? void 0 : w(e)));
    }
  }
  return o || (ct = await Se(), vr()), e.PTR_SIZE = 4, we ? e : new Promise((a, l) => {
    w = a, S = l;
  });
}
var xf, Sf, fs$1 = V$1(() => {
  var _a2, _b;
  xf = ps$1, Sf = (_b = (_a2 = globalThis.self) == null ? void 0 : _a2.name) == null ? void 0 : _b.startsWith("em-pthread");
  Sf && ps$1();
});
var ys$1, Xn, Tf, Le, bs$1, Yn, If, Cf, ws$1, Af, hs$1, _s$1, gs$1, vs$1, Cr = V$1(() => {
  Ir();
  ys$1 = typeof location > "u" ? void 0 : location.origin, Xn = import.meta.url > "file:" && import.meta.url < "file;", Tf = () => {
    {
      if (Xn) {
        let t = URL;
        return new URL(new t("ort.bundle.min.mjs", import.meta.url).href, ys$1).href;
      }
      return import.meta.url;
    }
  }, Le = Tf(), bs$1 = () => {
    if (Le && !Le.startsWith("blob:")) return Le.substring(0, Le.lastIndexOf("/") + 1);
  }, Yn = (t, e) => {
    try {
      let r = e ?? Le;
      return (r ? new URL(t, r) : new URL(t)).origin === ys$1;
    } catch {
      return false;
    }
  }, If = (t, e) => {
    let r = e ?? Le;
    try {
      return (r ? new URL(t, r) : new URL(t)).href;
    } catch {
      return;
    }
  }, Cf = (t, e) => `${e ?? "./"}${t}`, ws$1 = async (t) => {
    let r = await (await fetch(t, { credentials: "same-origin" })).blob();
    return URL.createObjectURL(r);
  }, Af = async (t) => (await import(
    /*webpackIgnore:true*/
    /*@vite-ignore*/
    t
  )).default, hs$1 = (cs$1(), Yt$1(ls$1)).default, _s$1 = async () => {
    if (!Le) throw new Error("Failed to load proxy worker: cannot determine the script source URL.");
    if (Yn(Le)) return [void 0, hs$1()];
    let t = await ws$1(Le);
    return [t, hs$1(t)];
  }, gs$1 = (fs$1(), Yt$1(ms$1)).default, vs$1 = async (t, e, r, n) => {
    let o = gs$1 && !(t || e);
    if (o) if (Le) o = Yn(Le);
    else if (n && !r) o = true;
    else throw new Error("cannot determine the script source URL.");
    if (o) return [void 0, gs$1];
    {
      let i = "ort-wasm-simd-threaded.jsep.mjs", s = t ?? If(i, e), u = r && s && !Yn(s, e), d = u ? await ws$1(s) : s ?? Cf(i, e);
      return [u ? d : void 0, await Af(d)];
    }
  };
});
var Jn, eo, Mr, $s$1, Ef, kf, Pf, Ar, ge, vt = V$1(() => {
  Cr();
  eo = false, Mr = false, $s$1 = false, Ef = () => {
    if (typeof SharedArrayBuffer > "u") return false;
    try {
      return typeof MessageChannel < "u" && new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)), WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 5, 4, 1, 3, 1, 1, 10, 11, 1, 9, 0, 65, 0, 254, 16, 2, 0, 26, 11]));
    } catch {
      return false;
    }
  }, kf = () => {
    try {
      return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 30, 1, 28, 0, 65, 0, 253, 15, 253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 253, 186, 1, 26, 11]));
    } catch {
      return false;
    }
  }, Pf = () => {
    try {
      return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 19, 1, 17, 0, 65, 1, 253, 15, 65, 2, 253, 15, 65, 3, 253, 15, 253, 147, 2, 11]));
    } catch {
      return false;
    }
  }, Ar = async (t) => {
    if (eo) return Promise.resolve();
    if (Mr) throw new Error("multiple calls to 'initializeWebAssembly()' detected.");
    if ($s$1) throw new Error("previous call to 'initializeWebAssembly()' failed.");
    Mr = true;
    let e = t.initTimeout, r = t.numThreads;
    if (t.simd !== false) {
      if (t.simd === "relaxed") {
        if (!Pf()) throw new Error("Relaxed WebAssembly SIMD is not supported in the current environment.");
      } else if (!kf()) throw new Error("WebAssembly SIMD is not supported in the current environment.");
    }
    let n = Ef();
    r > 1 && !n && (typeof self < "u" && !self.crossOriginIsolated && console.warn("env.wasm.numThreads is set to " + r + ", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."), console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."), t.numThreads = r = 1);
    let o = t.wasmPaths, i = typeof o == "string" ? o : void 0, s = o == null ? void 0 : o.mjs, u = (s == null ? void 0 : s.href) ?? s, d = o == null ? void 0 : o.wasm, c = (d == null ? void 0 : d.href) ?? d, p = t.wasmBinary, [m, g] = await vs$1(u, i, r > 1, !!p || !!c), b = false, y = [];
    if (e > 0 && y.push(new Promise((w) => {
      setTimeout(() => {
        b = true, w();
      }, e);
    })), y.push(new Promise((w, S) => {
      let x = { numThreads: r };
      if (p) x.wasmBinary = p;
      else if (c || i) x.locateFile = ($) => c ?? i + $;
      else if (u && u.indexOf("blob:") !== 0) x.locateFile = ($) => new URL($, u).href;
      else if (m) {
        let $ = bs$1();
        $ && (x.locateFile = (T) => $ + T);
      }
      g(x).then(($) => {
        Mr = false, eo = true, Jn = $, w(), m && URL.revokeObjectURL(m);
      }, ($) => {
        Mr = false, $s$1 = true, S($);
      });
    })), await Promise.race(y), b) throw new Error(`WebAssembly backend initializing failed due to timeout: ${e}ms`);
  }, ge = () => {
    if (eo && Jn) return Jn;
    throw new Error("WebAssembly is not initialized yet.");
  };
});
var We, er$1, me, Rr = V$1(() => {
  vt();
  We = (t, e) => {
    let r = ge(), n = r.lengthBytesUTF8(t) + 1, o = r._malloc(n);
    return r.stringToUTF8(t, o, n), e.push(o), o;
  }, er$1 = (t, e, r, n) => {
    if (typeof t == "object" && t !== null) {
      if (r.has(t)) throw new Error("Circular reference in options");
      r.add(t);
    }
    Object.entries(t).forEach(([o, i]) => {
      let s = e ? e + o : o;
      if (typeof i == "object") er$1(i, s + ".", r, n);
      else if (typeof i == "string" || typeof i == "number") n(s, i.toString());
      else if (typeof i == "boolean") n(s, i ? "1" : "0");
      else throw new Error(`Can't handle extra config type: ${typeof i}`);
    });
  }, me = (t) => {
    let e = ge(), r = e.stackSave();
    try {
      let n = e.PTR_SIZE, o = e.stackAlloc(2 * n);
      e._OrtGetLastError(o, o + n);
      let i = Number(e.getValue(o, n === 4 ? "i32" : "i64")), s = e.getValue(o + n, "*"), u = s ? e.UTF8ToString(s) : "";
      throw new Error(`${t} ERROR_CODE: ${i}, ERROR_MESSAGE: ${u}`);
    } finally {
      e.stackRestore(r);
    }
  };
});
var xs$1, Ss$1 = V$1(() => {
  vt();
  Rr();
  xs$1 = (t) => {
    let e = ge(), r = 0, n = [], o = t || {};
    try {
      if ((t == null ? void 0 : t.logSeverityLevel) === void 0) o.logSeverityLevel = 2;
      else if (typeof t.logSeverityLevel != "number" || !Number.isInteger(t.logSeverityLevel) || t.logSeverityLevel < 0 || t.logSeverityLevel > 4) throw new Error(`log severity level is not valid: ${t.logSeverityLevel}`);
      if ((t == null ? void 0 : t.logVerbosityLevel) === void 0) o.logVerbosityLevel = 0;
      else if (typeof t.logVerbosityLevel != "number" || !Number.isInteger(t.logVerbosityLevel)) throw new Error(`log verbosity level is not valid: ${t.logVerbosityLevel}`);
      (t == null ? void 0 : t.terminate) === void 0 && (o.terminate = false);
      let i = 0;
      return (t == null ? void 0 : t.tag) !== void 0 && (i = We(t.tag, n)), r = e._OrtCreateRunOptions(o.logSeverityLevel, o.logVerbosityLevel, !!o.terminate, i), r === 0 && me("Can't create run options."), (t == null ? void 0 : t.extra) !== void 0 && er$1(t.extra, "", /* @__PURE__ */ new WeakSet(), (s, u) => {
        let d = We(s, n), c = We(u, n);
        e._OrtAddRunConfigEntry(r, d, c) !== 0 && me(`Can't set a run config entry: ${s} - ${u}.`);
      }), [r, n];
    } catch (i) {
      throw r !== 0 && e._OrtReleaseRunOptions(r), n.forEach((s) => e._free(s)), i;
    }
  };
});
var Of, zf, Df, Ur, Bf, Ts$1, Is$1 = V$1(() => {
  vt();
  Rr();
  Of = (t) => {
    switch (t) {
      case "disabled":
        return 0;
      case "basic":
        return 1;
      case "extended":
        return 2;
      case "layout":
        return 3;
      case "all":
        return 99;
      default:
        throw new Error(`unsupported graph optimization level: ${t}`);
    }
  }, zf = (t) => {
    switch (t) {
      case "sequential":
        return 0;
      case "parallel":
        return 1;
      default:
        throw new Error(`unsupported execution mode: ${t}`);
    }
  }, Df = (t) => {
    t.extra || (t.extra = {}), t.extra.session || (t.extra.session = {});
    let e = t.extra.session;
    e.use_ort_model_bytes_directly || (e.use_ort_model_bytes_directly = "1"), t.executionProviders && t.executionProviders.some((r) => (typeof r == "string" ? r : r.name) === "webgpu") && (t.enableMemPattern = false);
  }, Ur = (t, e, r, n) => {
    let o = We(e, n), i = We(r, n);
    ge()._OrtAddSessionConfigEntry(t, o, i) !== 0 && me(`Can't set a session config entry: ${e} - ${r}.`);
  }, Bf = async (t, e, r) => {
    let n = e.executionProviders;
    for (let o of n) {
      let i = typeof o == "string" ? o : o.name, s = [];
      switch (i) {
        case "webnn":
          if (i = "WEBNN", typeof o != "string") {
            let g = o == null ? void 0 : o.deviceType;
            g && Ur(t, "deviceType", g, r);
          }
          break;
        case "webgpu":
          if (i = "JS", typeof o != "string") {
            let m = o;
            if (m == null ? void 0 : m.preferredLayout) {
              if (m.preferredLayout !== "NCHW" && m.preferredLayout !== "NHWC") throw new Error(`preferredLayout must be either 'NCHW' or 'NHWC': ${m.preferredLayout}`);
              Ur(t, "preferredLayout", m.preferredLayout, r);
            }
          }
          break;
        case "wasm":
        case "cpu":
          continue;
        default:
          throw new Error(`not supported execution provider: ${i}`);
      }
      let u = We(i, r), d = s.length, c = 0, p = 0;
      if (d > 0) {
        c = ge()._malloc(d * ge().PTR_SIZE), r.push(c), p = ge()._malloc(d * ge().PTR_SIZE), r.push(p);
        for (let m = 0; m < d; m++) ge().setValue(c + m * ge().PTR_SIZE, s[m][0], "*"), ge().setValue(p + m * ge().PTR_SIZE, s[m][1], "*");
      }
      await ge()._OrtAppendExecutionProvider(t, u, c, p, d) !== 0 && me(`Can't append execution provider: ${i}.`);
    }
  }, Ts$1 = async (t) => {
    let e = ge(), r = 0, n = [], o = t || {};
    Df(o);
    try {
      let i = Of(o.graphOptimizationLevel ?? "all"), s = zf(o.executionMode ?? "sequential"), u = typeof o.logId == "string" ? We(o.logId, n) : 0, d = o.logSeverityLevel ?? 2;
      if (!Number.isInteger(d) || d < 0 || d > 4) throw new Error(`log severity level is not valid: ${d}`);
      let c = o.logVerbosityLevel ?? 0;
      if (!Number.isInteger(c) || c < 0 || c > 4) throw new Error(`log verbosity level is not valid: ${c}`);
      let p = typeof o.optimizedModelFilePath == "string" ? We(o.optimizedModelFilePath, n) : 0;
      if (r = e._OrtCreateSessionOptions(i, !!o.enableCpuMemArena, !!o.enableMemPattern, s, !!o.enableProfiling, 0, u, d, c, p), r === 0 && me("Can't create session options."), o.executionProviders && await Bf(r, o, n), o.enableGraphCapture !== void 0) {
        if (typeof o.enableGraphCapture != "boolean") throw new Error(`enableGraphCapture must be a boolean value: ${o.enableGraphCapture}`);
        Ur(r, "enableGraphCapture", o.enableGraphCapture.toString(), n);
      }
      if (o.freeDimensionOverrides) for (let [m, g] of Object.entries(o.freeDimensionOverrides)) {
        if (typeof m != "string") throw new Error(`free dimension override name must be a string: ${m}`);
        if (typeof g != "number" || !Number.isInteger(g) || g < 0) throw new Error(`free dimension override value must be a non-negative integer: ${g}`);
        let b = We(m, n);
        e._OrtAddFreeDimensionOverride(r, b, g) !== 0 && me(`Can't set a free dimension override: ${m} - ${g}.`);
      }
      return o.extra !== void 0 && er$1(o.extra, "", /* @__PURE__ */ new WeakSet(), (m, g) => {
        Ur(r, m, g, n);
      }), [r, n];
    } catch (i) {
      throw r !== 0 && e._OrtReleaseSessionOptions(r) !== 0 && me("Can't release session options."), n.forEach((s) => e._free(s)), i;
    }
  };
});
var $t, rt$1, xt$1, Lt$1, tr$1, Nr, Vr, to, J = V$1(() => {
  $t = (t) => {
    switch (t) {
      case "int8":
        return 3;
      case "uint8":
        return 2;
      case "bool":
        return 9;
      case "int16":
        return 5;
      case "uint16":
        return 4;
      case "int32":
        return 6;
      case "uint32":
        return 12;
      case "float16":
        return 10;
      case "float32":
        return 1;
      case "float64":
        return 11;
      case "string":
        return 8;
      case "int64":
        return 7;
      case "uint64":
        return 13;
      case "int4":
        return 22;
      case "uint4":
        return 21;
      default:
        throw new Error(`unsupported data type: ${t}`);
    }
  }, rt$1 = (t) => {
    switch (t) {
      case 3:
        return "int8";
      case 2:
        return "uint8";
      case 9:
        return "bool";
      case 5:
        return "int16";
      case 4:
        return "uint16";
      case 6:
        return "int32";
      case 12:
        return "uint32";
      case 10:
        return "float16";
      case 1:
        return "float32";
      case 11:
        return "float64";
      case 8:
        return "string";
      case 7:
        return "int64";
      case 13:
        return "uint64";
      case 22:
        return "int4";
      case 21:
        return "uint4";
      default:
        throw new Error(`unsupported data type: ${t}`);
    }
  }, xt$1 = (t, e) => {
    let r = [-1, 4, 1, 1, 2, 2, 4, 8, -1, 1, 2, 8, 4, 8, -1, -1, -1, -1, -1, -1, -1, 0.5, 0.5][t], n = typeof e == "number" ? e : e.reduce((o, i) => o * i, 1);
    return r > 0 ? Math.ceil(n * r) : void 0;
  }, Lt$1 = (t) => {
    switch (t) {
      case "float16":
        return typeof Float16Array < "u" && Float16Array.from ? Float16Array : Uint16Array;
      case "float32":
        return Float32Array;
      case "uint8":
        return Uint8Array;
      case "int8":
        return Int8Array;
      case "uint16":
        return Uint16Array;
      case "int16":
        return Int16Array;
      case "int32":
        return Int32Array;
      case "bool":
        return Uint8Array;
      case "float64":
        return Float64Array;
      case "uint32":
        return Uint32Array;
      case "int64":
        return BigInt64Array;
      case "uint64":
        return BigUint64Array;
      default:
        throw new Error(`unsupported type: ${t}`);
    }
  }, tr$1 = (t) => {
    switch (t) {
      case "verbose":
        return 0;
      case "info":
        return 1;
      case "warning":
        return 2;
      case "error":
        return 3;
      case "fatal":
        return 4;
      default:
        throw new Error(`unsupported logging level: ${t}`);
    }
  }, Nr = (t) => t === "float32" || t === "float16" || t === "int32" || t === "int64" || t === "uint32" || t === "uint8" || t === "bool" || t === "uint4" || t === "int4", Vr = (t) => t === "float32" || t === "float16" || t === "int32" || t === "int64" || t === "uint32" || t === "uint64" || t === "int8" || t === "uint8" || t === "bool" || t === "uint4" || t === "int4", to = (t) => {
    switch (t) {
      case "none":
        return 0;
      case "cpu":
        return 1;
      case "cpu-pinned":
        return 2;
      case "texture":
        return 3;
      case "gpu-buffer":
        return 4;
      case "ml-tensor":
        return 5;
      default:
        throw new Error(`unsupported data location: ${t}`);
    }
  };
});
var rr$1, ro = V$1(() => {
  Ir();
  rr$1 = async (t) => {
    if (typeof t == "string") {
      let e = await fetch(t);
      if (!e.ok) throw new Error(`failed to load external data file: ${t}`);
      let r = e.headers.get("Content-Length"), n = r ? parseInt(r, 10) : 0;
      if (n < 1073741824) return new Uint8Array(await e.arrayBuffer());
      {
        if (!e.body) throw new Error(`failed to load external data file: ${t}, no response body.`);
        let o = e.body.getReader(), i;
        try {
          i = new ArrayBuffer(n);
        } catch (u) {
          if (u instanceof RangeError) {
            let d = Math.ceil(n / 65536);
            i = new WebAssembly.Memory({ initial: d, maximum: d }).buffer;
          } else throw u;
        }
        let s = 0;
        for (; ; ) {
          let { done: u, value: d } = await o.read();
          if (u) break;
          let c = d.byteLength;
          new Uint8Array(i, s, c).set(d), s += c;
        }
        return new Uint8Array(i, 0, n);
      }
    } else return t instanceof Blob ? new Uint8Array(await t.arrayBuffer()) : t instanceof Uint8Array ? t : new Uint8Array(t);
  };
});
var Mf, Rf, Cs$1, As$1, Lr, Uf, se, nt = V$1(() => {
  J();
  Mf = ["V", "I", "W", "E", "F"], Rf = (t, e) => {
    console.log(`[${Mf[t]},${(/* @__PURE__ */ new Date()).toISOString()}]${e}`);
  }, Lr = (t, e) => {
    Cs$1 = t, As$1 = e;
  }, Uf = (t, e) => {
    let r = tr$1(t), n = tr$1(Cs$1);
    r >= n && Rf(r, typeof e == "function" ? e() : e);
  }, se = (...t) => {
    As$1 && Uf(...t);
  };
});
var no, ot$1, k, zt, Wr, Es$1, ks$1, ne = V$1(() => {
  no = class {
    static calcMatMulShape(e, r) {
      return e[1] !== r[0] ? void 0 : [e[0], r[1]];
    }
  }, ot$1 = class {
    static calcShape(e, r, n = false) {
      let o = e.length, i = r.length;
      if (o === 0) return r;
      if (i === 0) return e;
      let s = Math.max(e.length, r.length), u = new Array(s);
      if (n) {
        if (o < 2 || i < 2) return;
        let d = no.calcMatMulShape([e[o - 2], e[o - 1]], [r[i - 2], r[i - 1]]);
        if (d === void 0) return;
        [u[s - 2], u[s - 1]] = d;
      }
      for (let d = n ? 3 : 1; d <= s; d++) {
        let c = o - d < 0 ? 1 : e[o - d], p = i - d < 0 ? 1 : r[i - d];
        if (c !== p && c > 1 && p > 1) return;
        let m = Math.max(c, p);
        if (c && p) u[s - d] = Math.max(c, p);
        else {
          if (m > 1) return;
          u[s - d] = 0;
        }
      }
      return u;
    }
    static isValidBroadcast(e, r) {
      let n = e.length, o = r.length;
      if (n > o) return false;
      for (let i = 1; i <= n; i++) if (e[n - i] !== 1 && e[n - i] !== r[o - i]) return false;
      return true;
    }
  }, k = class t {
    static size(e) {
      return t.getSizeFromDimensionRange(e, 0, e.length);
    }
    static convertShape(e, r = 4) {
      let n = e.length;
      if (n === 0) return [];
      let o = new Array(n), i = n - 1;
      for (; i >= 0; ) {
        if (e[i] % r === 0) {
          o[i] = e[i] / r;
          break;
        }
        if (r % e[i] !== 0) throw new Error("cannot convert shape");
        o[i] = 1, r /= e[i], i--;
      }
      for (i--; i >= 0; i--) o[i] = e[i];
      return o;
    }
    static sizeFromDimension(e, r) {
      if (r < 0 || r > e.length) throw new Error(`invalid dimension of ${r} for sizeFromDimension as Tensor has ${e.length} dimensions.`);
      return t.getSizeFromDimensionRange(e, r, e.length);
    }
    static sizeToDimension(e, r) {
      if (r < 0 || r > e.length) throw new Error(`invalid dimension of ${r} for sizeToDimension as Tensor has ${e.length} dimensions.`);
      return t.getSizeFromDimensionRange(e, 0, r);
    }
    static getSizeFromDimensionRange(e, r, n) {
      let o = 1;
      for (let i = r; i < n; i++) {
        if (e[i] < 0) throw new Error("cannot get valid size from specified dimension range. Most likely the range contains negative values in them.");
        o *= Number(e[i]);
      }
      return o;
    }
    static computeStrides(e) {
      let r = e.length;
      if (r === 0) return [];
      if (r === 1) return [1];
      let n = new Array(r);
      n[r - 1] = 1, n[r - 2] = e[r - 1];
      for (let o = r - 3; o >= 0; --o) n[o] = n[o + 1] * e[o + 1];
      return n;
    }
    static normalizeAxis(e, r) {
      if (e < -r && e >= r) throw new Error("unsupported axis for this operation.");
      return e < 0 ? e + r : e;
    }
    static normalizeAxes(e, r) {
      return e.map((n) => this.normalizeAxis(n, r ?? e.length));
    }
    static sortBasedOnPerm(e, r) {
      return r ? r.map((n) => e[n]) : e.slice().reverse();
    }
    static padShape(e, r) {
      let n = e.length;
      return e.map((o, i) => o + r[i] + r[i + n]);
    }
    static areEqual(e, r) {
      return e.length !== r.length ? false : e.every((n, o) => n === r[o]);
    }
  }, zt = class t {
    static adjustPoolAttributes(e, r, n, o, i, s) {
      if (!e && n.length !== r.length - 2) throw new Error("length of specified kernel shapes should be 2 less than length of input dimensions");
      if (e) for (let u = 0; u < r.length - 2; u++) u >= n.length ? n.push(r[u + 2]) : n[u] = r[u + 2];
      for (let u = 0; u < n.length; u++) if (u < o.length) {
        if (o[u] < 0) throw new Error("strides should be greater than or equal to 1");
      } else o.push(1);
      for (let u = 0; u < n.length; u++) if (u < i.length) {
        if (i[u] < 0) throw new Error("dilations should be greater than or equal to 1");
      } else i.push(1);
      for (let u = 0; u < n.length * 2; u++) if (u < s.length) {
        if (s[u] < 0) throw new Error("pad should be greater than or equal to 1");
      } else s.push(0);
      for (let u = 0; u < n.length; u++) {
        if (n[u] <= 0) throw new Error("kernel shapes need to be greater than 0");
        if (s[u] >= n[u] || s[u + n.length] >= n[u]) throw new Error("pads should be smaller than kernel");
      }
    }
    static adjustPadsBasedOnAutoPad(e, r, n, o, i, s, u) {
      if (u) {
        if (i.length !== 2 * (e.length - 2)) throw new Error("length of pads should be twice the length of data dimensions");
        if (r.length !== e.length - 2) throw new Error("length of strides should be the length of data dimensions");
        if (o.length !== e.length - 2) throw new Error("length of kernel shapes should be the length of data dimensions");
        for (let d = 0; d < e.length - 2; d++) t.adjustPadAndReturnShape(e[d + (s ? 1 : 2)], r[d], n[d], o[d], i, d, d + e.length - 2, u);
      }
    }
    static computePoolOutputShape(e, r, n, o, i, s, u) {
      if (r.length <= 0) throw new Error("input shape must be of size greater than 0");
      let d = [r[0], r[1]];
      return t.computeShapeHelper(e, r, d, n, o, i, s, u), d;
    }
    static computeConvOutputShape(e, r, n, o, i, s, u) {
      if (e.length <= 0 || r.length <= 0) throw new Error("invalid input tensor dims or invalid filter tensor dims");
      let d = [e[0], r[0]];
      return t.computeShapeHelper(false, e, d, n, o, i, s, u), d;
    }
    static computeShapeHelper(e, r, n, o, i, s, u, d) {
      if (e) for (let c = 0; c < r.length - 2; c++) n.push(1);
      else for (let c = 0; c < r.length - 2; c++) n.push(t.adjustPadAndReturnShape(r[c + 2], o[c], i[c], s[c], u, c, c + r.length - 2, d));
    }
    static adjustPadAndReturnShape(e, r, n, o, i, s, u, d) {
      let c = n * (o - 1) + 1;
      if (d && d !== "NOTSET") switch (d) {
        case "VALID":
          return i[s] = 0, i[u] = 0, Math.floor((e - c) / r + 1);
        case "SAME_LOWER":
        case "SAME_UPPER":
          if (n !== 1) throw new Error("Dilation not supported for SAME_UPPER or SAME_LOWER");
          {
            let m = ((e + r - 1) / r - 1) * r + o - e;
            return i[s] = Math.floor(d === "SAME_LOWER" ? (m + 1) / 2 : m / 2), i[u] = m - i[s], Math.floor((e + m - o) / r + 1);
          }
        default:
          throw new Error("Unsupported AutoPad type");
      }
      else return Math.floor((e + i[s] + i[u] - c) / r + 1);
    }
  }, Wr = class {
    static getShapeOfGemmResult(e, r, n, o, i) {
      if (e.length !== 2 || n.length !== 2) throw new Error("shape need to be of size 2");
      let s, u, d;
      r ? (s = e[1], u = e[0]) : (s = e[0], u = e[1]);
      let c = -1;
      if (o ? (d = n[0], c = 1) : (d = n[1], c = 0), n[c] !== u) throw new Error("dimension mismatch");
      if (s <= 0 || d <= 0 || u <= 0) throw new Error("invalid shape specified");
      if (i && !ot$1.isValidBroadcast(i, [s, d])) throw new Error("gemm: invalid bias shape for broadcast");
      return [s, d, u];
    }
  }, Es$1 = -34028234663852886e22, ks$1 = 34028234663852886e22;
});
var Gr, oo = V$1(() => {
  J();
  Gr = (t, e) => new (Lt$1(e))(t);
});
var Os$1, ao, zs$1, Nf, Ps$1, Vf, Ds$1, Hr, Fr, io, Bs$1, Ms$1 = V$1(() => {
  J();
  nt();
  Os$1 = /* @__PURE__ */ new Map([["float32", 32], ["float16", 16], ["int32", 32], ["uint32", 32], ["int64", 64], ["uint64", 64], ["int8", 8], ["uint8", 8], ["int4", 4], ["uint4", 4]]), ao = (t, e) => {
    if (e === "int32") return t;
    let r = Os$1.get(e);
    if (!r) throw new Error(`WebNN backend does not support data type: ${e}`);
    let n = r / 8;
    if (t.byteLength % n !== 0) throw new Error(`Invalid Uint8Array length - must be a multiple of ${n}.`);
    let o = t.byteLength / n, i = new (Lt$1(e))(t.buffer, t.byteOffset, o);
    switch (e) {
      case "int64":
      case "uint64": {
        let s = new Int32Array(o);
        for (let u = 0; u < o; u++) {
          let d = i[u];
          if (d > 2147483647n || d < -2147483648n) throw new Error("Can not convert int64 data to int32 - value out of range.");
          s[u] = Number(d);
        }
        return new Uint8Array(s.buffer);
      }
      case "int8":
      case "uint8":
      case "uint32": {
        if (e === "uint32" && i.some((u) => u > 2147483647)) throw new Error("Can not convert uint32 data to int32 - value out of range.");
        let s = Int32Array.from(i, Number);
        return new Uint8Array(s.buffer);
      }
      default:
        throw new Error(`Unsupported data conversion from ${e} to 'int32'`);
    }
  }, zs$1 = (t, e) => {
    if (e === "int32") return t;
    if (t.byteLength % 4 !== 0) throw new Error("Invalid Uint8Array length - must be a multiple of 4 (int32).");
    let r = t.byteLength / 4, n = new Int32Array(t.buffer, t.byteOffset, r);
    switch (e) {
      case "int64": {
        let o = BigInt64Array.from(n, BigInt);
        return new Uint8Array(o.buffer);
      }
      case "uint64": {
        if (n.some((i) => i < 0)) throw new Error("Can not convert int32 data to uin64 - negative value found.");
        let o = BigUint64Array.from(n, BigInt);
        return new Uint8Array(o.buffer);
      }
      case "int8": {
        if (n.some((i) => i < -128 || i > 127)) throw new Error("Can not convert int32 data to int8 - value out of range.");
        let o = Int8Array.from(n, Number);
        return new Uint8Array(o.buffer);
      }
      case "uint8": {
        if (n.some((o) => o < 0 || o > 255)) throw new Error("Can not convert int32 data to uint8 - value out of range.");
        return Uint8Array.from(n, Number);
      }
      case "uint32": {
        if (n.some((i) => i < 0)) throw new Error("Can not convert int32 data to uint32 - negative value found.");
        let o = Uint32Array.from(n, Number);
        return new Uint8Array(o.buffer);
      }
      default:
        throw new Error(`Unsupported data conversion from 'int32' to ${e}`);
    }
  }, Nf = 1, Ps$1 = () => Nf++, Vf = /* @__PURE__ */ new Map([["int8", "int32"], ["uint8", "int32"], ["uint32", "int32"], ["int64", "int32"]]), Ds$1 = (t, e) => {
    let r = Os$1.get(t);
    if (!r) throw new Error(`WebNN backend does not support data type: ${t}`);
    return e.length > 0 ? Math.ceil(e.reduce((n, o) => n * o) * r / 8) : 0;
  }, Hr = class {
    constructor(e) {
      this.isDataConverted = false;
      let { sessionId: r, context: n, tensor: o, dataType: i, shape: s, fallbackDataType: u } = e;
      this.sessionId = r, this.mlContext = n, this.mlTensor = o, this.dataType = i, this.tensorShape = s, this.fallbackDataType = u;
    }
    get tensor() {
      return this.mlTensor;
    }
    get type() {
      return this.dataType;
    }
    get fallbackType() {
      return this.fallbackDataType;
    }
    get shape() {
      return this.tensorShape;
    }
    get byteLength() {
      return Ds$1(this.dataType, this.tensorShape);
    }
    destroy() {
      se("verbose", () => "[WebNN] TensorWrapper.destroy"), this.mlTensor.destroy();
    }
    write(e) {
      this.mlContext.writeTensor(this.mlTensor, e);
    }
    async read(e) {
      if (this.fallbackDataType) {
        let r = await this.mlContext.readTensor(this.mlTensor), n = zs$1(new Uint8Array(r), this.dataType);
        if (e) {
          (e instanceof ArrayBuffer ? new Uint8Array(e) : new Uint8Array(e.buffer, e.byteOffset, e.byteLength)).set(n);
          return;
        } else return n.buffer;
      } else return e ? this.mlContext.readTensor(this.mlTensor, e) : this.mlContext.readTensor(this.mlTensor);
    }
    canReuseTensor(e, r, n) {
      return this.mlContext === e && this.dataType === r && this.tensorShape.length === n.length && this.tensorShape.every((o, i) => o === n[i]);
    }
    setIsDataConverted(e) {
      this.isDataConverted = e;
    }
  }, Fr = class {
    constructor(e, r) {
      this.tensorManager = e;
      this.wrapper = r;
    }
    get tensorWrapper() {
      return this.wrapper;
    }
    releaseTensor() {
      this.tensorWrapper && (this.tensorManager.releaseTensor(this.tensorWrapper), this.wrapper = void 0);
    }
    async ensureTensor(e, r, n, o) {
      let i = this.tensorManager.getMLContext(e), s = this.tensorManager.getMLOpSupportLimits(e), u;
      if (!(s == null ? void 0 : s.input.dataTypes.includes(r))) {
        if (u = Vf.get(r), !u || (s == null ? void 0 : s.input.dataTypes.includes(u))) throw new Error(`WebNN backend does not support data type: ${r}`);
        se("verbose", () => `[WebNN] TensorIdTracker.ensureTensor: fallback dataType from ${r} to ${u}`);
      }
      if (this.wrapper) {
        if (this.wrapper.canReuseTensor(i, r, n)) return this.wrapper.tensor;
        if (o) {
          if (this.wrapper.byteLength !== Ds$1(r, n)) throw new Error("Unable to copy data to tensor with different size.");
          this.activeUpload = new Uint8Array(await this.wrapper.read());
        }
        this.tensorManager.releaseTensor(this.wrapper);
      }
      let d = typeof MLTensorUsage > "u" ? void 0 : MLTensorUsage.READ | MLTensorUsage.WRITE;
      return this.wrapper = await this.tensorManager.getCachedTensor(e, r, n, d, true, true, u), o && this.activeUpload && (this.wrapper.write(this.activeUpload), this.activeUpload = void 0), this.wrapper.tensor;
    }
    upload(e) {
      let r = e;
      if (this.wrapper) {
        if (this.wrapper.fallbackType) if (this.wrapper.fallbackType === "int32") r = ao(e, this.wrapper.type), this.wrapper.setIsDataConverted(true);
        else throw new Error(`Unsupported fallback data type: ${this.wrapper.fallbackType}`);
        if (e.byteLength === this.wrapper.byteLength) {
          this.wrapper.write(r);
          return;
        } else se("verbose", () => "Data size does not match tensor size. Releasing tensor."), this.releaseTensor();
      }
      this.activeUpload ? this.activeUpload.set(r) : this.activeUpload = new Uint8Array(r);
    }
    async download(e) {
      var _a2, _b;
      if (this.activeUpload) {
        let r = ((_a2 = this.wrapper) == null ? void 0 : _a2.isDataConverted) ? zs$1(this.activeUpload, (_b = this.wrapper) == null ? void 0 : _b.type) : this.activeUpload;
        if (e) {
          e instanceof ArrayBuffer ? new Uint8Array(e).set(r) : new Uint8Array(e.buffer, e.byteOffset, e.byteLength).set(r);
          return;
        } else return r.buffer;
      }
      if (!this.wrapper) throw new Error("Tensor has not been created.");
      return e ? this.wrapper.read(e) : this.wrapper.read();
    }
  }, io = class {
    constructor(e) {
      this.backend = e;
      this.tensorTrackersById = /* @__PURE__ */ new Map();
      this.freeTensors = [];
      this.externalTensors = /* @__PURE__ */ new Set();
    }
    getMLContext(e) {
      let r = this.backend.getMLContext(e);
      if (!r) throw new Error("MLContext not found for session.");
      return r;
    }
    getMLOpSupportLimits(e) {
      return this.backend.getMLOpSupportLimits(e);
    }
    reserveTensorId() {
      let e = Ps$1();
      return this.tensorTrackersById.set(e, new Fr(this)), e;
    }
    releaseTensorId(e) {
      let r = this.tensorTrackersById.get(e);
      r && (this.tensorTrackersById.delete(e), r.tensorWrapper && this.releaseTensor(r.tensorWrapper));
    }
    async ensureTensor(e, r, n, o, i) {
      se("verbose", () => `[WebNN] TensorManager.ensureTensor {tensorId: ${r}, dataType: ${n}, shape: ${o}, copyOld: ${i}}`);
      let s = this.tensorTrackersById.get(r);
      if (!s) throw new Error("Tensor not found.");
      return s.ensureTensor(e, n, o, i);
    }
    upload(e, r) {
      let n = this.tensorTrackersById.get(e);
      if (!n) throw new Error("Tensor not found.");
      n.upload(r);
    }
    async download(e, r) {
      se("verbose", () => `[WebNN] TensorManager.download {tensorId: ${e}, dstBuffer: ${r == null ? void 0 : r.byteLength}}`);
      let n = this.tensorTrackersById.get(e);
      if (!n) throw new Error("Tensor not found.");
      return n.download(r);
    }
    releaseTensorsForSession(e) {
      for (let r of this.freeTensors) r.sessionId === e && r.destroy();
      this.freeTensors = this.freeTensors.filter((r) => r.sessionId !== e);
    }
    registerTensor(e, r, n, o) {
      let i = this.getMLContext(e), s = Ps$1(), u = new Hr({ sessionId: e, context: i, tensor: r, dataType: n, shape: o });
      return this.tensorTrackersById.set(s, new Fr(this, u)), this.externalTensors.add(u), s;
    }
    async getCachedTensor(e, r, n, o, i, s, u) {
      let d = this.getMLContext(e);
      for (let [p, m] of this.freeTensors.entries()) if (m.canReuseTensor(d, r, n)) {
        se("verbose", () => `[WebNN] Reusing tensor {dataType: ${r}, ${u ? `fallbackDataType: ${u},` : ""} shape: ${n}`);
        let g = this.freeTensors.splice(p, 1)[0];
        return g.sessionId = e, g;
      }
      se("verbose", () => `[WebNN] MLContext.createTensor {dataType: ${r}, ${u ? `fallbackDataType: ${u},` : ""} shape: ${n}}`);
      let c = await d.createTensor({ dataType: u ?? r, shape: n, dimensions: n, usage: o, writable: i, readable: s });
      return new Hr({ sessionId: e, context: d, tensor: c, dataType: r, shape: n, fallbackDataType: u });
    }
    releaseTensor(e) {
      this.externalTensors.has(e) && this.externalTensors.delete(e), this.freeTensors.push(e);
    }
  }, Bs$1 = (...t) => new io(...t);
});
var qr$1, Lf, Kr$1, Rs$1 = V$1(() => {
  J();
  vt();
  oo();
  Ms$1();
  nt();
  qr$1 = /* @__PURE__ */ new Map([[1, "float32"], [10, "float16"], [6, "int32"], [12, "uint32"], [7, "int64"], [13, "uint64"], [22, "int4"], [21, "uint4"], [3, "int8"], [2, "uint8"], [9, "uint8"]]), Lf = (t, e) => {
    if (t === e) return true;
    if (t === void 0 || e === void 0) return false;
    let r = Object.keys(t).sort(), n = Object.keys(e).sort();
    return r.length === n.length && r.every((o, i) => o === n[i] && t[o] === e[o]);
  }, Kr$1 = class {
    constructor(e) {
      this.tensorManager = Bs$1(this);
      this.mlContextBySessionId = /* @__PURE__ */ new Map();
      this.sessionIdsByMLContext = /* @__PURE__ */ new Map();
      this.mlContextCache = [];
      this.sessionGraphInputs = /* @__PURE__ */ new Map();
      this.sessionGraphOutputs = /* @__PURE__ */ new Map();
      this.temporaryGraphInputs = [];
      this.temporaryGraphOutputs = [];
      this.temporarySessionTensorIds = /* @__PURE__ */ new Map();
      this.mlOpSupportLimitsBySessionId = /* @__PURE__ */ new Map();
      Lr(e.logLevel, !!e.debug);
    }
    get currentSessionId() {
      if (this.activeSessionId === void 0) throw new Error("No active session");
      return this.activeSessionId;
    }
    onRunStart(e) {
      se("verbose", () => `[WebNN] onRunStart {sessionId: ${e}}`), this.activeSessionId = e;
    }
    onRunEnd(e) {
      se("verbose", () => `[WebNN] onRunEnd {sessionId: ${e}}`);
      let r = this.temporarySessionTensorIds.get(e);
      if (r) {
        for (let n of r) se("verbose", () => `[WebNN] releasing temporary tensor {tensorId: ${n}}`), this.tensorManager.releaseTensorId(n);
        this.temporarySessionTensorIds.delete(e), this.activeSessionId = void 0;
      }
    }
    async createMLContext(e) {
      if (e instanceof GPUDevice) {
        let n = this.mlContextCache.findIndex((o) => o.gpuDevice === e);
        if (n !== -1) return this.mlContextCache[n].mlContext;
        {
          let o = await navigator.ml.createContext(e);
          return this.mlContextCache.push({ gpuDevice: e, mlContext: o }), o;
        }
      } else if (e === void 0) {
        let n = this.mlContextCache.findIndex((o) => o.options === void 0 && o.gpuDevice === void 0);
        if (n !== -1) return this.mlContextCache[n].mlContext;
        {
          let o = await navigator.ml.createContext();
          return this.mlContextCache.push({ mlContext: o }), o;
        }
      }
      let r = this.mlContextCache.findIndex((n) => Lf(n.options, e));
      if (r !== -1) return this.mlContextCache[r].mlContext;
      {
        let n = await navigator.ml.createContext(e);
        return this.mlContextCache.push({ options: e, mlContext: n }), n;
      }
    }
    registerMLContext(e, r) {
      this.mlContextBySessionId.set(e, r);
      let n = this.sessionIdsByMLContext.get(r);
      n || (n = /* @__PURE__ */ new Set(), this.sessionIdsByMLContext.set(r, n)), n.add(e), this.mlOpSupportLimitsBySessionId.has(e) || this.mlOpSupportLimitsBySessionId.set(e, r.opSupportLimits()), this.temporaryGraphInputs.length > 0 && (this.sessionGraphInputs.set(e, this.temporaryGraphInputs), this.temporaryGraphInputs = []), this.temporaryGraphOutputs.length > 0 && (this.sessionGraphOutputs.set(e, this.temporaryGraphOutputs), this.temporaryGraphOutputs = []);
    }
    onReleaseSession(e) {
      this.sessionGraphInputs.delete(e), this.sessionGraphOutputs.delete(e);
      let r = this.mlContextBySessionId.get(e);
      if (!r) return;
      this.tensorManager.releaseTensorsForSession(e), this.mlContextBySessionId.delete(e), this.mlOpSupportLimitsBySessionId.delete(e);
      let n = this.sessionIdsByMLContext.get(r);
      if (n.delete(e), n.size === 0) {
        this.sessionIdsByMLContext.delete(r);
        let o = this.mlContextCache.findIndex((i) => i.mlContext === r);
        o !== -1 && this.mlContextCache.splice(o, 1);
      }
    }
    getMLContext(e) {
      return this.mlContextBySessionId.get(e);
    }
    getMLOpSupportLimits(e) {
      return this.mlOpSupportLimitsBySessionId.get(e);
    }
    reserveTensorId() {
      return this.tensorManager.reserveTensorId();
    }
    releaseTensorId(e) {
      se("verbose", () => `[WebNN] releaseTensorId {tensorId: ${e}}`), this.tensorManager.releaseTensorId(e);
    }
    async ensureTensor(e, r, n, o, i) {
      let s = qr$1.get(n);
      if (!s) throw new Error(`Unsupported ONNX data type: ${n}`);
      return this.tensorManager.ensureTensor(e ?? this.currentSessionId, r, s, o, i);
    }
    async createTemporaryTensor(e, r, n) {
      se("verbose", () => `[WebNN] createTemporaryTensor {onnxDataType: ${r}, shape: ${n}}`);
      let o = qr$1.get(r);
      if (!o) throw new Error(`Unsupported ONNX data type: ${r}`);
      let i = this.tensorManager.reserveTensorId();
      await this.tensorManager.ensureTensor(e, i, o, n, false);
      let s = this.temporarySessionTensorIds.get(e);
      return s ? s.push(i) : this.temporarySessionTensorIds.set(e, [i]), i;
    }
    uploadTensor(e, r) {
      if (!ge().shouldTransferToMLTensor) throw new Error("Trying to upload to a MLTensor while shouldTransferToMLTensor is false");
      se("verbose", () => `[WebNN] uploadTensor {tensorId: ${e}, data: ${r.byteLength}}`), this.tensorManager.upload(e, r);
    }
    async downloadTensor(e, r) {
      return this.tensorManager.download(e, r);
    }
    createMLTensorDownloader(e, r) {
      return async () => {
        let n = await this.tensorManager.download(e);
        return Gr(n, r);
      };
    }
    registerMLTensor(e, r, n, o) {
      let i = qr$1.get(n);
      if (!i) throw new Error(`Unsupported ONNX data type: ${n}`);
      let s = this.tensorManager.registerTensor(e, r, i, o);
      return se("verbose", () => `[WebNN] registerMLTensor {tensor: ${r}, dataType: ${i}, dimensions: ${o}} -> {tensorId: ${s}}`), s;
    }
    registerMLConstant(e, r, n, o, i, s, u = false) {
      if (!s) throw new Error("External mounted files are not available.");
      let d = e;
      e.startsWith("./") && (d = e.substring(2));
      let c = s.get(d);
      if (!c) throw new Error(`File with name ${d} not found in preloaded files.`);
      if (r + n > c.byteLength) throw new Error("Out of bounds: data offset and length exceed the external file data size.");
      let p = c.slice(r, r + n).buffer, m;
      switch (i.dataType) {
        case "float32":
          m = new Float32Array(p);
          break;
        case "float16":
          m = typeof Float16Array < "u" && Float16Array.from ? new Float16Array(p) : new Uint16Array(p);
          break;
        case "int32":
          m = new Int32Array(p);
          break;
        case "uint32":
          m = new Uint32Array(p);
          break;
        case "int64":
          if (u) {
            let g = ao(new Uint8Array(p), "int64");
            m = new Int32Array(g.buffer), i.dataType = "int32";
          } else m = new BigInt64Array(p);
          break;
        case "uint64":
          m = new BigUint64Array(p);
          break;
        case "int8":
          m = new Int8Array(p);
          break;
        case "int4":
        case "uint4":
        case "uint8":
          m = new Uint8Array(p);
          break;
        default:
          throw new Error(`Unsupported data type: ${i.dataType} in creating WebNN Constant from external data.`);
      }
      return se("verbose", () => `[WebNN] registerMLConstant {dataType: ${i.dataType}, shape: ${i.shape}}} ${u ? "(Note: it was int64 data type and registered to int32 as workaround)" : ""}`), o.constant(i, m);
    }
    registerGraphInput(e) {
      this.temporaryGraphInputs.push(e);
    }
    registerGraphOutput(e) {
      this.temporaryGraphOutputs.push(e);
    }
    isGraphInput(e, r) {
      let n = this.sessionGraphInputs.get(e);
      return n ? n.includes(r) : false;
    }
    isGraphOutput(e, r) {
      let n = this.sessionGraphOutputs.get(e);
      return n ? n.includes(r) : false;
    }
    isGraphInputOutputTypeSupported(e, r, n = true) {
      let o = qr$1.get($t(r)), i = this.mlOpSupportLimitsBySessionId.get(e);
      return typeof o > "u" ? false : n ? !!(i == null ? void 0 : i.input.dataTypes.includes(o)) : !!(i == null ? void 0 : i.output.dataTypes.includes(o));
    }
    flush() {
    }
  };
});
var jr = V$1(() => {
});
var Us$1, so, uo, Wf, Gf, Ns$1, co, lo, Ls$1, Ws$1 = V$1(() => {
  nt();
  jr();
  Us$1 = /* @__PURE__ */ new Map([[64, 250], [128, 200], [256, 200], [512, 200], [2048, 230], [4096, 200], [8192, 50], [16384, 50], [32768, 50], [65536, 50], [131072, 50], [262144, 50], [524288, 50], [1048576, 50], [2097152, 30], [4194304, 20], [8388608, 10], [12582912, 10], [16777216, 10], [26214400, 15], [33554432, 22], [44236800, 2], [58982400, 6], [67108864, 6], [134217728, 6], [167772160, 6]]), so = [], uo = (t) => Math.ceil(Number(t) / 16) * 16, Wf = (t) => {
    for (let e = 0; e < so.length; e++) {
      let r = so[e];
      if (t <= r) return r;
    }
    return Math.ceil(t / 16) * 16;
  }, Gf = 1, Ns$1 = () => Gf++, co = async (t, e, r, n) => {
    let o = uo(r), i = t.device.createBuffer({ size: o, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    try {
      let s = t.getCommandEncoder();
      t.endComputePass(), s.copyBufferToBuffer(e, 0, i, 0, o), t.flush(), await i.mapAsync(GPUMapMode.READ);
      let u = i.getMappedRange();
      if (n) {
        let d = n();
        return d.set(new Uint8Array(u, 0, r)), d;
      } else return new Uint8Array(u.slice(0, r));
    } finally {
      i.destroy();
    }
  }, lo = class {
    constructor(e) {
      this.backend = e;
      this.storageCache = /* @__PURE__ */ new Map(), this.freeBuffers = /* @__PURE__ */ new Map(), this.freeUniformBuffers = /* @__PURE__ */ new Map(), this.buffersPending = [], this.capturedPendingBuffers = /* @__PURE__ */ new Map();
      for (let [r] of Us$1) so.push(r), this.freeBuffers.set(r, []), this.freeUniformBuffers.set(r, []);
      this.sessionCount = 0;
    }
    upload(e, r) {
      let n = r.buffer, o = r.byteOffset, i = r.byteLength, s = uo(i), u = this.storageCache.get(e);
      if (!u) throw new Error("gpu data for uploading does not exist");
      if (Number(u.originalSize) !== i) throw new Error(`inconsistent data size. gpu data size=${u.originalSize}, data size=${i}`);
      let d = this.backend.device.createBuffer({ mappedAtCreation: true, size: s, usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC }), c = d.getMappedRange();
      new Uint8Array(c).set(new Uint8Array(n, o, i)), d.unmap();
      let p = this.backend.device.createCommandEncoder();
      p.copyBufferToBuffer(d, 0, u.gpuData.buffer, 0, s), this.backend.device.queue.submit([p.finish()]), d.destroy(), se("verbose", () => `[WebGPU] GpuDataManager.upload(id=${e})`);
    }
    memcpy(e, r) {
      let n = this.storageCache.get(e);
      if (!n) throw new Error("source gpu data for memcpy does not exist");
      let o = this.storageCache.get(r);
      if (!o) throw new Error("destination gpu data for memcpy does not exist");
      if (n.originalSize !== o.originalSize) throw new Error("inconsistent source and destination gpu data size");
      let i = uo(n.originalSize), s = this.backend.getCommandEncoder();
      this.backend.endComputePass(), s.copyBufferToBuffer(n.gpuData.buffer, 0, o.gpuData.buffer, 0, i);
    }
    registerExternalBuffer(e, r, n) {
      let o;
      if (n) {
        if (o = n[0], e === n[1]) return se("verbose", () => `[WebGPU] GpuDataManager.registerExternalBuffer(size=${r}) => id=${o}, buffer is the same, skip.`), o;
        if (this.backend.capturedCommandList.has(this.backend.currentSessionId)) throw new Error(`Registering a different external buffer under graph capture mode is not supported yet.
             Please use the previous external buffer!`);
      } else o = Ns$1();
      return this.storageCache.set(o, { gpuData: { id: o, type: 0, buffer: e }, originalSize: r }), se("verbose", () => `[WebGPU] GpuDataManager.registerExternalBuffer(size=${r}) => id=${o}, registered.`), o;
    }
    unregisterExternalBuffer(e) {
      e !== void 0 && (this.storageCache.delete(e), se("verbose", () => `[WebGPU] GpuDataManager.unregisterExternalBuffer() => id=${e}`));
    }
    create(e, r = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST) {
      let n = Wf(e), o, i = (r & GPUBufferUsage.STORAGE) === GPUBufferUsage.STORAGE, s = (r & GPUBufferUsage.UNIFORM) === GPUBufferUsage.UNIFORM;
      if (i || s) {
        let c = (i ? this.freeBuffers : this.freeUniformBuffers).get(n);
        c ? c.length > 0 ? o = c.pop() : o = this.backend.device.createBuffer({ size: n, usage: r }) : o = this.backend.device.createBuffer({ size: n, usage: r });
      } else o = this.backend.device.createBuffer({ size: n, usage: r });
      let u = { id: Ns$1(), type: 0, buffer: o };
      return this.storageCache.set(u.id, { gpuData: u, originalSize: Number(e) }), se("verbose", () => `[WebGPU] GpuDataManager.create(size=${e}) => id=${u.id}`), u;
    }
    get(e) {
      var _a2;
      return (_a2 = this.storageCache.get(e)) == null ? void 0 : _a2.gpuData;
    }
    release(e) {
      let r = typeof e == "bigint" ? Number(e) : e, n = this.storageCache.get(r);
      if (!n) {
        if (this.storageCache.size === 0) return 0;
        throw new Error("releasing data does not exist");
      }
      return se("verbose", () => `[WebGPU] GpuDataManager.release(id=${r}), gpuDataId=${n.gpuData.id}`), this.storageCache.delete(r), this.buffersPending.push(n.gpuData.buffer), n.originalSize;
    }
    async download(e, r) {
      let n = this.storageCache.get(Number(e));
      if (!n) throw new Error("data does not exist");
      await co(this.backend, n.gpuData.buffer, n.originalSize, r);
    }
    refreshPendingBuffers() {
      if (this.buffersPending.length !== 0) if (this.backend.sessionStatus === "default") {
        for (let e of this.buffersPending) {
          let r = Us$1.get(e.size);
          if ((e.usage & GPUBufferUsage.STORAGE) === GPUBufferUsage.STORAGE) {
            let n = this.freeBuffers.get(e.size) || [];
            r === void 0 || n.length >= r ? e.destroy() : n.push(e);
          } else if ((e.usage & GPUBufferUsage.UNIFORM) === GPUBufferUsage.UNIFORM) {
            let n = this.freeUniformBuffers.get(e.size) || [];
            r === void 0 || n.length >= r ? e.destroy() : n.push(e);
          } else e.destroy();
        }
        this.buffersPending = [];
      } else {
        let e = this.capturedPendingBuffers.get(this.backend.currentSessionId);
        e || (e = [], this.capturedPendingBuffers.set(this.backend.currentSessionId, e));
        for (let r of this.buffersPending) e.push(r);
        this.buffersPending = [];
      }
    }
    dispose() {
      this.freeBuffers.forEach((e) => {
        e.forEach((r) => {
          r.destroy();
        });
      }), this.freeUniformBuffers.forEach((e) => {
        e.forEach((r) => {
          r.destroy();
        });
      }), this.storageCache.forEach((e) => {
        e.gpuData.buffer.destroy();
      }), this.capturedPendingBuffers.forEach((e) => {
        e.forEach((r) => {
          r.destroy();
        });
      }), this.storageCache = /* @__PURE__ */ new Map(), this.freeBuffers = /* @__PURE__ */ new Map(), this.freeUniformBuffers = /* @__PURE__ */ new Map(), this.capturedPendingBuffers = /* @__PURE__ */ new Map();
    }
    onCreateSession() {
      this.sessionCount += 1;
    }
    onReleaseSession(e) {
      let r = this.capturedPendingBuffers.get(e);
      r && (r.forEach((n) => {
        n.destroy();
      }), this.capturedPendingBuffers.delete(e)), this.sessionCount -= 1, this.sessionCount === 0 && (se("warning", () => "[WebGPU] Clearing webgpu buffer cache"), this.storageCache.forEach((n) => {
        n.gpuData.buffer.destroy();
      }), this.storageCache = /* @__PURE__ */ new Map());
    }
  }, Ls$1 = (...t) => new lo(...t);
});
var po, ee$1, Ie = V$1(() => {
  po = class {
    constructor(e) {
      Object.assign(this, e);
    }
    get cacheKey() {
      return this.key || (this.key = Object.getOwnPropertyNames(this).sort().map((e) => `${this[e]}`).join(";")), this.key;
    }
  }, ee$1 = (t) => new po(t);
});
var Dt, fo, be$1, Pe, L, fe, ho, Bt$1, je, F$1, Zr$1, O, R, Gs$1, Qr$1, mo, Hs$1, ae = V$1(() => {
  J();
  ne();
  Dt = 64, fo = (t, e) => {
    if (e === 3) throw new Error("vec3 has same alignment as vec4, use vec4 instead");
    switch (Number(t)) {
      case 10:
        return e > 1 ? `vec${e}<f16>` : "f16";
      case 1:
        return e > 1 ? `vec${e}<f32>` : "f32";
      case 6:
        return e > 1 ? `vec${e}<i32>` : "i32";
      case 12:
        return e > 1 ? `vec${e}<u32>` : "u32";
      case 7:
        if (e > 1) throw new Error("currently not supported vecX of uint64 yet");
        return ["vec2<u32>", "i32"];
      case 13:
        if (e > 1) throw new Error("currently not supported vecX of uint64 yet");
        return ["vec2<u32>", "u32"];
      case 9:
        if (e !== 4) throw new Error("bool must be vec4");
        return ["u32", "vec4<bool>"];
      case 22:
        return "i32";
      case 21:
        return "u32";
      default:
        throw new Error(`Unknown data type: ${t}`);
    }
  }, be$1 = (t, e = 1) => {
    let r = fo(t, e);
    return typeof r == "string" ? r : r[0];
  }, Pe = (t, e = 1) => {
    let r = fo(t, e);
    return typeof r == "string" ? r : r[1];
  }, L = (...t) => {
    let e = [];
    return t.forEach((r) => {
      r.length !== 0 && e.push({ type: 12, data: r }, { type: 12, data: k.computeStrides(r) });
    }), e;
  }, fe = (t) => t % 4 === 0 ? 4 : t % 2 === 0 ? 2 : 1, ho = (t = "f32", e, r = "0") => !e || e === 1 ? `${t}(${r})` : `vec${e}<${t}>(${r})`, Bt$1 = (t, e, r) => t === "f32" ? r : e === 1 ? `f32(${r})` : `vec${e}<f32>(${r})`, je = (t, e) => e === 4 ? `(${t}.x + ${t}.y + ${t}.z + ${t}.w)` : e === 2 ? `(${t}.x + ${t}.y)` : e === 3 ? `(${t}.x + ${t}.y + ${t}.z)` : t, F$1 = (t, e, r, n) => t.startsWith("uniforms.") && r > 4 ? typeof e == "string" ? n === "f16" ? `${t}[(${e}) / 8][(${e}) % 8 / 4][(${e}) % 8 % 4]` : `${t}[(${e}) / 4][(${e}) % 4]` : n === "f16" ? `${t}[${Math.floor(e / 8)}][${Math.floor(e % 8 / 4)}][${e % 8 % 4}]` : `${t}[${Math.floor(e / 4)}][${e % 4}]` : r > 1 ? `${t}[${e}]` : t, Zr$1 = (t, e, r, n, o) => {
    let i = typeof r == "number", s = i ? r : r.length, u = [...new Array(s).keys()], d = s < 2 ? "u32" : s <= 4 ? `vec${s}<u32>` : `array<u32, ${s}>`, c = fo(e, o), p = typeof c == "string" ? c : c[1], m = typeof c == "string" ? c : c[0], g = { indices: d, value: p, storage: m, tensor: e }, b = (U) => typeof U == "string" ? U : `${U}u`, y = { offsetToIndices: false, indicesToOffset: false, broadcastedIndicesToOffset: false, set: false, setByIndices: false, get: false, getByIndices: false }, w = i ? "uniforms." : "", S = `${w}${t}_shape`, x = `${w}${t}_strides`, $ = "";
    for (let U = 0; U < s - 1; U++) $ += `
    let dim${U} = current / ${F$1(x, U, s)};
    let rest${U} = current % ${F$1(x, U, s)};
    indices[${U}] = dim${U};
    current = rest${U};
    `;
    $ += `indices[${s - 1}] = current;`;
    let T = s < 2 ? "" : `
  fn o2i_${t}(offset: u32) -> ${g.indices} {
    var indices: ${g.indices};
    var current = offset;
    ${$}
    return indices;
  }`, I = (U) => (y.offsetToIndices = true, s < 2 ? U : `o2i_${t}(${U})`), E = [];
    if (s >= 2) for (let U = s - 1; U >= 0; U--) E.push(`${F$1(x, U, s)} * (indices[${U}])`);
    let A = s < 2 ? "" : `
  fn i2o_${t}(indices: ${g.indices}) -> u32 {
    return ${E.join("+")};
  }`, z2 = (U) => (y.indicesToOffset = true, s < 2 ? U : `i2o_${t}(${U})`), v = (...U) => s === 0 ? "0u" : `${g.indices}(${U.map(b).join(",")})`, M = (U, X) => s < 2 ? `${U}` : `${F$1(U, X, s)}`, N = (U, X, Se) => s < 2 ? `${U}=${Se};` : `${F$1(U, X, s)}=${Se};`, K = {}, q = (U, X) => {
      y.broadcastedIndicesToOffset = true;
      let Se = `${X.name}broadcastedIndicesTo${t}Offset`;
      if (Se in K) return `${Se}(${U})`;
      let Be = [];
      for (let ze2 = s - 1; ze2 >= 0; ze2--) {
        let Xe = X.indicesGet("outputIndices", ze2 + X.rank - s);
        Be.push(`${M(x, ze2)} * (${Xe} % ${M(S, ze2)})`);
      }
      return K[Se] = `fn ${Se}(outputIndices: ${X.type.indices}) -> u32 {
             return ${Be.length > 0 ? Be.join("+") : "0u"};
           }`, `${Se}(${U})`;
    }, Q = (U, X) => (() => {
      if (g.storage === g.value) return `${t}[${U}]=${X};`;
      if (g.storage === "vec2<u32>" && g.value === "i32") return `${t}[${U}]=vec2<u32>(u32(${X}), select(0u, 0xFFFFFFFFu, ${X} < 0));`;
      if (g.storage === "vec2<u32>" && g.value === "u32") return `${t}[${U}]=vec2<u32>(u32(${X}), 0u);`;
      if (g.storage === "u32" && g.value === "vec4<bool>") return `${t}[${U}]=dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(${X}));`;
      throw new Error(`not supported combination of storage type ${g.storage} and value type ${g.value} yet`);
    })(), D = (U) => (() => {
      if (g.storage === g.value) return `${t}[${U}]`;
      if (g.storage === "vec2<u32>" && g.value === "i32") return `i32(${t}[${U}].x)`;
      if (g.storage === "vec2<u32>" && g.value === "u32") return `u32(${t}[${U}].x)`;
      if (g.storage === "u32" && g.value === "vec4<bool>") return `vec4<bool>(bool(${t}[${U}] & 0xFFu), bool(${t}[${U}] & 0xFF00u), bool(${t}[${U}] & 0xFF0000u), bool(${t}[${U}] & 0xFF000000u))`;
      throw new Error(`not supported combination of storage type ${g.storage} and value type ${g.value} yet`);
    })(), W = s < 2 ? "" : `
  fn get_${t}ByIndices(indices: ${g.indices}) -> ${p} {
    return ${D(`i2o_${t}(indices)`)};
  }`, j = s < 2 ? "" : (() => {
      let U = u.map((Se) => `d${Se}: u32`).join(", "), X = u.map((Se) => `d${Se}`).join(", ");
      return `
  fn get_${t}(${U}) -> ${p} {
    return get_${t}ByIndices(${v(X)});
  }`;
    })(), Y = (...U) => {
      if (U.length !== s) throw new Error(`indices length must be ${s}`);
      let X = U.map(b).join(",");
      return s === 0 ? D("0u") : s === 1 ? D(X[0]) : (y.get = true, y.getByIndices = true, y.indicesToOffset = true, `get_${t}(${X})`);
    }, Z = (U) => s < 2 ? D(U) : (y.getByIndices = true, y.indicesToOffset = true, `get_${t}ByIndices(${U})`), te = s < 2 ? "" : `
  fn set_${t}ByIndices(indices: ${g.indices}, value: ${p}) {
    ${Q(`i2o_${t}(indices)`, "value")}
  }`, ie = s < 2 ? "" : (() => {
      let U = u.map((Se) => `d${Se}: u32`).join(", "), X = u.map((Se) => `d${Se}`).join(", ");
      return `
  fn set_${t}(${U}, value: ${p}) {
    set_${t}ByIndices(${v(X)}, value);
  }`;
    })();
    return { impl: () => {
      let U = [], X = false;
      return y.offsetToIndices && (U.push(T), X = true), y.indicesToOffset && (U.push(A), X = true), y.broadcastedIndicesToOffset && (Object.values(K).forEach((Se) => U.push(Se)), X = true), y.set && (U.push(ie), X = true), y.setByIndices && (U.push(te), X = true), y.get && (U.push(j), X = true), y.getByIndices && (U.push(W), X = true), !i && X && U.unshift(`const ${S} = ${g.indices}(${r.join(",")});`, `const ${x} = ${g.indices}(${k.computeStrides(r).join(",")});`), U.join(`
`);
    }, type: g, offsetToIndices: I, indicesToOffset: z2, broadcastedIndicesToOffset: q, indices: v, indicesGet: M, indicesSet: N, set: (...U) => {
      if (U.length !== s + 1) throw new Error(`indices length must be ${s}`);
      let X = U[s];
      if (typeof X != "string") throw new Error("value must be string");
      let Se = U.slice(0, s).map(b).join(",");
      return s === 0 ? Q("0u", X) : s === 1 ? Q(Se[0], X) : (y.set = true, y.setByIndices = true, y.indicesToOffset = true, `set_${t}(${Se}, ${X})`);
    }, setByOffset: Q, setByIndices: (U, X) => s < 2 ? Q(U, X) : (y.setByIndices = true, y.indicesToOffset = true, `set_${t}ByIndices(${U}, ${X});`), get: Y, getByOffset: D, getByIndices: Z, usage: n, name: t, strides: x, shape: S, rank: s };
  }, O = (t, e, r, n = 1) => Zr$1(t, e, r, "input", n), R = (t, e, r, n = 1) => Zr$1(t, e, r, "output", n), Gs$1 = (t, e, r) => Zr$1(t, e, r, "atomicOutput", 1), Qr$1 = (t, e, r, n = 1) => Zr$1(t, e, r, "internal", n), mo = class {
    constructor(e, r) {
      this.normalizedDispatchGroup = e;
      this.limits = r;
      this.internalVariables = [];
      this.variables = [];
      this.uniforms = [];
      this.variableIndex = 0;
    }
    guardAgainstOutOfBoundsWorkgroupSizes(e) {
      return `if (global_idx >= ${typeof e == "number" ? `${e}u` : e}) { return; }`;
    }
    mainStart(e = Dt) {
      let r = typeof e == "number" ? e : e[0], n = typeof e == "number" ? 1 : e[1], o = typeof e == "number" ? 1 : e[2];
      if (r > this.limits.maxComputeWorkgroupSizeX || n > this.limits.maxComputeWorkgroupSizeY || o > this.limits.maxComputeWorkgroupSizeZ) throw new Error(`workgroup size [${r}, ${n}, ${o}] exceeds the maximum workgroup size [${this.limits.maxComputeWorkgroupSizeX}, ${this.limits.maxComputeWorkgroupSizeY}, ${this.limits.maxComputeWorkgroupSizeZ}].`);
      if (r * n * o > this.limits.maxComputeInvocationsPerWorkgroup) throw new Error(`workgroup size [${r}, ${n}, ${o}] exceeds the maximum workgroup invocations ${this.limits.maxComputeInvocationsPerWorkgroup}.`);
      let i = this.normalizedDispatchGroup[1] === 1 && this.normalizedDispatchGroup[2] === 1, s = i ? `@builtin(global_invocation_id) global_id : vec3<u32>,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(local_invocation_id) local_id : vec3<u32>` : `@builtin(global_invocation_id) global_id : vec3<u32>,
                                             @builtin(local_invocation_id) local_id : vec3<u32>,
    @builtin(local_invocation_index) local_idx : u32,
    @builtin(workgroup_id) workgroup_id : vec3<u32>,
    @builtin(num_workgroups) num_workgroups : vec3<u32>`, u = i ? `let global_idx = global_id.x;
         let workgroup_index = workgroup_id.x;` : `let workgroup_index = workgroup_id.z * num_workgroups[0] * num_workgroups[1] +
             workgroup_id.y * num_workgroups[0] + workgroup_id.x;
         let global_idx = workgroup_index * ${r * n * o}u + local_idx;`;
      return `@compute @workgroup_size(${r}, ${n}, ${o})
  fn main(${s}) {
    ${u}
  `;
    }
    appendVariableUniforms(e) {
      e.rank !== 0 && (e.shape.startsWith("uniforms.") && this.uniforms.push({ name: e.shape.replace("uniforms.", ""), type: "u32", length: e.rank }), e.strides.startsWith("uniforms.") && this.uniforms.push({ name: e.strides.replace("uniforms.", ""), type: "u32", length: e.rank }));
    }
    declareVariable(e, r) {
      if (e.usage === "internal") throw new Error("cannot use internal variable with declareVariable(). use registerInternalVariables() instead.");
      this.variables.push(e), this.appendVariableUniforms(e);
      let n = e.usage === "input" ? "read" : "read_write", o = e.usage === "atomicOutput" ? "atomic<i32>" : e.type.storage;
      return `@group(0) @binding(${r}) var<storage, ${n}> ${e.name}: array<${o}>;`;
    }
    declareVariables(...e) {
      return e.map((r) => this.declareVariable(r, this.variableIndex++)).join(`
`);
    }
    registerInternalVariable(e) {
      if (e.usage !== "internal") throw new Error("cannot use input or output variable with registerInternalVariable(). use declareVariables() instead.");
      this.internalVariables.push(e), this.appendVariableUniforms(e);
    }
    registerInternalVariables(...e) {
      return e.forEach((r) => this.registerInternalVariable(r)), this;
    }
    registerUniform(e, r, n = 1) {
      return this.uniforms.push({ name: e, type: r, length: n }), this;
    }
    registerUniforms(e) {
      return this.uniforms = this.uniforms.concat(e), this;
    }
    uniformDeclaration() {
      if (this.uniforms.length === 0) return "";
      let e = [];
      for (let { name: r, type: n, length: o } of this.uniforms) if (o && o > 4) n === "f16" ? e.push(`@align(16) ${r}:array<mat2x4<${n}>, ${Math.ceil(o / 8)}>`) : e.push(`${r}:array<vec4<${n}>, ${Math.ceil(o / 4)}>`);
      else {
        let i = o == null || o === 1 ? n : `vec${o}<${n}>`;
        e.push(`${r}:${i}`);
      }
      return `
      struct Uniforms { ${e.join(", ")} };
      @group(0) @binding(${this.variableIndex}) var<uniform> uniforms: Uniforms;`;
    }
    get additionalImplementations() {
      return this.uniformDeclaration() + this.variables.map((e) => e.impl()).join(`
`) + this.internalVariables.map((e) => e.impl()).join(`
`);
    }
    get variablesInfo() {
      if (this.uniforms.length === 0) return;
      let e = (r) => [12, 10, 1, 6][["u32", "f16", "f32", "i32"].indexOf(r)];
      return this.uniforms.map((r) => [e(r.type), r.length ?? 1]);
    }
  }, Hs$1 = (t, e) => new mo(t, e);
});
var Hf, Fs$1, Ff, qf, Kf$1, jf, Oe, qs$1, Ks, pt = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  Hf = (t, e) => {
    if (!t || t.length !== 1) throw new Error("Transpose requires 1 input.");
    if (e.length !== 0 && e.length !== t[0].dims.length) throw new Error(`perm size ${e.length} does not match input rank ${t[0].dims.length}`);
  }, Fs$1 = (t, e) => e.length !== 0 ? e : [...new Array(t).keys()].reverse(), Ff = (t, e) => k.sortBasedOnPerm(t, Fs$1(t.length, e)), qf = (t, e, r, n) => {
    let o = `fn perm(i: ${n.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`;
    for (let i = 0; i < e; ++i) o += `a[${t[i]}]=i[${i}];`;
    return o += "return a;}";
  }, Kf$1 = (t, e) => {
    let r = [], n = [];
    for (let o = 0; o < t.length; ++o) t[o] !== 1 && r.push(t[o]), t[e[o]] !== 1 && n.push(e[o]);
    return { newShape: r, newPerm: n };
  }, jf = (t, e) => {
    let r = 0;
    for (let n = 0; n < t.length; ++n) if (e[t[n]] !== 1) {
      if (t[n] < r) return false;
      r = t[n];
    }
    return true;
  }, Oe = (t, e) => {
    let r = t.dataType, n = t.dims.length, o = Fs$1(n, e), i = Ff(t.dims, o), s = t.dims, u = i, d = n < 2 || jf(o, t.dims), c;
    if (d) return c = (w) => {
      let S = O("input", r, s, 4), x = R("output", r, u, 4);
      return `
  ${w.registerUniform("output_size", "u32").declareVariables(S, x)}
  ${w.mainStart()}
    ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    output[global_idx] = input[global_idx];
  }`;
    }, { name: "TransposeCopy", shaderCache: { inputDependencies: ["type"] }, getRunData: () => {
      let w = k.size(i);
      return { outputs: [{ dims: i, dataType: t.dataType }], dispatchGroup: { x: Math.ceil(w / 64 / 4) }, programUniforms: [{ type: 12, data: Math.ceil(w / 4) }] };
    }, getShaderSource: c };
    let { newShape: p, newPerm: m } = Kf$1(t.dims, o), g = k.areEqual(m, [2, 3, 1]), b = k.areEqual(m, [3, 1, 2]);
    if (p.length === 2 || g || b) {
      s = g ? [p[0], p[1] * p[2]] : b ? [p[0] * p[1], p[2]] : p, u = [s[1], s[0]];
      let w = 16;
      return c = (S) => {
        let x = O("a", r, s.length), $ = R("output", r, u.length);
        return `
  ${S.registerUniform("output_size", "u32").declareVariables(x, $)}
  var<workgroup> tile : array<array<${$.type.value}, ${w + 1}>, ${w}>;
  ${S.mainStart([w, w, 1])}
    let stride = (uniforms.output_shape[1] - 1) / ${w} + 1;
    let workgroup_id_x = workgroup_index % stride;
    let workgroup_id_y = workgroup_index / stride;
    let input_col = workgroup_id_y * ${w}u + local_id.x;
    let input_row = workgroup_id_x * ${w}u + local_id.y;
    if (input_row < uniforms.a_shape[0] && input_col < uniforms.a_shape[1]) {
      tile[local_id.y][local_id.x] = ${x.getByIndices(`${x.type.indices}(input_row, input_col)`)};
    }
    workgroupBarrier();

    let output_col = workgroup_id_x * ${w}u + local_id.x;
    let output_row = workgroup_id_y * ${w}u + local_id.y;
    if (output_row < uniforms.output_shape[0] && output_col < uniforms.output_shape[1]) {
      ${$.setByIndices(`${$.type.indices}(output_row, output_col)`, "tile[local_id.x][local_id.y]")}
    }
  }`;
      }, { name: "TransposeShared", shaderCache: { inputDependencies: ["type"] }, getRunData: () => {
        let S = k.size(i);
        return { outputs: [{ dims: i, dataType: t.dataType }], dispatchGroup: { x: Math.ceil(u[1] / w), y: Math.ceil(u[0] / w) }, programUniforms: [{ type: 12, data: S }, ...L(s, u)] };
      }, getShaderSource: c };
    }
    return c = (w) => {
      let S = O("a", r, s.length), x = R("output", r, u.length);
      return `
  ${w.registerUniform("output_size", "u32").declareVariables(S, x)}

  ${qf(o, n, S, x)}

  ${w.mainStart()}
    ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${x.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${x.setByOffset("global_idx", S.getByIndices("aIndices"))}
  }`;
    }, { name: "Transpose", shaderCache: { hint: `${e}`, inputDependencies: ["rank"] }, getRunData: () => {
      let w = k.size(i);
      return { outputs: [{ dims: i, dataType: t.dataType }], dispatchGroup: { x: Math.ceil(w / 64) }, programUniforms: [{ type: 12, data: w }, ...L(s, u)] };
    }, getShaderSource: c };
  }, qs$1 = (t, e) => {
    Hf(t.inputs, e.perm), t.compute(Oe(t.inputs[0], e.perm));
  }, Ks = (t) => ee$1({ perm: t.perm });
});
var Zf, Qf$1, Yf, Xf, Jf, eh, th, rh, nh, oh, it$1, js$1, Zs, Qs, Ys$1, Xs, Js, eu, tu, ru, nu, ou = V$1(() => {
  J();
  ne();
  ae();
  Yr();
  pt();
  Zf = { max: "select(bestValue, candidate, candidate > bestValue)", min: "select(bestValue, candidate, candidate < bestValue)", mean: "bestValue + candidate", sum: "bestValue + candidate", prod: "bestValue * candidate", sumSquare: "bestValue + candidate * candidate", logSumExp: "bestValue + exp(candidate)", l1: "bestValue + abs(candidate)", l2: "bestValue + candidate * candidate", logSum: "bestValue + candidate" }, Qf$1 = { max: "select(bestValue, candidate, candidate > bestValue)", min: "select(bestValue, candidate, candidate < bestValue)", mean: "bestValue + candidate", sum: "bestValue + candidate", prod: "bestValue * candidate", sumSquare: "bestValue + candidate", logSumExp: "bestValue + candidate", l1: "bestValue + candidate", l2: "bestValue + candidate", logSum: "bestValue + candidate" }, Yf = { max: "_A[offset]", min: "_A[offset]", mean: "0", sum: "0", prod: "1", sumSquare: "0", logSumExp: "0", l1: "0", l2: "0", logSum: "0" }, Xf = { max: "bestValue", min: "bestValue", sum: "bestValue", prod: "bestValue", sumSquare: "bestValue", logSumExp: "log(bestValue)", l1: "bestValue", l2: "sqrt(bestValue)", logSum: "log(bestValue)" }, Jf = (t, e) => {
    let r = [];
    for (let n = e - t; n < e; ++n) r.push(n);
    return r;
  }, eh = (t, e) => {
    let r = [], n = t.length;
    for (let i = 0; i < n; i++) e.indexOf(i) === -1 && r.push(t[i]);
    let o = e.map((i) => t[i]);
    return [r, o];
  }, th = (t, e) => {
    let r = t.length + e.length, n = [], o = 0;
    for (let i = 0; i < r; i++) e.indexOf(i) === -1 ? n.push(t[o++]) : n.push(1);
    return n;
  }, rh = (t, e) => {
    for (let r = 0; r < t.length; ++r) if (t[t.length - r - 1] !== e - 1 - r) return false;
    return true;
  }, nh = (t, e) => {
    let r = [];
    if (!rh(t, e)) {
      for (let n = 0; n < e; ++n) t.indexOf(n) === -1 && r.push(n);
      t.forEach((n) => r.push(n));
    }
    return r;
  }, oh = (t, e, r, n, o, i, s) => {
    let u = r[0].dims, d = k.size(i), c = k.size(s), p = O("_A", r[0].dataType, u), m = R("output", o, i), g = 64;
    d === 1 && (g = 256);
    let b = `
          var<workgroup> aBestValues : array<f32, ${g}>;
       `, y = (w) => `
        ${w.registerUniform("reduceSize", "u32").declareVariables(p, m)}
        ${b}
        fn DIV_CEIL(a : u32, b : u32) -> u32 {
          return ((a - 1u) / b + 1u);
         }
         ${w.mainStart(g)}

          let outputIndex = global_idx / ${g};
          let offset = outputIndex * uniforms.reduceSize;

          var bestValue = f32(${Yf[n]});
          let Length = uniforms.reduceSize;
          for (var k = local_idx; k < Length; k = k + ${g}) {
           let candidate = f32(${p.getByOffset("offset + k")});
           bestValue = ${Zf[n]};
          }
          aBestValues[local_idx] = bestValue;
          workgroupBarrier();

         var reduceSize = min(Length, ${g}u);
         for (var currentSize = reduceSize / 2u; reduceSize > 1u;
             currentSize = reduceSize / 2u) {
           let interval = DIV_CEIL(reduceSize, 2u);
           if (local_idx < currentSize) {
            let candidate = aBestValues[local_idx + interval];
            bestValue = ${Qf$1[n]};
            aBestValues[local_idx] = bestValue;
           }
           reduceSize = interval;
           workgroupBarrier();
         }

         if (local_idx == 0u) {
          ${m.setByOffset("outputIndex", `${n === "mean" ? `${m.type.storage}(bestValue / f32(uniforms.reduceSize))` : `${m.type.storage}(${Xf[n]})`}`)};
         }
        }`;
    return { name: t, shaderCache: { hint: `${e};${g}`, inputDependencies: ["type"] }, getShaderSource: y, getRunData: () => ({ outputs: [{ dims: i, dataType: o }], dispatchGroup: { x: d }, programUniforms: [{ type: 12, data: c }] }) };
  }, it$1 = (t, e, r, n) => {
    let o = t.inputs.length === 1 ? r : go(t.inputs, r), i = o.axes;
    i.length === 0 && !o.noopWithEmptyAxes && (i = t.inputs[0].dims.map((b, y) => y));
    let s = k.normalizeAxes(i, t.inputs[0].dims.length), u = s, d = t.inputs[0], c = nh(u, t.inputs[0].dims.length);
    c.length > 0 && (d = t.compute(Oe(t.inputs[0], c), { inputs: [0], outputs: [-1] })[0], u = Jf(u.length, d.dims.length));
    let [p, m] = eh(d.dims, u), g = p;
    o.keepDims && (g = th(p, s)), t.compute(oh(e, o.cacheKey, [d], n, t.inputs[0].dataType, g, m), { inputs: [d] });
  }, js$1 = (t, e) => {
    it$1(t, "ReduceMeanShared", e, "mean");
  }, Zs = (t, e) => {
    it$1(t, "ReduceL1Shared", e, "l1");
  }, Qs = (t, e) => {
    it$1(t, "ReduceL2Shared", e, "l2");
  }, Ys$1 = (t, e) => {
    it$1(t, "ReduceLogSumExpShared", e, "logSumExp");
  }, Xs = (t, e) => {
    it$1(t, "ReduceMaxShared", e, "max");
  }, Js = (t, e) => {
    it$1(t, "ReduceMinShared", e, "min");
  }, eu = (t, e) => {
    it$1(t, "ReduceProdShared", e, "prod");
  }, tu = (t, e) => {
    it$1(t, "ReduceSumShared", e, "sum");
  }, ru = (t, e) => {
    it$1(t, "ReduceSumSquareShared", e, "sumSquare");
  }, nu = (t, e) => {
    it$1(t, "ReduceLogSumShared", e, "logSum");
  };
});
var at$1, ih, Xr$1, go, st$1, ah, sh, uh, dh, lh, ch, ph, mh, fh, hh, ut$1, iu, au, su, uu, du, lu, cu, pu, mu, fu, Yr = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  ou();
  at$1 = (t) => {
    if (!t || t.length === 0 || t.length > 2) throw new Error("Reduce op requires 1 or 2 inputs.");
    if (t.length === 2 && t[1].dims.length !== 1) throw new Error("Invalid axes input dims.");
  }, ih = (t) => ["", "", `var value = ${t.getByIndices("input_indices")};`, ""], Xr$1 = (t, e, r, n, o, i, s = false, u = false) => {
    let d = [], c = r[0].dims, p = c.length, m = k.normalizeAxes(o, p), g = !u && m.length === 0;
    c.forEach((S, x) => {
      g || m.indexOf(x) >= 0 ? s && d.push(1) : d.push(S);
    });
    let b = d.length, y = k.size(d);
    return { name: t, shaderCache: e, getShaderSource: (S) => {
      let x = [], $ = O("_A", r[0].dataType, p), T = R("output", i, b), I = n($, T, m), E = I[2];
      for (let A = 0, z2 = 0; A < p; A++) g || m.indexOf(A) >= 0 ? (s && z2++, E = `for(var j${A}: u32 = 0; j${A} < ${c[A]}; j${A}++) {
                  ${I[2].includes("last_index") ? `let last_index = j${A};` : ""}
                  ${$.indicesSet("input_indices", A, `j${A}`)}
                  ${E}
                }`) : (x.push(`${$.indicesSet("input_indices", A, T.indicesGet("output_indices", z2))};`), z2++);
      return `

        ${S.registerUniform("output_size", "u32").declareVariables($, T)}

        ${S.mainStart()}
          ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          var input_indices: ${$.type.indices};
          let output_indices = ${T.offsetToIndices("global_idx")};

          ${x.join(`
`)}
          ${I[0]}       // init ops for reduce max/min
          ${I[1]}
          ${E}
          ${I[3]}
          ${I.length === 4 ? T.setByOffset("global_idx", "value") : I.slice(4).join(`
`)}
        }`;
    }, getRunData: () => ({ outputs: [{ dims: d, dataType: i }], dispatchGroup: { x: Math.ceil(y / 64) }, programUniforms: [{ type: 12, data: y }, ...L(c, d)] }) };
  }, go = (t, e) => {
    let r = [];
    return t[1].dims[0] > 0 && t[1].getBigInt64Array().forEach((n) => r.push(Number(n))), ee$1({ axes: r, keepDims: e.keepDims, noopWithEmptyAxes: e.noopWithEmptyAxes });
  }, st$1 = (t, e, r, n) => {
    let o = t.inputs, i = o.length === 1 ? r : go(o, r);
    t.compute(Xr$1(e, { hint: i.cacheKey, inputDependencies: ["rank"] }, [o[0]], i.noopWithEmptyAxes && i.axes.length === 0 ? ih : n, i.axes, o[0].dataType, i.keepDims, i.noopWithEmptyAxes), { inputs: [0] });
  }, ah = (t, e) => {
    at$1(t.inputs), st$1(t, "ReduceLogSum", e, (n, o) => [`var value = ${o.type.storage}(0);`, "", `value += ${n.getByIndices("input_indices")};`, "value = log(value);"]);
  }, sh = (t, e) => {
    at$1(t.inputs), st$1(t, "ReduceL1", e, (n, o) => [`var value = ${o.type.storage}(0);`, "", `value += abs(${n.getByIndices("input_indices")});`, ""]);
  }, uh = (t, e) => {
    at$1(t.inputs), st$1(t, "ReduceL2", e, (n, o) => [`var t = ${o.type.value}(0); var value = ${o.type.value}(0);`, "", `t = ${n.getByIndices("input_indices")}; value += (t * t);`, "value = sqrt(value);"]);
  }, dh = (t, e) => {
    at$1(t.inputs), st$1(t, "ReduceLogSumExp", e, (n, o) => [`var value = ${o.type.storage}(0);`, "", `value += exp(${n.getByIndices("input_indices")});`, "value = log(value);"]);
  }, lh = (t, e) => {
    at$1(t.inputs), st$1(t, "ReduceMax", e, (n, o, i) => {
      let s = [];
      for (let u = 0; u < n.rank; u++) (i.indexOf(u) >= 0 || i.length === 0) && s.push(n.indicesSet("input_indices", u, 0));
      return [`${s.join(`
`)}`, `var value = ${n.getByIndices("input_indices")};`, `value = max(value, ${n.getByIndices("input_indices")});`, ""];
    });
  }, ch = (t, e) => {
    at$1(t.inputs), st$1(t, "ReduceMean", e, (n, o, i) => {
      let s = 1;
      for (let u = 0; u < n.rank; u++) (i.indexOf(u) >= 0 || i.length === 0) && (s *= t.inputs[0].dims[u]);
      return ["var sum = f32(0);", "", `sum += f32(${n.getByIndices("input_indices")});`, `let value = ${o.type.value}(sum / ${s});`];
    });
  }, ph = (t, e) => {
    at$1(t.inputs), st$1(t, "ReduceMin", e, (n, o, i) => {
      let s = [];
      for (let u = 0; u < n.rank; u++) (i.indexOf(u) >= 0 || i.length === 0) && s.push(`input_indices[${u}] = 0;`);
      return [`${s.join(`
`)}`, `var value = ${n.getByIndices("input_indices")};`, `value = min(value, ${n.getByIndices("input_indices")});`, ""];
    });
  }, mh = (t, e) => {
    at$1(t.inputs), st$1(t, "ReduceProd", e, (n, o) => [`var value = ${o.type.storage}(1);`, "", `value *= ${n.getByIndices("input_indices")};`, ""]);
  }, fh = (t, e) => {
    at$1(t.inputs), st$1(t, "ReduceSum", e, (n, o) => [`var value = ${o.type.storage}(0);`, "", `value += ${n.getByIndices("input_indices")};`, ""]);
  }, hh = (t, e) => {
    at$1(t.inputs), st$1(t, "ReduceSumSquare", e, (n, o) => [`var t = ${o.type.value}(0); var value = ${o.type.value}(0);`, "", `t = ${n.getByIndices("input_indices")}; value += t * t;`, ""]);
  }, ut$1 = (t, e, r) => {
    if (e.length === 0) return r;
    let n = 1, o = 1;
    for (let i = 0; i < e.length; i++) e.indexOf(i) === -1 ? n *= t[i] : o *= t[i];
    return o < 32 && n > 1024;
  }, iu = (t, e) => {
    ut$1(t.inputs[0].dims, e.axes, e.noopWithEmptyAxes) ? ch(t, e) : js$1(t, e);
  }, au = (t, e) => {
    ut$1(t.inputs[0].dims, e.axes, e.noopWithEmptyAxes) ? sh(t, e) : Zs(t, e);
  }, su = (t, e) => {
    ut$1(t.inputs[0].dims, e.axes, e.noopWithEmptyAxes) ? uh(t, e) : Qs(t, e);
  }, uu = (t, e) => {
    ut$1(t.inputs[0].dims, e.axes, e.noopWithEmptyAxes) ? dh(t, e) : Ys$1(t, e);
  }, du = (t, e) => {
    ut$1(t.inputs[0].dims, e.axes, e.noopWithEmptyAxes) ? lh(t, e) : Xs(t, e);
  }, lu = (t, e) => {
    ut$1(t.inputs[0].dims, e.axes, e.noopWithEmptyAxes) ? ph(t, e) : Js(t, e);
  }, cu = (t, e) => {
    ut$1(t.inputs[0].dims, e.axes, e.noopWithEmptyAxes) ? mh(t, e) : eu(t, e);
  }, pu = (t, e) => {
    ut$1(t.inputs[0].dims, e.axes, e.noopWithEmptyAxes) ? fh(t, e) : tu(t, e);
  }, mu = (t, e) => {
    ut$1(t.inputs[0].dims, e.axes, e.noopWithEmptyAxes) ? hh(t, e) : ru(t, e);
  }, fu = (t, e) => {
    ut$1(t.inputs[0].dims, e.axes, e.noopWithEmptyAxes) ? ah(t, e) : nu(t, e);
  };
});
var hu, gu, yu, yo, bu = V$1(() => {
  J();
  Ie();
  Yr();
  hu = (t) => {
    if (!t || t.length === 0 || t.length > 2) throw new Error("ArgMinMaxOp op requires 1 or 2 inputs.");
    if (t[0].dataType !== 1) throw new Error("Invalid input type.");
  }, gu = (t, e) => {
    hu(t.inputs);
    let r = (n, o, i) => {
      let s = [];
      for (let u = 0; u < n.rank; u++) (i.indexOf(u) >= 0 || i.length === 0) && s.push(`input_indices[${u}] = 0;`);
      return [`${s.join(`
`)}`, `var value = ${n.getByIndices("input_indices")};
var best_index : i32 = 0;`, `if (${n.getByIndices("input_indices")} ${e.selectLastIndex > 0 ? "<=" : "<"} value) {
         value = ${n.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`, "", o.setByOffset("global_idx", "best_index")];
    };
    t.compute(Xr$1("ArgMin", { hint: e.cacheKey, inputDependencies: ["rank"] }, [t.inputs[0]], r, [e.axis], 7, e.keepDims), { inputs: [0] });
  }, yu = (t, e) => {
    hu(t.inputs);
    let r = (n, o, i) => {
      let s = [];
      for (let u = 0; u < n.rank; u++) (i.indexOf(u) >= 0 || i.length === 0) && s.push(`input_indices[${u}] = 0;`);
      return [`${s.join(`
`)}`, `var value = ${n.getByIndices("input_indices")};
var best_index : i32 = 0;`, `if (${n.getByIndices("input_indices")} ${e.selectLastIndex > 0 ? ">=" : ">"} value) {
         value = ${n.getByIndices("input_indices")};
         best_index = i32(last_index);
       }`, "", o.setByOffset("global_idx", "best_index")];
    };
    t.compute(Xr$1("argMax", { hint: e.cacheKey, inputDependencies: ["rank"] }, [t.inputs[0]], r, [e.axis], 7, e.keepDims), { inputs: [0] });
  }, yo = (t) => ee$1(t);
});
var gh, bo, yh, bh, wh, Wt, _h, wu, Jr$1 = V$1(() => {
  J();
  ne();
  jr();
  ae();
  gh = (t, e) => {
    let r = t[0], n = t[1], o = t[2], i = t[3], s = t[4], u = t[5];
    if (s && u) throw new Error("Attention cannot have both past and attention_bias");
    if (r.dims.length !== 3) throw new Error('Input "input" must have 3 dimensions');
    let d = r.dims[0], c = r.dims[1], p = r.dims[2];
    if (o.dims.length !== 1) throw new Error('Input "bias" is expected to have 1 dimensions');
    if (n.dims.length !== 2) throw new Error('Input "weights" is expected to have 2 dimensions');
    if (n.dims[0] !== p) throw new Error("Input 1 dimension 0 should have same length as dimension 2 of input 0");
    if (o.dims[0] !== n.dims[1]) throw new Error('Input "bias" dimension 0 should have same length as dimension 1 of input "weights"');
    let m = o.dims[0] / 3, g = m, b = g;
    if (e.qkvHiddenSizes.length > 0) {
      if (e.qkvHiddenSizes.length !== 3) throw new Error("qkv_hidden_sizes attribute should have 3 elements");
      for (let T of e.qkvHiddenSizes) if (T % e.numHeads !== 0) throw new Error("qkv_hidden_sizes should be divisible by num_heads");
      m = e.qkvHiddenSizes[0], g = e.qkvHiddenSizes[1], b = e.qkvHiddenSizes[2];
    }
    let y = c;
    if (m !== g) throw new Error("qkv_hidden_sizes first element should be same as the second");
    if (o.dims[0] !== m + g + b) throw new Error('Input "bias" dimension 0 should have same length as sum of Q/K/V hidden sizes');
    let w = 0;
    if (s) {
      if (g !== b) throw new Error('Input "past" expect k_hidden_size == v_hidden_size');
      if (s.dims.length !== 5) throw new Error('Input "past" must have 5 dimensions');
      if (s.dims[0] !== 2) throw new Error('Input "past" first dimension must be 2');
      if (s.dims[1] !== d) throw new Error('Input "past" second dimension must be batch_size');
      if (s.dims[2] !== e.numHeads) throw new Error('Input "past" third dimension must be num_heads');
      if (s.dims[4] !== g / e.numHeads) throw new Error('Input "past" fifth dimension must be k_hidden_size / num_heads');
      e.pastPresentShareBuffer || (w = s.dims[3]);
    }
    let S = y + w, x = -1, $ = 0;
    if (i) throw new Error("Mask not supported");
    if (s) throw new Error("past is not supported");
    if (u) {
      if (u.dims.length !== 4) throw new Error('Input "attention_bias" must have 4 dimensions');
      if (u.dims[0] !== d || u.dims[1] !== e.numHeads || u.dims[2] !== c || u.dims[3] !== S) throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)');
    }
    return { batchSize: d, sequenceLength: c, pastSequenceLength: w, kvSequenceLength: y, totalSequenceLength: S, maxSequenceLength: x, inputHiddenSize: p, hiddenSize: m, vHiddenSize: b, headSize: Math.floor(m / e.numHeads), vHeadSize: Math.floor(b / e.numHeads), numHeads: e.numHeads, isUnidirectional: false, pastPresentShareBuffer: false, maskFilterValue: e.maskFilterValue, maskType: $, scale: e.scale, broadcastResPosBias: false, passPastInKv: false, qkvFormat: 1 };
  }, bo = (t, e, r) => e && t ? `
      let total_sequence_length_input = u32(${e.getByOffset("0")});
      let present_sequence_length = max(total_sequence_length_input, uniforms.past_sequence_length);
      let is_subsequent_prompt: bool = sequence_length > 1 && sequence_length != total_sequence_length_input;
      let is_first_prompt: bool = is_subsequent_prompt == false && sequence_length == total_sequence_length_input;
      total_sequence_length = u32(${t == null ? void 0 : t.getByOffset("batchIdx")}) + 1;
      var past_sequence_length: u32 = 0;
      if (is_first_prompt == false) {
        past_sequence_length = total_sequence_length - sequence_length;
      }
       ` : `
    ${r ? "let past_sequence_length = uniforms.past_sequence_length" : ""};
    let present_sequence_length = total_sequence_length;
    `, yh = (t, e, r, n, o, i, s, u) => {
    let d = fe(s ? 1 : i), c = 64, p = i / d;
    p < c && (c = 32);
    let m = Math.ceil(i / d / c), g = [{ type: 12, data: e }, { type: 12, data: r }, { type: 12, data: n }, { type: 12, data: o }, { type: 12, data: p }, { type: 12, data: m }], b = be$1(t.dataType, d), y = Pe(1, d), w = ["type"];
    s && w.push("type"), u && w.push("type");
    let S = (x) => {
      let $ = R("x", t.dataType, t.dims, d), T = [$], I = s ? O("seq_lens", s.dataType, s.dims) : void 0;
      I && T.push(I);
      let E = u ? O("total_sequence_length_input", u.dataType, u.dims) : void 0;
      E && T.push(E);
      let A = Pe(t.dataType), z2 = [{ name: "batch_size", type: "u32" }, { name: "num_heads", type: "u32" }, { name: "past_sequence_length", type: "u32" }, { name: "sequence_length", type: "u32" }, { name: "total_sequence_length", type: "u32" }, { name: "elements_per_thread", type: "u32" }];
      return `
  var<workgroup> thread_max: array<f32, ${c}>;
  var<workgroup> thread_sum: array<f32, ${c}>;
  ${x.registerUniforms(z2).declareVariables(...T)}
  ${x.mainStart([c, 1, 1])}
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let sequence_length = uniforms.sequence_length;
    var total_sequence_length = uniforms.total_sequence_length;
    ${bo(I, E, false)}
    let local_offset = local_idx * uniforms.elements_per_thread;
    let offset = (global_idx / ${c}) * uniforms.total_sequence_length + local_offset;
    let seq_causal_length = ${s ? "u32(past_sequence_length + workgroup_id.y + 1)" : "total_sequence_length"};
    var thread_max_vector = ${y}(-3.4028234663852886e+38f);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      thread_max_vector = max(${y}(x[offset + i]), thread_max_vector);
    }
    thread_max[local_idx] = ${(() => {
        switch (d) {
          case 1:
            return "thread_max_vector";
          case 2:
            return "max(thread_max_vector.x, thread_max_vector.y)";
          case 4:
            return "max(max(thread_max_vector.x, thread_max_vector.y), max(thread_max_vector.z, thread_max_vector.w))";
          default:
            throw new Error(`Unsupported components: ${d}`);
        }
      })()};
    workgroupBarrier();

    var max_value =  f32(-3.4028234663852886e+38f);
    for (var i = 0u; i < ${c}; i++) {
      max_value = max(thread_max[i], max_value);
    }

    var sum_vector = ${y}(0);
    for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
      sum_vector += exp(${y}(x[offset + i]) - max_value);
    }
    thread_sum[local_idx] = ${(() => {
        switch (d) {
          case 1:
            return "sum_vector";
          case 2:
            return "sum_vector.x + sum_vector.y";
          case 4:
            return "sum_vector.x + sum_vector.y + sum_vector.z + sum_vector.w";
          default:
            throw new Error(`Unsupported components: ${d}`);
        }
      })()};
    workgroupBarrier();

    var sum: f32 = 0;
    for (var i = 0u; i < ${c}; i++) {
      sum += thread_sum[i];
    }

    if (sum == 0) {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        x[offset + i] = ${$.type.value}(${A}(1.0) / ${A}(seq_causal_length));
      }
    } else {
      for (var i: u32 = 0; i < uniforms.elements_per_thread && i + local_offset < seq_causal_length; i++) {
        var f32input = ${y}(x[offset + i]);
        x[offset + i] = ${$.type.value}(exp(f32input - max_value) / sum);
      }
    }
      ${s ? `
        for (var total_seq_id: u32 = seq_causal_length; total_seq_id + local_offset < uniforms.total_sequence_length; total_seq_id++) {
          x[offset + total_seq_id] = ${$.type.value}(${A}(0));
        }` : ""};
  }`;
    };
    return { name: "AttentionProbsSoftmax", shaderCache: { hint: `${c};${b};${d}`, inputDependencies: w }, getShaderSource: S, getRunData: () => ({ outputs: [], dispatchGroup: { x: 1, y: o, z: e * r }, programUniforms: g }) };
  }, bh = (t, e, r, n, o, i, s, u, d) => {
    let c = s + i.kvSequenceLength, p = [i.batchSize, i.numHeads, i.sequenceLength, c], m = t > 1 && n, g = i.kvNumHeads ? i.kvNumHeads : i.numHeads, b = m ? [i.batchSize, g, c, i.headSize] : void 0, y = i.nReps ? i.nReps : 1, w = i.scale === 0 ? 1 / Math.sqrt(i.headSize) : i.scale, S = fe(i.headSize), x = i.headSize / S, $ = 12, T = { x: Math.ceil(c / $), y: Math.ceil(i.sequenceLength / $), z: i.batchSize * i.numHeads }, I = [{ type: 12, data: i.sequenceLength }, { type: 12, data: x }, { type: 12, data: c }, { type: 12, data: i.numHeads }, { type: 12, data: i.headSize }, { type: 1, data: w }, { type: 12, data: s }, { type: 12, data: i.kvSequenceLength }, { type: 12, data: y }], E = m && n && k.size(n.dims) > 0, A = ["type", "type"];
    E && A.push("type"), o && A.push("type"), u && A.push("type"), d && A.push("type");
    let z2 = [{ dims: p, dataType: e.dataType, gpuDataType: 0 }];
    m && z2.push({ dims: b, dataType: e.dataType, gpuDataType: 0 });
    let v = (M) => {
      let N = O("q", e.dataType, e.dims, S), K = O("key", r.dataType, r.dims, S), q = [N, K];
      if (E) {
        let te = O("past_key", n.dataType, n.dims, S);
        q.push(te);
      }
      o && q.push(O("attention_bias", o.dataType, o.dims));
      let Q = u ? O("seq_lens", u.dataType, u.dims) : void 0;
      Q && q.push(Q);
      let D = d ? O("total_sequence_length_input", d.dataType, d.dims) : void 0;
      D && q.push(D);
      let W = R("output", e.dataType, p), j = [W];
      m && j.push(R("present_key", e.dataType, b, S));
      let Y = Pe(1, S), Z = [{ name: "M", type: "u32" }, { name: "K", type: "u32" }, { name: "N", type: "u32" }, { name: "num_heads", type: "u32" }, { name: "head_size", type: "u32" }, { name: "alpha", type: "f32" }, { name: "past_sequence_length", type: "u32" }, { name: "kv_sequence_length", type: "u32" }, { name: "n_reps", type: "u32" }];
      return `
  const TILE_SIZE = ${$}u;

  var<workgroup> tileQ: array<${N.type.storage}, ${$ * $}>;
  var<workgroup> tileK: array<${N.type.storage}, ${$ * $}>;
  ${M.registerUniforms(Z).declareVariables(...q, ...j)}
  ${M.mainStart([$, $, 1])}
    // x holds the N and y holds the M
    let headIdx = workgroup_id.z % uniforms.num_heads;
    let kvHeadIdx = ${y === 1 ? "headIdx" : "headIdx / uniforms.n_reps"};
    let kv_num_heads = ${y === 1 ? "uniforms.num_heads" : "uniforms.num_heads / uniforms.n_reps"};
    let batchIdx = workgroup_id.z / uniforms.num_heads;
    let m = workgroup_id.y * TILE_SIZE;
    let n = workgroup_id.x * TILE_SIZE;
    let sequence_length = uniforms.M;
    var total_sequence_length = uniforms.N;
    ${bo(Q, D, true)}
    let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx;
    let qOffset = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
    ${E && m ? "let pastKeyOffset = absKvHeadIdx * uniforms.past_sequence_length * uniforms.K;" : ""};
    let kOffset = absKvHeadIdx * uniforms.kv_sequence_length * uniforms.K;
    ${m ? "let presentKeyOffset = absKvHeadIdx * uniforms.N * uniforms.K;" : ""}
    var value = ${Y}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (global_id.y < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = q[qOffset + local_id.y * uniforms.K + w + local_id.x];
      }
      if (n + local_id.y < uniforms.N && w + local_id.x < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
      ${E && m ? `
              if (n + local_id.y < past_sequence_length) {
                tileK[idx] = past_key[pastKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
              } else if (n + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
                tileK[idx] = key[kOffset + (n + local_id.y - past_sequence_length) * uniforms.K + w + local_id.x];
              }` : `
          if (n + local_id.y < uniforms.kv_sequence_length) {
            tileK[idx] = key[kOffset + (n + local_id.y) * uniforms.K + w + local_id.x];
          }`}
      ${m ? `if (n + local_id.y < present_sequence_length) {
        present_key[presentKeyOffset + (n + local_id.y) * uniforms.K + w + local_id.x] = tileK[idx];
      }` : ""}
      }
      workgroupBarrier();

      for (var k: u32 = 0u; k < TILE_SIZE && w+k < uniforms.K; k++) {
          value += ${Y}(tileQ[TILE_SIZE * local_id.y + k] * tileK[TILE_SIZE * local_id.x + k]);
      }

      workgroupBarrier();
    }

    if (global_id.y < uniforms.M && global_id.x < total_sequence_length) {
      let headOffset = workgroup_id.z * uniforms.M * uniforms.N;
      let outputIdx = headOffset + global_id.y * uniforms.N + global_id.x;
      var sum: f32 = ${(() => {
        switch (S) {
          case 1:
            return "value";
          case 2:
            return "value.x + value.y";
          case 4:
            return "value.x + value.y + value.z + value.w";
          default:
            throw new Error(`Unsupported components: ${S}`);
        }
      })()};
        output[outputIdx] = ${W.type.value} (sum * uniforms.alpha) + ${o ? "attention_bias[outputIdx]" : "0.0"};
    }
  }`;
    };
    return { name: "AttentionProbs", shaderCache: { hint: `${S};${o !== void 0};${n !== void 0};${t}`, inputDependencies: A }, getRunData: () => ({ outputs: z2, dispatchGroup: T, programUniforms: I }), getShaderSource: v };
  }, wh = (t, e, r, n, o, i, s = void 0, u = void 0) => {
    let d = i + o.kvSequenceLength, c = o.nReps ? o.nReps : 1, p = o.vHiddenSize * c, m = t > 1 && n, g = o.kvNumHeads ? o.kvNumHeads : o.numHeads, b = m ? [o.batchSize, g, d, o.headSize] : void 0, y = [o.batchSize, o.sequenceLength, p], w = 12, S = { x: Math.ceil(o.vHeadSize / w), y: Math.ceil(o.sequenceLength / w), z: o.batchSize * o.numHeads }, x = [{ type: 12, data: o.sequenceLength }, { type: 12, data: d }, { type: 12, data: o.vHeadSize }, { type: 12, data: o.numHeads }, { type: 12, data: o.headSize }, { type: 12, data: p }, { type: 12, data: i }, { type: 12, data: o.kvSequenceLength }, { type: 12, data: c }], $ = m && n && k.size(n.dims) > 0, T = ["type", "type"];
    $ && T.push("type"), s && T.push("type"), u && T.push("type");
    let I = [{ dims: y, dataType: e.dataType, gpuDataType: 0 }];
    m && I.push({ dims: b, dataType: e.dataType, gpuDataType: 0 });
    let E = (A) => {
      let z2 = O("probs", e.dataType, e.dims), v = O("v", r.dataType, r.dims), M = [z2, v];
      $ && M.push(O("past_value", n.dataType, n.dims));
      let N = s ? O("seq_lens", s.dataType, s.dims) : void 0;
      s && M.push(N);
      let K = u ? O("total_sequence_length_input", u.dataType, u.dims) : void 0;
      u && M.push(K);
      let Q = [R("output", e.dataType, y)];
      m && Q.push(R("present_value", e.dataType, b));
      let D = [{ name: "M", type: "u32" }, { name: "K", type: "u32" }, { name: "N", type: "u32" }, { name: "num_heads", type: "u32" }, { name: "head_size", type: "u32" }, { name: "v_hidden_size", type: "u32" }, { name: "past_sequence_length", type: "u32" }, { name: "kv_sequence_length", type: "u32" }, { name: "n_reps", type: "u32" }];
      return `
  const TILE_SIZE = ${w}u;
  var<workgroup> tileQ: array<${z2.type.value}, ${w * w}>;
  var<workgroup> tileV: array<${z2.type.value}, ${w * w}>;
  ${A.registerUniforms(D).declareVariables(...M, ...Q)}
  ${A.mainStart([w, w, 1])}
   let headIdx = workgroup_id.z % uniforms.num_heads;
   let batchIdx = workgroup_id.z / uniforms.num_heads;
   let kvHeadIdx = ${c === 1 ? "headIdx" : "headIdx / uniforms.n_reps"};
   let kv_num_heads = ${c === 1 ? "uniforms.num_heads" : "uniforms.num_heads / uniforms.n_reps"};
   let m = global_id.y;
   let n = global_id.x;
   let sequence_length = uniforms.M;
   var total_sequence_length = uniforms.K;
   ${bo(N, K, true)}
   let offsetA = workgroup_id.z * uniforms.M * uniforms.K + m * uniforms.K;
   let absKvHeadIdx = batchIdx * kv_num_heads + kvHeadIdx; // kvHeadIdx is relative to the batch
   ${$ && m ? "let pastValueOffset = absKvHeadIdx * uniforms.N * uniforms.past_sequence_length + n;" : ""};
   let vOffset = absKvHeadIdx * uniforms.N * uniforms.kv_sequence_length + n;
   ${m ? "let presentValueOffset = absKvHeadIdx * uniforms.N * uniforms.K + n;" : ""}
   var value = ${z2.type.storage}(0);
   for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileQ[TILE_SIZE * local_id.y + local_id.x] = probs[offsetA + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        var idx = TILE_SIZE * local_id.y + local_id.x;
        ${$ && m ? `
        if (w + local_id.y < past_sequence_length) {
          tileV[idx] = past_value[pastValueOffset + (w + local_id.y) * uniforms.N];
        } else if (w + local_id.y - past_sequence_length < uniforms.kv_sequence_length) {
          tileV[idx] = v[vOffset + (w + local_id.y - past_sequence_length) * uniforms.N];
        }
      ` : `
            if (w + local_id.y < uniforms.kv_sequence_length) {
              tileV[idx] = v[vOffset + (w + local_id.y) * uniforms.N];
            }`}
        ${m ? `
            if (w + local_id.y < present_sequence_length) {
          present_value[presentValueOffset + (w + local_id.y) * uniforms.N] = tileV[idx];
        }` : ""}
      }
     workgroupBarrier();
     for (var k: u32 = 0u; k < TILE_SIZE && w+k < total_sequence_length; k++) {
       value += tileQ[TILE_SIZE * local_id.y + k] * tileV[TILE_SIZE * k + local_id.x];
     }
     workgroupBarrier();
   }

   // we need to transpose output from BNSH_v to BSND_v
   if (m < uniforms.M && n < uniforms.N) {
     let outputIdx = batchIdx * uniforms.M * uniforms.v_hidden_size + m * uniforms.v_hidden_size
       + headIdx * uniforms.N + n;
     output[outputIdx] = value;
   }
  }`;
    };
    return { name: "AttentionScore", shaderCache: { hint: `${n !== void 0};${t}`, inputDependencies: T }, getRunData: () => ({ outputs: I, dispatchGroup: S, programUniforms: x }), getShaderSource: E };
  }, Wt = (t, e, r, n, o, i, s, u, d, c, p = void 0, m = void 0) => {
    let g = Math.min(t.outputCount, 1 + (s ? 1 : 0) + (u ? 1 : 0)), b = g > 1 ? c.pastSequenceLength : 0, y = b + c.kvSequenceLength, w = d && k.size(d.dims) > 0 ? d : void 0, S = [e, r];
    g > 1 && s && k.size(s.dims) > 0 && S.push(s), w && S.push(w), p && S.push(p), m && S.push(m);
    let x = t.compute(bh(g, e, r, s, w, c, b, p, m), { inputs: S, outputs: g > 1 ? [-1, 1] : [-1] })[0];
    t.compute(yh(x, c.batchSize, c.numHeads, b, c.sequenceLength, y, p, m), { inputs: p && m ? [x, p, m] : [x], outputs: [] });
    let $ = [x, n];
    g > 1 && u && k.size(u.dims) > 0 && $.push(u), p && $.push(p), m && $.push(m), t.compute(wh(g, x, n, u, c, b, p, m), { inputs: $, outputs: g > 1 ? [0, 2] : [0] });
  }, _h = (t, e) => {
    let r = [e.batchSize, e.numHeads, e.sequenceLength, e.headSize], n = e.sequenceLength, o = e.inputHiddenSize, i = e.headSize, s = 12, u = { x: Math.ceil(e.headSize / s), y: Math.ceil(e.sequenceLength / s), z: e.batchSize * e.numHeads }, d = [t.inputs[0], t.inputs[1], t.inputs[2]], c = [{ type: 12, data: n }, { type: 12, data: o }, { type: 12, data: i }, { type: 12, data: e.numHeads }, { type: 12, data: e.headSize }, { type: 12, data: e.hiddenSize }, { type: 12, data: e.hiddenSize + e.hiddenSize + e.vHiddenSize }], p = (m) => {
      let g = R("output_q", d[0].dataType, r), b = R("output_k", d[0].dataType, r), y = R("output_v", d[0].dataType, r), w = O("input", d[0].dataType, d[0].dims), S = O("weight", d[1].dataType, d[1].dims), x = O("bias", d[2].dataType, d[2].dims), $ = w.type.storage, T = [{ name: "M", type: "u32" }, { name: "K", type: "u32" }, { name: "N", type: "u32" }, { name: "num_heads", type: "u32" }, { name: "head_size", type: "u32" }, { name: "hidden_size", type: "u32" }, { name: "ldb", type: "u32" }];
      return `
  const TILE_SIZE = ${s}u;
  var<workgroup> tileInput: array<${$}, ${s * s}>;
  var<workgroup> tileWeightQ: array<${$}, ${s * s}>;
  var<workgroup> tileWeightK: array<${$}, ${s * s}>;
  var<workgroup> tileWeightV: array<${$}, ${s * s}>;
  ${m.registerUniforms(T).declareVariables(w, S, x, g, b, y)}
  ${m.mainStart([s, s, 1])}
    let batchIndex = workgroup_id.z / uniforms.num_heads;
    let headNumber = workgroup_id.z % uniforms.num_heads;
    let m = global_id.y;
    let n = global_id.x;

    let inputOffset = batchIndex * (uniforms.M * uniforms.K) + m * uniforms.K;
    let biasOffsetQ = headNumber * uniforms.head_size;
    let biasOffsetK = uniforms.hidden_size + biasOffsetQ;
    let biasOffsetV = uniforms.hidden_size + biasOffsetK;

    var valueQ = ${$}(0);
    var valueK = ${$}(0);
    var valueV = ${$}(0);
    for (var w: u32 = 0u; w < uniforms.K; w += TILE_SIZE) {
      if (m < uniforms.M && w + local_id.x < uniforms.K) {
        tileInput[TILE_SIZE * local_id.y + local_id.x] = input[inputOffset + w + local_id.x];
      }
      if (n < uniforms.N && w + local_id.y < uniforms.K) {
        let offset = n + (w + local_id.y) * uniforms.ldb;
        tileWeightQ[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetQ + offset];
        tileWeightK[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetK + offset];
        tileWeightV[TILE_SIZE * local_id.y + local_id.x] = weight[biasOffsetV + offset];
      }
      workgroupBarrier();
      for (var k: u32 = 0u; k<TILE_SIZE && w+k < uniforms.K; k++) {
        let inputTileOffset = TILE_SIZE * local_id.y + k;
        let weightTileOffset = TILE_SIZE * k + local_id.x;
        valueQ += tileInput[inputTileOffset] * tileWeightQ[weightTileOffset];
        valueK += tileInput[inputTileOffset] * tileWeightK[weightTileOffset];
        valueV += tileInput[inputTileOffset] * tileWeightV[weightTileOffset];
      }

      workgroupBarrier();
    }

    let headOffset = (m * uniforms.N + n) % uniforms.head_size;
    valueQ += bias[headOffset + biasOffsetQ];
    valueK += bias[headOffset + biasOffsetK];
    valueV += bias[headOffset + biasOffsetV];

    let offset = workgroup_id.z * uniforms.M * uniforms.N;
    if (m < uniforms.M && n < uniforms.N) {
      let outputIdx = offset + m * uniforms.N + n;
      output_q[outputIdx] = valueQ;
      output_k[outputIdx] = valueK;
      output_v[outputIdx] = valueV;
    }
  }`;
    };
    return t.compute({ name: "AttentionPrepare", shaderCache: { inputDependencies: ["type", "type", "type"] }, getRunData: () => ({ outputs: [{ dims: r, dataType: t.inputs[0].dataType, gpuDataType: 0 }, { dims: r, dataType: t.inputs[0].dataType, gpuDataType: 0 }, { dims: r, dataType: t.inputs[0].dataType, gpuDataType: 0 }], dispatchGroup: u, programUniforms: c }), getShaderSource: p }, { inputs: d, outputs: [-1, -1, -1] });
  }, wu = (t, e) => {
    let r = gh(t.inputs, e), [n, o, i] = _h(t, r);
    return Wt(t, n, o, i, t.inputs[4], void 0, void 0, void 0, t.inputs[5], r);
  };
});
var vh, $h, xh, _u, vu = V$1(() => {
  Ve$1();
  J();
  ne();
  Ie();
  ae();
  vh = (t, e) => {
    if (!t || t.length !== 5) throw new Error("BatchNormalization requires 5 inputs");
    let r = (n, o, i) => {
      let s = o.length;
      if (s !== n.length) throw new Error(`${i}: num dimensions != ${s}`);
      o.forEach((u, d) => {
        if (u !== n[d]) throw new Error(`${i}: dim[${d}] do not match`);
      });
    };
    if (t[0].dims.length > 1) {
      let n = e.format === "NHWC" ? e.spatial ? t[0].dims.slice(-1) : t[0].dims.slice(-1).concat(t[0].dims.slice(1, t[0].dims.length - 1)) : t[0].dims.slice(1, e.spatial ? 2 : void 0);
      r(t[1].dims, n, "Invalid input scale"), r(t[2].dims, n, "Invalid input B"), r(t[3].dims, n, "Invalid input mean"), r(t[4].dims, n, "Invalid input var");
    } else r(t[1].dims, [1], "Invalid input scale"), r(t[2].dims, [1], "Invalid input B"), r(t[3].dims, [1], "Invalid input mean"), r(t[4].dims, [1], "Invalid input var");
  }, $h = (t, e) => {
    let { epsilon: r, spatial: n, format: o } = e, i = t[0].dims, s = n ? fe(i[i.length - 1]) : 1, u = o === "NHWC" && i.length > 1 ? s : 1, d = k.size(i) / s, c = n, p = c ? i.length : i, m = O("x", t[0].dataType, t[0].dims, s), g = O("scale", t[1].dataType, t[1].dims, u), b = O("bias", t[2].dataType, t[2].dims, u), y = O("inputMean", t[3].dataType, t[3].dims, u), w = O("inputVar", t[4].dataType, t[4].dims, u), S = R("y", t[0].dataType, p, s), x = () => {
      let T = "";
      if (n) T = `let cOffset = ${i.length === 1 ? "0u" : o === "NHWC" ? `outputIndices[${i.length - 1}] / ${s}` : "outputIndices[1]"};`;
      else if (o === "NCHW") T = `
            ${S.indicesSet("outputIndices", "0", "0")}
            let cOffset = ${S.indicesToOffset("outputIndices")};`;
      else {
        T = `var cIndices = ${g.type.indices}(0);
                       cIndices[0] = outputIndices[${i.length - 1}];`;
        for (let I = 1; I < g.rank; I++) T += `cIndices[${I}] = outputIndices[${I}];`;
        T += `let cOffset = ${g.indicesToOffset("cIndices")};`;
      }
      return T;
    }, $ = (T) => `
  const epsilon = ${r};
  ${T.registerUniform("outputSize", "u32").declareVariables(m, g, b, y, w, S)}
  ${T.mainStart()}
  ${T.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
    var outputIndices = ${S.offsetToIndices(`global_idx * ${s}`)};
    ${x()}
    let scale = ${g.getByOffset("cOffset")};
    let bias = ${b.getByOffset("cOffset")};
    let inputMean = ${y.getByOffset("cOffset")};
    let inputVar = ${w.getByOffset("cOffset")};
    let x = ${m.getByOffset("global_idx")};
    let value = (x - inputMean) * inverseSqrt(inputVar + epsilon) * scale + bias;
    ${S.setByOffset("global_idx", "value")}
  }`;
    return { name: "BatchNormalization", shaderCache: { hint: `${e.epsilon}_${e.format}_${n}_${s}`, inputDependencies: c ? ["rank", "type", "type", "type", "type"] : void 0 }, getShaderSource: $, getRunData: () => ({ outputs: [{ dims: t[0].dims, dataType: t[0].dataType }], dispatchGroup: { x: Math.ceil(d / 64) }, programUniforms: c ? [{ type: 12, data: d }, ...L(i)] : [{ type: 12, data: d }] }) };
  }, xh = (t) => ee$1(t), _u = (t, e) => {
    let { inputs: r, outputCount: n } = t, o = xh({ ...e, outputCount: n });
    if (ye.webgpu.validateInputContent && vh(r, o), e.trainingMode) throw new Error("BatchNormalization trainingMode is not supported yet.");
    t.compute($h(r, o));
  };
});
var Sh, Th, $u, xu = V$1(() => {
  ne();
  ae();
  Sh = (t) => {
    if (t[0].dims.length !== 3) throw new Error("input should have 3 dimensions");
    if (![320, 640, 1280].includes(t[0].dims[2])) throw new Error("number of channels should be 320, 640 or 1280");
    if (t[1].dims.length !== 1) throw new Error("bias is expected to have 1 dimensions");
    if (t[0].dims[2] !== t[1].dims[0]) throw new Error("last dimension of input and bias are not the same");
  }, Th = (t) => {
    let e = t[0].dims, r = t[0].dims[2], n = k.size(e) / 4, o = t[0].dataType, i = O("input", o, e, 4), s = O("bias", o, [r], 4), u = O("residual", o, e, 4), d = R("output", o, e, 4);
    return { name: "BiasAdd", getRunData: () => ({ outputs: [{ dims: e, dataType: t[0].dataType }], dispatchGroup: { x: Math.ceil(n / 64) } }), getShaderSource: (p) => `
  const channels = ${r}u / 4;
  ${p.declareVariables(i, s, u, d)}

  ${p.mainStart()}
    ${p.guardAgainstOutOfBoundsWorkgroupSizes(n)}
    let value = ${i.getByOffset("global_idx")}
      + ${s.getByOffset("global_idx % channels")} + ${u.getByOffset("global_idx")};
    ${d.setByOffset("global_idx", "value")}
  }` };
  }, $u = (t) => {
    Sh(t.inputs), t.compute(Th(t.inputs));
  };
});
var Ih, he$1, Su, Tu, Iu, Cu, Au, Eu, ku, Pu, Ou, Ch, zu, Du, Bu, Mu, nr$1, Ru, en$1, Uu, Nu, Vu, Lu, Wu, Gu, Hu, Fu, qu, Ku, ju, Zu, Qu, Yu, Xu, Ju, ed, td, wo, _o, rd, nd, od, Ah, Eh, id, tn$1 = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  Ih = (t, e, r, n, o, i, s) => {
    let u = Math.ceil(e / 4), d = "";
    typeof o == "string" ? d = `${o}(a)` : d = o("a");
    let c = O("inputData", r, [u], 4), p = R("outputData", n, [u], 4), m = [{ name: "vec_size", type: "u32" }];
    return s && m.push(...s), `
      ${t.registerUniforms(m).declareVariables(c, p)}

  ${i ?? ""}

  ${t.mainStart()}
    ${t.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}

    let a = ${c.getByOffset("global_idx")};
    ${p.setByOffset("global_idx", d)}
  }`;
  }, he$1 = (t, e, r, n, o, i = t.dataType, s, u) => {
    let d = [{ type: 12, data: Math.ceil(k.size(t.dims) / 4) }];
    return s && d.push(...s), { name: e, shaderCache: { hint: o, inputDependencies: ["type"] }, getShaderSource: (c) => Ih(c, k.size(t.dims), t.dataType, i, r, n, u), getRunData: (c) => ({ outputs: [{ dims: t.dims, dataType: i }], dispatchGroup: { x: Math.ceil(k.size(c[0].dims) / 64 / 4) }, programUniforms: d }) };
  }, Su = (t) => {
    t.compute(he$1(t.inputs[0], "Abs", "abs"));
  }, Tu = (t) => {
    t.compute(he$1(t.inputs[0], "Acos", "acos"));
  }, Iu = (t) => {
    t.compute(he$1(t.inputs[0], "Acosh", "acosh"));
  }, Cu = (t) => {
    t.compute(he$1(t.inputs[0], "Asin", "asin"));
  }, Au = (t) => {
    t.compute(he$1(t.inputs[0], "Asinh", "asinh"));
  }, Eu = (t) => {
    t.compute(he$1(t.inputs[0], "Atan", "atan"));
  }, ku = (t) => {
    t.compute(he$1(t.inputs[0], "Atanh", "atanh"));
  }, Pu = (t) => ee$1(t), Ou = (t, e) => {
    let r;
    switch (e.to) {
      case 10:
        r = "vec4<f16>";
        break;
      case 1:
        r = "vec4<f32>";
        break;
      case 12:
        r = "vec4<u32>";
        break;
      case 6:
        r = "vec4<i32>";
        break;
      case 9:
        r = "vec4<bool>";
        break;
      default:
        throw new RangeError(`not supported type (specified in attribute 'to' from 'Cast' operator): ${e.to}`);
    }
    t.compute(he$1(t.inputs[0], "Cast", r, void 0, e.cacheKey, e.to));
  }, Ch = (t) => {
    let e, r, n = t.length >= 2 && t[1].data !== 0, o = t.length >= 3 && t[2].data !== 0;
    switch (t[0].dataType) {
      case 1:
        e = n ? t[1].getFloat32Array()[0] : -34028234663852886e22, r = o ? t[2].getFloat32Array()[0] : 34028234663852886e22;
        break;
      case 10:
        e = n ? t[1].getUint16Array()[0] : 64511, r = o ? t[2].getUint16Array()[0] : 31743;
        break;
      default:
        throw new Error("Unsupport data type");
    }
    return ee$1({ min: e, max: r });
  }, zu = (t, e) => {
    let r = e || Ch(t.inputs), n = Pe(t.inputs[0].dataType);
    t.compute(he$1(t.inputs[0], "Clip", (o) => `clamp(${o}, vec4<${n}>(uniforms.min), vec4<${n}>(uniforms.max))`, void 0, r.cacheKey, void 0, [{ type: t.inputs[0].dataType, data: r.min }, { type: t.inputs[0].dataType, data: r.max }], [{ name: "min", type: n }, { name: "max", type: n }]), { inputs: [0] });
  }, Du = (t) => {
    t.compute(he$1(t.inputs[0], "Ceil", "ceil"));
  }, Bu = (t) => {
    t.compute(he$1(t.inputs[0], "Cos", "cos"));
  }, Mu = (t) => {
    t.compute(he$1(t.inputs[0], "Cosh", "cosh"));
  }, nr$1 = (t) => ee$1(t), Ru = (t, e) => {
    let r = Pe(t.inputs[0].dataType);
    t.compute(he$1(t.inputs[0], "Elu", (n) => `elu_vf32(${n})`, `
  const elu_alpha_ = ${r}(${e.alpha});

  fn elu_f32(a: ${r}) -> ${r} {
  return select((exp(a) - 1.0) * elu_alpha_, a, a >= 0.0);
  }

  fn elu_vf32(v: vec4<${r}>) -> vec4<${r}> {
  return vec4(elu_f32(v.x), elu_f32(v.y), elu_f32(v.z), elu_f32(v.w));
  }`, e.cacheKey));
  }, en$1 = (t = "f32") => `
const r0: ${t} = 0.3275911;
const r1: ${t} = 0.254829592;
const r2: ${t} = -0.284496736;
const r3: ${t} = 1.421413741;
const r4: ${t} = -1.453152027;
const r5: ${t} = 1.061405429;

fn erf_vf32(v: vec4<${t}>) -> vec4<${t}> {
  let absv = abs(v);
  let x = 1.0 / (1.0 + r0 * absv);
  return sign(v) * (1.0 - ((((r5 * x + r4) * x + r3) * x + r2) * x + r1) * x * exp(-absv * absv));
}`, Uu = (t) => {
    let e = Pe(t.inputs[0].dataType);
    t.compute(he$1(t.inputs[0], "Erf", (r) => `erf_vf32(${r})`, en$1(e)));
  }, Nu = (t) => {
    t.compute(he$1(t.inputs[0], "Exp", "exp"));
  }, Vu = (t) => {
    t.compute(he$1(t.inputs[0], "Floor", "floor"));
  }, Lu = (t) => {
    let e = Pe(t.inputs[0].dataType);
    t.compute(he$1(t.inputs[0], "Gelu", (r) => `0.5 * ${r} * (1.0 + erf_vf32(${r} * 0.7071067811865475))`, en$1(e)));
  }, Wu = (t, e) => {
    let r = Pe(t.inputs[0].dataType);
    t.compute(he$1(t.inputs[0], "LeakyRelu", (n) => `select(leaky_relu_alpha_ * ${n}, ${n}, ${n} >= vec4<${r}>(0.0))`, `const leaky_relu_alpha_ = ${r}(${e.alpha});`, e.cacheKey));
  }, Gu = (t) => {
    t.compute(he$1(t.inputs[0], "Not", (e) => `!${e}`));
  }, Hu = (t) => {
    t.compute(he$1(t.inputs[0], "Neg", (e) => `-${e}`));
  }, Fu = (t) => {
    t.compute(he$1(t.inputs[0], "Reciprocal", (e) => `1.0/${e}`));
  }, qu = (t) => {
    let e = Pe(t.inputs[0].dataType);
    t.compute(he$1(t.inputs[0], "Relu", (r) => `select(vec4<${e}>(0.0), ${r}, ${r} > vec4<${e}>(0.0))`));
  }, Ku = (t) => {
    t.compute(he$1(t.inputs[0], "Sigmoid", (e) => `(1.0 / (1.0 + exp(-${e})))`));
  }, ju = (t) => ee$1(t), Zu = (t, e) => {
    let r = Pe(t.inputs[0].dataType);
    t.compute(he$1(t.inputs[0], "HardSigmoid", (n) => `max(vec4<${r}>(0.0), min(vec4<${r}>(1.0), ${e.alpha} * ${n} + vec4<${r}>(${e.beta})))`, void 0, e.cacheKey));
  }, Qu = (t) => {
    t.compute(he$1(t.inputs[0], "Sin", "sin"));
  }, Yu = (t) => {
    t.compute(he$1(t.inputs[0], "Sinh", "sinh"));
  }, Xu = (t) => {
    t.compute(he$1(t.inputs[0], "Sqrt", "sqrt"));
  }, Ju = (t) => {
    t.compute(he$1(t.inputs[0], "Tan", "tan"));
  }, ed = (t) => `sign(${t}) * (1 - exp(-2 * abs(${t}))) / (1 + exp(-2 * abs(${t})))`, td = (t) => {
    t.compute(he$1(t.inputs[0], "Tanh", ed));
  }, wo = (t = "f32") => `
const fast_gelu_a: ${t} = 0.5;
const fast_gelu_b: ${t} = 0.7978845608028654;
const fast_gelu_c: ${t} = 0.035677408136300125;

fn tanh_v(v: vec4<${t}>) -> vec4<${t}> {
  return ${ed("v")};
}
`, _o = (t) => `(fast_gelu_a + fast_gelu_a * tanh_v(${t} * (fast_gelu_c * ${t} * ${t} + fast_gelu_b))) * ${t}`, rd = (t) => {
    let e = Pe(t.inputs[0].dataType);
    t.compute(he$1(t.inputs[0], "FastGelu", _o, wo(e), void 0, t.inputs[0].dataType));
  }, nd = (t, e) => {
    let r = Pe(t.inputs[0].dataType);
    return t.compute(he$1(t.inputs[0], "ThresholdedRelu", (n) => `select(vec4<${r}>(0.0), ${n}, ${n} > thresholded_relu_alpha_)`, `const thresholded_relu_alpha_ = vec4<${r}>(${e.alpha});`, e.cacheKey)), 0;
  }, od = (t) => {
    t.compute(he$1(t.inputs[0], "Log", "log"));
  }, Ah = (t, e) => `
const alpha = vec4<${t}>(${e});
const one = ${t}(1.0);
const zero = ${t}(0.0);

fn quick_gelu_impl(x: vec4<${t}>) -> vec4<${t}> {
  let v = x *alpha;
  var x1 : vec4<${t}>;
  for (var i = 0; i < 4; i = i + 1) {
    if (v[i] >= zero) {
      x1[i] = one / (one + exp(-v[i]));
    } else {
      x1[i] = one - one / (one + exp(v[i]));
    }
  }
  return x * x1;
}
`, Eh = (t) => `quick_gelu_impl(${t})`, id = (t, e) => {
    let r = Pe(t.inputs[0].dataType);
    t.compute(he$1(t.inputs[0], "QuickGelu", Eh, Ah(r, e.alpha), e.cacheKey, t.inputs[0].dataType));
  };
});
var kh, Ph, sd, ud = V$1(() => {
  ne();
  ae();
  tn$1();
  kh = (t) => {
    if (t[0].dims.length !== 3) throw new Error("input should have 3 dimensions");
    if (![2560, 5120, 10240].includes(t[0].dims[2])) throw new Error("hidden state should be 2560, 5120 or 10240");
    if (t[1].dims.length !== 1) throw new Error("bias is expected to have 1 dimensions");
    if (t[0].dims[2] !== t[1].dims[0]) throw new Error("last dimension of input and bias are not the same");
  }, Ph = (t) => {
    let e = t[0].dims.slice();
    e[2] = e[2] / 2;
    let r = O("input", t[0].dataType, t[0].dims, 4), n = O("bias", t[0].dataType, [t[0].dims[2]], 4), o = R("output", t[0].dataType, e, 4), i = k.size(e) / 4, s = be$1(t[0].dataType);
    return { name: "BiasSplitGelu", getRunData: () => ({ outputs: [{ dims: e, dataType: t[0].dataType }], dispatchGroup: { x: Math.ceil(i / 64) } }), getShaderSource: (d) => `
  const M_SQRT2 = sqrt(2.0);
  const halfChannels = ${t[0].dims[2] / 4 / 2}u;

  ${d.declareVariables(r, n, o)}

  ${en$1(s)}

  ${d.mainStart()}
    ${d.guardAgainstOutOfBoundsWorkgroupSizes(i)}
    let biasIdx = global_idx % halfChannels;
    let batchIndex = global_idx / halfChannels;
    let inputOffset = biasIdx + batchIndex * halfChannels * 2;
    let valueLeft = input[inputOffset] + bias[biasIdx];
    let valueRight = input[inputOffset + halfChannels] + bias[biasIdx + halfChannels];
    let geluRight = valueRight * 0.5 * (erf_vf32(valueRight / M_SQRT2) + 1);

    ${o.setByOffset("global_idx", "valueLeft * geluRight")}
  }` };
  }, sd = (t) => {
    kh(t.inputs), t.compute(Ph(t.inputs));
  };
});
var Oh, zh, dt, dd, ld, cd, pd, md, fd, hd, gd, yd, bd, wd = V$1(() => {
  J();
  ne();
  ae();
  Oh = (t, e, r, n, o, i, s, u, d, c, p, m) => {
    let g, b;
    typeof u == "string" ? g = b = ($, T) => `${u}((${$}),(${T}))` : typeof u == "function" ? g = b = u : (g = u.scalar, b = u.vector);
    let y = R("outputData", p, n.length, 4), w = O("aData", d, e.length, 4), S = O("bData", c, r.length, 4), x;
    if (o) if (i) {
      let $ = k.size(e) === 1, T = k.size(r) === 1, I = e.length > 0 && e[e.length - 1] % 4 === 0, E = r.length > 0 && r[r.length - 1] % 4 === 0;
      $ || T ? x = y.setByOffset("global_idx", b($ ? `${w.type.value}(${w.getByOffset("0")}.x)` : w.getByOffset("global_idx"), T ? `${S.type.value}(${S.getByOffset("0")}.x)` : S.getByOffset("global_idx"))) : x = `
            let outputIndices = ${y.offsetToIndices("global_idx * 4u")};
            let offsetA = ${w.broadcastedIndicesToOffset("outputIndices", y)};
            let offsetB = ${S.broadcastedIndicesToOffset("outputIndices", y)};
            ${y.setByOffset("global_idx", b(s || I ? w.getByOffset("offsetA / 4u") : `${w.type.value}(${w.getByOffset("offsetA / 4u")}[offsetA % 4u])`, s || E ? S.getByOffset("offsetB / 4u") : `${S.type.value}(${S.getByOffset("offsetB / 4u")}[offsetB % 4u])`))}
          `;
    } else x = y.setByOffset("global_idx", b(w.getByOffset("global_idx"), S.getByOffset("global_idx")));
    else {
      if (!i) throw new Error("no necessary to use scalar implementation for element-wise binary op implementation.");
      let $ = (T, I, E = "") => {
        let A = `aData[indexA${I}][componentA${I}]`, z2 = `bData[indexB${I}][componentB${I}]`;
        return `
            let outputIndices${I} = ${y.offsetToIndices(`global_idx * 4u + ${I}u`)};
            let offsetA${I} = ${w.broadcastedIndicesToOffset(`outputIndices${I}`, y)};
            let offsetB${I} = ${S.broadcastedIndicesToOffset(`outputIndices${I}`, y)};
            let indexA${I} = offsetA${I} / 4u;
            let indexB${I} = offsetB${I} / 4u;
            let componentA${I} = offsetA${I} % 4u;
            let componentB${I} = offsetB${I} % 4u;
            ${T}[${I}] = ${E}(${g(A, z2)});
          `;
      };
      p === 9 ? x = `
            var data = vec4<u32>(0);
            ${$("data", 0, "u32")}
            ${$("data", 1, "u32")}
            ${$("data", 2, "u32")}
            ${$("data", 3, "u32")}
            outputData[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));` : x = `
            ${$("outputData[global_idx]", 0)}
            ${$("outputData[global_idx]", 1)}
            ${$("outputData[global_idx]", 2)}
            ${$("outputData[global_idx]", 3)}
          `;
    }
    return `
        ${t.registerUniform("vec_size", "u32").declareVariables(w, S, y)}

        ${m ?? ""}

        ${t.mainStart()}
        ${t.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${x}
      }`;
  }, zh = (t, e, r, n, o, i, s = r.dataType) => {
    let u = r.dims.map(Number), d = n.dims.map(Number), c = !k.areEqual(u, d), p = u, m = k.size(u), g = false, b = false, y = [c];
    if (c) {
      let w = ot$1.calcShape(u, d, false);
      if (!w) throw new Error("Can't perform binary op on the given tensors");
      p = w.slice(), m = k.size(p);
      let S = k.size(u) === 1, x = k.size(d) === 1, $ = u.length > 0 && u[u.length - 1] % 4 === 0, T = d.length > 0 && d[d.length - 1] % 4 === 0;
      y.push(S), y.push(x), y.push($), y.push(T);
      let I = 1;
      for (let E = 1; E < p.length; E++) {
        let A = u[u.length - E], z2 = d[d.length - E];
        if (A === z2) I *= A;
        else break;
      }
      I % 4 === 0 ? (b = true, g = true) : (S || x || $ || T) && (g = true);
    } else g = true;
    return y.push(g), { name: t, shaderCache: { hint: e + y.map((w) => w.toString()).join("_"), inputDependencies: ["rank", "rank"] }, getShaderSource: (w) => Oh(w, u, d, p, g, c, b, o, r.dataType, n.dataType, s, i), getRunData: () => ({ outputs: [{ dims: p, dataType: s }], dispatchGroup: { x: Math.ceil(m / 64 / 4) }, programUniforms: [{ type: 12, data: Math.ceil(k.size(p) / 4) }, ...L(u, d, p)] }) };
  }, dt = (t, e, r, n, o, i) => {
    t.compute(zh(e, o ?? "", t.inputs[0], t.inputs[1], r, n, i));
  }, dd = (t) => {
    dt(t, "Add", (e, r) => `${e}+${r}`);
  }, ld = (t) => {
    dt(t, "Div", (e, r) => `${e}/${r}`);
  }, cd = (t) => {
    dt(t, "Equal", { scalar: (e, r) => `u32(${e}==${r})`, vector: (e, r) => `vec4<u32>(${e}==${r})` }, void 0, void 0, 9);
  }, pd = (t) => {
    dt(t, "Mul", (e, r) => `${e}*${r}`);
  }, md = (t) => {
    let e = O("input", t.inputs[0].dataType, t.inputs[0].dims).type.value;
    dt(t, "Pow", { scalar: (n, o) => `pow_custom(${n},${o})`, vector: (n, o) => `pow_vector_custom(${n},${o})` }, `
    fn pow_custom(a : ${e}, b : ${e}) -> ${e} {
      if (b == ${e}(0.0)) {
        return ${e}(1.0);
      } else if (a < ${e}(0.0) && f32(b) != floor(f32(b))) {
        return ${e}(pow(f32(a), f32(b))); // NaN
      }
      return select(sign(a), ${e}(1.0), round(f32(abs(b) % ${e}(2.0))) != 1.0) * ${e}(${e === "i32" ? "round" : ""}(pow(f32(abs(a)), f32(b))));
    }
    fn pow_vector_custom(a : vec4<${e}>, b : vec4<${e}>) -> vec4<${e}> {
      // TODO: implement vectorized pow
      return vec4<${e}>(pow_custom(a.x, b.x), pow_custom(a.y, b.y), pow_custom(a.z, b.z), pow_custom(a.w, b.w));
    }
      `);
  }, fd = (t) => {
    dt(t, "Sub", (e, r) => `${e}-${r}`);
  }, hd = (t) => {
    dt(t, "Greater", { scalar: (e, r) => `u32(${e}>${r})`, vector: (e, r) => `vec4<u32>(${e}>${r})` }, void 0, void 0, 9);
  }, gd = (t) => {
    dt(t, "Less", { scalar: (e, r) => `u32(${e}<${r})`, vector: (e, r) => `vec4<u32>(${e}<${r})` }, void 0, void 0, 9);
  }, yd = (t) => {
    dt(t, "GreaterOrEqual", { scalar: (e, r) => `u32(${e}>=${r})`, vector: (e, r) => `vec4<u32>(${e}>=${r})` }, void 0, void 0, 9);
  }, bd = (t) => {
    dt(t, "LessOrEqual", { scalar: (e, r) => `u32(${e}<=${r})`, vector: (e, r) => `vec4<u32>(${e}<=${r})` }, void 0, void 0, 9);
  };
});
var Bh, Mh, Rh, Uh, _d, vd, $d = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  Bh = (t, e) => {
    if (!t || t.length < 1) throw new Error("too few inputs");
    let r = 0, n = t[r], o = n.dataType, i = n.dims.length;
    t.forEach((s, u) => {
      if (u !== r) {
        if (s.dataType !== o) throw new Error("input tensors should be one type");
        if (s.dims.length !== i) throw new Error("input tensors should have the same shape");
        s.dims.forEach((d, c) => {
          if (c !== e && d !== n.dims[c]) throw new Error("non concat dimensions must match");
        });
      }
    });
  }, Mh = (t, e) => `
  fn calculateInputIndex(index: u32) -> u32 {
    let sizeInConcatAxis = array<u32, ${t}u>(${e});
    for (var i: u32 = 0u; i < ${t}; i += 1u ) {
      if (index < sizeInConcatAxis[i]) {
        return i;
      }
    }
    return ${t}u;
  }`, Rh = (t, e) => {
    let r = t.length, n = [];
    for (let o = 0; o < r; ++o) {
      let i = e.setByOffset("global_idx", t[o].getByIndices("indices"));
      r === 1 ? n.push(i) : o === 0 ? n.push(`if (inputIndex == ${o}u) { ${i} }`) : o === r - 1 ? n.push(`else { ${i} }`) : n.push(`else if (inputIndex == ${o}) { ${i} }`);
    }
    return n.join(`
`);
  }, Uh = (t, e, r, n) => {
    let o = k.size(r), i = new Array(t.length), s = new Array(t.length), u = 0, d = [], c = [], p = [{ type: 12, data: o }];
    for (let w = 0; w < t.length; ++w) u += t[w].dims[e], i[w] = u, c.push(t[w].dims.length), s[w] = O(`input${w}`, n, c[w]), d.push("rank"), p.push({ type: 12, data: i[w] });
    for (let w = 0; w < t.length; ++w) p.push(...L(t[w].dims));
    p.push(...L(r));
    let m = R("output", n, r.length), g = m.indicesGet("indices", e), b = Array.from(Array(i.length).keys()).map((w) => `uniforms.sizeInConcatAxis${w}`).join(","), y = (w) => `

  ${(() => {
      w.registerUniform("outputSize", "u32");
      for (let S = 0; S < t.length; S++) w.registerUniform(`sizeInConcatAxis${S}`, "u32");
      return w.declareVariables(...s, m);
    })()}

  ${Mh(i.length, b)}

  ${w.mainStart()}
    ${w.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

    var indices = ${m.offsetToIndices("global_idx")};

    let inputIndex = calculateInputIndex(${g});
    if (inputIndex != 0u) {
      let sizeInConcatAxis = array<u32, ${i.length}u>(${b});
      ${g} -= sizeInConcatAxis[inputIndex - 1u];
    }

    ${Rh(s, m)}
  }`;
    return { name: "Concat", shaderCache: { hint: `${e}`, inputDependencies: d }, getRunData: () => ({ outputs: [{ dims: r, dataType: n }], dispatchGroup: { x: Math.ceil(o / 64) }, programUniforms: p }), getShaderSource: y };
  }, _d = (t, e) => {
    let r = t.inputs, n = r[0].dims, o = k.normalizeAxis(e.axis, n.length);
    Bh(r, o);
    let i = n.slice();
    i[o] = r.reduce((u, d) => u + (d.dims.length > o ? d.dims[o] : 0), 0);
    let s = r.filter((u) => k.size(u.dims) > 0);
    t.compute(Uh(s, o, i, r[0].dataType), { inputs: s });
  }, vd = (t) => ee$1({ axis: t.axis });
});
var Ze, Qe$1, Ye, rn$1, St = V$1(() => {
  J();
  ne();
  Ze = (t, e, r = "f32") => {
    switch (t.activation) {
      case "Relu":
        return `value = max(value, ${e}(0.0));`;
      case "Sigmoid":
        return `value = (${e}(1.0) / (${e}(1.0) + exp(-value)));`;
      case "Clip":
        return `value = clamp(value, ${e}(${r}(uniforms.clip_min)), ${e}(${r}(uniforms.clip_max)));`;
      case "HardSigmoid":
        return `value = max(${e}(0.0), min(${e}(1.0), ${r}(uniforms.alpha) * value + ${r}(uniforms.beta)));`;
      case "LeakyRelu":
        return `value = select(${r}(uniforms.alpha) * value, value, value >= ${e}(0.0));`;
      case "Tanh":
        return `let e2x = exp(-2.0 * abs(value));
              value = sign(value) * (1.0 - e2x) / (1.0 + e2x);
        `;
      case "":
        return "";
      default:
        throw new Error(`Unsupported activation ${t.activation}`);
    }
  }, Qe$1 = (t, e) => {
    t.activation === "Clip" ? e.push({ type: 1, data: t.clipMax }, { type: 1, data: t.clipMin }) : t.activation === "HardSigmoid" ? e.push({ type: 1, data: t.alpha }, { type: 1, data: t.beta }) : t.activation === "LeakyRelu" && e.push({ type: 1, data: t.alpha });
  }, Ye = (t, e) => {
    t.activation === "Clip" ? e.push({ name: "clip_max", type: "f32" }, { name: "clip_min", type: "f32" }) : t.activation === "HardSigmoid" ? e.push({ name: "alpha", type: "f32" }, { name: "beta", type: "f32" }) : t.activation === "LeakyRelu" && e.push({ name: "alpha", type: "f32" });
  }, rn$1 = (t) => {
    let e = (t == null ? void 0 : t.activation) || "";
    if (e === "HardSigmoid") {
      let [r, n] = (t == null ? void 0 : t.activation_params) || [0.2, 0.5];
      return { activation: e, alpha: r, beta: n };
    } else if (e === "Clip") {
      let [r, n] = (t == null ? void 0 : t.activation_params) || [Es$1, ks$1];
      return { activation: e, clipMax: n, clipMin: r };
    } else if (e === "LeakyRelu") {
      let [r] = (t == null ? void 0 : t.activation_params) || [0.01];
      return { activation: e, alpha: r };
    }
    return { activation: e };
  };
});
var Ee$1, xd, nn$1 = V$1(() => {
  Ee$1 = (t, e) => {
    switch (t) {
      case 1:
        return e;
      case 2:
        return `vec2<${e}>`;
      case 3:
        return `vec3<${e}>`;
      case 4:
        return `vec4<${e}>`;
      default:
        throw new Error(`${t}-component is not supported.`);
    }
  }, xd = (t) => `
      ${t ? "value = value + getBiasByOutputCoords(coords);" : ""}
      `;
});
var Sd, Td = V$1(() => {
  Sd = (t) => `
fn getIndexFromCoords4D(coords : vec4<i32>, shape : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
      shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1));
}
fn getOutputIndexFromCoords(coords : vec4<i32>) -> i32 {
  return dot(coords, vec4<i32>(
    i32(${t}.x), i32(${t}.y), i32(${t}.z), 1));
}
`;
});
var or$1, on$1, an$1 = V$1(() => {
  J();
  ne();
  ae();
  St();
  or$1 = (t, e, r, n, o) => {
    let i = n - r;
    return `
      ${Array.from({ length: r }).map((s, u) => `
      if (${F$1(e.shape, u, e.rank)} != 1) {
        ${e.indicesSet(t, u, F$1(o, u + i, n))}
      } else {
        ${e.indicesSet(t, u, 0)}
      }`).join("")}
`;
  }, on$1 = (t, e, r, n, o = false, i) => {
    let s = t[0].dims, u = t[1].dims, d = s[s.length - 2], c = u[u.length - 1], p = s[s.length - 1], m = fe(c), g = fe(p), b = fe(d), y = k.size(r) / m / b, w = t.length > 2, S = n ? n.slice(0, -2) : r.slice(0, -2), $ = [k.size(S), d, c], T = [{ type: 12, data: y }, { type: 12, data: d }, { type: 12, data: c }, { type: 12, data: p }];
    Qe$1(e, T), T.push(...L(S, s, u)), w && T.push(...L(t[2].dims)), T.push(...L($));
    let I = (E) => {
      let A = Qr$1("batch_dims", t[0].dataType, S.length), z2 = O("a", t[0].dataType, s.length, g), v = O("b", t[1].dataType, u.length, m), M = R("output", t[0].dataType, $.length, m), N = be$1(M.type.tensor), K = Ze(e, M.type.value, N), q = [z2, v], Q = "";
      if (w) {
        let j = o ? m : 1;
        q.push(O("bias", t[2].dataType, t[2].dims.length, j)), Q = `${o ? `value += bias[col / ${j}];` : `value += ${M.type.value}(bias[row + i]);`}`;
      }
      let D = [{ name: "output_size", type: "u32" }, { name: "M", type: "u32" }, { name: "N", type: "u32" }, { name: "K", type: "u32" }];
      Ye(e, D);
      let W = () => {
        let j = `var a_data: ${z2.type.value};`;
        for (let Y = 0; Y < g; Y++) j += `
              let b_data${Y} = b[(b_offset + (k + ${Y}) * uniforms.N + col) / ${m}];`;
        for (let Y = 0; Y < b; Y++) {
          j += `a_data = a[(a_offset + (row + ${Y}) * uniforms.K + k) / ${g}];`;
          for (let Z = 0; Z < g; Z++) j += `
            values[${Y}] = fma(${v.type.value}(a_data${g === 1 ? "" : `[${Z}]`}), b_data${Z}, values[${Y}]);
`;
        }
        return j;
      };
      return `
  ${E.registerUniforms(D).registerInternalVariables(A).declareVariables(...q, M)}
  ${E.mainStart()}
    ${E.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let col = (global_idx % (uniforms.N / ${m})) * ${m};
    var index1 = global_idx / (uniforms.N / ${m});
    let stride1 = uniforms.M / ${b};
    let row = (index1 % stride1) * ${b};
    let batch = index1 / stride1;

    ${r.length === 2 ? "" : `let batch_indices = ${A.offsetToIndices("batch")};`}

    var a_indices: ${z2.type.indices};
    ${or$1("a_indices", z2, z2.rank - 2, A.rank, "batch_indices")}
    ${z2.indicesSet("a_indices", z2.rank - 2, 0)}
    ${z2.indicesSet("a_indices", z2.rank - 1, 0)}
    let a_offset = ${z2.indicesToOffset("a_indices")};

    var b_indices: ${v.type.indices};
    ${or$1("b_indices", v, v.rank - 2, A.rank, "batch_indices")}
    ${v.indicesSet("b_indices", v.rank - 2, 0)}
    ${v.indicesSet("b_indices", v.rank - 1, 0)}
    let b_offset = ${v.indicesToOffset("b_indices")};
    var values: array<${M.type.value}, ${b}>;
    for (var k: u32 = 0u; k < uniforms.K; k = k + ${g}) {
      ${W()}
    }
    for (var i = 0u; i < ${b}u; i++) {
      var value = values[i];
      ${Q}
      ${K}
      let cur_indices = ${M.type.indices}(batch, row + i, col);
      let offset = ${M.indicesToOffset("cur_indices")};
      ${M.setByOffset(`offset / ${m}`, "value")};
    }
  }
  `;
    };
    return { name: "MatMulNaive", shaderCache: { hint: `${e.activation};${m};${g};${b};${o}`, inputDependencies: w ? ["rank", "rank", "rank"] : ["rank", "rank"] }, getRunData: () => ({ outputs: [{ dims: i ? i(r) : r, dataType: t[0].dataType }], dispatchGroup: { x: Math.ceil(y / 64) }, programUniforms: T }), getShaderSource: I };
  };
});
var Nh, Vh, vo, Id, Lh, $o, Wh, ir$1, sn$1 = V$1(() => {
  J();
  ne();
  ae();
  St();
  an$1();
  nn$1();
  Nh = (t, e) => t ? `
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          kStart + inputRow,
          globalRowStart / innerElementSize + inputCol${e ? ", batchIndices" : ""});
        ` : `
        mm_Asub[inputRow][inputCol] = mm_readA(batch,
          globalRow + innerRow,
          kStart / innerElementSize + inputCol${e ? ", batchIndices" : ""});
        `, Vh = (t, e) => t ? `
        let ACached0 = mm_Asub[k * innerElementSize][localRow];
        let ACached1 = mm_Asub[k * innerElementSize + 1][localRow];
        let ACached2 = mm_Asub[k * innerElementSize + 2][localRow];
        ${e === 3 ? "" : "let ACached3 = mm_Asub[k * innerElementSize + 3][localRow];"}
        for (var i = 0; i < rowPerThread; i = i + 1) {
          acc[i] = BCached0 * ACached0[i] + acc[i];
          acc[i] = BCached1 * ACached1[i] + acc[i];
          acc[i] = BCached2 * ACached2[i] + acc[i];
          ${e === 3 ? "" : "acc[i] = BCached3 * ACached3[i] + acc[i];"}
        }` : `
        for (var i = 0; i < rowPerThread; i = i + 1) {
          let ACached = mm_Asub[tileRow + i][k];
          acc[i] = BCached0 * ACached.x + acc[i];
          acc[i] = BCached1 * ACached.y + acc[i];
          acc[i] = BCached2 * ACached.z + acc[i];
          ${e === 3 ? "" : "acc[i] = BCached3 * ACached.w + acc[i];"}
        }`, vo = (t, e, r = "f32", n, o = false, i = 32, s = false, u = 32) => {
    let d = e[1] * t[1], c = e[0] * t[0], p = o ? d : i, m = o ? i : d, g = p / e[0], b = i / e[1];
    if (!((o && g === 4 && t[1] === 4 || !o && (g === 3 || g === 4)) && p % e[0] === 0 && i % e[1] === 0 && t[0] === 4)) throw new Error(`If transposeA ${o} is true, innerElementSize ${g} and workPerThread[1] ${t[1]} must be 4.
      Otherwise, innerElementSize ${g} must be 3 or 4.
  tileAWidth ${p} must be divisible by workgroupSize[0]${e[0]}. tileInner ${i} must be divisible by workgroupSize[1] ${e[1]}. colPerThread ${t[0]} must be 4.`);
    return `
var<workgroup> mm_Asub: array<array<vec${g}<${r}>, ${p / g}>, ${m}>;
var<workgroup> mm_Bsub: array<array<vec4<${r}>, ${c / t[0]}>, ${i}>;

const rowPerThread = ${t[1]};
const colPerThread = ${t[0]};
const innerElementSize = ${g};
const tileInner = ${i};

@compute @workgroup_size(${e[0]}, ${e[1]}, ${e[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
  let localRow = i32(localId.y);
  let tileRow = localRow * rowPerThread;
  let tileCol = i32(localId.x);

  let globalRow =i32(globalId.y) * rowPerThread;
  let globalCol = i32(globalId.x);
  let batch = ${s ? "0" : "i32(globalId.z)"};
  ${n ? `let batchIndices = ${n.offsetToIndices("u32(batch)")};` : ""}
  let globalRowStart = i32(workgroupId.y) * ${d};

  let num_tiles = ${s ? `${Math.ceil(u / i)}` : "(uniforms.dim_inner - 1) / tileInner + 1"};
  var kStart = ${s ? `i32(globalId.z) * ${u}` : "0"};

  var acc: array<vec4<${r}>, rowPerThread>;

  // Loop over shared dimension.
  let tileRowB = localRow * ${b};
  for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let inputRow = tileRow + innerRow;
          let inputCol = tileCol;
          ${Nh(o, n)}
      }

      // Load one tile of B into local memory.
      for (var innerRow = 0; innerRow < ${b}; innerRow = innerRow + 1) {
          let inputRow = tileRowB + innerRow;
          let inputCol = tileCol;
          mm_Bsub[inputRow][inputCol] = mm_readB(batch, kStart + inputRow, globalCol${n ? ", batchIndices" : ""});
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      for (var k = 0; k < tileInner / innerElementSize; k = k + 1) {
          let BCached0 = mm_Bsub[k * innerElementSize][tileCol];
          let BCached1 = mm_Bsub[k * innerElementSize + 1][tileCol];
          let BCached2 = mm_Bsub[k * innerElementSize + 2][tileCol];
          ${g === 3 ? "" : "let BCached3 = mm_Bsub[k * innerElementSize + 3][tileCol];"}

          ${Vh(o, g)}
      }

      workgroupBarrier();
  }

  for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      mm_write(batch, globalRow + innerRow, globalCol, acc[innerRow]);
  }
}`;
  }, Id = (t, e) => t ? `
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              kStart + inputRow,
              globalRowStart + inputCol${e ? ", batchIndices" : ""});
            ` : `
            mm_Asub[inputRow][inputCol] = mm_readA(batch,
              globalRowStart + inputRow,
              kStart + inputCol${e ? ", batchIndices" : ""});
            `, Lh = (t) => t ? "let ACached = mm_Asub[k][tileRow + innerRow];" : "let ACached = mm_Asub[tileRow + innerRow][k];", $o = (t, e, r = "f32", n, o = false, i = 32, s = false, u = 32, d = false) => {
    let c = t[1] * e[1], p = t[0] * e[0], m = o ? c : i, g = o ? i : c;
    if (!(g % e[1] === 0 && m % e[0] === 0 && i % e[1] === 0)) throw new Error(`tileAHight ${g} must be divisible by workgroupSize[1]${e[1]}, tileAWidth ${m} must be divisible by workgroupSize[0]${e[0]}, tileInner ${i} must be divisible by workgroupSize[1]${e[1]}`);
    let b = g / e[1], y = m / e[0], w = i / e[1], S = d ? `
    let localRow = i32(localId.y);
    let localCol = i32(localId.x);
    let globalRowStart = i32(workgroupId.y) * ${c};
    let globalColStart = i32(workgroupId.x) * ${p};

    // Loop over shared dimension.
    for (var t = 0; t < num_tiles; t = t + 1) {
      // Load one tile of A into local memory.
      for (var inputRow = localRow; inputRow < ${g}; inputRow = inputRow + ${e[1]}) {
        for (var inputCol = localCol; inputCol < ${m}; inputCol = inputCol + ${e[0]}) {
          ${Id(o, n)}
        }
      }
      // Load one tile of B into local memory.
      for (var inputRow = localRow; inputRow < ${i}; inputRow = inputRow + ${e[1]}) {
            for (var inputCol = localCol; inputCol < ${p}; inputCol = inputCol + ${e[0]}) {
          mm_Bsub[inputRow][inputCol] = mm_readB(batch,
            kStart + inputRow,
            globalColStart + inputCol${n ? ", batchIndices" : ""});
        }
      }
      kStart = kStart + tileInner;
      workgroupBarrier();

      // Compute acc values for a single thread.
      var BCached : array<${r}, colPerThread>;
      for (var k = 0; k < tileInner; k = k + 1) {
        for (var inner = 0; inner < colPerThread; inner = inner + 1) {
          BCached[inner] = mm_Bsub[k][localCol + inner * ${e[0]}];
        }
        for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
          let ACached = ${o ? `mm_Asub[k][localRow + innerRow * ${e[1]}];` : `mm_Asub[localRow + innerRow * ${e[1]}][k];`}
          for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
            acc[innerRow][innerCol] = acc[innerRow][innerCol] +
                ACached * BCached[innerCol];
          }
        }
      }
      workgroupBarrier();
    }
    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      let gRow = globalRowStart + localRow + innerRow * ${e[1]};
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        let gCol = globalColStart + localCol + innerCol * ${e[0]};
        mm_write(batch, gRow, gCol, acc[innerRow][innerCol]);
      }
    }
    ` : `
let tileRow = i32(localId.y) * rowPerThread;
let tileCol = i32(localId.x) * colPerThread;

let globalRow = i32(globalId.y) * rowPerThread;
let globalCol = i32(globalId.x) * colPerThread;
let globalRowStart = i32(workgroupId.y) * ${c};

let tileRowA = i32(localId.y) * ${b};
let tileColA = i32(localId.x) * ${y};
let tileRowB = i32(localId.y) * ${w};
// Loop over shared dimension.
for (var t = 0; t < num_tiles; t = t + 1) {
  // Load one tile of A into local memory.
  for (var innerRow = 0; innerRow < ${b}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < ${y}; innerCol = innerCol + 1) {
      let inputRow = tileRowA + innerRow;
      let inputCol = tileColA + innerCol;
      ${Id(o, n)}
    }
  }

  // Load one tile of B into local memory.
  for (var innerRow = 0; innerRow < ${w}; innerRow = innerRow + 1) {
    for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
      let inputRow = tileRowB + innerRow;
      let inputCol = tileCol + innerCol;
      mm_Bsub[inputRow][inputCol] = mm_readB(batch,
        kStart + inputRow,
        globalCol + innerCol${n ? ", batchIndices" : ""});
    }
  }
  kStart = kStart + tileInner;
  workgroupBarrier();

  // Compute acc values for a single thread.
  var BCached : array<${r}, colPerThread>;
  for (var k = 0; k < tileInner; k = k + 1) {
    for (var inner = 0; inner < colPerThread; inner = inner + 1) {
      BCached[inner] = mm_Bsub[k][tileCol + inner];
    }

    for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
      ${Lh(o)}
      for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
        acc[innerRow][innerCol] = acc[innerRow][innerCol] + ACached * BCached[innerCol];
      }
    }
  }

  workgroupBarrier();
}

for (var innerRow = 0; innerRow < rowPerThread; innerRow = innerRow + 1) {
  for (var innerCol = 0; innerCol < colPerThread; innerCol = innerCol + 1) {
    mm_write(batch, globalRow + innerRow, globalCol + innerCol,
        acc[innerRow][innerCol]);
  }
}
`;
    return `
  var<workgroup> mm_Asub : array<array<${r}, ${m}>, ${g}>;
  var<workgroup> mm_Bsub : array<array<${r}, ${p}>, ${i}>;
  const rowPerThread = ${t[1]};
  const colPerThread = ${t[0]};
  const tileInner = ${i};

@compute @workgroup_size(${e[0]}, ${e[1]}, ${e[2]})
fn main(@builtin(local_invocation_id) localId : vec3<u32>,
        @builtin(global_invocation_id) globalId : vec3<u32>,
        @builtin(workgroup_id) workgroupId : vec3<u32>) {
    let batch = ${s ? "0" : "i32(globalId.z)"};
    ${n ? `let batchIndices = ${n.offsetToIndices("u32(batch)")};` : ""}
    let num_tiles = ${s ? `${Math.ceil(u / i)}` : "(uniforms.dim_inner - 1) / tileInner + 1"};
    var kStart = ${s ? `i32(globalId.z) * ${u}` : "0"};

    var acc : array<array<${r}, colPerThread>, rowPerThread>;
    ${S}
  }
`;
  }, Wh = (t, e, r, n, o = false) => {
    let [i, s, u, d] = n, c = be$1(n[0].type.tensor);
    return `
    fn mm_readA(batch: i32, row: i32, colIn: i32, batchIndices: ${i.type.indices}) -> ${Ee$1(t, c)} {
      var value = ${Ee$1(t, c)}(0.0);
      let col = colIn * ${t};
      if(row < uniforms.dim_a_outer && col < uniforms.dim_inner)
      {
        var aIndices: ${s.type.indices};
        ${or$1("aIndices", s, s.rank - 2, i.rank, "batchIndices")}
        ${s.indicesSet("aIndices", s.rank - 2, "u32(row)")}
        ${s.indicesSet("aIndices", s.rank - 1, "u32(colIn)")}
        value = ${s.getByIndices("aIndices")};
      }
      return value;
    }

    fn mm_readB(batch: i32, row: i32, colIn: i32, batchIndices: ${i.type.indices}) -> ${Ee$1(t, c)} {
      var value = ${Ee$1(t, c)}(0.0);
      let col = colIn * ${t};
      if(row < uniforms.dim_inner && col < uniforms.dim_b_outer)
      {
        var bIndices: ${u.type.indices};
        ${or$1("bIndices", u, u.rank - 2, i.rank, "batchIndices")}
        ${u.indicesSet("bIndices", u.rank - 2, "u32(row)")}
        ${u.indicesSet("bIndices", u.rank - 1, "u32(colIn)")}
        value = ${u.getByIndices("bIndices")};
      }
      return value;
    }

    fn mm_write(batch: i32, row: i32, colIn: i32, valueIn: ${Ee$1(t, c)}) {
      let col = colIn * ${t};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer) {
        var value = valueIn;
        let coords = vec3<i32>(batch, row, colIn);
        ${e ? `value = value + ${o ? "bias[colIn]" : `${Ee$1(t, c)}(bias[row])`};` : ""}
        ${r}
        ${d.setByIndices("vec3<u32>(coords)", "value")}
      }
    }
    `;
  }, ir$1 = (t, e, r, n, o = false, i) => {
    let s = t[0].dims, u = t[1].dims, d = s.slice(0, -2), c = u.slice(0, -2), p = n ? n.slice(0, -2) : r.slice(0, -2), m = k.size(p), g = s[s.length - 2], b = s[s.length - 1], y = u[u.length - 1], w = b % 4 === 0 && y % 4 === 0, S = g <= 8 ? [4, 1, 1] : [4, 4, 1], x = [8, 8, 1], $ = [Math.ceil(y / x[0] / S[0]), Math.ceil(g / x[1] / S[1]), Math.ceil(m / x[2] / S[2])], T = w ? 4 : 1, I = [...d, g, b / T], E = I.length, A = [...c, b, y / T], z2 = A.length, v = [m, g, y / T], M = [{ type: 6, data: g }, { type: 6, data: y }, { type: 6, data: b }];
    Qe$1(e, M), M.push(...L(p, I, A));
    let N = ["rank", "rank"], K = t.length > 2;
    K && (M.push(...L(t[2].dims)), N.push("rank")), M.push(...L(v));
    let q = (Q) => {
      let D = p.length, W = Qr$1("batchDims", t[0].dataType, D, 1), j = be$1(t[0].dataType), Y = O("a", t[0].dataType, E, T), Z = O("b", t[1].dataType, z2, T), te = R("result", t[0].dataType, v.length, T), ie = [Y, Z];
      if (K) {
        let X = o ? T : 1;
        ie.push(O("bias", t[2].dataType, t[2].dims.length, X));
      }
      let we = [{ name: "dim_a_outer", type: "i32" }, { name: "dim_b_outer", type: "i32" }, { name: "dim_inner", type: "i32" }];
      Ye(e, we);
      let Te = be$1(te.type.tensor), re = Ze(e, te.type.value, Te), U = Wh(T, K, re, [W, Y, Z, te], o);
      return `
  ${Q.registerUniforms(we).registerInternalVariables(W).declareVariables(...ie, te)}
  ${U}
  ${w ? vo(S, x, j, W) : $o(S, x, j, W)}
                   `;
    };
    return { name: "MatMul", shaderCache: { hint: `${S};${e.activation};${w};${o}`, inputDependencies: N }, getRunData: () => ({ outputs: [{ dims: i ? i(r) : r, dataType: t[0].dataType }], dispatchGroup: { x: $[0], y: $[1], z: $[2] }, programUniforms: M }), getShaderSource: q };
  };
});
var Gh, Cd, Ad = V$1(() => {
  J();
  nt();
  ae();
  St();
  nn$1();
  Td();
  sn$1();
  Gh = (t, e, r, n, o = false, i, s = 4, u = 4, d = 4, c = "f32") => {
    let p = (N) => {
      switch (N) {
        case 1:
          return "resData = x[xIndex];";
        case 3:
          return `resData = vec3<${c}>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);`;
        case 4:
          return "resData = x[xIndex / 4];";
        default:
          throw new Error(`innerElementSize ${N} is not supported.`);
      }
    }, m = (N) => {
      switch (N) {
        case 1:
          return "return w[row * i32(uniforms.w_shape[3]) + colIn];";
        case 4:
          return "return w[row * i32(uniforms.w_shape[3]) / 4 + colIn];";
        default:
          throw new Error(`innerElementSize ${N} is not supported.`);
      }
    }, g = t ? `
    let coord = vec4<i32>(batch, xRow, xCol, xCh);
    ` : `
    let coord = vec4<i32>(batch, xCh, xRow, xCol);
    `, b = t ? `
    let coords = vec4<i32>(
      batch,
      row / outWidth,
      row % outWidth,
      col);
    ` : `
    let coords = vec4<i32>(
      batch,
      row,
      col / outWidth,
      col % outWidth);
    `, y = t ? "i32(uniforms.x_shape[1])" : "i32(uniforms.x_shape[2])", w = t ? "i32(uniforms.x_shape[2])" : "i32(uniforms.x_shape[3])", S = t ? "row" : "col", x = t ? "col" : "row", $ = `
    let inChannels = i32(uniforms.w_shape[2]);
    let outWidth = ${t ? "i32(uniforms.result_shape[2])" : "i32(uniforms.result_shape[3])"};
    let outRow = ${S} / outWidth;
    let outCol = ${S} % outWidth;

    let WRow = ${x} / (i32(uniforms.w_shape[1]) * inChannels);
    let WCol = ${x} / inChannels % i32(uniforms.w_shape[1]);
    let xRow = outRow * uniforms.stride[0] + uniforms.dilation[0] * WRow - uniforms.pad[0];
    let xCol = outCol * uniforms.stride[1] + uniforms.dilation[1] * WCol - uniforms.pad[1];
    let xCh = ${x} % inChannels;
    var resData = ${Ee$1(s, c)}(0.0);
    // The bounds checking is always needed since we use it to pad zero for
    // the 'same' padding type.
    if (xRow >= 0 && xRow < ${y} && xCol >= 0 && xCol < ${w}) {
      ${g}
      let xIndex = getIndexFromCoords4D(coord, vec4<i32>(uniforms.x_shape));
      ${p(s)}
    }
    return resData;`, T = t ? e && n ? `
    let col = colIn * ${s};
    ${$}` : `
    let col = colIn * ${s};
    if (row < uniforms.dim_a_outer && col < uniforms.dim_inner) {
      ${$}
    }
    return ${Ee$1(s, c)}(0.0);` : n && r ? `
    let col = colIn * ${s};
    ${$}` : `
    let col = colIn * ${s};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${$}
    }
    return ${Ee$1(s, c)}(0.0);`, I = t ? n && r ? m(u) : `
    let col = colIn * ${u};
    if (row < uniforms.dim_inner && col < uniforms.dim_b_outer) {
      ${m(u)}
    }
    return ${Ee$1(u, c)}(0.0);` : `
    let col = colIn * ${u};
    if (row < uniforms.dim_inner && col < uniforms.dim_a_outer) {
      ${m(u)}
    }
    return ${Ee$1(u, c)}(0.0);`, E = Ee$1(d, c), A = t ? Ee$1(s, c) : Ee$1(u, c), z2 = t ? Ee$1(u, c) : Ee$1(s, c), v = Ze(i, E, c);
    return `
    fn mm_readA(batch: i32, row : i32, colIn : i32) -> ${A} {
      ${t ? T : I}
    }

    fn mm_readB(batch: i32, row : i32, colIn : i32) -> ${z2} {
      ${t ? I : T}
    }

    fn mm_write(batch: i32, row : i32, colIn : i32, valueIn : ${E}) {
      let col = colIn * ${d};
      if (row < uniforms.dim_a_outer && col < uniforms.dim_b_outer)
      {
      var value = valueIn;
      let outWidth = ${t ? "i32(uniforms.result_shape[2])" : "i32(uniforms.result_shape[3])"};
      ${b}
      ${xd(o)}
      ${v}
      setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
      }
    }`;
  }, Cd = (t, e, r, n, o, i, s, u, d) => {
    let c = e.format === "NHWC", p = c ? t[0].dims[3] : t[0].dims[1], m = r[0], g = c ? r[2] : r[3], b = c ? r[1] : r[2], y = c ? r[3] : r[1], w = c && (p % 4 === 0 || p % 3 === 0) && y % 4 === 0, S = c ? y : g * b, x = c ? g * b : y, $ = [8, 8, 1], T = n <= 8 ? [4, 1, 1] : [4, 4, 1], I = [Math.ceil(S / $[0] / T[0]), Math.ceil(x / $[1] / T[1]), Math.ceil(m / $[2] / T[2])];
    se("verbose", () => `[conv2d_mm_webgpu] dispatch = ${I}`);
    let E = w ? c && p % 4 !== 0 ? 3 : 4 : 1, A = $[1] * T[1], z2 = $[0] * T[0], v = Math.max($[0] * E, $[1]), M = n % A === 0, N = o % z2 === 0, K = i % v === 0, q = w ? [E, 4, 4] : [1, 1, 1], Q = [{ type: 6, data: n }, { type: 6, data: o }, { type: 6, data: i }, { type: 6, data: [e.pads[0], e.pads[1]] }, { type: 6, data: e.strides }, { type: 6, data: e.dilations }];
    Qe$1(e, Q), Q.push(...L(t[0].dims, t[1].dims));
    let D = ["rank", "rank"];
    s && (Q.push(...L(t[2].dims)), D.push("rank")), Q.push(...L(r));
    let W = (j) => {
      let Y = [{ name: "dim_a_outer", type: "i32" }, { name: "dim_b_outer", type: "i32" }, { name: "dim_inner", type: "i32" }, { name: "pad", type: "i32", length: 2 }, { name: "stride", type: "i32", length: 2 }, { name: "dilation", type: "i32", length: 2 }];
      Ye(e, Y);
      let Z = w ? 4 : 1, te = be$1(t[0].dataType), ie = `
      fn setOutputAtIndex(flatIndex : i32, value : ${w ? `vec4<${te}>` : te}) {
        result[flatIndex] = ${w ? `vec4<${te}>` : te}(value);
      }
      fn setOutputAtCoords(d0 : i32, d1 : i32, d2 : i32, d3 : i32, value : ${w ? `vec4<${te}>` : te}) {
        let flatIndex = getOutputIndexFromCoords(vec4<i32>(d0, d1, d2, d3));
        setOutputAtIndex(flatIndex ${w ? "/ 4" : ""}, value);
      }`, we = O("x", t[0].dataType, t[0].dims.length, E === 3 ? 1 : E), Te = O("w", t[1].dataType, t[1].dims.length, Z), re = [we, Te], U = R("result", t[0].dataType, r.length, Z);
      if (s) {
        let X = O("bias", t[2].dataType, t[2].dims.length, Z);
        re.push(X), ie += `
        fn getBiasByOutputCoords(coords : vec4<i32>) -> ${w ? `vec4<${te}>` : te} {
          return bias[coords.${c ? "w" : "y"}${w ? "/ 4" : ""}];
        }`;
      }
      return `
        ${Sd("uniforms.result_strides")}
        //struct Uniforms { xShape : vec4<i32>, wShape : vec4<i32>, outShape : vec4<i32>,
        //  outShapeStrides: vec3<i32>, filterDims : vec2<i32>, pad : vec2<i32>, stride : vec2<i32>,
        //  dilation : vec2<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32 };
        ${j.registerUniforms(Y).declareVariables(...re, U)}
        ${ie}
        ${Gh(c, M, N, K, s, e, q[0], q[1], q[2], te)}
        ${w ? vo(T, $, te, void 0, !c, v) : $o(T, $, te, void 0, !c, v, false, void 0, u)}`;
    };
    return { name: "Conv2DMatMul", shaderCache: { hint: `${e.cacheKey};${E};${w};${M};${N};${K};${A};${z2};${v}`, inputDependencies: D }, getRunData: () => ({ outputs: [{ dims: d ? d(r) : r, dataType: t[0].dataType }], dispatchGroup: { x: I[0], y: I[1], z: I[2] }, programUniforms: Q }), getShaderSource: W };
  };
});
var Hh, Ed, un$1, Fh, kd, qh, Pd, Od, zd = V$1(() => {
  J();
  nt();
  ne();
  ae();
  St();
  nn$1();
  Hh = (t) => {
    let e = 1;
    for (let r = 0; r < t.length; r++) e *= t[r];
    return e;
  }, Ed = (t) => typeof t == "number" ? [t, t, t] : t, un$1 = (t, e) => e <= 1 ? t : t + (t - 1) * (e - 1), Fh = (t, e, r, n = 1) => {
    let o = un$1(e, n);
    return Math.floor((t[0] * (r - 1) - r + o) / 2);
  }, kd = (t, e, r, n, o) => {
    o == null && (o = Fh(t, e[0], n[0]));
    let i = [0, 0, 0, r];
    for (let s = 0; s < 3; s++) t[s] + 2 * o >= e[s] && (i[s] = Math.trunc((t[s] - e[s] + 2 * o) / n[s] + 1));
    return i;
  }, qh = (t, e, r, n, o, i, s, u, d, c) => {
    let p, m, g, b;
    if (t === "VALID" && (t = 0), typeof t == "number") {
      p = { top: t, bottom: t, left: t, right: t, front: t, back: t };
      let y = kd([e, r, n, 1], [u, d, c], 1, [o, i, s], t);
      m = y[0], g = y[1], b = y[2];
    } else if (Array.isArray(t)) {
      if (!t.every((w, S, x) => w === x[0])) throw Error(`Unsupported padding parameter: ${t}`);
      p = { top: t[0], bottom: t[1], left: t[2], right: t[3], front: t[4], back: t[5] };
      let y = kd([e, r, n, 1], [u, d, c], 1, [o, i, s], t[0]);
      m = y[0], g = y[1], b = y[2];
    } else if (t === "SAME_UPPER") {
      m = Math.ceil(e / o), g = Math.ceil(r / i), b = Math.ceil(n / s);
      let y = (m - 1) * o + u - e, w = (g - 1) * i + d - r, S = (b - 1) * s + c - n, x = Math.floor(y / 2), $ = y - x, T = Math.floor(w / 2), I = w - T, E = Math.floor(S / 2), A = S - E;
      p = { top: T, bottom: I, left: E, right: A, front: x, back: $ };
    } else throw Error(`Unknown padding parameter: ${t}`);
    return { padInfo: p, outDepth: m, outHeight: g, outWidth: b };
  }, Pd = (t, e, r, n, o, i = false, s = "channelsLast") => {
    let u, d, c, p, m;
    if (s === "channelsLast") [u, d, c, p, m] = t;
    else if (s === "channelsFirst") [u, m, d, c, p] = t;
    else throw new Error(`Unknown dataFormat ${s}`);
    let [g, , b, y, w] = e, [S, x, $] = Ed(r), [T, I, E] = Ed(n), A = un$1(b, T), z2 = un$1(y, I), v = un$1(w, E), { padInfo: M, outDepth: N, outHeight: K, outWidth: q } = qh(o, d, c, p, S, x, $, A, z2, v), Q = i ? g * m : g, D = [0, 0, 0, 0, 0];
    return s === "channelsFirst" ? D = [u, Q, N, K, q] : s === "channelsLast" && (D = [u, N, K, q, Q]), { batchSize: u, dataFormat: s, inDepth: d, inHeight: c, inWidth: p, inChannels: m, outDepth: N, outHeight: K, outWidth: q, outChannels: Q, padInfo: M, strideDepth: S, strideHeight: x, strideWidth: $, filterDepth: b, filterHeight: y, filterWidth: w, effectiveFilterDepth: A, effectiveFilterHeight: z2, effectiveFilterWidth: v, dilationDepth: T, dilationHeight: I, dilationWidth: E, inShape: t, outShape: D, filterShape: e };
  }, Od = (t, e, r, n, o, i) => {
    let s = i === "channelsLast";
    s ? t[0].dims[3] : t[0].dims[1];
    let c = [64, 1, 1], p = { x: r.map(($, T) => T) }, m = [Math.ceil(Hh(p.x.map(($) => r[$])) / c[0]), 1, 1];
    se("verbose", () => `[conv3d_naive_webgpu] dispatch = ${m}`);
    let g = 1, b = k.size(r), y = [{ type: 12, data: b }, { type: 12, data: n }, { type: 12, data: o }, { type: 12, data: e.strides }, { type: 12, data: e.dilations }];
    Qe$1(e, y), y.push(...L(t[0].dims, t[1].dims));
    let w = ["rank", "rank"], S = t.length === 3;
    S && (y.push(...L(t[2].dims)), w.push("rank")), y.push(...L(r));
    let x = ($) => {
      let T = [{ name: "output_size", type: "u32" }, { name: "filter_dims", type: "u32", length: n.length }, { name: "pads", type: "u32", length: o.length }, { name: "strides", type: "u32", length: e.strides.length }, { name: "dilations", type: "u32", length: e.dilations.length }];
      Ye(e, T);
      let I = 1, E = be$1(t[0].dataType), A = O("x", t[0].dataType, t[0].dims.length, g), z2 = O("W", t[1].dataType, t[1].dims.length, I), v = [A, z2], M = R("result", t[0].dataType, r.length, I), N = "";
      if (S) {
        let Q = O("bias", t[2].dataType, t[2].dims.length, I);
        v.push(Q), N += `
        fn getBiasByOutputCoords(coords : array<u32, 5>) -> ${E} {
          return bias[${s ? F$1("coords", 4, 5) : F$1("coords", 1, 5)}${""}];
        }`;
      }
      let K = Ee$1(g, E), q = Ze(e, K, E);
      return `
            ${N}
            fn getX(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${A.getByIndices("aIndices")};
            }
            fn getW(d0 : u32, d1 : u32, d2 : u32, d3 : u32, d4 : u32) -> f32 {
              let aIndices = array<u32, 5>(d0, d1, d2, d3, d4);
              return ${z2.getByIndices("aIndices")};
            }
          ${$.registerUniforms(T).declareVariables(...v, M)}
          ${$.mainStart()}
          ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
              let coords = ${M.offsetToIndices("global_idx")};
              let batch = ${F$1("coords", 0, A.rank)};
              let d2 = ${s ? F$1("coords", A.rank - 1, A.rank) : F$1("coords", 1, A.rank)};
              let xFRCCorner = vec3<u32>(${s ? F$1("coords", 1, A.rank) : F$1("coords", 2, A.rank)},
              ${s ? F$1("coords", 2, A.rank) : F$1("coords", 3, A.rank)},
              ${s ? F$1("coords", 3, A.rank) : F$1("coords", 4, A.rank)}) * uniforms.strides - uniforms.pads;
              let xFCorner = xFRCCorner.x;
              let xRCorner = xFRCCorner.y;
              let xCCorner = xFRCCorner.z;
              let xShapeY = ${s ? F$1("uniforms.x_shape", 1, A.rank) : F$1("uniforms.x_shape", 2, A.rank)};
              let xShapeZ = ${s ? F$1("uniforms.x_shape", 2, A.rank) : F$1("uniforms.x_shape", 3, A.rank)};
              let xShapeW = ${s ? F$1("uniforms.x_shape", 3, A.rank) : F$1("uniforms.x_shape", 4, A.rank)};
              let xShapeU = ${s ? F$1("uniforms.x_shape", 4, A.rank) : F$1("uniforms.x_shape", 1, A.rank)};
              let inputDepthNearestVec4 = (xShapeU / 4) * 4;
              let inputDepthVec4Remainder = xShapeU % 4;

              var value = 0.0;
              for (var wF = 0u; wF < uniforms.filter_dims[0]; wF++) {
                let xF = xFCorner + wF * uniforms.dilations[0];
                if (xF < 0 || xF >= xShapeY) {
                  continue;
                }

                for (var wR = 0u; wR < uniforms.filter_dims[1]; wR++) {
                  let xR = xRCorner + wR * uniforms.dilations[1];
                  if (xR < 0 || xR >= xShapeZ) {
                    continue;
                  }

                  for (var wC = 0u; wC < uniforms.filter_dims[2]; wC++) {
                    let xC = xCCorner + wC * uniforms.dilations[2];
                    if (xC < 0 || xC >= xShapeW) {
                      continue;
                    }

                    for (var d1 = 0u; d1 < inputDepthNearestVec4; d1 += 4) {
                      ${s ? `let xValues = vec4<f32>(
                               getX(batch, xF, xR, xC, d1),
                               getX(batch, xF, xR, xC, d1 + 1),
                               getX(batch, xF, xR, xC, d1 + 2),
                               getX(batch, xF, xR, xC, d1 + 3));
                            ` : `let xValues = vec4<f32>(
                               getX(batch, d1, xF, xR, xC),
                               getX(batch, d1 + 1, xF, xR, xC),
                               getX(batch, d1 + 2, xF, xR, xC),
                               getX(batch, d1 + 3, xF, xR, xC));
                            `}
                            let wValues = vec4<f32>(
                              getW(d2, d1, wF, wR, wC),
                              getW(d2, d1 + 1, wF, wR, wC),
                              getW(d2, d1 + 2, wF, wR, wC),
                              getW(d2, d1 + 3, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                    if (inputDepthVec4Remainder == 1) {
                        ${s ? `value += getX(batch, xF, xR, xC, inputDepthNearestVec4)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);` : `value += getX(batch, inputDepthNearestVec4, xF, xR, xC)
                          * getW(d2, inputDepthNearestVec4, wF, wR, wC);`}
                    } else if (inputDepthVec4Remainder == 2) {
                      ${s ? `let xValues = vec2<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1));
                      ` : `let xValues = vec2<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC));
                    `}
                    let wValues = vec2<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC));
                      value += dot(xValues, wValues);
                    } else if (inputDepthVec4Remainder == 3) {
                      ${s ? `let xValues = vec3<f32>(
                        getX(batch, xF, xR, xC, inputDepthNearestVec4),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1),
                        getX(batch, xF, xR, xC, inputDepthNearestVec4 + 2));
                      ` : `let xValues = vec3<f32>(
                        getX(batch, inputDepthNearestVec4, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 1, xF, xR, xC),
                        getX(batch, inputDepthNearestVec4 + 2, xF, xR, xC));
                    `}
                    let wValues = vec3<f32>(
                      getW(d2, inputDepthNearestVec4, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 1, wF, wR, wC),
                      getW(d2, inputDepthNearestVec4 + 2, wF, wR, wC));
                      value += dot(xValues, wValues);
                    }
                  }
                }
              }
              ${S ? "value = value + getBiasByOutputCoords(coords)" : ""};
              ${q}
              result[global_idx] = f32(value);
          }`;
    };
    return { name: "Conv3DNaive", shaderCache: { hint: `${e.cacheKey};${s};${g};${S}`, inputDependencies: w }, getRunData: () => ({ outputs: [{ dims: r, dataType: t[0].dataType }], dispatchGroup: { x: m[0], y: m[1], z: m[2] }, programUniforms: y }), getShaderSource: x };
  };
});
var Dd, Bd, Md = V$1(() => {
  J();
  ne();
  ae();
  St();
  Dd = (t, e, r, n) => {
    let o = t.length > 2, i = o ? "value += b[output_channel];" : "", s = t[0].dims, u = t[1].dims, d = e.format === "NHWC", c = d ? r[3] : r[1], p = c / e.group, m = d && p >= 4 ? fe(c) : 1, g = k.size(r) / m, b = [{ type: 12, data: g }, { type: 12, data: e.dilations }, { type: 12, data: [e.strides[0], e.strides[1]] }, { type: 12, data: [e.pads[0], e.pads[1]] }, { type: 12, data: p }];
    Qe$1(e, b), b.push(...L(s, [u[0], u[1], u[2], u[3] / m]));
    let y = o ? ["rank", "rank", "rank"] : ["rank", "rank"];
    b.push(...L([r[0], r[1], r[2], r[3] / m]));
    let w = (S) => {
      let x = R("output", t[0].dataType, r.length, m), $ = be$1(x.type.tensor), T = Ze(e, x.type.value, $), I = O("x", t[0].dataType, s.length), E = O("w", t[1].dataType, u.length, m), A = [I, E];
      o && A.push(O("b", t[2].dataType, t[2].dims, m));
      let z2 = [{ name: "output_size", type: "u32" }, { name: "dilations", type: "u32", length: e.dilations.length }, { name: "strides", type: "u32", length: 2 }, { name: "pads", type: "u32", length: 2 }, { name: "output_channels_per_group", type: "u32" }];
      Ye(e, z2);
      let v = d ? `
      for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[0]; wHeight++) {
        let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

        if (xHeight < 0u || xHeight >= uniforms.x_shape[1]) {
          continue;
        }

        for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[1]; wWidth++) {
          let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
          if (xWidth < 0u || xWidth >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[2]; wInChannel++) {
            let input_channel = in_channel_offset + wInChannel;
            let xVal = ${I.get("batch", "xHeight", "xWidth", "input_channel")};
            let wVal = ${E.get("wHeight", "wWidth", "wInChannel", "output_channel")};
            value += xVal * wVal;
          }
        }
      }
      ` : `
      for (var wInChannel: u32 = 0u; wInChannel < uniforms.w_shape[1]; wInChannel++) {
        let input_channel = in_channel_offset + wInChannel;
        for (var wHeight: u32 = 0u; wHeight < uniforms.w_shape[2]; wHeight++) {
          let xHeight = xRCCorner.x + wHeight * uniforms.dilations[0];

          if (xHeight < 0u || xHeight >= uniforms.x_shape[2]) {
            continue;
          }

          for (var wWidth: u32 = 0u; wWidth < uniforms.w_shape[3]; wWidth++) {
            let xWidth = xRCCorner.y + wWidth * uniforms.dilations[1];
            if (xWidth < 0u || xWidth >= uniforms.x_shape[3]) {
              continue;
            }

            let xVal = ${I.get("batch", "input_channel", "xHeight", "xWidth")};
            let wVal = ${E.get("output_channel", "wInChannel", "wHeight", "wWidth")};
            value += xVal * wVal;
          }
        }
      }
      `;
      return `
  ${S.registerUniforms(z2).declareVariables(...A, x)}

  ${S.mainStart()}
    ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let outputIndices = ${x.offsetToIndices("global_idx")};
    let batch: u32 = outputIndices[0];
    let output_channel: u32 = outputIndices[${d ? 3 : 1}];
    let xRCCorner: vec2<u32> = vec2<u32>(outputIndices[${d ? 1 : 2}], outputIndices[${d ? 2 : 3}]) * uniforms.strides - uniforms.pads;
    let group_id: u32 = output_channel * ${m} / uniforms.output_channels_per_group;
    var in_channel_offset = group_id * uniforms.w_shape[${d ? 2 : 1}];

    var value: ${x.type.value} = ${x.type.value}(0);
    ${v}
    ${i}
    ${T}
    ${x.setByOffset("global_idx", "value")}
  }`;
    };
    return { name: "GroupedConv", shaderCache: { hint: `${e.cacheKey}_${m}`, inputDependencies: y }, getRunData: () => ({ outputs: [{ dims: n ? n(r) : r, dataType: t[0].dataType }], dispatchGroup: { x: Math.ceil(g / 64) }, programUniforms: b }), getShaderSource: w };
  }, Bd = (t, e, r, n) => {
    let o = t.length > 2, i = fe(r[3]), s = fe(r[2]), u = k.size(r) / i / s, d = [t[0].dims[0], t[0].dims[1], t[0].dims[2], t[0].dims[3] / i], c = [t[1].dims[0], t[1].dims[1], t[1].dims[2], t[1].dims[3] / i], p = [r[0], r[1], r[2], r[3] / i], m = [{ type: 12, data: u }, { type: 6, data: [e.strides[0], e.strides[1]] }, { type: 6, data: [e.pads[0], e.pads[1]] }];
    Qe$1(e, m), m.push(...L(d, c, p));
    let g = (s - 1) * e.strides[1] + c[1], b = (y) => {
      let w = R("output", t[0].dataType, p.length, i), S = be$1(w.type.tensor), x = Ze(e, w.type.value, S), $ = O("x", t[0].dataType, d.length, i), T = O("w", t[1].dataType, c.length, i), I = [$, T];
      o && I.push(O("b", t[2].dataType, t[2].dims, i));
      let E = o ? "value += b[output_channel];" : "", A = [{ name: "output_size", type: "u32" }, { name: "strides", type: "i32", length: 2 }, { name: "pads", type: "i32", length: 2 }];
      return Ye(e, A), `
  ${y.registerUniforms(A).declareVariables(...I, w)}
  ${y.mainStart()}
    ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let width0 = uniforms.output_shape[3];
    let output_channel = global_idx % width0;
    var index1 = global_idx / width0;
    let width1 = uniforms.output_shape[2] / ${s}u;
    let col = (index1 % width1) * ${s}u;
    index1 = index1 / width1;
    let row = index1 % uniforms.output_shape[1];
    let batch = index1 / uniforms.output_shape[1];

    let x_corner = vec2<i32>(i32(row), i32(col)) * uniforms.strides - uniforms.pads;

    var x_vals: array<${$.type.value}, ${g}>;
    var values: array<${w.type.value}, ${s}>;
    let input_channel = output_channel;
    // Use constant instead of uniform can give better performance for w's height/width.
    for (var w_height: u32 = 0u; w_height < ${c[0]}; w_height++) {
      let x_height = x_corner.x + i32(w_height);
      if (x_height >= 0 && u32(x_height) < uniforms.x_shape[1]) {
        for (var i = 0; i < ${g}; i++) {
          let x_width = x_corner.y + i;
          if (x_width >= 0 && u32(x_width) < uniforms.x_shape[2]) {
            x_vals[i] = ${$.get("batch", "u32(x_height)", "u32(x_width)", "input_channel")};
          } else {
            x_vals[i] = ${$.type.value}(0);
          }
        }
        for (var w_width: u32 = 0u; w_width < ${c[1]}; w_width++) {
          let w_val = ${T.get("w_height", "w_width", "0", "output_channel")};
          for (var i = 0u; i < ${s}u; i++) {
            values[i] = fma(x_vals[i * u32(uniforms.strides[1]) + w_width], w_val, values[i]);
          }
        }
      }
    }

    for (var i = 0u; i < ${s}u; i++) {
      var value = values[i];
      ${E}
      ${x}
      ${w.set("batch", "row", "col + i", "output_channel", "value")};
    }
  }`;
    };
    return { name: "GroupedConv-Vectorize", shaderCache: { hint: `${e.cacheKey};${i};${s};${g};${c[0]};${c[1]}`, inputDependencies: o ? ["rank", "rank", "type"] : ["rank", "rank"] }, getRunData: () => ({ outputs: [{ dims: n ? n(r) : r, dataType: t[0].dataType }], dispatchGroup: { x: Math.ceil(u / 64) }, programUniforms: m }), getShaderSource: b };
  };
});
var Kh, xo, jh, So, To, Rd, Zh, Qh, Io, Ud = V$1(() => {
  ne();
  Ad();
  zd();
  sn$1();
  Md();
  St();
  an$1();
  pt();
  Kh = (t, e, r, n, o, i) => {
    let s = t[0], u = t.slice(i ? 1 : 2, i ? 3 : 4), d = u.length, c = e[0], m = e.slice(2).map((y, w) => y + (y - 1) * (r[w] - 1)), b = u.map((y, w) => y + n[w] + n[w + d]).map((y, w) => Math.floor((y - m[w] + o[w]) / o[w]));
    return b.splice(0, 0, s), b.splice(i ? 3 : 1, 0, c), b;
  }, xo = [2, 3, 1, 0], jh = (t, e) => {
    if (!t || t.length !== 2 && t.length !== 3) throw new Error("Conv requires 2 or 3 inputs");
    if (t[0].dims.length > 5) throw new Error("greater than 5D is not supported");
    if (t[0].dims.length !== t[1].dims.length) throw new Error("filter does not have same dimension as input");
    let r = t[0].dims[e.format === "NHWC" ? t[0].dims.length - 1 : 1], n = t[1].dims[1] * e.group;
    if (r !== n) throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");
    if (t.length === 3 && (t[2].dims.length !== 1 || t[1].dims[0] !== t[2].dims[0])) throw new Error("invalid bias");
    let o = t[0].dims.length - 2;
    if (e.dilations.length !== o) throw new Error(`dilations should be ${o}D`);
    if (e.strides.length !== o) throw new Error(`strides should be ${o}D`);
    if (e.pads.length !== o * 2) throw new Error(`pads should be ${o * 2}D`);
    if (e.kernelShape.length !== 0 && e.kernelShape.length !== t[1].dims.length - 2) throw new Error("invalid kernel shape");
  }, So = (t, e) => {
    let r = t.kernelShape.slice();
    r.length < e[1].dims.length - 2 && r.push(...Array(e[1].dims.length - 2 - r.length).fill(0));
    for (let i = 2; i < e[1].dims.length; ++i) r[i - 2] === 0 && (r[i - 2] = e[1].dims[i]);
    let n = t.pads.slice();
    zt.adjustPadsBasedOnAutoPad(e[0].dims, t.strides, t.dilations, r, n, t.format === "NHWC", t.autoPad);
    let o = Object.assign({}, t);
    return Object.assign(o, { kernelShape: r, pads: n }), o;
  }, To = (t) => {
    let e = rn$1(t), r = t.format, n = ["NOTSET", "VALID", "SAME_UPPER", "SAME_LOWER"][t.auto_pad], o = t.dilations, i = t.group, s = t.kernel_shape, u = t.pads, d = t.strides, c = t.w_is_const();
    return { autoPad: n, format: r, dilations: o, group: i, kernelShape: s, pads: u, strides: d, wIsConst: c, ...e, cacheKey: `${t.format};${e.activation};` };
  }, Rd = (t, e, r, n) => {
    let o = r.format === "NHWC", i = Kh(e[0].dims, e[1].dims, r.dilations, r.pads, r.strides, o);
    if (r.group !== 1) {
      let A = [e[0]];
      if (o) {
        let v = t.kernelCustomData.wT ?? t.compute(Oe(e[1], xo), { inputs: [1], outputs: [r.wIsConst ? -2 : -1] })[0];
        r.wIsConst && !t.kernelCustomData.wT && (t.kernelCustomData.wT = v), A.push(v);
      } else A.push(e[1]);
      e.length === 3 && A.push(e[2]), !t.adapterInfo.isArchitecture("ampere") && o && e[1].dims[0] === r.group && e[1].dims[1] === 1 && r.dilations[0] === 1 && r.dilations[1] === 1 ? t.compute(Bd(A, r, i, n), { inputs: A }) : t.compute(Dd(A, r, i, n), { inputs: A });
      return;
    }
    let s = e.length === 3, u = e[0].dims[o ? 1 : 2], d = e[0].dims[o ? 2 : 3], c = e[0].dims[o ? 3 : 1], p = e[1].dims[2], m = e[1].dims[3], g = i[o ? 1 : 2], b = i[o ? 2 : 3], y = i[o ? 3 : 1], w = o && p === u && m === d && r.pads[0] === 0 && r.pads[1] === 0;
    if (w || p === 1 && m === 1 && r.dilations[0] === 1 && r.dilations[1] === 1 && r.strides[0] === 1 && r.strides[1] === 1 && r.pads[0] === 0 && r.pads[1] === 0) {
      let A = i[0], z2, v, M, N = [];
      if (o) {
        let Q = t.kernelCustomData.wT ?? t.compute(Oe(e[1], xo), { inputs: [1], outputs: [r.wIsConst ? -2 : -1] })[0];
        if (r.wIsConst && !t.kernelCustomData.wT && (t.kernelCustomData.wT = Q), w) {
          let D = u * d * c;
          z2 = e[0].reshape([1, A, D]), v = Q.reshape([1, D, y]), M = [1, A, y];
        } else z2 = e[0].reshape([A, u * d, c]), v = Q.reshape([1, c, y]), M = [A, g * b, y];
        N.push(z2), N.push(v);
      } else z2 = e[0].reshape([A, c, u * d]), v = e[1].reshape([1, y, c]), M = [A, y, g * b], N.push(v), N.push(z2);
      s && N.push(e[2]);
      let K = M[2], q = N[0].dims[N[0].dims.length - 1];
      K < 8 && q < 8 ? t.compute(on$1(N, r, i, M, o, n), { inputs: N }) : t.compute(ir$1(N, r, i, M, o, n), { inputs: N });
      return;
    }
    let S = true, x = t.kernelCustomData.wT ?? t.compute(Oe(e[1], xo), { inputs: [1], outputs: [r.wIsConst ? -2 : -1] })[0];
    r.wIsConst && !t.kernelCustomData.wT && (t.kernelCustomData.wT = x);
    let $ = [e[0], x];
    s && $.push(e[2]);
    let T = o ? g * b : y, I = o ? y : g * b, E = p * m * c;
    t.compute(Cd($, r, i, T, I, E, s, S, n), { inputs: $ });
  }, Zh = (t, e) => {
    let r = e.format === "NHWC", n = [t.inputs[0].reshape(r ? [t.inputs[0].dims[0], 1, t.inputs[0].dims[1], t.inputs[0].dims[2]] : [t.inputs[0].dims[0], t.inputs[0].dims[1], 1, t.inputs[0].dims[2]]), t.inputs[1].reshape([t.inputs[1].dims[0], t.inputs[1].dims[1], 1, t.inputs[1].dims[2]])];
    t.inputs.length === 3 && n.push(t.inputs[2]);
    let o = [0, e.pads[0], 0, e.pads[1]], i = [1].concat(e.strides), s = [1].concat(e.dilations), u = [1].concat(e.kernelShape), d = So({ ...e, pads: o, strides: i, dilations: s, kernelShape: u }, n);
    Rd(t, n, d, (c) => r ? [c[0], c[2], c[3]] : [c[0], c[1], c[3]]);
  }, Qh = (t, e, r) => {
    let n = r.format === "NHWC" ? "channelsLast" : "channelsFirst", o = So(r, e), i = r.autoPad === "NOTSET" ? r.pads : r.autoPad, s = Pd(e[0].dims, e[1].dims, r.strides, r.dilations, i, false, n);
    t.compute(Od(e, o, s.outShape, [s.filterDepth, s.filterHeight, s.filterWidth], [s.padInfo.front, s.padInfo.top, s.padInfo.left], n));
  }, Io = (t, e) => {
    if (jh(t.inputs, e), t.inputs[0].dims.length === 3) Zh(t, e);
    else if (t.inputs[0].dims.length === 5) Qh(t, t.inputs, e);
    else {
      let r = So(e, t.inputs);
      Rd(t, t.inputs, r);
    }
  };
});
var Nd, Vd = V$1(() => {
  J();
  nt();
  ne();
  ae();
  Nd = (t, e, r) => {
    let n = t.length > 2, o = e.outputShape, i = e.format === "NHWC", s = e.group, u = t[1].dims, d = u[2] / s, c = u[3], p = i ? fe(d) : 1, m = i && c === 1 && d >= 4, g = m ? Math.floor(d / 4) * 4 : Math.floor(d / p) * p, b = d - g, y = i ? fe(c) : 1, w = i ? c === 1 ? p : y : 1, S = k.size(o) / y, x = [Math.ceil(S / 64), 1, 1];
    se("verbose", () => `[conv2d_backprop_webgpu] dispatch = ${x}`);
    let $ = ["rank", "rank"], T = [e.strides[0], e.strides[1]], I = [e.kernelShape[i ? 1 : 2], e.kernelShape[i ? 2 : 3]], E = [e.dilations[0], e.dilations[1]], A = [I[0] + (e.dilations[0] <= 1 ? 0 : (e.kernelShape[i ? 1 : 2] - 1) * (e.dilations[0] - 1)), I[1] + (e.dilations[1] <= 1 ? 0 : (e.kernelShape[i ? 2 : 3] - 1) * (e.dilations[1] - 1))], z2 = [A[0] - 1 - Math.floor((e.pads[0] + e.pads[2]) / 2), A[1] - 1 - Math.floor((e.pads[1] + e.pads[3]) / 2)], v = [{ type: 12, data: S }, { type: 12, data: T }, { type: 12, data: I }, { type: 12, data: E }, { type: 12, data: A }, { type: 6, data: z2 }, { type: 12, data: g }, { type: 12, data: d }, { type: 12, data: c }, ...L(t[0].dims, t[1].dims)];
    n && (v.push(...L(t[2].dims)), $.push("rank")), v.push(...L(o));
    let M = (N) => {
      let K = [{ name: "output_size", type: "u32" }, { name: "strides", type: "u32", length: T.length }, { name: "filter_dims", type: "u32", length: I.length }, { name: "dilations", type: "u32", length: I.length }, { name: "effective_filter_dims", type: "u32", length: A.length }, { name: "pads", type: "i32", length: z2.length }, { name: "input_channels_per_group_int", type: "u32" }, { name: "input_channels_per_group", type: "u32" }, { name: "output_channels_per_group", type: "u32" }], q = be$1(t[0].dataType), Q = i ? 1 : 2, D = i ? 2 : 3, W = i ? 3 : 1, j = O("W", t[1].dataType, t[1].dims.length, w), Y = O("Dy", t[0].dataType, t[0].dims.length, p), Z = [Y, j];
      n && Z.push(O("bias", t[2].dataType, [o[W]].length, y));
      let te = R("result", t[0].dataType, o.length, y), ie = () => {
        let re = "";
        if (m) p === 4 ? re += `
        let xValue = ${Y.getByOffset("x_offset")};
        let wValue = ${j.getByOffset("w_offset")};
        dotProd = dotProd + dot(xValue, wValue);
        x_offset += 1u;
        w_offset += 1u;` : p === 2 ? re += `
          dotProd = dotProd + dot(vec4<${q}>(${Y.getByOffset("x_offset")}, ${Y.getByOffset("x_offset + 1u")}), vec4<${q}>(${j.getByOffset("w_offset")}, ${j.getByOffset("w_offset + 1u")}));
          x_offset += 2u;
          w_offset += 2u;` : p === 1 && (re += `
          dotProd = dotProd + dot(vec4<${q}>(${Y.getByOffset("x_offset")}, ${Y.getByOffset("x_offset + 1u")}, ${Y.getByOffset("x_offset + 2u")}, ${Y.getByOffset("x_offset + 3u")}), vec4<${q}>(${j.getByOffset("w_offset")}, ${j.getByOffset("w_offset + 1u")}, ${j.getByOffset("w_offset + 2u")}, ${j.getByOffset("w_offset + 3u")}));
          x_offset += 4u;
          w_offset += 4u;`);
        else if (re += `
                  let xValue = ${i ? Y.getByOffset(`${Y.indicesToOffset(`${Y.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${p}`) : Y.get("batch", "inputChannel", "idyR", "idyC")};
        `, p === 1) re += `
          let w_offset = ${j.indicesToOffset(`${j.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel, wOutChannel)`)};
          let wValue = ${j.getByOffset(`w_offset / ${w}`)};
          dotProd = dotProd + xValue * wValue;`;
        else for (let U = 0; U < p; U++) re += `
            let wValue${U} = ${j.getByOffset(`${j.indicesToOffset(`${j.type.indices}(u32(wRPerm), u32(wCPerm), inputChannel + ${U}, wOutChannel)`)} / ${w}`)};
            dotProd = dotProd + xValue[${U}] * wValue${U};`;
        return re;
      }, we = () => {
        if (b === 0) return "";
        if (!m) throw new Error(`packInputAs4 ${m} is not true.`);
        let re = "";
        if (p === 1) {
          re += "dotProd = dotProd";
          for (let U = 0; U < b; U++) re += `
            + ${Y.getByOffset(`x_offset + ${U}`)} * ${j.getByOffset(`w_offset + ${U}`)}`;
          re += ";";
        } else if (p === 2) {
          if (b !== 2) throw new Error(`Invalid inputChannelsRemainder ${b}.`);
          re += `
          let xValue = ${Y.getByOffset("x_offset")};
          let wValue = ${j.getByOffset("w_offset")};
          dotProd = dotProd + dot(xValue, wValue);`;
        }
        return re;
      }, Te = `
            let outputIndices = ${te.offsetToIndices(`global_idx * ${y}`)};
            let batch = ${te.indicesGet("outputIndices", 0)};
            let d1 = ${te.indicesGet("outputIndices", W)};
            let r = ${te.indicesGet("outputIndices", Q)};
            let c = ${te.indicesGet("outputIndices", D)};
            let dyCorner = vec2<i32>(i32(r), i32(c)) - uniforms.pads;
            let dyRCorner = dyCorner.x;
            let dyCCorner = dyCorner.y;
            let groupId = d1 / uniforms.output_channels_per_group;
            let wOutChannel = d1 - groupId * uniforms.output_channels_per_group;
            // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
            // ? = to be determined. : = across all values in that axis.
            var dotProd = ${te.type.value}(0.0);
            var wR: u32 = 0;
            if (uniforms.dilations.x == 1) {
              // Minimum wR >= 0 that satisfies (dyRCorner + wR) % (uniforms.strides.x) == 0
              wR = u32(((dyRCorner + i32(uniforms.strides.x) - 1) / i32(uniforms.strides.x)) * i32(uniforms.strides.x) - dyRCorner);
            }
            for (; wR < uniforms.effective_filter_dims.x; wR = wR + 1) {
              if (wR % uniforms.dilations.x != 0) {
                continue;
              }
              let dyR = (${q}(dyRCorner) + ${q}(wR)) / ${q}(uniforms.strides[0]);
              let wRPerm = uniforms.filter_dims.x - 1 - wR / uniforms.dilations.x;
              if (dyR < 0.0 || dyR >= ${q}(uniforms.Dy_shape[${Q}]) || fract(dyR) > 0.0 ||
                  wRPerm < 0) {
                continue;
              }
              let idyR: u32 = u32(dyR);
              var wC: u32 = 0;
              if (uniforms.dilations.y == 1) {
                // Minimum wC >= 0 that satisfies (dyCCorner + wC) % (uniforms.strides.y) == 0
                wC = u32(((dyCCorner + i32(uniforms.strides.y) - 1) / i32(uniforms.strides.y)) * i32(uniforms.strides.y) - dyCCorner);
              }
              for (; wC < uniforms.effective_filter_dims.y; wC = wC + 1) {
                if (wC % uniforms.dilations.y != 0) {
                  continue;
                }
                let dyC = (${q}(dyCCorner) + ${q}(wC)) / ${q}(uniforms.strides.y);
                let wCPerm = uniforms.filter_dims.y - 1 - wC / uniforms.dilations.y;
                if (dyC < 0.0 || dyC >= ${q}(uniforms.Dy_shape[${D}]) ||
                    fract(dyC) > 0.0 || wCPerm < 0) {
                  continue;
                }
                let idyC: u32 = u32(dyC);
                var inputChannel = groupId * uniforms.input_channels_per_group;
                ${m ? `
                var x_offset = ${Y.indicesToOffset(`${Y.type.indices}(batch, idyR, idyC, inputChannel)`)} / ${p};
                var w_offset = ${j.indicesToOffset(`${j.type.indices}(wRPerm, wCPerm, inputChannel, wOutChannel)`)} / ${w};
                  ` : ""}
                for (var d2: u32 = 0; d2 < uniforms.input_channels_per_group_int; d2 = d2 + ${m ? 4 : p}) {
                  ${ie()}
                  inputChannel = inputChannel + ${m ? 4 : p};
                }
                ${we()}
                wC = wC + uniforms.strides.y - 1;
              }
              wR = wR + uniforms.strides[0] - 1;
            }
            let value = dotProd${n ? ` + bias[d1 / ${y}]` : ""};
            ${te.setByOffset("global_idx", "value")};
          `;
      return `
    ${N.registerUniforms(K).declareVariables(...Z, te)}
      ${N.mainStart()}
      ${N.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")};
    ${Te}}`;
    };
    return { name: "ConvTranspose2D", shaderCache: { hint: `${e.cacheKey};${p}${w}${y}${m}${b}`, inputDependencies: $ }, getRunData: () => ({ dispatchGroup: { x: x[0], y: x[1], z: x[2] }, outputs: [{ dims: r ? r(o) : o, dataType: t[0].dataType }], programUniforms: v }), getShaderSource: M };
  };
});
var Yh, Xh, Jh, Ld, Wd, eg, Gd, tg, Hd, Fd = V$1(() => {
  Vd();
  St();
  pt();
  Yh = (t, e, r, n, o, i) => (t - 1) * e + r + (n - 1) * o + 1 - i, Xh = (t, e, r, n, o) => {
    let i = Math.floor(t / 2);
    e === "SAME_UPPER" ? (r[n] = i, r[o] = t - i) : e === "SAME_LOWER" && (r[n] = t - i, r[o] = i);
  }, Jh = (t, e, r, n, o, i, s, u, d, c) => {
    let p = t.length - 2, m = c.length === 0;
    d.length < p && d.push(...Array(p - d.length).fill(0));
    let g = t[0], b = e[u ? 3 : 1] * o;
    for (let y = 0, w = t.length - p - (u ? 1 : 0); y < p; ++y, ++w) {
      let S = t[w], x = m ? S * s[y] : c[y], $ = Yh(S, s[y], i[y], e[w], r[y], x);
      Xh($, n, i, y, y + p), m && c.push(s[y] * (S - 1) + d[y] + (e[w] - 1) * r[y] + 1 - i[y] - i[y + p]);
    }
    c.splice(0, 0, g), c.splice(u ? 3 : 1, 0, b);
  }, Ld = (t, e) => {
    let r = t.kernelShape.slice();
    if (t.kernelShape.length === 0 || t.kernelShape.reduce((m, g) => m * g, 1) === 0) {
      r.length = 0;
      for (let m = 2; m < e[1].dims.length; ++m) r.push(e[1].dims[m]);
    }
    let n = t.format === "NHWC";
    r.splice(0, 0, e[1].dims[0]), r.splice(n ? 3 : 1, 0, e[1].dims[1]);
    let o = t.pads.slice(), i = t.outputShape.slice(), s = t.outputPadding.slice(), u = e[0].dims, d = t.dilations.slice();
    if (d.reduce((m, g) => m + g, 0) === 0) {
      let m = e[0].dims.length - 2;
      d = new Array(m).fill(1);
    }
    let c = t.strides.slice();
    if (c.reduce((m, g) => m + g, 0) === 0) {
      let m = e[0].dims.length - 2;
      c = new Array(m).fill(1);
    }
    Jh(u, r, d, t.autoPad, t.group, o, c, n, s, i);
    let p = Object.assign({}, t);
    return Object.assign(p, { kernelShape: r, pads: o, outputPadding: s, outputShape: i, dilations: d, strides: c }), p;
  }, Wd = (t) => {
    let e = rn$1(t), r = t.format, n = ["NOTSET", "VALID", "SAME_UPPER", "SAME_LOWER"][typeof t.autoPad > "u" ? 0 : t.autoPad], o = t.dilations, i = t.group, s = t.kernelShape, u = t.pads, d = t.strides, c = t.wIsConst(), p = t.outputPadding, m = t.outputShape;
    return { autoPad: n, format: r, dilations: o, group: i, kernelShape: s, outputPadding: p, outputShape: m, pads: u, strides: d, wIsConst: c, ...e, cacheKey: `${t.format};${e.activation};` };
  }, eg = (t, e) => {
    if (!t || t.length !== 2 && t.length !== 3) throw new Error("Conv requires 2 or 3 inputs");
    if (t[0].dims.length !== 4 && t[0].dims.length !== 3) throw new Error("currently only support 2-dimensional conv");
    if (t[0].dims.length !== t[1].dims.length) throw new Error("filter does not have same dimension as input");
    let r = t[0].dims[e.format === "NHWC" ? t[0].dims.length - 1 : 1], n = t[1].dims[0];
    if (r !== n) throw new Error("FILTER_IN_CHANNEL should be equal to DATA_CHANNEL");
    let o = t[1].dims[1] * e.group;
    if (t.length === 3 && (t[2].dims.length !== 1 || t[2].dims[0] !== o)) throw new Error("invalid bias");
    let i = t[0].dims.length - 2;
    if (e.dilations.reduce((p, m) => p + m, 0) > 0 && e.dilations.length !== i) throw new Error(`dilations should be ${i}D`);
    if (e.strides.reduce((p, m) => p + m, 0) > 0 && e.strides.length !== i) throw new Error(`strides should be ${i}D`);
    if (e.pads.reduce((p, m) => p + m, 0) > 0 && e.pads.length !== i * 2) throw new Error(`pads should be ${i * 2}D`);
    if (e.outputPadding.length !== i && e.outputPadding.length !== 0) throw new Error(`output_padding should be ${i}D`);
    if (e.kernelShape.reduce((p, m) => p + m, 0) > 0 && e.kernelShape.length !== 0 && e.kernelShape.length !== t[1].dims.length - 2) throw new Error("invalid kernel shape");
    if (e.outputShape.length !== 0 && e.outputShape.length !== t[0].dims.length - 2) throw new Error("invalid output shape");
  }, Gd = (t, e, r, n) => {
    let o = t.kernelCustomData.wT ?? t.compute(Oe(e[1], [2, 3, 0, 1]), { inputs: [1], outputs: [r.wIsConst ? -2 : -1] })[0];
    r.wIsConst && !t.kernelCustomData.wT && (t.kernelCustomData.wT = o);
    let i = [e[0], o];
    e.length === 3 && i.push(e[2]), t.compute(Nd(i, r, n), { inputs: i });
  }, tg = (t, e) => {
    let r = e.format === "NHWC", n = [t.inputs[0].reshape(r ? [t.inputs[0].dims[0], 1, t.inputs[0].dims[1], t.inputs[0].dims[2]] : [t.inputs[0].dims[0], t.inputs[0].dims[1], 1, t.inputs[0].dims[2]]), t.inputs[1].reshape([t.inputs[1].dims[0], t.inputs[1].dims[1], 1, t.inputs[1].dims[2]])];
    t.inputs.length === 3 && n.push(t.inputs[2]);
    let o = e.kernelShape;
    (o.length === 0 || o[0] === 0) && (o = [t.inputs[1].dims[2]]);
    let i = e.dilations;
    (i.length === 0 || i[0] === 0) && (i = [1]);
    let s = e.strides;
    (s.length === 0 || s[0] === 0) && (s = [1]);
    let u = e.pads;
    u.length === 0 && (u = [0, 0]), u = [0, u[0], 0, u[1]], s = [1].concat(s), i = [1].concat(i), o = [1].concat(o);
    let d = e.outputPadding;
    d = [0].concat(d);
    let c = Ld({ ...e, pads: u, strides: s, dilations: i, kernelShape: o, outputPadding: d }, n);
    Gd(t, n, c, (p) => r ? [p[0], p[2], p[3]] : [p[0], p[1], p[3]]);
  }, Hd = (t, e) => {
    if (eg(t.inputs, e), t.inputs[0].dims.length === 3) tg(t, e);
    else {
      let r = Ld(e, t.inputs);
      Gd(t, t.inputs, r);
    }
  };
});
var rg, qd, Kd, jd = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  rg = (t, e, r, n) => {
    let o = k.size(e), i = e.length, s = O("input", t, i), u = R("output", t, i), d = r.dataType === 6 ? r.getInt32Array()[0] : Number(r.getBigInt64Array()[0]), c = k.normalizeAxis(d, i), p = (m) => {
      let g = ` i32(${s.indicesGet("inputIndices", "uniforms.axis")}) `, b = F$1("uniforms.input_shape", "uniforms.axis", i), y = n.reverse ? g + (n.exclusive ? " + 1" : "") : "0", w = n.reverse ? b : g + (n.exclusive ? "" : " + 1");
      return `
                ${m.registerUniform("outputSize", "u32").registerUniform("axis", "u32").declareVariables(s, u)}
                ${m.mainStart()}
                  ${m.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
                  var inputIndices = ${u.offsetToIndices("global_idx")};
                  var sum = ${u.type.value}(0);
                  let first : i32 = ${y};
                  let last : i32 = ${w};
                  for (var i : i32 = first; i < last; i++) {
                    ${s.indicesSet("inputIndices", "uniforms.axis", "u32(i)")};
                    sum = sum + ${s.getByIndices("inputIndices")};
                  }
                  ${u.setByOffset("global_idx", "sum")};
                }`;
    };
    return { name: "CumSum", shaderCache: { hint: n.cacheKey, inputDependencies: ["rank"] }, getRunData: () => ({ outputs: [{ dims: e, dataType: t }], dispatchGroup: { x: Math.ceil(o / 64) }, programUniforms: [{ type: 12, data: o }, { type: 12, data: c }, ...L(e, e)] }), getShaderSource: p };
  }, qd = (t, e) => {
    let r = t.inputs[0].dims, n = t.inputs[0].dataType, o = t.inputs[1];
    t.compute(rg(n, r, o, e), { inputs: [0] });
  }, Kd = (t) => {
    let e = t.exclusive === 1, r = t.reverse === 1;
    return ee$1({ exclusive: e, reverse: r });
  };
});
var ng, og, ig, Zd, Qd, Yd = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  ng = (t) => {
    if (!t || t.length !== 1) throw new Error("DepthToSpace requires 1 input.");
    if (t[0].dims.length !== 4) throw new Error("DepthToSpace requires 4D input.");
  }, og = (t, e, r, n) => {
    let o = [];
    o.push(`fn perm(i: ${n.type.indices}) -> ${r.type.indices} {
    var a: ${r.type.indices};`);
    for (let i = 0; i < e; ++i) o.push(r.indicesSet("a", t[i], `i[${i}]`));
    return o.push("return a;}"), o.join(`
`);
  }, ig = (t, e) => {
    let r, n, o, i, s, u, d = e.format === "NHWC", c = e.blocksize, p = e.mode === "DCR";
    d ? ([r, n, o, i] = t.dims, s = p ? [r, n, o, c, c, i / c ** 2] : [r, n, o, i / c ** 2, c, c], u = p ? [0, 1, 3, 2, 4, 5] : [0, 1, 4, 2, 5, 3]) : ([r, n, o, i] = [t.dims[0], t.dims[2], t.dims[3], t.dims[1]], s = p ? [r, c, c, i / c ** 2, n, o] : [r, i / c ** 2, c, c, n, o], u = p ? [0, 3, 4, 1, 5, 2] : [0, 1, 4, 2, 5, 3]);
    let m = t.reshape(s), g = m.dims.length, b = t.dataType, y = O("a", b, g), w = R("output", b, g), S = (x) => `
  ${x.registerUniform("output_size", "u32").declareVariables(y, w)}

  ${og(u, g, y, w)}

  ${x.mainStart()}
    ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let indices = ${w.offsetToIndices("global_idx")};
    let aIndices = perm(indices);

    ${w.setByOffset("global_idx", y.getByIndices("aIndices"))}
  }`;
    return { name: "DepthToSpace", shaderCache: { hint: `${t.dims};${e.blocksize};${e.mode}`, inputDependencies: ["rank"] }, getRunData: (x) => {
      let $ = d ? [r, n * c, o * c, i / c ** 2] : [r, i / c ** 2, n * c, o * c], T = k.size($), I = m.dims, E = k.sortBasedOnPerm(I, u);
      return { outputs: [{ dims: $, dataType: x[0].dataType }], dispatchGroup: { x: Math.ceil(T / 64) }, programUniforms: [{ type: 12, data: T }, ...L(I, E)] };
    }, getShaderSource: S };
  }, Zd = (t, e) => {
    ng(t.inputs), t.compute(ig(t.inputs[0], e));
  }, Qd = (t) => ee$1({ blocksize: t.blocksize, mode: t.mode, format: t.format });
});
var Co, dn$1, Xd, ag, sg, Ao, Eo, Jd, ug, el, tl, rl = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  Co = "[a-zA-Z]|\\.\\.\\.", dn$1 = "(" + Co + ")+", Xd = "^" + dn$1 + "$", ag = "(" + dn$1 + ",)*" + dn$1, sg = "^" + ag + "$", Ao = class {
    constructor(e = -1) {
      this.symbolToIndices = /* @__PURE__ */ new Map(), this.inputIndex = e;
    }
    addSymbol(e, r) {
      let n = this.symbolToIndices.get(e);
      n === void 0 ? n = [r] : n.push(r), this.symbolToIndices.set(e, n);
    }
  }, Eo = class {
    constructor(e, r) {
      var _a2;
      this.equation = r;
      this.hasEllipsis = false, this.symbolToInfo = /* @__PURE__ */ new Map(), this.lhs = new Array(), this.outputDims = [];
      let [n, o] = r.includes("->") ? r.split("->", 2) : [r, ""];
      if (!n.match(RegExp(sg))) throw new Error("Invalid LHS term");
      if (n.split(",").forEach((u, d) => {
        let c = e[d].dims.slice();
        if (!u.match(RegExp(Xd))) throw new Error("Invalid LHS term");
        let p = this.processTerm(u, true, c, d);
        this.lhs.push(p);
      }), o === "") o += [...this.symbolToInfo.entries()].filter(([u, d]) => d.count === 1 || u === "...").map(([u]) => u).join("");
      else if (!o.match(RegExp(dn$1))) throw new Error("Invalid RHS");
      (_a2 = o.match(RegExp(Co, "g"))) == null ? void 0 : _a2.forEach((u) => {
        if (u === "...") this.outputDims = this.outputDims.concat(this.ellipsisDims);
        else {
          let d = this.symbolToInfo.get(u);
          if (d === void 0) throw new Error("Invalid RHS symbol");
          this.outputDims.push(d.dimValue);
        }
      }), this.rhs = this.processTerm(o, false, this.outputDims);
    }
    addSymbol(e, r, n) {
      let o = this.symbolToInfo.get(e);
      if (o !== void 0) {
        if (o.dimValue !== r && o.count !== 1) throw new Error("Dimension mismatch");
        o.count++, o.inputIndices.push(n);
      } else o = { count: 1, dimValue: r, inputIndices: [n] };
      this.symbolToInfo.set(e, o);
    }
    processTerm(e, r, n, o = -1) {
      let i = n.length, s = false, u = [], d = 0;
      if (!e.match(RegExp(Xd)) && !r && e !== "") throw new Error("Invalid LHS term");
      let c = e.match(RegExp(Co, "g")), p = new Ao(o);
      return c == null ? void 0 : c.forEach((m, g) => {
        if (m === "...") {
          if (s) throw new Error("Only one ellipsis is allowed per input term");
          s = true;
          let b = i - c.length + 1;
          if (b < 0) throw new Error("Ellipsis out of bounds");
          if (u = n.slice(d, d + b), this.hasEllipsis) {
            if (this.ellipsisDims.length !== u.length || this.ellipsisDims.toString() !== u.toString()) throw new Error("Ellipsis dimensions mismatch");
          } else if (r) this.hasEllipsis = true, this.ellipsisDims = u;
          else throw new Error("Ellipsis must be specified in the LHS");
          for (let y = 0; y < u.length; y++) {
            let w = String.fromCharCode(48 + y);
            p.addSymbol(w, g + y), this.addSymbol(w, n[d++], o);
          }
        } else p.addSymbol(m, g + (this.hasEllipsis ? this.ellipsisDims.length - 1 : 0)), this.addSymbol(m, n[d++], o);
      }), p;
    }
  }, Jd = (t) => t + "_max", ug = (t, e, r, n) => {
    let i = t.map((p) => p.length).map((p, m) => O(`input${m}`, e, p)), s = k.size(n), u = R("output", e, n.length), d = [...r.symbolToInfo.keys()].filter((p) => !r.rhs.symbolToIndices.has(p)), c = (p) => {
      let m = [], g = "var prod = 1.0;", b = "var sum = 0.0;", y = "sum += prod;", w = [], S = [], x = [], $ = [], T = r.symbolToInfo.size === r.rhs.symbolToIndices.size;
      r.symbolToInfo.forEach((E, A) => {
        var _a2;
        if (r.rhs.symbolToIndices.has(A)) {
          let z2 = (_a2 = r.rhs.symbolToIndices.get(A)) == null ? void 0 : _a2[0];
          z2 !== void 0 && r.lhs.forEach((v, M) => {
            if (E.inputIndices.includes(M)) {
              let N = v.symbolToIndices.get(A);
              if (N === void 0) throw new Error("Invalid symbol error");
              N.forEach((K) => {
                m.push(`${i[M].indicesSet(`input${M}Indices`, K, u.indicesGet("outputIndices", z2))}`);
              });
            }
          });
        } else r.lhs.forEach((z2, v) => {
          if (E.inputIndices.includes(v)) {
            let M = z2.symbolToIndices.get(A);
            if (M === void 0) throw new Error("Invalid symbol error");
            M.forEach((N) => {
              w.push(`${i[v].indicesSet(`input${v}Indices`, N, `${A}`)}`);
            }), $.push(`prod *= ${i[v].getByIndices(`input${v}Indices`)};`);
          }
        }), S.push(`for(var ${A}: u32 = 0; ${A} < uniforms.${Jd(A)}; ${A}++) {`), x.push("}");
      });
      let I = T ? [...m, `let sum = ${i.map((E, A) => E.getByIndices(`input${A}Indices`)).join(" * ")};`] : [...m, b, ...S, ...w, g, ...$, y, ...x];
      return `
            ${p.registerUniforms(d.map((E) => ({ name: `${Jd(E)}`, type: "u32" }))).registerUniform("outputSize", "u32").declareVariables(...i, u)}

            ${p.mainStart()}
            ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
            var outputIndices = ${u.offsetToIndices("global_idx")};
            ${i.map((E, A) => `var input${A}Indices: ${i[A].type.indices};`).join(`
`)}
            ${I.join(`
`)};
            ${u.setByOffset("global_idx", "sum")};
          }`;
    };
    return { name: "Einsum", shaderCache: { hint: r.equation, inputDependencies: t.map(() => "rank") }, getRunData: () => {
      let p = d.filter((g) => r.symbolToInfo.has(g)).map((g) => {
        var _a2;
        return { type: 12, data: ((_a2 = r.symbolToInfo.get(g)) == null ? void 0 : _a2.dimValue) || 0 };
      });
      p.push({ type: 12, data: s });
      let m = t.map((g, b) => [...L(g)]).reduce((g, b) => g.concat(b), p);
      return m.push(...L(n)), { outputs: [{ dims: n, dataType: e }], dispatchGroup: { x: Math.ceil(s / 64) }, programUniforms: m };
    }, getShaderSource: c };
  }, el = (t, e) => {
    let r = new Eo(t.inputs, e.equation), n = r.outputDims, o = t.inputs.map((i, s) => i.dims);
    t.compute(ug(o, t.inputs[0].dataType, r, n));
  }, tl = (t) => {
    let e = t.equation.replace(/\s+/g, "");
    return ee$1({ equation: e });
  };
});
var dg, nl, lg, cg, ol, il = V$1(() => {
  J();
  ne();
  ae();
  dg = (t) => {
    if (!t || t.length !== 2) throw new Error("Expand requires 2 input.");
    let e = t[0].dims, r = Array.from(t[1].getBigInt64Array(), Number), n = r.length < e.length ? 0 : r.length - e.length, o = e.length < r.length ? 0 : e.length - r.length;
    for (; n < r.length && o < e.length; ++n, ++o) if (r[n] !== e[o] && r[n] !== 1 && e[o] !== 1) throw new Error("Expand requires shape to be broadcastable to input");
  }, nl = (t, e) => {
    let r = t.length - e.length, n = [];
    for (let o = 0; o < r; ++o) n.push(t[o]);
    for (let o = 0; o < e.length; ++o) n.push(e[o] === 1 ? t[o + r] : e[o]);
    return n;
  }, lg = (t, e) => t.length > e.length ? nl(t, e) : nl(e, t), cg = (t) => {
    let e = t[0].dims, r = Array.from(t[1].getBigInt64Array(), Number), n = lg(e, r), o = t[0].dataType, i = o === 9 || k.size(e) === 1, s = o === 9 || e.length > 0 && e[e.length - 1] % 4 === 0 ? 4 : 1, u = i || n.length > 0 && n[n.length - 1] % 4 === 0 ? 4 : 1, d = Math.ceil(k.size(n) / u), c = (m) => {
      let g = O("input", o, e.length, s), b = R("output", o, n.length, u), y;
      if (o === 9) {
        let w = (S, x, $ = "") => `
          let outputIndices${x} = ${b.offsetToIndices(`outputOffset + ${x}u`)};
          let offset${x} = ${g.broadcastedIndicesToOffset(`outputIndices${x}`, b)};
          let index${x} = offset${x} / 4u;
          let component${x} = offset${x} % 4u;
          ${S}[${x}] = ${$}(${g.getByOffset(`index${x}`)}[component${x}]);
        `;
        y = `
        let outputOffset = global_idx * ${u};
        var data = vec4<u32>(0);
        ${w("data", 0, "u32")}
        ${w("data", 1, "u32")}
        ${w("data", 2, "u32")}
        ${w("data", 3, "u32")}
        ${b.setByOffset("global_idx", "data")}
      }`;
      } else y = `
        let outputIndices = ${b.offsetToIndices(`global_idx * ${u}`)};
        let inputOffset = ${g.broadcastedIndicesToOffset("outputIndices", b)};
        let data = ${b.type.value}(${g.getByOffset(`inputOffset / ${s}`)});
        ${b.setByOffset("global_idx", "data")}
      }`;
      return `
    ${m.registerUniform("vec_size", "u32").declareVariables(g, b)}
    ${m.mainStart()}
    ${m.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
    ${y}`;
    }, p = [{ type: 12, data: d }, ...L(e, n)];
    return { name: "Expand", shaderCache: { hint: `${n.length};${s}${u}`, inputDependencies: ["rank"] }, getShaderSource: c, getRunData: () => ({ outputs: [{ dims: n, dataType: t[0].dataType }], dispatchGroup: { x: Math.ceil(d / 64) }, programUniforms: p }) };
  }, ol = (t) => {
    dg(t.inputs), t.compute(cg(t.inputs), { inputs: [0] });
  };
});
var pg, al, sl = V$1(() => {
  J();
  ne();
  ae();
  tn$1();
  pg = (t) => {
    let e = t[0].dataType, r = k.size(t[0].dims), n = k.size(t[1].dims), o = n % 4 === 0, i = (s) => {
      let u = O("x", e, [1], 4), d = O("bias", e, [1], 4), c = R("y", e, [1], 4), p = [{ name: "output_vec_size", type: "u32" }, { name: "bias_size", type: "u32" }], m = (b) => `
      let bias${b}_offset: u32 = (global_idx * 4 + ${b}) % uniforms.bias_size;
      let bias${b} = ${d.getByOffset(`bias${b}_offset / 4`)}[bias${b}_offset % 4];`, g = o ? `
      let bias = ${d.getByOffset("global_idx % (uniforms.bias_size / 4)")};` : `${m(0)}${m(1)}${m(2)}${m(3)}
      let bias = ${u.type.value}(bias0, bias1, bias2, bias3);`;
      return `${s.registerUniforms(p).declareVariables(u, d, c)}

    ${wo(Pe(e))}

    ${s.mainStart(Dt)}
      ${s.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_vec_size")}

      let x = ${u.getByOffset("global_idx")};
      ${g}
      let x_in = x + bias;
      ${c.setByOffset("global_idx", _o("x_in"))}
    }`;
    };
    return { name: "FastGeluWithBias", shaderCache: { hint: `${o}`, inputDependencies: ["type", "type"] }, getShaderSource: i, getRunData: (s) => ({ outputs: [{ dims: s[0].dims, dataType: s[0].dataType }], programUniforms: [{ type: 12, data: Math.ceil(r / 4) }, { type: 12, data: n }], dispatchGroup: { x: Math.ceil(r / Dt / 4) } }) };
  }, al = (t) => {
    t.inputs.length < 2 || k.size(t.inputs[1].dims) === 0 ? rd(t) : t.compute(pg(t.inputs));
  };
});
var mg, fg, ul, dl, ll = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  mg = (t) => {
    if (!t || t.length !== 2) throw new Error("Gather requires 2 inputs.");
  }, fg = (t, e) => {
    let r = t[0].dims, n = t[1].dims, o = r.length, i = k.normalizeAxis(e.axis, o), s = r.slice(0);
    s.splice(i, 1, ...n);
    let u = r[i], d = t[0].dataType === 9 ? 4 : 1, c = Math.ceil(k.size(s) / d), p = [{ type: 12, data: c }, { type: 6, data: u }, { type: 12, data: i }, ...L(t[0].dims, t[1].dims, s)], m = (g) => {
      let b = O("data", t[0].dataType, t[0].dims.length, d), y = O("inputIndices", t[1].dataType, t[1].dims.length), w = R("output", t[0].dataType, s.length, d), S = ($) => {
        let T = n.length, I = `var indicesIndices${$}  = ${y.type.indices}(0);`;
        for (let E = 0; E < T; E++) I += `${T > 1 ? `indicesIndices${$}[${E}]` : `indicesIndices${$}`} = ${s.length > 1 ? `outputIndices${$}[uniforms.axis + ${E}]` : `outputIndices${$}`};`;
        I += `
          var idx${$} = ${y.getByIndices(`indicesIndices${$}`)};
          if (idx${$} < 0) {
            idx${$} = idx${$} + uniforms.axisDimLimit;
          }
          var dataIndices${$} : ${b.type.indices};
        `;
        for (let E = 0, A = 0; E < o; E++) E === i ? (I += `${o > 1 ? `dataIndices${$}[${E}]` : `dataIndices${$}`} = u32(idx${$});`, A += T) : (I += `${o > 1 ? `dataIndices${$}[${E}]` : `dataIndices${$}`} = ${s.length > 1 ? `outputIndices${$}[${A}]` : `outputIndices${$}`};`, A++);
        return I;
      }, x;
      if (t[0].dataType === 9) {
        let $ = (T, I, E = "") => `
          let outputIndices${I} = ${w.offsetToIndices(`outputOffset + ${I}u`)};
          ${S(I)};
          let offset${I} = ${b.indicesToOffset(`dataIndices${I}`)};
          let index${I} = offset${I} / 4u;
          let component${I} = offset${I} % 4u;
          ${T}[${I}] = ${E}(${b.getByOffset(`index${I}`)}[component${I}]);
        `;
        x = `
        let outputOffset = global_idx * ${d};
        var value = vec4<u32>(0);
        ${$("value", 0, "u32")}
        ${$("value", 1, "u32")}
        ${$("value", 2, "u32")}
        ${$("value", 3, "u32")}
        ${w.setByOffset("global_idx", "value")}
      `;
      } else x = `
      let outputIndices = ${w.offsetToIndices("global_idx")};
      ${S("")};
      let value = ${b.getByIndices("dataIndices")};
      ${w.setByOffset("global_idx", "value")};
      `;
      return `
      ${g.registerUniform("outputSize", "u32").registerUniform("axisDimLimit", "i32").registerUniform("axis", "u32").declareVariables(b, y, w)}
      ${g.mainStart()}
        ${g.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        ${x}
      }`;
    };
    return { name: "Gather", shaderCache: { hint: e.cacheKey, inputDependencies: ["rank", "rank"] }, getRunData: () => ({ outputs: [{ dims: s, dataType: t[0].dataType }], dispatchGroup: { x: Math.ceil(c / 64) }, programUniforms: p }), getShaderSource: m };
  }, ul = (t) => ee$1({ axis: t.axis }), dl = (t, e) => {
    let r = t.inputs;
    mg(r), t.compute(fg(t.inputs, e));
  };
});
var hg, cl, pl, ml = V$1(() => {
  J();
  ne();
  ae();
  hg = (t, e, r, n, o, i, s, u, d) => {
    let c = [{ type: 12, data: i }, { type: 12, data: n }, { type: 12, data: o }, { type: 12, data: r }, { type: 12, data: s }, { type: 12, data: u }, { type: 12, data: d }], p = [i];
    c.push(...L(e.dims, p));
    let m = (g) => {
      let b = O("indices_data", e.dataType, e.dims.length), y = R("input_slice_offsets_data", 12, 1, 1), w = [b, y], S = [{ name: "output_size", type: "u32" }, { name: "batch_dims", type: "u32" }, { name: "input_dims", type: "u32", length: o.length }, { name: "sizes_from_slice_dims_data", type: "u32", length: r.length }, { name: "num_slices_per_batch", type: "u32" }, { name: "input_batch_stride", type: "u32" }, { name: "num_slice_dims", type: "u32" }];
      return `
  ${g.registerUniforms(S).declareVariables(...w)}
  ${g.mainStart()}
    ${g.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let batch_idx = global_idx / uniforms.num_slices_per_batch;
    let base_offset = batch_idx * uniforms.input_batch_stride;

    let slice_indices_base_offset = global_idx * uniforms.num_slice_dims;
    var relative_slice_offset = 0;
    for (var dim_idx = 0u; dim_idx < uniforms.num_slice_dims; dim_idx ++) {
      var index = i32(indices_data[dim_idx + slice_indices_base_offset].x);
      let input_dim_idx = uniforms.batch_dims + dim_idx;
      if (index < 0) {
        ${o.length === 1 ? "index += i32(uniforms.input_dims);" : "index += i32(uniforms.input_dims[input_dim_idx]);"}
      }
      ${r.length === 1 ? "relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data);" : "relative_slice_offset += index * i32(uniforms.sizes_from_slice_dims_data[dim_idx]);"}
    }

    input_slice_offsets_data[global_idx] =  base_offset + u32(relative_slice_offset);
  }`;
    };
    return t.compute({ name: "computeSliceOffsets", shaderCache: { hint: `${o.length}_${r.length}`, inputDependencies: ["rank"] }, getRunData: () => ({ outputs: [{ dims: p, dataType: t.inputs[1].dataType }], dispatchGroup: { x: Math.ceil(i / 64) }, programUniforms: c }), getShaderSource: m }, { inputs: [e], outputs: [-1] })[0];
  }, cl = (t, e) => {
    let r = t.inputs, n = r[0].dims, o = r[0].dataType, i = r[1].dims, s = i[i.length - 1], u = k.sizeToDimension(i, i.length - 1), d = k.sizeFromDimension(n, e.batchDims + s), c = k.sizeToDimension(n, e.batchDims), p = k.sizeFromDimension(n, e.batchDims), m = u / c, g = new Array(s), b = d;
    for (let I = 0; I < s; ++I) g[s - 1 - I] = b, b *= n[e.batchDims + s - 1 - I];
    let y = hg(t, r[1], g, e.batchDims, n, u, m, p, s), w = e.batchDims + s;
    if (w > n.length) throw new Error("last dimension of indices must not be larger than rank of input tensor");
    let S = i.slice(0, -1).concat(n.slice(w)), x = k.size(S), $ = [{ type: 12, data: x }, { type: 12, data: d }, ...L(r[0].dims, y.dims, S)], T = (I) => {
      let E = O("data", r[0].dataType, r[0].dims.length), A = O("slice_offsets", 12, y.dims.length), z2 = R("output", r[0].dataType, S.length);
      return `
          ${I.registerUniform("output_size", "u32").registerUniform("slice_size", "u32").declareVariables(E, A, z2)}
            ${I.mainStart()}
            ${I.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let slice_offset = slice_offsets[global_idx / uniforms.slice_size];
          output[global_idx] = data[u32(slice_offset) + global_idx % uniforms.slice_size];
        }`;
    };
    t.compute({ name: "GatherND", shaderCache: { hint: e.cacheKey, inputDependencies: ["rank", "rank"] }, getRunData: () => ({ outputs: [{ dims: S, dataType: o }], dispatchGroup: { x: Math.ceil(x / 64) }, programUniforms: $ }), getShaderSource: T }, { inputs: [r[0], y] });
  }, pl = (t) => ({ batchDims: t.batch_dims, cacheKey: "" });
});
var gg, yg, fl, hl, gl = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  gg = (t, e) => {
    if (t.length < 3 || t.length > 4) throw new Error("GatherBlockQuantized requires 3 or 4 inputs.");
    let r = k.normalizeAxis(e.quantizeAxis, t[0].dims.length), n = e.blockSize, o = t[0], i = t[2], s = t.length === 4 ? t[3] : void 0;
    if (i.dims.length !== o.dims.length || !o.dims.map((u, d) => d === r ? Math.ceil(u / n) === i.dims[d] : u === i.dims[d]).reduce((u, d) => u && d, true)) throw new Error("Scales must have the same rank as the input tensor and the dims should match except on gatherAxis.");
    if (s) {
      if (s.dataType !== o.dataType) throw new Error("Zero point must have the same data type as the input tensor.");
      if (s.dims.length !== i.dims.length || !s.dims.map((u, d) => u === i.dims[d]).reduce((u, d) => u && d, true)) throw new Error("Zero point must have the same rank as the input tensor and the dims should match except on quantizeAxis.");
    }
  }, yg = (t, e) => {
    let r = t[0].dims, n = t[1].dims, o = r.length, i = k.normalizeAxis(e.gatherAxis, o), s = k.normalizeAxis(e.quantizeAxis, o), u = r.slice(0);
    u.splice(i, 1, ...n);
    let d = k.size(u), c = t[2].dataType, m = t[0].dataType === 22, g = [{ type: 12, data: d }, { type: 12, data: s }, { type: 12, data: i }, { type: 12, data: e.blockSize }, ...L(...t.map((y, w) => y.dims), u)], b = (y) => {
      let w = O("data", t[0].dataType, t[0].dims.length), S = O("inputIndices", t[1].dataType, t[1].dims.length), x = O("scales", t[2].dataType, t[2].dims.length), $ = t.length > 3 ? O("zeroPoint", t[3].dataType, t[3].dims.length) : void 0, T = R("output", c, u.length), I = [w, S, x];
      $ && I.push($);
      let E = [{ name: "output_size", type: "u32" }, { name: "quantize_axis", type: "u32" }, { name: "gather_axis", type: "u32" }, { name: "block_size", type: "u32" }];
      return `
        ${y.registerUniforms(E).declareVariables(...I, T)}
        ${y.mainStart()}
        let output_indices = ${T.offsetToIndices("global_idx")};
        var indices_indices = ${S.type.indices}(0);
        ${n.length > 1 ? `
          for (var i: u32 = 0; i < ${n.length}; i++) {
            let index = ${T.indicesGet("output_indices", "uniforms.gather_axis + i")};
            ${S.indicesSet("indices_indices", "i", "index")};
          }` : `indices_indices = ${T.indicesGet("output_indices", "uniforms.gather_axis")};`};
        var data_indices = ${w.type.indices}(0);
        for (var i: u32 = 0; i < uniforms.gather_axis; i++) {
          let index = ${T.indicesGet("output_indices", "i")};
          ${w.indicesSet("data_indices", "i", "index")};
        }
        var index_from_indices = ${S.getByIndices("indices_indices")};
        if (index_from_indices < 0) {
          index_from_indices += ${r[i]};
        }
        ${w.indicesSet("data_indices", "uniforms.gather_axis", "u32(index_from_indices)")};
        for (var i = uniforms.gather_axis + 1; i < ${u.length}; i++) {
          let index = ${T.indicesGet("output_indices", `i + ${n.length} - 1`)};
          ${w.indicesSet("data_indices", "i", "index")};
        }
        let data_offset = ${w.indicesToOffset("data_indices")};
        let data_index = data_offset % 8;
        // Convert 4-bit packed data to 8-bit packed data.
        let packed_4bit_quantized_data = ${w.getByOffset("data_offset / 8")};
        let packed_8bit_quantized_data = (packed_4bit_quantized_data >> (4 * (data_index % 2))) & 0x0f0f0f0f;
        let quantized_data_vec = ${m ? "unpack4xI8" : "unpack4xU8"}(u32(packed_8bit_quantized_data));
        let quantized_data = quantized_data_vec[data_index / 2];
        var scale_indices = data_indices;
        let quantize_axis_index = ${x.indicesGet("data_indices", "uniforms.quantize_axis")} / uniforms.block_size;
        ${x.indicesSet("scale_indices", "uniforms.quantize_axis", "quantize_axis_index")};
        var scale = ${x.getByIndices("scale_indices")};
        ${$ ? `
              let zero_point_indices = scale_indices;
              let zero_point_offset = ${$.indicesToOffset("zero_point_indices")};
              let zero_point_index = zero_point_offset % 8;
              let packed_4bit_zero_points = ${$.getByOffset("zero_point_offset / 8")};
              let packed_8bit_zero_points = (packed_4bit_zero_points >> (4 * (zero_point_index % 2))) & 0x0f0f0f0f;
              let zero_point_vec = ${m ? "unpack4xI8" : "unpack4xU8"}(u32(packed_8bit_zero_points));
              let zero_point = zero_point_vec[zero_point_index / 2];` : "var zero_point = 0"};
        let dequantized_data = ${Pe(c)}(quantized_data - zero_point) * scale;
        ${T.setByOffset("global_idx", "dequantized_data")};
    }`;
    };
    return { name: "GatherBlockQuantized", shaderCache: { hint: `${e.cacheKey};${t.filter((y, w) => w !== 1).map((y) => y.dims.join("_")).join(";")}`, inputDependencies: Array.from({ length: t.length }, (y, w) => "rank") }, getRunData: () => ({ outputs: [{ dims: u, dataType: c }], dispatchGroup: { x: Math.ceil(d / 64) }, programUniforms: g }), getShaderSource: b };
  }, fl = (t, e) => {
    let r = t.inputs;
    gg(r, e), t.compute(yg(t.inputs, e));
  }, hl = (t) => ee$1({ blockSize: t.blockSize, gatherAxis: t.gatherAxis, quantizeAxis: t.quantizeAxis });
});
var bg, wg, yl, bl, wl = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  bg = (t) => {
    if (!t || t.length !== 2) throw new Error("GatherElements requires 2 inputs.");
    if (t[0].dims.length < 1) throw new Error("GatherElements requires that the data input be rank >= 1.");
    if (t[0].dims.length !== t[1].dims.length) throw new Error(`GatherElements requires that the data input and
                     indices input tensors be of same rank.`);
  }, wg = (t, e) => {
    let r = t[0].dims, n = t[0].dataType, o = r.length, i = t[1].dims, s = t[1].dataType, u = k.normalizeAxis(e.axis, o), d = r[u], c = i.slice(0), p = k.size(c), m = O("input", n, o), g = O("indicesInput", s, i.length), b = R("output", n, c.length), y = [{ type: 12, data: p }, { type: 6, data: d }, { type: 12, data: u }];
    return y.push(...L(r, i, c)), { name: "GatherElements", shaderCache: { inputDependencies: ["rank", "rank"] }, getRunData: () => ({ outputs: [{ dims: c, dataType: t[0].dataType }], dispatchGroup: { x: Math.ceil(p / 64) }, programUniforms: y }), getShaderSource: (x) => `
      ${x.registerUniform("outputSize", "u32").registerUniform("axisDimLimit", "i32").registerUniform("axis", "u32").declareVariables(m, g, b)}
      ${x.mainStart()}
      ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

      let outputIndices = ${b.offsetToIndices("global_idx")};

      var idx = ${g.getByOffset("global_idx")};
      if (idx < 0) {
        idx = idx + uniforms.axisDimLimit;
      }
      var inputIndices = ${m.type.indices}(outputIndices);
      ${m.indicesSet("inputIndices", "uniforms.axis", "u32(idx)")};
      let value = ${m.getByIndices("inputIndices")};

      ${b.setByOffset("global_idx", "value")};
  }` };
  }, yl = (t) => ee$1({ axis: t.axis }), bl = (t, e) => {
    let r = t.inputs;
    bg(r), t.compute(wg(t.inputs, e));
  };
});
var _g, vg, _l, vl, $l = V$1(() => {
  J();
  ne();
  ae();
  _g = (t) => {
    if (!t) throw new Error("Input is missing");
    if (t.length < 2 || t.length > 3) throw new Error("Invaid input number.");
    if (t.length === 3 && t[2].dims.length > 2) throw new Error("Invalid input shape of C");
    if (t[0].dataType !== t[1].dataType || t.length === 3 && t[0].dataType !== t[2].dataType) throw new Error("Input types are mismatched");
  }, vg = (t, e) => {
    let r = t[0].dims.slice(), n = t[1].dims.slice(), [o, i, s] = Wr.getShapeOfGemmResult(r, e.transA, n, e.transB, t.length === 3 ? t[2].dims : void 0), u = [o, i];
    if (!u) throw new Error("Can't use gemm on the given tensors");
    let d = 16, c = Math.ceil(i / d), p = Math.ceil(o / d), m = true, g = k.size(u), b = [{ type: 12, data: m ? c : g }, { type: 12, data: o }, { type: 12, data: i }, { type: 12, data: s }, { type: 1, data: e.alpha }, { type: 1, data: e.beta }], y = ["type", "type"];
    t.length === 3 && (b.push(...L(t[2].dims)), y.push("rank")), b.push(...L(u));
    let w = (x) => {
      let $ = "";
      e.transA && e.transB ? $ = "value += a[k * uniforms.M + m] * b[n * uniforms.K + k];" : e.transA && !e.transB ? $ = "value += a[k * uniforms.M + m] * b[k * uniforms.N + n];" : !e.transA && e.transB ? $ = "value += a[m * uniforms.K + k] * b[n * uniforms.K + k];" : !e.transA && !e.transB && ($ = "value += a[m * uniforms.K + k] * b[k * uniforms.N + n];");
      let T = e.alpha === 1 ? "" : "value *= uniforms.alpha;", I = O("a", t[0].dataType, t[0].dims), E = O("b", t[1].dataType, t[1].dims), A = I.type.value, z2 = null, v = [I, E];
      t.length === 3 && (z2 = O("c", t[2].dataType, t[2].dims.length), v.push(z2));
      let M = R("output", t[0].dataType, u.length);
      v.push(M);
      let N = [{ name: "output_size", type: "u32" }, { name: "M", type: "u32" }, { name: "N", type: "u32" }, { name: "K", type: "u32" }, { name: "alpha", type: "f32" }, { name: "beta", type: "f32" }];
      return `
  ${x.registerUniforms(N).declareVariables(...v)}

  ${x.mainStart()}
    ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

    let m = global_idx / uniforms.N;
    let n = global_idx % uniforms.N;

    var value = ${A}(0);
    for (var k: u32 = 0u; k < uniforms.K; k++) {
      ${$}
    }

    ${T}
    ${z2 != null ? `let cOffset = ${z2.broadcastedIndicesToOffset("vec2(m, n)", M)}; value += ${A}(uniforms.beta) * ${z2.getByOffset("cOffset")};` : ""}
    output[global_idx] = value;
  }`;
    }, S = (x) => {
      let $ = O("a", t[0].dataType, t[0].dims), T = O("b", t[1].dataType, t[1].dims), I = null, E = [$, T];
      t.length === 3 && (I = O("c", t[2].dataType, t[2].dims.length), E.push(I));
      let A = R("output", t[0].dataType, u.length);
      E.push(A);
      let z2 = [{ name: "num_tile_n", type: "u32" }, { name: "M", type: "u32" }, { name: "N", type: "u32" }, { name: "K", type: "u32" }, { name: "alpha", type: "f32" }, { name: "beta", type: "f32" }], v = "", M = "";
      e.transA && e.transB ? (M = `
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${$.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${T.type.value}(0);
      }
      `, v = "value += tile_a[k][local_id.y] * tile_b[local_id.x][k];") : e.transA && !e.transB ? (M = `
      var col = tile_row_start + local_id.x;
      var row = k_start + local_id.y;
      if (col < uniforms.M && row < uniforms.K) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.M + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${$.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${T.type.value}(0);
      }
      `, v = "value += tile_a[k][local_id.y] * tile_b[k][local_id.x];") : !e.transA && e.transB ? (M = `
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${$.type.value}(0);
      }

      col = k_start + local_id.x;
      row = tile_col_start + local_id.y;
      if (col < uniforms.K && row < uniforms.N) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.K + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${T.type.value}(0);
      }
      `, v = "value += tile_a[local_id.y][k] * tile_b[local_id.x][k];") : !e.transA && !e.transB && (M = `
      var col = k_start + local_id.x;
      var row = tile_row_start + local_id.y;
      if (col < uniforms.K && row < uniforms.M) {
        tile_a[local_id.y][local_id.x] = a[row * uniforms.K + col];
      } else {
        tile_a[local_id.y][local_id.x] = ${$.type.value}(0);
      }

      col = tile_col_start + local_id.x;
      row = k_start + local_id.y;
      if (col < uniforms.N && row < uniforms.K) {
        tile_b[local_id.y][local_id.x] = b[row * uniforms.N + col];
      } else {
        tile_b[local_id.y][local_id.x] = ${T.type.value}(0);
      }
      `, v = "value += tile_a[local_id.y][k] * tile_b[k][local_id.x];");
      let N = e.alpha === 1 ? "" : "value *= uniforms.alpha;";
      return `
  ${x.registerUniforms(z2).declareVariables(...E)}
  var<workgroup> tile_a: array<array<${$.type.storage}, ${d}>, ${d}>;
  var<workgroup> tile_b: array<array<${T.type.storage}, ${d}>, ${d}>;
  ${x.mainStart([d, d, 1])}
    let tile_col_start = (workgroup_index % uniforms.num_tile_n) * ${d};
    let tile_row_start = (workgroup_index / uniforms.num_tile_n) * ${d};
    let num_tiles = (uniforms.K - 1) / ${d} + 1;
    var k_start = 0u;
    var value = ${A.type.value}(0);
    for (var t: u32 = 0u; t < num_tiles; t++) {
      ${M}
      k_start = k_start + ${d};
      workgroupBarrier();

      for (var k: u32 = 0u; k < ${d}; k++) {
        ${v}
      }
      workgroupBarrier();
    }

    ${N}
    let m = tile_row_start + local_id.y;
    let n = tile_col_start + local_id.x;
    ${I != null ? `let cOffset = ${I.broadcastedIndicesToOffset("vec2(m, n)", A)}; value += ${A.type.value}(uniforms.beta) * ${I.getByOffset("cOffset")};` : ""}
    if (m < uniforms.M && n < uniforms.N) {
      output[m * uniforms.N + n] = value;
    }
  }`;
    };
    return m ? { name: "GemmShared", shaderCache: { hint: `${e.cacheKey}`, inputDependencies: y }, getRunData: () => ({ outputs: [{ dims: u, dataType: t[0].dataType }], dispatchGroup: { x: c * p }, programUniforms: b }), getShaderSource: S } : { name: "Gemm", shaderCache: { hint: `${e.cacheKey}`, inputDependencies: y }, getRunData: () => ({ outputs: [{ dims: u, dataType: t[0].dataType }], dispatchGroup: { x: Math.ceil(g / 64) }, programUniforms: b }), getShaderSource: w };
  }, _l = (t) => {
    let e = t.transA, r = t.transB, n = t.alpha, o = t.beta;
    return { transA: e, transB: r, alpha: n, beta: o, cacheKey: `${t.transA};${t.transB};${t.alpha === 1}` };
  }, vl = (t, e) => {
    _g(t.inputs), t.compute(vg(t.inputs, e));
  };
});
var mt, Tt, Gt, Ht$1, $g, xg, Sg, Tg, Ig, Cg, Ag, Eg, xl, Sl, Tl = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  [mt, Tt, Gt, Ht$1] = [0, 1, 2, 3], $g = (t) => {
    if (t[0].dims.length !== 4) throw new Error("only 4-D tensor is supported.");
    if (t[0].dims.length !== t[1].dims.length) throw new Error("input dimensions must be equal to grid dimensions");
    if (t[0].dims.length - 2 !== t[1].dims[t[1].dims.length - 1]) throw new Error(`last dimension of grid must be equal to ${t[0].dims.length - 2}`);
    if (t[0].dims[0] !== t[1].dims[0]) throw new Error("grid batch size must match input batch size");
  }, xg = `
  fn gs_get_cubic_coeffs(x: f32) -> vec4<f32> {
    let cubic_alpha = -0.75f;
    let x_abs = abs(x);
    var coeffs: vec4<f32>;
    coeffs[0] = (((cubic_alpha * (x_abs + 1) - 5 * cubic_alpha) * (x_abs + 1) + 8 * cubic_alpha) * (x_abs + 1) - 4 * cubic_alpha);
    coeffs[1] = (((cubic_alpha + 2) * x_abs - (cubic_alpha + 3)) * x_abs * x_abs + 1);
    coeffs[2] = (((cubic_alpha + 2) * (1 - x_abs) - (cubic_alpha + 3)) * (1 - x_abs) * (1 - x_abs) + 1);
    coeffs[3] = (((cubic_alpha * (2 - x_abs) - 5 * cubic_alpha) * (2 - x_abs) + 8 * cubic_alpha) * (2 - x_abs) - 4 * cubic_alpha);
    return coeffs;
  }
`, Sg = (t) => `
  fn gs_bicubic_interpolate(p: mat4x4<${t}>, x: f32, y: f32) -> ${t} {
    var v: vec4<f32>;
    var coeffs = gs_get_cubic_coeffs(x);
    for (var i = 0; i < 4; i++) {
      v[i] = coeffs[0] * p[i][0] + coeffs[1] * p[i][1] + coeffs[2] * p[i][2] + coeffs[3] * p[i][3];
    }
    coeffs = gs_get_cubic_coeffs(y);
    let pixel = ${t}(coeffs[0] * v[0] + coeffs[1] * v[1] + coeffs[2] * v[2] + coeffs[3] * v[3]);
    return pixel;
  }
`, Tg = (t) => `
  fn gs_denormalize(n: f32, length: i32) -> f32 {
    ${t.alignCorners === 0 ? `
    // alignCorners: false => [-1, 1] to [-0.5, length - 0.5]
    return ((n + 1.0) * f32(length) - 1.0) / 2.0;
    ` : `
    // alignCorners: true => [-1, 1] to [0, length - 1]
    return (n + 1.0) / 2.0 * (f32(length - 1));
    `}
  }
`, Ig = (t) => `
  ${t.paddingMode === "reflection" ? `
      fn gs_reflect(x: i32, x_min: f32, x_max: f32) -> u32 {
        var dx = 0.0;
        var fx = f32(x);
        let range = x_max - x_min;
        if (fx < x_min) {
          dx = x_min - fx;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_min + r;
          } else {
            fx = x_max - r;
          }
        } else if (fx > x_max) {
          dx = fx - x_max;
          let n = u32(dx / range);
          let r = dx - f32(n) * range;
          if (n % 2 == 0) {
            fx = x_max - r;
          } else {
            fx = x_min + r;
          }
        }
        return u32(fx);
      }` : ""}
`, Cg = (t, e, r) => `
  fn pixel_at_grid(r: i32, c: i32, H: i32, W: i32, batch: u32, channel: u32, border: vec4<f32>) -> ${e} {
     var pixel = ${e}(0);
     var indices = vec4<u32>(0);
     indices[${mt}] = batch;
     indices[${Tt}] = channel;` + (() => {
    switch (r.paddingMode) {
      case "zeros":
        return `
          if (r >= 0 && r < H && c >=0 && c < W) {
            indices[${Gt}] = u32(r);
            indices[${Ht$1}] = u32(c);
          } else {
            return ${e}(0);
          }
        `;
      case "border":
        return `
          indices[${Gt}] = u32(clamp(r, 0, H - 1));
          indices[${Ht$1}] = u32(clamp(c, 0, W - 1));
        `;
      case "reflection":
        return `
          indices[${Gt}] = gs_reflect(r, border[1], border[3]);
          indices[${Ht$1}] = gs_reflect(c, border[0], border[2]);
        `;
      default:
        throw new Error(`padding mode ${r.paddingMode} is not supported`);
    }
  })() + `
    return ${t.getByIndices("indices")};
  }
`, Ag = (t, e, r) => (() => {
    switch (r.mode) {
      case "nearest":
        return `
          let result = pixel_at_grid(i32(round(y)), i32(round(x)), H_in, W_in, indices[${mt}], indices[${Tt}], border);
        `;
      case "bilinear":
        return `
          let x1 = i32(floor(x));
          let y1 = i32(floor(y));
          let x2 = x1 + 1;
          let y2 = y1 + 1;

          let p11 = pixel_at_grid(y1, x1, H_in, W_in, indices[${mt}], indices[${Tt}], border);
          let p12 = pixel_at_grid(y1, x2, H_in, W_in, indices[${mt}], indices[${Tt}], border);
          let p21 = pixel_at_grid(y2, x1, H_in, W_in, indices[${mt}], indices[${Tt}], border);
          let p22 = pixel_at_grid(y2, x2, H_in, W_in, indices[${mt}], indices[${Tt}], border);

          let dx2 = ${e}(f32(x2) - x);
          let dx1 = ${e}(x - f32(x1));
          let dy2 = ${e}(f32(y2) - y);
          let dy1 = ${e}(y - f32(y1));
          let result = dy2 * (dx2 * p11 + dx1 * p12) + dy1 * (dx2 * p21 + dx1 * p22);
        `;
      case "bicubic":
        return `
          let x0 = i32(floor(x)) - 1;
          let y0 = i32(floor(y)) - 1;
          var p: mat4x4<${e}>;
          for (var h = 0; h < 4; h++) {
            for (var w = 0; w < 4; w++) {
              p[h][w] = pixel_at_grid(h + y0, w + x0, H_in, W_in, indices[${mt}], indices[${Tt}], border);
            }
          }

          let dx = x - f32(x0 + 1);
          let dy = y - f32(y0 + 1);
          let result = gs_bicubic_interpolate(p, dx, dy);
        `;
      default:
        throw new Error(`mode ${r.mode} is not supported`);
    }
  })() + `${t.setByOffset("global_idx", "result")}`, Eg = (t, e) => {
    let r = O("x", t[0].dataType, t[0].dims.length), n = [t[1].dims[0], t[1].dims[1], t[1].dims[2]], o = O("grid", t[1].dataType, n.length, 2), i = [t[0].dims[0], t[0].dims[1], t[1].dims[1], t[1].dims[2]];
    e.format === "NHWC" && (i = [t[0].dims[0], t[1].dims[1], t[1].dims[2], t[0].dims[3]], [mt, Tt, Gt, Ht$1] = [0, 3, 1, 2]);
    let s = R("output", t[0].dataType, i.length), u = r.type.value, d = k.size(i), c = [{ type: 12, data: d }, ...L(t[0].dims, n, i)], p = (m) => `
  ${m.registerUniform("output_size", "u32").declareVariables(r, o, s)}
  ${xg}
  ${Sg(u)}
  ${Tg(e)}
  ${Ig(e)}
  ${Cg(r, u, e)}

  ${m.mainStart()}
    ${m.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let H_in = i32(uniforms.x_shape[${Gt}]);
      let W_in = i32(uniforms.x_shape[${Ht$1}]);

      ${e.alignCorners === 0 ? `
      let x_min = -0.5;
      let x_max = f32(W_in) - 0.5;
      let y_min = -0.5;
      let y_max = f32(H_in) - 0.5;
      ` : `
      let x_min = 0.0;
      let x_max = f32(W_in) - 1.0;
      let y_min = 0.0;
      let y_max = f32(H_in) - 1.0;
      `};
      let border = vec4<f32>(x_min, y_min, x_max, y_max);

      let indices = ${s.offsetToIndices("global_idx")};
      var grid_indices = vec3<u32>(indices[${mt}], indices[${Gt}], indices[${Ht$1}]);
      let nxy = ${o.getByIndices("grid_indices")};
      var x = gs_denormalize(f32(nxy[0]), W_in);
      var y = gs_denormalize(f32(nxy[1]), H_in);

      ${Ag(s, u, e)}
  }`;
    return { name: "GridSample", shaderCache: { hint: `${e.cacheKey}`, inputDependencies: ["type", "type"] }, getRunData: (m) => {
      let g = k.size(i);
      return { outputs: [{ dims: i, dataType: m[0].dataType }], dispatchGroup: { x: Math.ceil(g / 64) }, programUniforms: c };
    }, getShaderSource: p };
  }, xl = (t, e) => {
    $g(t.inputs), t.compute(Eg(t.inputs, e));
  }, Sl = (t) => ee$1({ alignCorners: t.align_corners, mode: t.mode, paddingMode: t.padding_mode, format: t.format });
});
var Re, Og, Cl, Il, zg, ar$1, Al, ko = V$1(() => {
  J();
  ne();
  Ie();
  jr();
  Jr$1();
  ae();
  pt();
  Re = (t, e) => t.length > e && t[e].dims.length > 0 ? t[e] : void 0, Og = (t, e) => {
    let r = t[0], n = Re(t, 1), o = Re(t, 2), i = Re(t, 3), s = Re(t, 4), u = Re(t, 5), d = Re(t, 6), c = Re(t, 7);
    if (r.dims.length !== 3 && r.dims.length !== 5) throw new Error("Input query is expected to have 3 or 5 dimensions");
    let p = r.dims[0], m = r.dims[1], g = r.dims.length === 3 ? r.dims[2] : e.numHeads * r.dims[4], b = m, y = 0, w = 0, S = Math.floor(g / e.numHeads);
    if (d && c && k.size(d.dims) && k.size(c.dims)) {
      if (d.dims.length !== 4) throw new Error('Input "past_key" is expected to have 4 dimensions');
      if (d.dims[0] !== p || d.dims[1] !== e.numHeads || d.dims[3] !== S) throw new Error('Input "past_key" shape (batch_size, num_heads, past_sequence_length, head_size)');
      if (c.dims[0] !== p || c.dims[1] !== e.numHeads || c.dims[3] !== S) throw new Error('Input "past_value" shape (batch_size, num_heads, past_sequence_length, head_size)');
      if (d.dims[2] !== c.dims[2]) throw new Error('Input "past_key" and "past_value" shall have same dim 2 (past_sequence_length)');
      if (c.dims.length !== 4) throw new Error('Input "past_value" is expected to have 4 dimensions');
      y = d.dims[2], w = d.dims[2];
    } else if (d && k.size(d.dims) || c && k.size(c.dims)) throw new Error('Input "past_key" and "past_value" shall be both present or both absent');
    let x;
    if (n && k.size(n.dims) > 0) {
      if (r.dims.length !== 3) throw new Error('Input "query" is expected to have 3 dimensions when key is given');
      if (n.dims.length < 3 || n.dims.length > 5) throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');
      if (r.dims[0] !== n.dims[0]) throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');
      if (n.dims.length === 3) {
        if (n.dims[2] !== r.dims[2]) throw new Error('Input "query" and "key" shall have same dim 2 (hidden_size)');
        x = 2, b = n.dims[1];
      } else if (n.dims.length === 5) {
        if (n.dims[2] !== e.numHeads || n.dims[3] !== 2 || n.dims[4] !== S) throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');
        if (o) throw new Error('Expect "value" be none when "key" has packed kv format.');
        x = 5, b = n.dims[1];
      } else {
        if (n.dims[1] !== e.numHeads || n.dims[3] !== S) throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');
        x = 0, b = n.dims[2];
      }
    } else {
      if (r.dims.length !== 5) throw new Error('Input "query" is expected to have 5 dimensions when key is empty');
      if (r.dims[2] !== e.numHeads || r.dims[3] !== 3) throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');
      x = 3;
    }
    if (i && k.size(i.dims) > 0) {
      if (i.dims.length !== 1) throw new Error('Input "bias" is expected to have 1 dimension');
      if (n && n.dims.length === 5 && n.dims[3] === 2) throw new Error("bias is not allowed for packed kv.");
    }
    let $ = y + b, T = 0;
    if (s && k.size(s.dims) > 0) {
      T = 8;
      let z2 = s.dims;
      throw z2.length === 1 ? z2[0] === p ? T = 1 : z2[0] === 3 * p + 2 && (T = 3) : z2.length === 2 && z2[0] === p && z2[1] === $ && (T = 5), T === 8 ? new Error('Input "key_padding_mask" shape shall be (batch_size) or (batch_size, total_sequence_length)') : new Error("Mask not supported");
    }
    let I = false, E = g;
    if (o && k.size(o.dims) > 0) {
      if (o.dims.length !== 3 && o.dims.length !== 4) throw new Error('Input "value" is expected to have 3 or 4 dimensions');
      if (r.dims[0] !== o.dims[0]) throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');
      if (o.dims.length === 3) {
        if (b !== o.dims[1]) throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');
        E = o.dims[2];
      } else {
        if (b !== o.dims[2]) throw new Error('Input "key" and "value" shall have the same dim 2 (kv_sequence_length)');
        E = o.dims[1] * o.dims[3], I = true;
      }
    }
    let A = false;
    if (s && k.size(s.dims) > 0) throw new Error("Key padding mask is not supported");
    if (u && k.size(u.dims) > 0) {
      if (u.dims.length !== 4) throw new Error('Input "attention_bias" is expected to have 4 dimensions');
      if (u.dims[0] !== p || u.dims[1] !== e.numHeads || u.dims[2] !== m || u.dims[3] !== $) throw new Error('Expect "attention_bias" shape (batch_size, num_heads, sequence_length, total_sequence_length)');
    }
    return { batchSize: p, sequenceLength: m, pastSequenceLength: y, kvSequenceLength: b, totalSequenceLength: $, maxSequenceLength: w, inputHiddenSize: 0, hiddenSize: g, vHiddenSize: E, headSize: S, vHeadSize: Math.floor(E / e.numHeads), numHeads: e.numHeads, isUnidirectional: false, pastPresentShareBuffer: false, maskFilterValue: e.maskFilterValue, maskType: T, scale: e.scale, broadcastResPosBias: A, passPastInKv: I, qkvFormat: x };
  }, Cl = (t) => ee$1({ ...t }), Il = ee$1({ perm: [0, 2, 1, 3] }), zg = (t, e, r, n, o, i, s) => {
    let u = [n, o, i], d = k.size(u), c = [{ type: 12, data: d }, { type: 12, data: s }, { type: 12, data: i }], p = (m) => {
      let g = R("qkv_with_bias", e.dataType, u), b = O("qkv", e.dataType, u), y = O("bias", r.dataType, u), w = [{ name: "output_size", type: "u32" }, { name: "bias_offset", type: "u32" }, { name: "hidden_size", type: "u32" }];
      return `
  ${m.registerUniforms(w).declareVariables(b, y, g)}
  ${m.mainStart()}
    ${m.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let bias_offset_idx = (global_idx % uniforms.hidden_size) + uniforms.bias_offset;

    qkv_with_bias[global_idx] = qkv[global_idx] + bias[bias_offset_idx];
  }`;
    };
    return t.compute({ name: "MultiHeadAttentionAddBias", shaderCache: { inputDependencies: ["type", "type"] }, getRunData: () => ({ outputs: [{ dims: u, dataType: e.dataType, gpuDataType: 0 }], dispatchGroup: { x: Math.ceil(d / 64) }, programUniforms: c }), getShaderSource: p }, { inputs: [e, r], outputs: [-1] })[0];
  }, ar$1 = (t, e, r, n, o, i, s, u) => {
    let d = i;
    if (s && k.size(s.dims) > 0) {
      if (n === 1) throw new Error("AddBiasReshape is not implemented. Please export your model with packed QKV or KV");
      return d = zg(t, i, s, e, n, r * o, u), d = d.reshape([e, n, r, o]), r === 1 || n === 1 ? d : t.compute(Oe(d, Il.perm), { inputs: [d], outputs: [-1] })[0];
    } else return i.dims.length === 3 && (d = i.reshape([e, n, r, o])), r === 1 || n === 1 ? d : t.compute(Oe(d, Il.perm), { inputs: [d], outputs: [-1] })[0];
  }, Al = (t, e) => {
    let r = Og(t.inputs, e), n = t.inputs[0], o = Re(t.inputs, 1), i = Re(t.inputs, 2), s = Re(t.inputs, 3), u = Re(t.inputs, 4), d = Re(t.inputs, 5), c = Re(t.inputs, 6), p = Re(t.inputs, 7);
    if (n.dims.length === 5) throw new Error("Packed QKV is not implemented");
    if ((o == null ? void 0 : o.dims.length) === 5) throw new Error("Packed KV is not implemented");
    let m = o && i && o.dims.length === 4 && i.dims.length === 4, g = ar$1(t, r.batchSize, r.numHeads, r.sequenceLength, r.headSize, n, s, 0);
    if (m) return Wt(t, g, o, i, u, void 0, c, p, d, r);
    if (!o || !i) throw new Error("key and value must be provided");
    let b = ar$1(t, r.batchSize, r.numHeads, r.kvSequenceLength, r.headSize, o, s, r.hiddenSize), y = ar$1(t, r.batchSize, r.numHeads, r.kvSequenceLength, r.vHeadSize, i, s, 2 * r.hiddenSize);
    Wt(t, g, b, y, u, void 0, c, p, d, r);
  };
});
var Dg, Bg, Mg, Rg, Po, El, kl, Oo = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  Dg = (t) => {
    if (!t || t.length < 1) throw new Error("too few inputs");
  }, Bg = (t, e) => {
    let r = [], n = e.numOutputs;
    return t[1].dims[0] > 0 && (t[1].getBigInt64Array().forEach((o) => r.push(Number(o))), n = r.length), ee$1({ numOutputs: n, axis: e.axis, splitSizes: r });
  }, Mg = (t) => `
fn calculateOutputIndex(index: u32) -> u32 {
    for (var i: u32 = 0u; i < ${t}u; i += 1u ) {
    if (index < ${F$1("uniforms.size_in_split_axis", "i", t)}) {
        return i;
    }
    }
    return ${t}u;
}`, Rg = (t) => {
    let e = t.length, r = [];
    for (let n = 0; n < e; ++n) {
      let o = t[n].setByIndices("indices", "input[global_idx]");
      e === 1 ? r.push(o) : n === 0 ? r.push(`if (output_number == ${n}u) { ${o} }`) : n === e - 1 ? r.push(`else { ${o} }`) : r.push(`else if (output_number == ${n}) { ${o} }`);
    }
    return `
      fn writeBufferData(output_number: u32, indices: ${t[0].type.indices}, global_idx: u32) {
        ${r.join(`
`)}
      }`;
  }, Po = (t, e) => {
    let r = t[0].dims, n = k.size(r), o = t[0].dataType, i = k.normalizeAxis(e.axis, r.length), s = new Array(e.numOutputs), u = O("input", o, r.length), d = new Array(e.numOutputs), c = [], p = [], m = 0, g = [{ type: 12, data: n }];
    for (let y = 0; y < e.numOutputs; y++) {
      m += e.splitSizes[y], d[y] = m;
      let w = r.slice();
      w[i] = e.splitSizes[y], p.push(w), s[y] = R(`output${y}`, o, w.length), c.push({ dims: p[y], dataType: t[0].dataType });
    }
    g.push({ type: 12, data: d }, ...L(r, ...p));
    let b = (y) => `
  ${y.registerUniform("input_size", "u32").registerUniform("size_in_split_axis", "u32", d.length).declareVariables(u, ...s)}
  ${Mg(d.length)}
  ${Rg(s)}

  ${y.mainStart()}
    ${y.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.input_size")}

    var indices = ${u.offsetToIndices("global_idx")};
    var index = ${u.indicesGet("indices", i)};
    let output_number = calculateOutputIndex(index);
    if (output_number != 0) {
      index -= ${F$1("uniforms.size_in_split_axis", "output_number - 1u", d.length)};
      ${u.indicesSet("indices", i, "index")};
    }
    writeBufferData(output_number, indices, global_idx);
  }`;
    return { name: "Split", shaderCache: { hint: e.cacheKey, inputDependencies: ["rank"] }, getShaderSource: b, getRunData: () => ({ outputs: c, dispatchGroup: { x: Math.ceil(n / 64) }, programUniforms: g }) };
  }, El = (t, e) => {
    Dg(t.inputs);
    let r = t.inputs.length === 1 ? e : Bg(t.inputs, e);
    t.compute(Po(t.inputs, r), { inputs: [0] });
  }, kl = (t) => {
    let e = t.axis, r = t.splitSizes, n = t.numOutputs < 0 ? r.length : t.numOutputs;
    if (n !== r.length) throw new Error("numOutputs and splitSizes length must be equal");
    return ee$1({ axis: e, numOutputs: n, splitSizes: r });
  };
});
var Ug, ln$1, Pl, zo = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  Ug = (t, e) => {
    let [r, n, o, i] = t, { numHeads: s, rotaryEmbeddingDim: u } = e;
    if (r.dims.length !== 3 && r.dims.length !== 4) throw new Error(`Input 'x' is expected to have 3 or 4 dimensions, got ${r.dims.length}`);
    if (!k.areEqual(n.dims, []) && !k.areEqual(n.dims, [1]) && n.dims.length !== 2) throw new Error(`Input 'position_ids' is expected to have 0, 1, or 2 dimensions, got ${n.dims.length}`);
    if (o.dims.length !== 2) throw new Error(`Input 'cos_cache' is expected to have 2 dimensions, got ${o.dims.length}`);
    if (i.dims.length !== 2) throw new Error(`Input 'sin_cache' is expected to have 2 dimensions, got ${i.dims.length}`);
    if (!k.areEqual(o.dims, i.dims)) throw new Error("Inputs 'cos_cache' and 'sin_cache' are expected to have the same shape");
    if (u > 0 && s === 0) throw new Error("num_heads must be provided if rotary_embedding_dim is specified");
    let d = r.dims[0], c = r.dims[r.dims.length - 2], p = o.dims[0], m = k.sizeFromDimension(r.dims, 1) / c, g = u === 0 ? o.dims[1] * 2 : m / s;
    if (u > g) throw new Error("rotary_embedding_dim must be less than or equal to head_size");
    if (n.dims.length === 2) {
      if (d !== n.dims[0]) throw new Error(`Input 'position_ids' dimension 0 should be of size batch_size, got ${n.dims[0]}`);
      if (c !== n.dims[1]) throw new Error(`Input 'position_ids' dimension 1 should be of size sequence_length, got ${n.dims[1]}`);
    }
    if (g / 2 !== o.dims[1] && u / 2 !== o.dims[1]) throw new Error(`Input 'cos_cache' dimension 1 should be same as head_size / 2 or rotary_embedding_dim / 2, got ${o.dims[1]}`);
    if (c > p) throw new Error("Updating cos_cache and sin_cache in RotaryEmbedding is not currently supported");
  }, ln$1 = (t, e) => {
    let { interleaved: r, numHeads: n, rotaryEmbeddingDim: o, scale: i } = e, s = t[0].dims[0], u = k.sizeFromDimension(t[0].dims, 1), d = t[0].dims[t[0].dims.length - 2], c = u / d, p = t[2].dims[1], m = o === 0 ? p * 2 : c / n, g = new Array(s, d, c / m, m - p), b = k.computeStrides(g), y = [{ type: 1, data: i }, { type: 12, data: g }, { type: 12, data: b }, ...t[0].dims.length === 3 ? new Array({ type: 12, data: [u, c, m, 1] }) : [], ...t[0].dims.length === 4 ? new Array({ type: 12, data: [u, m, d * m, 1] }) : [], ...L(t[0].dims, t[1].dims, t[2].dims, t[3].dims, t[0].dims)], w = (S) => {
      let x = O("input", t[0].dataType, t[0].dims.length), $ = O("position_ids", t[1].dataType, t[1].dims.length), T = O("cos_cache", t[2].dataType, t[2].dims.length), I = O("sin_cache", t[3].dataType, t[3].dims.length), E = R("output", t[0].dataType, t[0].dims.length);
      return S.registerUniforms([{ name: "scale", type: "f32" }, { name: "global_shape", type: "u32", length: g.length }, { name: "global_strides", type: "u32", length: b.length }, { name: "input_output_strides", type: "u32", length: b.length }]), `
        ${S.declareVariables(x, $, T, I, E)}

        ${S.mainStart(Dt)}
          let half_rotary_emb_dim = uniforms.${T.name}_shape[1];
          let bsnh = global_idx / uniforms.global_strides % uniforms.global_shape;
          let size = uniforms.global_shape[0] * uniforms.global_strides[0];
          ${S.guardAgainstOutOfBoundsWorkgroupSizes("size")}

          if (bsnh[3] < half_rotary_emb_dim) {
            let position_ids_idx =
                ${$.broadcastedIndicesToOffset("bsnh.xy", R("", $.type.tensor, 2))};
            let position_id =
                u32(${$.getByOffset("position_ids_idx")}) + select(0, bsnh[1], position_ids_idx == 0);
            let i = dot(bsnh, uniforms.input_output_strides) + select(0, bsnh[3], ${r});
            let j = i + select(half_rotary_emb_dim, 1, ${r});
            let re = ${x.getByOffset("i")} * ${T.get("position_id", "bsnh[3]")} -
                ${x.getByOffset("j")} * ${I.get("position_id", "bsnh[3]")};
            ${E.setByOffset("i", "re")}
            let im = ${x.getByOffset("i")} * ${I.get("position_id", "bsnh[3]")} +
                ${x.getByOffset("j")} * ${T.get("position_id", "bsnh[3]")};
            ${E.setByOffset("j", "im")}
          } else {
            let k = dot(bsnh, uniforms.input_output_strides) + half_rotary_emb_dim;
            ${E.setByOffset("k", x.getByOffset("k"))}
          }
        }`;
    };
    return { name: "RotaryEmbedding", shaderCache: { hint: ee$1({ interleaved: r }).cacheKey, inputDependencies: ["rank", "rank", "rank", "rank"] }, getShaderSource: w, getRunData: () => ({ outputs: [{ dims: t[0].dims, dataType: t[0].dataType }], dispatchGroup: { x: Math.ceil(k.size(g) / Dt) }, programUniforms: y }) };
  }, Pl = (t, e) => {
    Ug(t.inputs, e), t.compute(ln$1(t.inputs, e));
  };
});
var Ng, Vg, Ol, Lg, zl, Dl = V$1(() => {
  Ie();
  J();
  Jr$1();
  ko();
  Oo();
  pt();
  zo();
  ae();
  Ng = (t, e) => {
    if (e.doRotary && t.length <= 7) throw new Error("cos_cache and sin_cache inputs are required if do_rotary is specified");
    let r = t[0], n = t[1], o = t[2], i = t[3], s = t[4];
    if (e.doRotary !== 0 && t.length <= 7) throw new Error("cos_cast and sin_cache are expected if do_rotary attribute is non-zero");
    if (e.localWindowSize !== -1) throw new Error("Local attention is not supported");
    if (e.softcap !== 0) throw new Error("Softcap is not supported");
    if (e.rotaryInterleaved !== 0) throw new Error("Rotary interleaved is not supported");
    if (e.smoothSoftmax) throw new Error("Smooth softmax is not supported");
    if (r.dims.length !== 3 && r.dims.length !== 5) throw new Error("Input query is expected to have 3 or 5 dimensions");
    let u = false, d = r.dims[0], c = r.dims[1], p = r.dims.length === 3 ? u ? r.dims[2] / 3 : r.dims[2] : e.numHeads * r.dims[4], m = c, g = 0, b = !n || n.dims.length === 0, y = Math.floor(b ? p / (e.numHeads + 2 * e.kvNumHeads) : p / e.numHeads);
    b && (p = y * e.numHeads);
    let w = i && i.dims.length !== 0, S = s && s.dims.length !== 0;
    if (w && i.dims.length === 4 && i.dims[0] === d && i.dims[1] !== e.kvNumHeads && i.dims[2] === e.kvNumHeads && i.dims[3] === y) throw new Error("BSNH pastKey/pastValue is not supported");
    if (w && S) {
      if (i.dims.length !== 4) throw new Error('Input "past_key" is expected to have 4 dimensions');
      if (s.dims.length !== 4) throw new Error('Input "past_value" is expected to have 4 dimensions');
      g = i.dims[2];
    } else if (w || S) throw new Error('Input "past_key" and "past_value" shall be both present or both absent');
    let $ = 1;
    if (n && n.dims.length > 0) {
      if (r.dims.length !== 3) throw new Error('Input "query" is expected to have 3 dimensions when key is given');
      if (n.dims.length < 3 || n.dims.length > 5) throw new Error('Input "key" is expected to have 3, 4, or 5 dimensions');
      if (r.dims[0] !== n.dims[0]) throw new Error('Input "query" and "key" shall have same dim 0 (batch size)');
      if (n.dims.length === 3) {
        if (r.dims[2] % n.dims[2] !== 0) throw new Error('Dimension 2 of "query" should be a multiple of "key"');
        m = n.dims[1];
      } else if (n.dims.length === 5) {
        if (n.dims[2] !== e.numHeads || n.dims[3] !== 2 || n.dims[4] !== y) throw new Error('Expect "key" shape (batch_size, kv_sequence_length, num_heads, 2, head_size) for packed kv');
        if (o) throw new Error('Expect "value" be none when "key" has packed kv format.');
        m = n.dims[1];
      } else {
        if (n.dims[1] !== e.numHeads || n.dims[3] !== y) throw new Error('Expect "key" shape (batch_size, num_heads, kv_sequence_length, head_size) for past_key');
        m = n.dims[2];
      }
    } else {
      if (r.dims.length !== 3 && r.dims.length !== 5) throw new Error('Input "query" is expected to have 3 or 5 dimensions when key is empty');
      if (r.dims.length === 5 && (r.dims[2] !== e.numHeads || r.dims[3] !== 3)) throw new Error('Expect "query" shape (batch_size, kv_sequence_length, num_heads, 3, head_size) for packed kv');
      $ = 3;
    }
    let T = 0, I = false, E = e.kvNumHeads ? y * e.kvNumHeads : p;
    if (o && o.dims.length > 0) {
      if (o.dims.length !== 3 && o.dims.length !== 4) throw new Error('Input "value" is expected to have 3 or 4 dimensions');
      if (r.dims[0] !== o.dims[0]) throw new Error('Input "query" and "value" shall have same dim 0 (batch_size)');
      if (o.dims.length === 3) {
        if (m !== o.dims[1]) throw new Error('Input "key" and "value" shall have the same dim 1 (kv_sequence_length)');
        E = o.dims[2];
      } else {
        if (m !== o.dims[2]) throw new Error('Input "past_key" and "past_value" shall have the same dim 2 (kv_sequence_length)');
        E = o.dims[1] * o.dims[3], I = true;
      }
    }
    let A = t.length > 4 ? t[5] : void 0;
    if (A && A.dims.length !== 1 && A.dims[0] !== d) throw new Error('Input "seqlens" is expected to have 1 dimension and the same dim 0 as batch_size');
    return { batchSize: d, sequenceLength: c, pastSequenceLength: g, kvSequenceLength: m, totalSequenceLength: -1, maxSequenceLength: -1, inputHiddenSize: 0, hiddenSize: p, vHiddenSize: E, headSize: y, vHeadSize: Math.floor(E / e.kvNumHeads), numHeads: e.numHeads, kvNumHeads: e.kvNumHeads, nReps: e.numHeads / e.kvNumHeads, pastPresentShareBuffer: false, maskType: T, scale: e.scale, broadcastResPosBias: false, passPastInKv: I, qkvFormat: $ };
  }, Vg = ee$1({ perm: [0, 2, 1, 3] }), Ol = (t, e, r) => {
    let n = e, o = r.kvNumHeads;
    return e.dims.length === 3 && r.kvSequenceLength !== 0 && (n = e.reshape([r.batchSize, r.kvSequenceLength, o, r.headSize]), n = t.compute(Oe(n, Vg.perm), { inputs: [n], outputs: [-1] })[0]), n;
  }, Lg = (t, e, r, n) => {
    let o = 7, i = ["type", "type"], s = [t * e], u = t * e, d = [{ type: 12, data: u }, { type: 12, data: e }, { type: 12, data: t }], c = (p) => {
      let m = O("seq_lens", r.dataType, r.dims), g = O("total_seq_lens", n.dataType, n.dims), b = R("pos_ids", o, s), y = [{ name: "output_size", type: "u32" }, { name: "sequence_length", type: "u32" }, { name: "batch_size", type: "u32" }];
      return `
  ${p.registerUniforms(y).declareVariables(m, g, b)}
  ${p.mainStart()}
    ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
    let total_sequence_length = u32(${g.getByOffset("0")});
    let is_subsequent_prompt = uniforms.sequence_length > 1 && uniforms.sequence_length != total_sequence_length;
    let is_first_prompt = !is_subsequent_prompt && uniforms.sequence_length == total_sequence_length;
    let batch_idx = global_idx / uniforms.sequence_length;
    let sequence_idx = i32(global_idx % uniforms.sequence_length);
    var pos_id: i32 = 0;
    let seqlen = ${m.getByOffset("batch_idx")};
    let total_seqlen = seqlen + 1;
    if (is_first_prompt) {
      if (sequence_idx < total_seqlen) {
        pos_id = sequence_idx;
      } else {
        pos_id = 1;
      }
      ${b.setByOffset("global_idx", "pos_id")}
    } else if (is_subsequent_prompt) {
      let past_seqlen = total_seqlen - i32(uniforms.sequence_length);
      if (past_seqlen + sequence_idx < total_seqlen) {
        pos_id = past_seqlen + sequence_idx;
      } else {
        pos_id = 1;
      }
      ${b.setByOffset("global_idx", "pos_id")}
    } else if (global_idx < uniforms.batch_size) {
      ${b.setByOffset("global_idx", "seqlen")}
    };
  }
  `;
    };
    return { name: "GeneratePositionIds", shaderCache: { hint: `${t};${e}`, inputDependencies: i }, getRunData: () => ({ outputs: [{ dims: s, dataType: o }], dispatchGroup: { x: Math.ceil(u / 64) }, programUniforms: d }), getShaderSource: c };
  }, zl = (t, e) => {
    var _a2;
    let r = Ng(t.inputs, e);
    if (t.inputs[0].dims.length === 5) throw new Error("Packed QKV is not implemented");
    if (((_a2 = t.inputs[1]) == null ? void 0 : _a2.dims.length) === 5) throw new Error("Packed KV is not implemented");
    let n = t.inputs[0], o = t.inputs[1] && t.inputs[1].dims.length > 0 ? t.inputs[1] : void 0, i = t.inputs[2] && t.inputs[2].dims.length > 0 ? t.inputs[2] : void 0, s = t.inputs[3] && t.inputs[3].dims.length !== 0 ? t.inputs[3] : void 0, u = t.inputs[4] && t.inputs[4].dims.length !== 0 ? t.inputs[4] : void 0, d = t.inputs.length > 4 ? t.inputs[5] : void 0, c = t.inputs.length > 5 ? t.inputs[6] : void 0, p = r.kvNumHeads ? r.kvNumHeads : r.numHeads, m = ee$1({ axis: 2, numOutputs: 3, splitSizes: [r.numHeads * r.headSize, p * r.headSize, p * r.headSize] }), [g, b, y] = !o && !i ? t.compute(Po([n], m), { inputs: [n], outputs: [-1, -1, -1] }) : [n, o, i], w, S;
    if (e.doRotary) {
      let I = t.compute(Lg(r.batchSize, r.sequenceLength, d, c), { inputs: [d, c], outputs: [-1] })[0], E = t.inputs[7], A = t.inputs[8], z2 = ee$1({ interleaved: e.rotaryInterleaved !== 0, numHeads: r.numHeads, rotaryEmbeddingDim: 0, scale: e.scale }), v = [g, I, E, A], M = [-1];
      w = t.compute(ln$1(v, z2), { inputs: v, outputs: M })[0], v.splice(0, 1, b);
      let N = ee$1({ interleaved: e.rotaryInterleaved !== 0, numHeads: r.kvNumHeads, rotaryEmbeddingDim: 0, scale: e.scale });
      S = t.compute(ln$1(v, N), { inputs: v, outputs: M })[0];
    }
    let x = ar$1(t, r.batchSize, r.numHeads, r.sequenceLength, r.headSize, e.doRotary ? w : g, void 0, 0), $ = Ol(t, e.doRotary ? S : b, r), T = Ol(t, y, r);
    Wt(t, x, $, T, void 0, void 0, s, u, void 0, r, d, c);
  };
});
var Bl, Wg, Gg, Ml, Rl = V$1(() => {
  J();
  ne();
  pt();
  ae();
  Bl = (t, e, r, n, o, i, s, u) => {
    let d = fe(i), c = d === 1 ? "f32" : `vec${d}f`, p = d === 1 ? "vec2f" : `mat2x${d}f`, m = o * s, g = 64;
    m === 1 && (g = 256);
    let b = [o, s, i / d], y = [o, s, 2], w = ["rank", "type", "type"], S = [];
    S.push(...L(b, y));
    let x = ($) => {
      let T = O("x", e.dataType, 3, d), I = O("scale", r.dataType, r.dims), E = O("bias", n.dataType, n.dims), A = R("output", 1, 3, 2), z2 = [T, I, E, A];
      return `
  var<workgroup> workgroup_shared : array<${p}, ${g}>;
  const workgroup_size = ${g}u;
  ${$.declareVariables(...z2)}
  ${$.mainStart(g)}
    let batch = workgroup_index / uniforms.x_shape[1];
    let channel = workgroup_index % uniforms.x_shape[1];
    let hight = uniforms.x_shape[2];
    // initialize workgroup memory
    var sum = ${c}(0);
    var squared_sum = ${c}(0);
    for (var h = local_idx; h < hight; h += workgroup_size) {
      let value = ${c}(${T.get("batch", "channel", "h")});
      sum += value;
      squared_sum += value * value;
    }
    workgroup_shared[local_idx] = ${p}(sum, squared_sum);
    workgroupBarrier();

    for (var currSize = workgroup_size >> 1;  currSize > 0; currSize = currSize >> 1) {
      if (local_idx < currSize) {
        workgroup_shared[local_idx] = workgroup_shared[local_idx] + workgroup_shared[local_idx + currSize];
      }
      workgroupBarrier();
    }
    if (local_idx == 0) {
      let sum_final = ${je("workgroup_shared[0][0]", d)} / f32(hight * ${d});
      let squared_sum_final = ${je("workgroup_shared[0][1]", d)} / f32(hight * ${d});

      let inv_std_dev = inverseSqrt(squared_sum_final - sum_final * sum_final + f32(${u}));
      let channel_scale = inv_std_dev * f32(scale[channel]);
      let channel_shift = f32(bias[channel]) - sum_final * channel_scale;
      output[workgroup_index] = vec2f(channel_scale, channel_shift);
    }
  }`;
    };
    return t.compute({ name: "InstanceNormComputeChannelScaleShift", shaderCache: { hint: `${d};${u};${g}`, inputDependencies: w }, getRunData: () => ({ outputs: [{ dims: y, dataType: 1 }], dispatchGroup: { x: m }, programUniforms: S }), getShaderSource: x }, { inputs: [e, r, n], outputs: [-1] })[0];
  }, Wg = (t, e, r) => {
    let n = e[0].dims, o = n, i = 2, s = n[0], u = n[1], d = k.sizeFromDimension(n, i), c = fe(d), p = k.size(o) / c, m = Bl(t, e[0], e[1], e[2], s, d, u, r.epsilon), g = [s, u, d / c], b = [s, u], y = ["type", "none"], w = (S) => {
      let x = O("x", e[0].dataType, g.length, c), $ = O("scale_shift", 1, b.length, 2), T = R("output", e[0].dataType, g.length, c), I = [x, $, T];
      return `
  ${S.registerUniform("output_size", "u32").declareVariables(...I)}
  ${S.mainStart()}
  ${S.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let outputIndices = ${T.offsetToIndices("global_idx")};
      let batch = outputIndices[0];
      let channel = outputIndices[1];
      let scale_shift = ${$.getByIndices("vec2<u32>(batch, channel)")};
      let value = ${x.getByOffset("global_idx")} * ${T.type.value}(scale_shift.x) + ${T.type.value}(scale_shift.y);
      ${T.setByOffset("global_idx", "value")};
  }`;
    };
    t.compute({ name: "InstanceNormalization", shaderCache: { hint: `${c}`, inputDependencies: y }, getRunData: () => ({ outputs: [{ dims: o, dataType: e[0].dataType }], dispatchGroup: { x: Math.ceil(p / 64) }, programUniforms: [{ type: 12, data: p }, ...L(g, b, g)] }), getShaderSource: w }, { inputs: [e[0], m] });
  }, Gg = (t, e, r) => {
    let n = e[0].dims, o = n, i = n[0], s = n[n.length - 1], u = k.sizeFromDimension(n, 1) / s, d = fe(s), c = k.size(o) / d, p = [{ type: 12, data: u }, { type: 12, data: Math.floor(s / d) }], m = ["type", "type"], g = false, b = [0, n.length - 1];
    for (let x = 0; x < n.length - 2; x++) g = g || n[x + 1] !== 1, b.push(x + 1);
    g = g && n[n.length - 1] !== 1;
    let y = g ? t.compute(Oe(t.inputs[0], b), { inputs: [t.inputs[0]], outputs: [-1] })[0] : t.inputs[0].reshape(Array.from({ length: n.length }, (x, $) => n[b[$]])), w = Bl(t, y, e[1], e[2], i, u, s, r.epsilon), S = (x) => {
      let $ = be$1(e[0].dataType), T = d === 1 ? "vec2f" : `mat${d}x2f`, I = (z2) => {
        let v = z2 === 0 ? "x" : "y", M = d === 1 ? "f32" : `vec${d}f`;
        switch (d) {
          case 1:
            return `${$}(${M}(scale.${v}))`;
          case 2:
            return `vec2<${$}>(${M}(scale[0].${v}, scale[1].${v}))`;
          case 4:
            return `vec4<${$}>(${M}(scale[0].${v}, scale[1].${v}, scale[2].${v}, scale[3].${v}))`;
          default:
            throw new Error(`Not supported compoents ${d}`);
        }
      }, E = O("input", e[0].dataType, e[0].dims, d), A = R("output", e[0].dataType, o, d);
      return `
  @group(0) @binding(0) var<storage, read> input : array<${E.type.storage}>;
  @group(0) @binding(1) var<storage, read> scale_input : array<${T}>;
  @group(0) @binding(2) var<storage, read_write> output : array<${A.type.storage}>;
  struct Uniforms {H: u32, C : u32};
  @group(0) @binding(3) var<uniform> uniforms: Uniforms;

  ${x.mainStart()}
    let current_image_number = global_idx / (uniforms.C * uniforms.H);
    let current_channel_number = global_idx % uniforms.C;

    let scale_offset = current_image_number * uniforms.C + current_channel_number;
    let scale = scale_input[scale_offset];
    output[global_idx] = fma(input[global_idx], ${I(0)}, ${I(1)});
  }`;
    };
    t.compute({ name: "InstanceNormalizationNHWC", shaderCache: { hint: `${d}`, inputDependencies: m }, getRunData: () => ({ outputs: [{ dims: o, dataType: e[0].dataType }], dispatchGroup: { x: Math.ceil(c / 64) }, programUniforms: p }), getShaderSource: S }, { inputs: [e[0], w] });
  }, Ml = (t, e) => {
    e.format === "NHWC" ? Gg(t, t.inputs, e) : Wg(t, t.inputs, e);
  };
});
var Hg, Fg, Ul, Nl = V$1(() => {
  J();
  ne();
  ae();
  Hg = (t) => {
    if (!t || t.length < 2) throw new Error("layerNorm requires at least 2 inputs.");
  }, Fg = (t, e, r) => {
    let n = e.simplified, o = t[0].dims, i = t[1], s = !n && t[2], u = o, d = k.normalizeAxis(e.axis, o.length), c = k.sizeToDimension(o, d), p = k.sizeFromDimension(o, d), m = k.size(i.dims), g = s ? k.size(s.dims) : 0;
    if (m !== p || s && g !== p) throw new Error(`Size of X.shape()[axis:] == ${p}.
       Size of scale and bias (if provided) must match this.
       Got scale size of ${m} and bias size of ${g}`);
    let b = [];
    for (let E = 0; E < o.length; ++E) E < d ? b.push(o[E]) : b.push(1);
    let y = fe(p), w = ["type", "type"], S = [{ type: 12, data: c }, { type: 1, data: p }, { type: 12, data: Math.floor(p / y) }, { type: 1, data: e.epsilon }];
    s && w.push("type");
    let x = r > 1, $ = r > 2, T = (E) => {
      let A = be$1(t[0].dataType), z2 = [O("x", t[0].dataType, t[0].dims, y), O("scale", i.dataType, i.dims, y)];
      s && z2.push(O("bias", s.dataType, s.dims, y)), z2.push(R("output", t[0].dataType, u, y)), x && z2.push(R("mean_data_output", 1, b)), $ && z2.push(R("inv_std_output", 1, b));
      let v = [{ name: "norm_count", type: "u32" }, { name: "norm_size", type: "f32" }, { name: "norm_size_vectorized", type: "u32" }, { name: "epsilon", type: "f32" }];
      return `
  ${E.registerUniforms(v).declareVariables(...z2)}
  ${E.mainStart()}
    ${E.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.norm_count")}
    let offset = global_idx * uniforms.norm_size_vectorized;
    var mean_vector = ${ho("f32", y)};
    var mean_square_vector = ${ho("f32", y)};

    for (var h: u32 = 0u; h < uniforms.norm_size_vectorized; h++) {
      let value = ${Bt$1(A, y, "x[h + offset]")};
      mean_vector += value;
      mean_square_vector += value * value;
    }
    let mean = ${je("mean_vector", y)} / uniforms.norm_size;
    let inv_std_dev = inverseSqrt(${je("mean_square_vector", y)} / uniforms.norm_size ${n ? "" : "- mean * mean"} + uniforms.epsilon);

    for (var j: u32 = 0; j < uniforms.norm_size_vectorized; j++) {
      let f32input = ${Bt$1(A, y, "x[j + offset]")};
      let f32scale = ${Bt$1(A, y, "scale[j]")};
      output[j + offset] = ${z2[0].type.value}((f32input ${n ? "" : "- mean"}) * inv_std_dev * f32scale
        ${s ? `+ ${Bt$1(A, y, "bias[j]")}` : ""}
      );
    }

    ${x ? "mean_data_output[global_idx] = mean" : ""};
    ${$ ? "inv_std_output[global_idx] = inv_std_dev" : ""};
  }`;
    }, I = [{ dims: u, dataType: t[0].dataType }];
    return x && I.push({ dims: b, dataType: 1 }), $ && I.push({ dims: b, dataType: 1 }), { name: "LayerNormalization", shaderCache: { hint: `${y};${r};${n}`, inputDependencies: w }, getRunData: () => ({ outputs: I, dispatchGroup: { x: Math.ceil(c / 64) }, programUniforms: S }), getShaderSource: T };
  }, Ul = (t, e) => {
    Hg(t.inputs), t.compute(Fg(t.inputs, e, t.outputCount));
  };
});
var qg, Vl, Ll = V$1(() => {
  ne();
  an$1();
  sn$1();
  qg = (t) => {
    if (!t || t.length !== 2) throw new Error("MatMul requires 2 inputs.");
    if (t[0].dims[t[0].dims.length - 1] !== t[1].dims[t[1].dims.length - 2]) throw new Error("shared dimension does not match.");
  }, Vl = (t) => {
    qg(t.inputs);
    let e = ot$1.calcShape(t.inputs[0].dims, t.inputs[1].dims, true);
    if (!e) throw new Error("Can't use matmul on the given tensors");
    let r = e[e.length - 1], n = t.inputs[0].dims[t.inputs[0].dims.length - 1];
    if (r < 8 && n < 8) t.compute(on$1(t.inputs, { activation: "" }, e));
    else {
      let o = e[e.length - 2], i = k.size(t.inputs[0].dims.slice(0, -2)), s = k.size(t.inputs[1].dims.slice(0, -2));
      if (i !== 1 && o === 1 && s === 1) {
        let u = t.inputs[0].reshape([1, i, n]), d = t.inputs[1].reshape([1, n, r]), c = [1, i, r], p = [u, d];
        t.compute(ir$1(p, { activation: "" }, e, c), { inputs: p });
      } else t.compute(ir$1(t.inputs, { activation: "" }, e));
    }
  };
});
var Kg, jg, Zg, Wl, Gl, Hl = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  Kg = (t, e) => {
    if (t.length < 3 || t.length > 4) throw new Error("MatMulNBits requires 3 or 4 inputs");
    let r = t[0], n = r.dims.length;
    if (r.dims[n - 1] !== e.k) throw new Error("The last dim of input shape does not match the k value");
    let o = Math.floor((e.k + e.blockSize - 1) / e.blockSize), i = e.blockSize / 8 * e.bits, s = t[1];
    if (!k.areEqual(s.dims, [e.n, o, i])) throw new Error("The second inputs must be 3D tensor with shape N X nBlocksPerCol X blobSize");
    let d = t[2].dims;
    if (k.size(d) !== e.n * o) throw new Error("scales input size error.");
    if (t.length === 4) {
      let p = t[3].dims, m = e.n * (e.bits === 8 ? o : Math.floor((o * e.bits + 7) / 8));
      if (k.size(p) !== m) throw new Error("zeroPoints input size error.");
    }
  }, jg = (t, e) => {
    let r = t[0].dims, n = r.length, o = r[n - 2], i = e.k, s = e.n, u = r.slice(0, n - 2), d = k.size(u), p = t[1].dims[2] / 4, m = t[0].dataType, g = fe(e.k), b = fe(p), y = fe(s), w = u.concat([o, s]), S = o > 1 && s / y % 2 === 0 ? 2 : 1, x = k.size(w) / y / S, $ = 64, T = [], I = [d, o, i / g], E = k.convertShape(t[1].dims).slice();
    E.splice(-1, 1, p / b), T.push(...L(I)), T.push(...L(E)), T.push(...L(t[2].dims)), t.length === 4 && T.push(...L(k.convertShape(t[3].dims)));
    let A = [d, o, s / y];
    T.push(...L(A));
    let z2 = (v) => {
      let M = I.length, N = O("a", t[0].dataType, M, g), K = O("b", 12, E.length, b), q = O("scales", t[2].dataType, t[2].dims.length), Q = [N, K, q], D = t.length === 4 ? O("zero_points", 12, t[3].dims.length) : void 0;
      D && Q.push(D);
      let W = A.length, j = R("output", t[0].dataType, W, y), Y = be$1(t[0].dataType), Z = (() => {
        switch (g) {
          case 1:
            return `array<${Y}, 8>`;
          case 2:
            return `mat4x2<${Y}>`;
          case 4:
            return `mat2x4<${Y}>`;
          default:
            throw new Error(`${g}-component is not supported.`);
        }
      })(), te = () => {
        let Te = `
          // reuse a data
            var input_offset = ${N.indicesToOffset(`${N.type.indices}(batch, row, word_offset)`)};
            var a_data: ${Z};
            for (var j: u32 = 0; j < ${8 / g}; j++) {
              a_data[j] = ${N.getByOffset("input_offset")};
              input_offset++;
            }
          `;
        for (let re = 0; re < y * S; re++) Te += `
            b_value = ${b === 1 ? `b${re}_data` : `b${re}_data[i]`};
            b_value_lower = unpack4xU8(b_value & b_mask);
            b_value_upper = unpack4xU8((b_value >> 4) & b_mask);
            b_quantized_values = ${Z}(${Array.from({ length: 4 }, (U, X) => `${Y}(b_value_lower[${X}]), ${Y}(b_value_upper[${X}])`).join(", ")});
            b_dequantized_values = ${g === 1 ? `${Z}(${Array.from({ length: 8 }, (U, X) => `(b_quantized_values[${X}] - ${D ? `zero_point${re}` : "zero_point"}) * scale${re}`).join(", ")});` : `(b_quantized_values - ${Z}(${Array(8).fill(`${D ? `zero_point${re}` : "zero_point"}`).join(",")})) * scale${re};`};
            workgroup_shared[local_id.x * ${S} + ${Math.floor(re / y)}]${y > 1 ? `[${re % y}]` : ""} += ${Array.from({ length: 8 / g }, (U, X) => `${g === 1 ? `a_data[${X}] * b_dequantized_values[${X}]` : `dot(a_data[${X}], b_dequantized_values[${X}])`}`).join(" + ")};
          `;
        return Te;
      }, ie = () => {
        let Te = `
            var col_index = col * ${y};
            ${D ? `
            let zero_point_bytes_per_col = (nBlocksPerCol + 1) / 2;
            var zero_point_byte_count: u32;
            var zero_point_word_index: u32;
            var zero_point_byte_offset: u32;
            let zero_point_nibble_offset: u32 = block & 0x1u;
            var zero_point_bits_offset: u32;
            var zero_point_word: u32;` : `
            // The default zero point is 8 for unsigned 4-bit quantization.
            let zero_point = ${Y}(8);`}
            `;
        for (let re = 0; re < y * S; re++) Te += `
            let scale${re} = ${q.getByOffset("col_index * nBlocksPerCol + block")};
            ${D ? `
            zero_point_byte_count = col_index * zero_point_bytes_per_col + (block >> 0x1u);
            zero_point_word_index = zero_point_byte_count >> 0x2u;
            zero_point_byte_offset = zero_point_byte_count & 0x3u;
            zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_nibble_offset << 2);
            zero_point_word = ${D.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point${re} = ${Y}((zero_point_word) & 0xFu);` : ""}
            col_index += 1;`;
        return Te;
      }, we = () => {
        let Te = `col_index = col * ${y};`;
        for (let re = 0; re < y * S; re++) Te += `
            let b${re}_data = ${K.getByIndices(`${K.type.indices}(col_index, block, word)`)};
            col_index += 1;`;
        return Te += `
            var b_value: u32;
            let b_mask: u32 = 0x0F0F0F0Fu;
            var b_value_lower: vec4<u32>;
            var b_value_upper: vec4<u32>;
            var b_quantized_values: ${Z};
            var b_dequantized_values: ${Z};`, Te;
      };
      return `
        var<workgroup> workgroup_shared: array<${j.type.value}, ${S * $}>;
        ${v.declareVariables(...Q, j)}
        ${v.mainStart([$, 1, 1])}
          let output_indices = ${j.offsetToIndices(`(global_idx / ${$}) * ${S}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let nBlocksPerCol = uniforms.b_shape[1];

          for (var block = local_id.x; block < nBlocksPerCol; block += ${$}) {
            //process one block
            var word_offset: u32 = block * ${e.blockSize / g};
            ${ie()}
            for (var word: u32 = 0; word < ${p}; word += ${b}) {
              ${we()}
              for (var i: u32 = 0; i < ${b}; i++) {
                ${te()}
                word_offset += ${8 / g};
              }
            }
          }
          workgroupBarrier();

          if (local_id.x < ${S}) {
            var output_value: ${j.type.value} = ${j.type.value}(0);
            var workgroup_shared_offset: u32 = local_id.x;
            for (var b: u32 = 0u; b < ${$}u; b++) {
              output_value += workgroup_shared[workgroup_shared_offset];
              workgroup_shared_offset += ${S};
            }
            ${j.setByIndices(`${j.type.indices}(batch, row, col + local_id.x)`, "output_value")};
          }
        }`;
    };
    return { name: "MatMulNBits", shaderCache: { hint: `${e.blockSize};${e.bits};${g};${b};${y};${S};${$}`, inputDependencies: Array(t.length).fill("rank") }, getRunData: () => ({ outputs: [{ dims: w, dataType: m }], dispatchGroup: { x }, programUniforms: T }), getShaderSource: z2 };
  }, Zg = (t, e) => {
    let r = t[0].dims, n = r.length, o = r[n - 2], i = e.k, s = e.n, u = r.slice(0, n - 2), d = k.size(u), p = t[1].dims[2] / 4, m = t[0].dataType, g = fe(e.k), b = fe(p), y = u.concat([o, s]), w = 128, S = s % 8 === 0 ? 8 : s % 4 === 0 ? 4 : 1, x = w / S, $ = x * b * 8, T = $ / g, I = $ / e.blockSize, E = k.size(y) / S, A = [], z2 = [d, o, i / g], v = k.convertShape(t[1].dims).slice();
    v.splice(-1, 1, p / b), A.push(...L(z2)), A.push(...L(v)), A.push(...L(t[2].dims)), t.length === 4 && A.push(...L(k.convertShape(t[3].dims)));
    let M = [d, o, s];
    A.push(...L(M));
    let N = (K) => {
      let q = z2.length, Q = O("a", t[0].dataType, q, g), D = O("b", 12, v.length, b), W = O("scales", t[2].dataType, t[2].dims.length), j = [Q, D, W], Y = t.length === 4 ? O("zero_points", 12, t[3].dims.length) : void 0;
      Y && j.push(Y);
      let Z = M.length, te = R("output", t[0].dataType, Z), ie = be$1(t[0].dataType), we = () => {
        switch (g) {
          case 1:
            return `
          let a_data0 = vec4<${ie}>(sub_a[word_offset], sub_a[word_offset + 1], sub_a[word_offset + 2], sub_a[word_offset + 3]);
          let a_data1 = vec4<${ie}>(sub_a[word_offset + 4], sub_a[word_offset + 5], sub_a[word_offset + 6], sub_a[word_offset + 7]);`;
          case 2:
            return `
          let a_data0 = vec4<${ie}>(sub_a[word_offset], sub_a[word_offset + 1]);
          let a_data1 = vec4<${ie}>(sub_a[word_offset + 2], sub_a[word_offset + 3]);`;
          case 4:
            return `
          let a_data0 = sub_a[word_offset];
          let a_data1 = sub_a[word_offset + 1];`;
          default:
            throw new Error(`${g}-component is not supported.`);
        }
      };
      return `
        var<workgroup> sub_a: array<${Q.type.value}, ${T}>;
        var<workgroup> inter_results: array<array<${te.type.value}, ${x}>, ${S}>;
        ${K.declareVariables(...j, te)}
        ${K.mainStart([x, S, 1])}
          let output_indices = ${te.offsetToIndices(`workgroup_index * ${S}`)};
          let col = output_indices[2];
          let row = output_indices[1];
          let batch = output_indices[0];
          let n_blocks_per_col = uniforms.b_shape[1];
          let num_tiles =  (n_blocks_per_col - 1) / ${I} + 1;

          // Loop over shared dimension.
          for (var tile: u32 = 0; tile < num_tiles; tile += 1) {
            let a_col_start = tile * ${T};
            // load one tile A data into shared memory.
            for (var a_offset = local_idx; a_offset < ${T}; a_offset += ${w})
            {
              let a_col = a_col_start + a_offset;
              if (a_col < uniforms.a_shape[2])
              {
                sub_a[a_offset] = ${Q.getByIndices(`${Q.type.indices}(batch, row, a_col)`)};
              } else {
                sub_a[a_offset] = ${Q.type.value}(0);
              }
            }
            workgroupBarrier();

            // each thread process one block
            let b_row = col + local_id.y;
            let block = tile * ${I} + local_id.x;
            ${Y ? `
            let zero_point_bytes_per_col = (n_blocks_per_col + 1) / 2;
            let zero_point_byte_count = b_row * zero_point_bytes_per_col + (block >> 0x1u);
            let zero_point_word_index = zero_point_byte_count >> 0x2u;
            let zero_point_byte_offset = zero_point_byte_count & 0x3u;
            let zero_point_nibble_offset: u32 = block & 0x1u;
            let zero_point_bits_offset = (zero_point_byte_offset << 3) + (zero_point_nibble_offset << 2);
            let zero_point_word = ${Y.getByOffset("zero_point_word_index")} >> zero_point_bits_offset;
            let zero_point = ${ie}((zero_point_word) & 0xFu);` : `
            // The default zero point is 8 for unsigned 4-bit quantization.
            let zero_point = ${ie}(8);`}
            let scale = ${W.getByOffset("b_row * n_blocks_per_col + block")};
            let b_data = ${D.getByIndices(`${D.type.indices}(b_row, block, 0)`)};
            var word_offset = local_id.x * ${e.blockSize / g};
            for (var i: u32 = 0; i < ${b}; i++) {
              ${we()}
              let b_value = ${b === 1 ? "b_data" : "b_data[i]"};
              let b_value_lower = unpack4xU8(b_value & 0x0F0F0F0Fu);
              let b_value_upper = unpack4xU8((b_value >> 4) & 0x0F0F0F0Fu);
              let b_quantized_values = mat2x4<${ie}>(${Array.from({ length: 4 }, (Te, re) => `${ie}(b_value_lower[${re}]), ${ie}(b_value_upper[${re}])`).join(", ")});
              let b_dequantized_values = (b_quantized_values - mat2x4<${ie}>(${Array(8).fill("zero_point").join(",")})) * scale;
              inter_results[local_id.y][local_id.x] += ${Array.from({ length: 2 }, (Te, re) => `${`dot(a_data${re}, b_dequantized_values[${re}])`}`).join(" + ")};
              word_offset += ${8 / g};
            }
            workgroupBarrier();
          }

          if (local_idx < ${S}) {
            var output_value: ${te.type.value} = ${te.type.value}(0);
            for (var b = 0u; b < ${x}; b++) {
              output_value += inter_results[local_idx][b];
            }
            if (col + local_idx < uniforms.output_shape[2])
            {
              ${te.setByIndices(`${te.type.indices}(batch, row, col + local_idx)`, "output_value")}
            }
          }
        }`;
    };
    return { name: "BlockwiseMatMulNBits32", shaderCache: { hint: `${e.blockSize};${g};${b};${x};${S}`, inputDependencies: Array(t.length).fill("rank") }, getRunData: () => ({ outputs: [{ dims: y, dataType: m }], dispatchGroup: { x: E }, programUniforms: A }), getShaderSource: N };
  }, Wl = (t, e) => {
    Kg(t.inputs, e), e.blockSize === 32 && t.adapterInfo.isVendor("intel") && t.adapterInfo.isArchitecture("gen-12lp") ? t.compute(Zg(t.inputs, e)) : t.compute(jg(t.inputs, e));
  }, Gl = (t) => ee$1(t);
});
var Qg, Yg, Xg, Jg, ey, ty, ry, ny, Fl, ql = V$1(() => {
  J();
  ne();
  ae();
  Qg = (t) => {
    if (!t || t.length < 1) throw new Error("Too few inputs");
    if (t[0].dataType !== 1 && t[0].dataType !== 10) throw new Error("Input type must be float or float16.");
    if (t.length >= 2) {
      let e = t[0].dims.length * 2 === t[1].dims[0];
      if (t.length === 4 && (e = t[3].dims[0] * 2 === t[1].dims[0]), !e) throw new Error("The pads should be a 1D tensor of shape [2 * input_rank] or [2 * num_axes].");
    }
  }, Yg = (t, e, r) => {
    let n = "";
    for (let o = e - 1; o >= 0; --o) n += `
            k = i32(${t.indicesGet("indices", o)}) - ${F$1("uniforms.pads", o, r)};
            if (k < 0) {
              break;
            }
            if (k >= i32(${F$1("uniforms.x_shape", o, e)})) {
              break;
            }
            offset += k * i32(${F$1("uniforms.x_strides", o, e)});
        `;
    return `
          value = ${t.type.value}(uniforms.constant_value);
          for (var i = 0; i < 1; i++) {
            var offset = 0;
            var k = 0;
            ${n}
            value = x[offset];
          }
      `;
  }, Xg = (t, e, r) => {
    let n = "";
    for (let o = e - 1; o >= 0; --o) n += `
                k = i32(${t.indicesGet("indices", o)}) - ${F$1("uniforms.pads", o, r)};
                if (k < 0) {
                  k = -k;
                }
                {
                  let _2n_1 = 2 * (i32(${F$1("uniforms.x_shape", o, e)}) - 1);
                  k = k % _2n_1;
                  if(k >= i32(${F$1("uniforms.x_shape", o, e)})) {
                    k = _2n_1 - k;
                  }
                }
                offset += k * i32(${F$1("uniforms.x_strides", o, e)});
            `;
    return `
              var offset = 0;
              var k = 0;
              ${n}
              value = x[offset];
          `;
  }, Jg = (t, e, r) => {
    let n = "";
    for (let o = e - 1; o >= 0; --o) n += `
                k = i32(${t.indicesGet("indices", o)}) - ${F$1("uniforms.pads", o, r)};
                if (k < 0) {
                  k = 0;
                }
                if (k >= i32(${F$1("uniforms.x_shape", o, e)})) {
                  k = i32(${F$1("uniforms.x_shape", o, e)}) - 1;
                }
                offset += k * i32(${F$1("uniforms.x_strides", o, e)});
            `;
    return `
              var offset = 0;
              var k = 0;
              ${n}
              value = x[offset];
          `;
  }, ey = (t, e, r) => {
    let n = "";
    for (let o = e - 1; o >= 0; --o) n += `
                k = i32(${t.indicesGet("indices", o)}) - ${F$1("uniforms.pads", o, r)};
                if (k < 0)  {
                  k += i32(${F$1("uniforms.x_shape", o, e)}]);
                }
                if (k >= i32(${F$1("uniforms.x_shape", o, e)})) {
                  k -= i32(${F$1("uniforms.x_shape", o, e)});
                }
                offset += k * i32(${F$1("uniforms.x_strides", o, e)});
            `;
    return `
              var offset = 0;
              var k = 0;
              ${n}
              value = x[offset];
          `;
  }, ty = (t, e, r) => {
    switch (r.mode) {
      case 0:
        return Yg(t, e, r.pads.length);
      case 1:
        return Xg(t, e, r.pads.length);
      case 2:
        return Jg(t, e, r.pads.length);
      case 3:
        return ey(t, e, r.pads.length);
      default:
        throw new Error("Invalid mode");
    }
  }, ry = (t, e) => {
    let r = k.padShape(t[0].dims.slice(), e.pads), n = t[0].dims, o = k.size(r), i = [{ type: 12, data: o }, { type: 6, data: e.pads }], s = t.length >= 3 && t[2].data;
    e.mode === 0 && i.push({ type: s ? t[2].dataType : 1, data: e.value }), i.push(...L(t[0].dims, r));
    let u = ["rank"], d = (c) => {
      let p = R("output", t[0].dataType, r.length), m = O("x", t[0].dataType, n.length), g = m.type.value, b = ty(p, n.length, e), y = [{ name: "output_size", type: "u32" }, { name: "pads", type: "i32", length: e.pads.length }];
      return e.mode === 0 && y.push({ name: "constant_value", type: s ? g : "f32" }), `
            ${c.registerUniforms(y).declareVariables(m, p)}
            ${c.mainStart()}
            ${c.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}

            let indices = ${p.offsetToIndices("global_idx")};

            var value = ${g}(0);
            ${b}
            output[global_idx] = value;
        }`;
    };
    return { name: "Pad", shaderCache: { hint: `${e.mode}${s}`, inputDependencies: u }, getRunData: () => ({ outputs: [{ dims: r, dataType: t[0].dataType }], dispatchGroup: { x: Math.ceil(k.size(r) / 64) }, programUniforms: i }), getShaderSource: d };
  }, ny = (t, e) => {
    if (t.length > 1) {
      let r = t[1].getBigInt64Array(), n = t.length >= 3 && t[2].data ? t[2].dataType === 10 ? t[2].getUint16Array()[0] : t[2].getFloat32Array()[0] : 0, o = t[0].dims.length, i = new Int32Array(2 * o).fill(0);
      if (t.length >= 4) {
        let u = t[3].getBigInt64Array();
        for (let d = 0; d < u.length; d++) i[Number(u[d])] = Number(r[d]), i[Number(u[d]) + o] = Number(r[d + u.length]);
      } else r.forEach((u, d) => i[Number(d)] = Number(u));
      let s = [];
      return i.forEach((u) => s.push(u)), { mode: e.mode, value: n, pads: s };
    } else return e;
  }, Fl = (t, e) => {
    Qg(t.inputs);
    let r = ny(t.inputs, e);
    t.compute(ry(t.inputs, r), { inputs: [0] });
  };
});
var cn$1, Kl, jl, Zl, Ql, oy, iy, Yl, Xl, Jl, ec$1, tc$1, rc$1, nc$1, oc$1, ic$1, ac$1, sc$1, uc$1, dc$1 = V$1(() => {
  Ve$1();
  J();
  ne();
  ae();
  cn$1 = (t) => {
    if (ye.webgpu.validateInputContent && (!t || t.length !== 1)) throw new Error("Pool ops requires 1 input.");
  }, Kl = (t, e, r) => {
    let n = e.format === "NHWC", o = t.dims.slice();
    n && o.splice(1, 0, o.pop());
    let i = Object.hasOwnProperty.call(e, "dilations"), s = e.kernelShape.slice(), u = e.strides.slice(), d = i ? e.dilations.slice() : [], c = e.pads.slice();
    zt.adjustPoolAttributes(r, o, s, u, d, c);
    let p = zt.computePoolOutputShape(r, o, u, d, s, c, e.autoPad), m = Object.assign({}, e);
    i ? Object.assign(m, { kernelShape: s, strides: u, pads: c, dilations: d, cacheKey: e.cacheKey }) : Object.assign(m, { kernelShape: s, strides: u, pads: c, cacheKey: e.cacheKey });
    let g = p.slice();
    return g.push(g.splice(1, 1)[0]), [m, n ? g : p];
  }, jl = (t, e) => {
    let r = e.format === "NHWC", n = k.size(t), o = k.size(e.kernelShape), i = [{ type: 12, data: n }, { type: 12, data: o }], s = [{ name: "outputSize", type: "u32" }, { name: "kernelSize", type: "u32" }];
    if (e.kernelShape.length <= 2) {
      let u = e.kernelShape[e.kernelShape.length - 1], d = e.strides[e.strides.length - 1], c = e.pads[e.pads.length / 2 - 1], p = e.pads[e.pads.length - 1], m = !!(c + p);
      i.push({ type: 12, data: u }, { type: 12, data: d }, { type: 12, data: c }, { type: 12, data: p }), s.push({ name: "kw", type: "u32" }, { name: "sw", type: "u32" }, { name: "pwStart", type: "u32" }, { name: "pwEnd", type: "u32" });
      let g = false;
      if (e.kernelShape.length === 2) {
        let b = e.kernelShape[e.kernelShape.length - 2], y = e.strides[e.strides.length - 2], w = e.pads[e.pads.length / 2 - 2], S = e.pads[e.pads.length - 2];
        g = !!(w + S), i.push({ type: 12, data: b }, { type: 12, data: y }, { type: 12, data: w }, { type: 12, data: S }), s.push({ name: "kh", type: "u32" }, { name: "sh", type: "u32" }, { name: "phStart", type: "u32" }, { name: "phEnd", type: "u32" });
      }
      return [i, s, true, m, g];
    } else {
      if (r) throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");
      let u = k.computeStrides(e.kernelShape);
      i.push({ type: 12, data: u }, { type: 12, data: e.pads }, { type: 12, data: e.strides }), s.push({ name: "kernelStrides", type: "u32", length: u.length }, { name: "pads", type: "u32", length: e.pads.length }, { name: "strides", type: "u32", length: e.strides.length });
      let d = e.pads.reduce((c, p) => c + p);
      return [i, s, !!d, false, false];
    }
  }, Zl = (t, e, r, n, o, i, s, u, d, c, p, m) => {
    let g = o.format === "NHWC", b = e.type.value, y = R("output", e.type.tensor, n);
    if (o.kernelShape.length <= 2) {
      let w = "", S = "", x = "", $ = r - (g ? 2 : 1);
      if (p ? w = `
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${$}] = indices[${$}] * uniforms.sw - uniforms.pwStart + i;
                  if (xIndices[${$}] < 0 || xIndices[${$}]
                      >= uniforms.x_shape[${$}]) {
                    pad++;
                    continue;
                  }
                  let x_val = x[${e.indicesToOffset("xIndices")}];
                  ${i}
                }` : w = `
                for (var i: u32 = 0u; i < uniforms.kw; i++) {
                  xIndices[${$}] = indices[${$}] * uniforms.sw - uniforms.pwStart + i;
                  let x_val = x[${e.indicesToOffset("xIndices")}];
                  ${i}
                }`, o.kernelShape.length === 2) {
        let I = r - (g ? 3 : 2);
        m ? S = `
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${I}] = indices[${I}] * uniforms.sh - uniforms.phStart + j;
                  if (xIndices[${I}] < 0 || xIndices[${I}] >= uniforms.x_shape[${I}]) {
                    pad += i32(uniforms.kw);
                    continue;
                  }
              ` : S = `
                for (var j: u32 = 0u; j < uniforms.kh; j++) {
                  xIndices[${I}] = indices[${I}] * uniforms.sh - uniforms.phStart + j;
                `, x = `
              }
            `;
      }
      return `
            ${t.registerUniforms(d).declareVariables(e, y)}

            ${t.mainStart()}
              ${t.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}

              let indices = ${y.offsetToIndices("global_idx")};
              var xIndices = ${y.offsetToIndices("global_idx")};

              var value = ${b}(${u});
              var pad = 0;
              ${S}
              ${w}
              ${x}
              ${s}

              output[global_idx] = value;
            }`;
    } else {
      if (g) throw new Error("Pooling with kernelShape.length > 2 is not supported for NHWC format.");
      let w = o.kernelShape.length, S = o.pads.length, x = "";
      return c ? x = `
                if (xIndices[j] >= uniforms.x_shape[j]) {
                  pad++;
                  isPad = true;
                  break;
                }
              }
              if (!isPad) {
                let x_val = x[${e.indicesToOffset("xIndices")}];
                ${i}
              }` : x = `
              }
              let x_val = x[${e.indicesToOffset("xIndices")}];
              ${i}
            `, `
            ${t.registerUniforms(d).declareVariables(e, y)}

            ${t.mainStart()}
              ${t.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
              let indices = ${y.offsetToIndices("global_idx")};
              var xIndices = ${y.offsetToIndices("global_idx")};

              var offsets: array<u32, ${w}>;

              var value = ${b}(${u});
              var pad = 0;
              var isPad = false;

              for (var i: u32 = 0u; i < uniforms.kernelSize; i++) {
                var offset = i;
                for (var j = 0u; j < ${w - 1}u; j++) {
                  offsets[j] = offset / ${F$1("uniforms.kernelStrides", "j", w)};
                  offset -= offsets[j] * ${F$1("uniforms.kernelStrides", "j", w)};
                }
                offsets[${w - 1}] = offset;

                isPad = false;
                for (var j = ${r - w}u; j < ${r}u; j++) {
                  xIndices[j] = indices[j] * ${F$1("uniforms.strides", `j - ${r - w}u`, w)}
                    + offsets[j - ${r - w}u] - ${F$1("uniforms.pads", "j - 2u", S)};
                  ${x}
              }
              ${s}

              output[global_idx] = value;
            }`;
    }
  }, Ql = (t) => `${t.format};${t.ceilMode};${t.autoPad};${t.kernelShape.length}`, oy = (t) => `${Ql(t)};${t.countIncludePad}`, iy = (t) => `${Ql(t)};${t.storageOrder};${t.dilations}`, Yl = (t) => ({ format: t.format, autoPad: ["NOTSET", "VALID", "SAME_UPPER", "SAME_LOWER"][t.auto_pad], ceilMode: t.ceil_mode, kernelShape: t.kernel_shape, strides: t.strides, pads: t.pads }), Xl = (t, e, r, n) => {
    let [o, i] = Kl(e, n, r), s = O("x", e.dataType, e.dims.length), u = s.type.value, d = "value += x_val;", c = "";
    o.countIncludePad ? c += `value /= ${u}(uniforms.kernelSize);` : c += `value /= ${u}(i32(uniforms.kernelSize) - pad);`;
    let [p, m, g, b, y] = jl(i, o);
    p.push(...L(e.dims, i));
    let w = ["rank"];
    return { name: t, shaderCache: { hint: `${n.cacheKey};${g};${b};${y}`, inputDependencies: w }, getRunData: () => ({ outputs: [{ dims: i, dataType: e.dataType }], dispatchGroup: { x: Math.ceil(k.size(i) / 64) }, programUniforms: p }), getShaderSource: (S) => Zl(S, s, e.dims.length, i.length, o, d, c, 0, m, g, b, y) };
  }, Jl = (t) => {
    let e = t.count_include_pad !== 0, r = Yl(t);
    if (r.ceilMode !== 0) throw new Error("using ceil() in shape computation is not yet supported for AveragePool");
    let n = { countIncludePad: e, ...r, cacheKey: "" };
    return { ...n, cacheKey: oy(n) };
  }, ec$1 = (t, e) => {
    cn$1(t.inputs), t.compute(Xl("AveragePool", t.inputs[0], false, e));
  }, tc$1 = { autoPad: "", ceilMode: 0, countIncludePad: false, kernelShape: [], strides: [], pads: [], storageOrder: 0, dilations: [] }, rc$1 = (t) => {
    let e = t.format;
    return { format: e, ...tc$1, cacheKey: e };
  }, nc$1 = (t, e) => {
    cn$1(t.inputs), t.compute(Xl("GlobalAveragePool", t.inputs[0], true, e));
  }, oc$1 = (t, e, r, n) => {
    let [o, i] = Kl(e, n, r), s = `
      value = max(x_val, value);
    `, u = "", d = O("x", e.dataType, e.dims.length), c = ["rank"], [p, m, g, b, y] = jl(i, o);
    return p.push(...L(e.dims, i)), { name: t, shaderCache: { hint: `${n.cacheKey};${g};${b};${y}`, inputDependencies: c }, getRunData: () => ({ outputs: [{ dims: i, dataType: e.dataType }], dispatchGroup: { x: Math.ceil(k.size(i) / 64) }, programUniforms: p }), getShaderSource: (w) => Zl(w, d, e.dims.length, i.length, o, s, u, e.dataType === 10 ? -65504 : -1e5, m, g, b, y) };
  }, ic$1 = (t, e) => {
    cn$1(t.inputs), t.compute(oc$1("MaxPool", t.inputs[0], false, e));
  }, ac$1 = (t) => {
    let e = t.storage_order, r = t.dilations, n = Yl(t);
    if (e !== 0) throw new Error("column major storage order is not yet supported for MaxPool");
    if (n.ceilMode !== 0) throw new Error("using ceil() in shape computation is not yet supported for MaxPool");
    let o = { storageOrder: e, dilations: r, ...n, cacheKey: "" };
    return { ...o, cacheKey: iy(o) };
  }, sc$1 = (t) => {
    let e = t.format;
    return { format: e, ...tc$1, cacheKey: e };
  }, uc$1 = (t, e) => {
    cn$1(t.inputs), t.compute(oc$1("GlobalMaxPool", t.inputs[0], true, e));
  };
});
var sy, uy, lc$1, cc$1, pc$1 = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  sy = (t, e) => {
    if (t.length < 2 || t.length > 3) throw new Error("DequantizeLinear requires 2 or 3 inputs.");
    if (t.length === 3 && t[1].dims === t[2].dims) throw new Error("x-scale and x-zero-point must have the same shape.");
    if (t.length === 3 && t[0].dataType !== t[2].dataType) throw new Error("x and x-zero-point must have the same data type.");
    if (t[0].dataType === 6 && t.length > 2) throw new Error("In the case of dequantizing int32 there is no zero point.");
    if (t[1].dims.length !== 0 && t[1].dims.length !== 1 && t[1].dims.length !== t[0].dims.length) throw new Error("scale input must be a scalar, a 1D tensor, or have the same rank as the input tensor.");
    if (t.length > 2) {
      if (t[0].dataType !== t[2].dataType) throw new Error("x and x-zero-point must have the same data type.");
      if (t[1].dims.length !== t[2].dims.length) throw new Error("scale and zero-point inputs must have the same rank.");
      if (!t[1].dims.map((r, n) => r === t[2].dims[n]).reduce((r, n) => r && n, true)) throw new Error("scale and zero-point inputs must have the same shape.");
    }
    if (e.blockSize > 0) {
      if (t[1].dims.length === 0 || t[1].dims.length === 1 && t[1].dims[0] === 1) throw new Error("blockSize must be set only for block quantization.");
      if (!t[1].dims.map((o, i) => i === e.axis || o === t[0].dims[i]).reduce((o, i) => o && i, true)) throw new Error("For block qunatization, scale input shape to match the input shape except for the axis");
      if (t[1].dims.length !== t[0].dims.length) throw new Error("For block qunatization the scale input rank must be the same as the x rank.");
      let r = t[0].dims[e.axis], n = t[1].dims[e.axis];
      if (e.blockSize < Math.ceil(r / n) || e.blockSize > Math.ceil(r / (n - 1) - 1)) throw new Error("blockSize must be with in the range [ceil(dI / Si), ceil(dI / (Si - 1) - 1)].");
    }
  }, uy = (t, e) => {
    let r = k.normalizeAxis(e.axis, t[0].dims.length), n = t[0].dataType, o = n === 3, i = t[0].dims, s = t[1].dataType, u = k.size(i), d = n === 3 || n === 2, c = d ? [Math.ceil(k.size(t[0].dims) / 4)] : t[0].dims, p = t[1].dims, m = t.length > 2 ? t[2] : void 0, g = m ? d ? [Math.ceil(k.size(m.dims) / 4)] : m.dims : void 0, b = p.length === 0 || p.length === 1 && p[0] === 1, y = b === false && p.length === 1, w = fe(u), S = b && (!d || w === 4), x = S ? w : 1, $ = S && !d ? w : 1, T = O("input", d ? 12 : n, c.length, $), I = O("scale", s, p.length), E = m ? O("zero_point", d ? 12 : n, g.length) : void 0, A = R("output", s, i.length, x), z2 = [T, I];
    E && z2.push(E);
    let v = [c, p];
    m && v.push(g);
    let M = [{ type: 12, data: u / x }, { type: 12, data: r }, { type: 12, data: e.blockSize }, ...L(...v, i)], N = (K) => {
      let q = [{ name: "output_size", type: "u32" }, { name: "axis", type: "u32" }, { name: "block_size", type: "u32" }];
      return `
      ${K.registerUniforms(q).declareVariables(...z2, A)}
      ${K.mainStart()}
          ${K.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
          let output_indices = ${A.offsetToIndices("global_idx")};

          // Set input x
          ${d ? `
            let input = ${T.getByOffset("global_idx / 4")};
            let x_vec = ${o ? "unpack4xI8(input)" : "unpack4xU8(input)"};
            let x_value = ${x === 1 ? "x_vec[global_idx % 4]" : "x_vec"};` : `let x_value = ${T.getByOffset("global_idx")};`};

          // Set scale input
          ${b ? `let scale_value= ${I.getByOffset("0")}` : y ? `
            let scale_index = ${A.indicesGet("output_indices", "uniforms.axis")};
            let scale_value= ${I.getByOffset("scale_index")};` : `
            var scale_indices: ${I.type.indices} = output_indices;
            let index = ${I.indicesGet("scale_indices", "uniforms.axis")} / uniforms.block_size;
            ${I.indicesSet("scale_indices", "uniforms.axis", "index")};
            let scale_value= ${I.getByIndices("scale_indices")};`};

          // Set zero-point input
          ${E ? b ? d ? `
                let zero_point_input = ${E.getByOffset("0")};
                let zero_point_vec =  ${o ? "unpack4xI8(zero_point_input)" : "unpack4xU8(zero_point_input)"};
                let zero_point_value= zero_point_vec[0]` : `let zero_point_value = ${E.getByOffset("0")}` : y ? d ? `
                let zero_point_index = ${A.indicesGet("output_indices", "uniforms.axis")};
                let zero_point_input = ${E.getByOffset("zero_point_index / 4")};
                let zero_point_vec =  ${o ? "unpack4xI8(zero_point_input)" : "unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_index % 4]` : `
                let zero_point_index = ${A.indicesGet("output_indices", "uniforms.axis")};
                let zero_point_value = ${E.getByOffset("zero_point_index")};` : d ? `
                let zero_point_offset = ${I.indicesToOffset("scale_indices")};
                let zero_point_input = ${E.getByOffset("zero_point_offset / 4")};
                let zero_point_vec = ${o ? "unpack4xI8(zero_point_input)" : "unpack4xU8(zero_point_input)"};
                let zero_point_value = zero_point_vec[zero_point_offset % 4];` : `let zero_point_value = ${E.getByIndices("scale_indices")};` : `let zero_point_value = ${d ? o ? "i32" : "u32" : T.type.value}(0);`};
      // Compute and write output
      ${A.setByOffset("global_idx", `${A.type.value}(x_value - zero_point_value) * scale_value`)};
      }`;
    };
    return { name: "DequantizeLinear", shaderCache: { hint: e.cacheKey, inputDependencies: E ? ["rank", "rank", "rank"] : ["rank", "rank"] }, getShaderSource: N, getRunData: () => ({ outputs: [{ dims: i, dataType: s }], dispatchGroup: { x: Math.ceil(u / x / 64), y: 1, z: 1 }, programUniforms: M }) };
  }, lc$1 = (t, e) => {
    sy(t.inputs, e), t.compute(uy(t.inputs, e));
  }, cc$1 = (t) => ee$1({ axis: t.axis, blockSize: t.blockSize });
});
var dy, ly, mc$1, fc$1 = V$1(() => {
  Ve$1();
  J();
  ae();
  dy = (t, e, r) => {
    let n = t === e, o = t < e && r < 0, i = t > e && r > 0;
    if (n || o || i) throw new Error("Range these inputs' contents are invalid.");
  }, ly = (t, e, r, n) => {
    let o = Math.abs(Math.ceil((e - t) / r)), i = [o], s = o, u = [{ type: 12, data: s }, { type: n, data: t }, { type: n, data: r }, ...L(i)], d = (c) => {
      let p = R("output", n, i.length), m = p.type.value, g = [{ name: "outputSize", type: "u32" }, { name: "start", type: m }, { name: "delta", type: m }];
      return `
        ${c.registerUniforms(g).declareVariables(p)}
        ${c.mainStart()}
        ${c.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
        output[global_idx] = uniforms.start + ${m}(global_idx) * uniforms.delta;
      }`;
    };
    return { name: "Range", shaderCache: { hint: `${n}` }, getShaderSource: d, getRunData: () => ({ outputs: [{ dims: i, dataType: n }], dispatchGroup: { x: Math.ceil(s / 64) }, programUniforms: u }) };
  }, mc$1 = (t) => {
    let e = 0, r = 0, n = 0;
    t.inputs[0].dataType === 6 ? (e = t.inputs[0].getInt32Array()[0], r = t.inputs[1].getInt32Array()[0], n = t.inputs[2].getInt32Array()[0]) : t.inputs[0].dataType === 1 && (e = t.inputs[0].getFloat32Array()[0], r = t.inputs[1].getFloat32Array()[0], n = t.inputs[2].getFloat32Array()[0]), ye.webgpu.validateInputContent && dy(e, r, n), t.compute(ly(e, r, n, t.inputs[0].dataType), { inputs: [] });
  };
});
var cy, py, hc$1, gc$1, yc$1 = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  cy = (t, e, r, n) => {
    if (t !== "none" && n !== "i32" && n !== "u32" && n !== "f32") throw new Error(`Input ${n} is not supported with reduction ${t}.`);
    let o = `{
                var oldValue = 0;
                loop {
                  let newValueF32 =`, i = `;
                  let newValue = bitcast<i32>(newValueF32);
                  let res = atomicCompareExchangeWeak(&${e}, oldValue, newValue);
                  if res.exchanged {
                    break;
                  }
                  oldValue = res.old_value;
                }
              }`;
    switch (t) {
      case "none":
        return `${e}=${r};`;
      case "add":
        return n === "i32" || n === "u32" ? `atomicAdd(&${e}, bitcast<${n}>(${r}));` : `
              ${o}bitcast<${n}>(oldValue) + (${r})${i}`;
      case "max":
        return n === "i32" || n === "u32" ? `atomicMax(&${e}, bitcast<${n}>(${r}));` : `
                ${o}max(bitcast<f32>(oldValue), (${r}))${i}`;
      case "min":
        return n === "i32" || n === "u32" ? `atomicMin(&${e}, bitcast<${n}>(${r}));` : `${o}min(bitcast<${n}>(oldValue), (${r}))${i}`;
      case "mul":
        return `${o}(bitcast<${n}>(oldValue) * (${r}))${i}`;
      default:
        throw new Error(`Reduction ${t} is not supported.`);
    }
  }, py = (t, e) => {
    let r = t[0].dims, n = t[1].dims, o = r, i = 1, s = Math.ceil(k.sizeToDimension(n, n.length - 1) / i), u = n[n.length - 1], d = k.sizeFromDimension(r, u), c = [{ type: 12, data: s }, { type: 12, data: u }, { type: 12, data: d }, ...L(t[1].dims, t[2].dims, o)], p = (m) => {
      let g = O("indices", t[1].dataType, t[1].dims.length), b = O("updates", t[2].dataType, t[2].dims.length, i), y = e.reduction !== "none" && e.reduction !== "" ? Gs$1("output", t[0].dataType, o.length) : R("output", t[0].dataType, o.length, i);
      return `
      ${m.registerUniform("output_size", "u32").registerUniform("last_index_dimension", "u32").registerUniform("num_updates_elements", "u32").declareVariables(g, b, y)}
      ${m.mainStart()}
        ${m.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
  var data_offset = 0u;
  let indices_start = uniforms.last_index_dimension * global_idx;
  let indices_end = indices_start + uniforms.last_index_dimension;
  for (var i = indices_start; i < indices_end; i++) {
    var index = i32(indices[i].x);
    ${t[0].dims.length === 1 ? `
    let element_count_dim = uniforms.output_strides;
    let dim_value = uniforms.output_shape;` : `
    let element_count_dim = uniforms.output_strides[i - indices_start];
    let dim_value = uniforms.output_shape[i - indices_start];`}
    if (index >= 0) {
      if (index >= i32(dim_value)) {
        index = i32(dim_value - 1);
      }
    } else {
      if (index < -i32(dim_value)) {
        index = 0;
      } else {
        index += i32(dim_value);
      }
    }
    data_offset += u32((u32(index) * element_count_dim));
  }

  for (var i = 0u; i < uniforms.num_updates_elements; i++) {
    let value = updates[uniforms.num_updates_elements * global_idx + i];
    ${cy(e.reduction, "output[data_offset + i]", "value", y.type.value)}
  }

      }`;
    };
    return { name: "ScatterND", shaderCache: { hint: `${e.cacheKey}_${e.reduction}`, inputDependencies: ["rank", "rank"] }, getRunData: () => ({ outputs: [{ dims: o, dataType: t[0].dataType }], dispatchGroup: { x: Math.ceil(s / 64) }, programUniforms: c }), getShaderSource: p };
  }, hc$1 = (t) => ee$1({ reduction: t.reduction }), gc$1 = (t, e) => {
    t.compute(py(t.inputs, e), { inputs: [t.inputs[1], t.inputs[2]], outputs: [] });
  };
});
var my, fy, hy, bc$1, gy, yy, by, wy, _y, vy, $y, xy, wc$1, Sy, Ty, Iy, Cy, Ay, _c, vc$1, $c = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  my = (t, e) => {
    if (t.every((r) => r > 0 || (() => {
      throw new Error("Resize requires scales input values to be positive");
    })), t.length > 0) {
      if (e.mode === "linear") {
        if (!(t.length === 2 || t.length === 3 || t.length === 4 && t[0] === 1 && t[1] === 1 || t.length === 4 && t[0] === 1 && t[3] === 1 || t.length === 5 && t[0] === 1 && t[1] === 1)) throw new Error(`For linear mode, Resize requires scales to be 2D, 3D, 4D with either two outermost or one innermost and
            one outermost scale values equal to 1, or 5D with two outermost scale values equal to 1`);
      } else if (e.mode === "cubic" && !(t.length === 2 || t.length === 4 && t[0] === 1 && t[1] === 1 || t.length === 4 && t[0] === 1 && t[3] === 1)) throw new Error("Resize requires scales input size to be 2 or 4 for cubic mode");
    }
  }, fy = (t, e, r) => {
    e.every((o) => o >= 0 && o < r || (() => {
      throw new Error("Resize requires axes input values to be positive and less than rank");
    }));
    let n = new Array(r).fill(1);
    return e.forEach((o, i) => n[o] = t[i]), n;
  }, hy = (t, e, r, n, o, i) => {
    let [s, u, d] = r > 10 ? [1, 2, 3] : [-1, t.length > 1 ? 1 : -1, -1], c = t[0].dims.length;
    if (s > 0 && t.length > s && t[s].dims.length > 0) t[s].getFloat32Array().forEach((p) => i.push(p));
    else if (e.coordinateTransformMode === "tf_crop_and_resize") throw new Error("Resize requires RoI input to be specified when coordinateTransformMode is tfCropAndResize");
    if (u > 0 && t.length > u && t[u].dims.length === 1 && t[u].dims[0] > 0) {
      if (t[u].getFloat32Array().forEach((p) => n.push(p)), n.length !== 0 && n.length !== c && r >= 18 && n.length !== e.axes.length) throw new Error("Resize requires scales input size to be same as input rank or axes size for opset 18 and up");
      my(n, e), e.axes.length > 0 && fy(n, e.axes, c).forEach((p, m) => n[m] = p);
    }
    if (d > 0 && t.length > d && t[d].dims.length === 1 && t[d].dims[0] > 0 && (t[d].getBigInt64Array().forEach((p) => o.push(Number(p))), o.length !== 0 && o.length !== c && r >= 18 && o.length !== e.axes.length)) throw new Error("Resize requires sizes input size to be same as input rank or axes size for opset 18 and up");
    if (e.axes.length > 0) {
      if (n.length !== 0 && n.length !== e.axes.length) throw new Error('Resize requires "scales" input size to be of axes rank when axes attributes is specified');
      if (o.length !== 0 && o.length !== e.axes.length) throw new Error('Resize requires "sizes" input size to be of rank axes rank when axes attributes is specified');
    }
    if (typeof n < "u" && typeof o < "u" && n.length > 0 && o.length > c) throw new Error("Resize requires only of scales or sizes to be specified");
  }, bc$1 = (t, e, r, n) => `
  // The whole part and the fractional part are calculated separately due to inaccuracy of floating
  // point division. As an example, f32(21) / f32(7) may evaluate to 2.99... instead of 3, causing an
  // offset-by-one error later in floor().
  let big = (${t}) * (${e});
  let whole = ${n}(big / (${r}));
  let fract = ${n}(big % (${r})) / ${n}(${r});
  return whole + fract;
`, gy = (t, e) => `fn getOriginalCoordinateFromResizedCoordinate(xResized: u32, xScale: f32, lengthResized: u32,
     lengthOriginal: u32, roiStart: f32, roiEnd: f32) -> ${e} { ` + (() => {
    switch (t) {
      case "asymmetric":
        return `
          if (xScale < 1.0 || floor(xScale) != xScale) {
            return ${e}(xResized) / ${e}(xScale);
          } else {
            ${bc$1("xResized", "lengthOriginal", "lengthResized", e)}
          }
        `;
      case "pytorch_half_pixel":
        return `if (lengthResized > 1) {
                    return (${e}(xResized) + 0.5) / ${e}(xScale) - 0.5;
                  } else {
                    return 0.0;
                  }`;
      case "tf_half_pixel_for_nn":
        return `return (${e}(xResized) + 0.5) / ${e}(xScale);`;
      case "align_corners":
        return `if (lengthResized == 1) {
                    return 0.0;
                  } else {
                    ${bc$1("xResized", "lengthOriginal - 1", "lengthResized - 1", e)}
                  }`;
      case "tf_crop_and_resize":
        return `if (lengthResized > 1) {
                    return ${e}(roiStart) * ${e}(lengthOriginal - 1) +
                        (${e}(xResized) * ${e}(roiEnd - roiStart) * ${e}(lengthOriginal - 1)) /
                        ${e}(lengthResized - 1);
                  } else {
                    return 0.5 * ${e}(roiStart + roiEnd) * ${e}(lengthOriginal - 1);
                  }`;
      case "half_pixel_symmetric":
        return `const outputWidth = ${e}xScale * ${e}(lengthResized);
                  const adjustment = ${e}(lengthResized) / outputWidth;
                  const center = ${e}(lengthOriginal) / 2;
                  const offset = center * (1 - adjustment);
                  return offset + ((${e}(xResized) + 0.5) / ${e}(xScale)) - 0.5;`;
      case "half_pixel":
        return `return ((${e}(xResized) + 0.5) / ${e}(xScale)) - 0.5;`;
      default:
        throw new Error(`Coordinate transform mode ${t} is not supported`);
    }
  })() + "}", yy = (t, e, r) => `fn getNearestPixelFromOriginal(xOriginal: ${r}, isDownSample: bool) -> ${r} {` + (() => {
    switch (t) {
      case "round_prefer_ceil":
        return "if (fract(xOriginal) == 0.5) {             return ceil(xOriginal);           } else {             return round(xOriginal);           }";
      case "floor":
        return "return floor(xOriginal);";
      case "ceil":
        return "return ceil(xOriginal);";
      case "round_prefer_floor":
        return "if (fract(xOriginal) == 0.5) {                     return floor(xOriginal);                   } else {                     return round(xOriginal);                   }";
      case "simple":
      default:
        if (e < 11) return "if (isDownSample)                     {                       return ceil(xOriginal);                     } else {                       return xOriginal;                     }";
        throw new Error(`Nearest mode ${t} is not supported`);
    }
  })() + "}", by = (t, e, r) => {
    let n = new Array(r).fill(0).concat(new Array(r).fill(1)), o = t.length === 0 ? n : t.slice();
    return e.length > 0 ? (e.forEach((i, s) => {
      n[i] = o[s], n[s + r] = o[e.length + s];
    }), n) : o;
  }, wy = (t, e, r, n) => {
    let o = [];
    if (r.length > 0) if (n.length > 0) {
      if (t.forEach((i) => o.push(i)), Math.max(...n) > t.length) throw new Error("axes is out of bound");
      n.forEach((i, s) => o[i] = r[s]);
    } else r.forEach((i) => o.push(i));
    else {
      if (e.length === 0) throw new Error("Resize requires either scales or sizes.");
      o = t.map((i, s) => Math.round(i * e[s]));
    }
    return o;
  }, _y = (t, e, r) => {
    let n = (() => {
      switch (r.keepAspectRatioPolicy) {
        case "not_larger":
          return r.axes.length > 0 ? Math.min(...r.axes.map((i) => e[i]), Number.MAX_VALUE) : Math.min(...e, Number.MAX_VALUE);
        case "not_smaller":
          return r.axes.length > 0 ? Math.max(...r.axes.map((i) => e[i]), Number.MIN_VALUE) : Math.max(...e, Number.MIN_VALUE);
        default:
          throw new Error(`Keep aspect ratio policy ${r.keepAspectRatioPolicy} is not supported`);
      }
    })();
    e.fill(1, 0, e.length);
    let o = t.slice();
    return r.axes.length > 0 ? (r.axes.forEach((i) => e[i] = n), r.axes.forEach((i) => o[i] = Math.round(t[i] * e[i]))) : (e.fill(n, 0, e.length), o.forEach((i, s) => o[s] = Math.round(i * e[s]))), o;
  }, vy = (t, e, r, n, o) => `
    fn calculateOriginalIndicesFromOutputIndices(output_indices: ${t.type.indices}) -> array<${t.type.value}, ${r.length}> {
      var original_indices: array<${t.type.value}, ${r.length}>;
      for (var i:u32 = 0; i < ${r.length}; i++) {
        var output_index = ${t.indicesGet("output_indices", "i")};
        var scale = ${F$1("uniforms.scales", "i", n)};
        var roi_low = ${F$1("uniforms.roi", "i", o)};
        var roi_hi = ${F$1("uniforms.roi", `i + ${e.length}`, o)};
        if (scale == 1.0) {
          original_indices[i] = ${t.type.value}(output_index);
        } else {
          var input_shape_i = ${F$1("uniforms.input_shape", "i", e.length)};
          var output_shape_i = ${F$1("uniforms.output_shape", "i", r.length)};
          original_indices[i] = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                           input_shape_i, roi_low, roi_hi);
        }
      }
      return original_indices;
    }`, $y = (t, e, r, n, o, i, s) => `
    fn calculateInputIndicesFromOutputIndices(output_indices: ${e.type.indices}) -> ${t.type.indices} {
      var input_indices: ${t.type.indices};
      for (var i:u32 = 0; i < ${n.length}; i++) {
        var output_index = ${e.indicesGet("output_indices", "i")};
        var input_index: u32;
        var scale = ${F$1("uniforms.scales", "i", o)};
        if (scale == 1.0) {
          input_index = output_index;
        } else {
          var roi_low = ${F$1("uniforms.roi", "i", i)};
          var roi_hi = ${F$1("uniforms.roi", `i + ${r.length}`, i)};
          var input_shape_i = ${F$1("uniforms.input_shape", "i", r.length)};
          var output_shape_i = ${F$1("uniforms.output_shape", "i", n.length)};
          var original_idx = getOriginalCoordinateFromResizedCoordinate(output_index, scale, output_shape_i,
                                                                        input_shape_i, roi_low, roi_hi);
          if (!${s} || (original_idx >= 0 && original_idx < ${e.type.value}(input_shape_i))) {
            if (original_idx < 0) {
              input_index = 0;
            } else if (original_idx > ${e.type.value}(input_shape_i - 1)) {
              input_index = input_shape_i - 1;
            } else {
              input_index = u32(getNearestPixelFromOriginal(original_idx, scale < 1));
            }
          } else {
            input_index = u32(original_idx);
          }
        }
        ${t.indicesSet("input_indices", "i", "input_index")}
      }
      return input_indices;
    }`, xy = (t, e) => `
    fn checkInputIndices(input_indices: ${t.type.indices}) -> bool {
      for (var i:u32 = 0; i < ${e.length}; i++) {
        var input_index = ${t.indicesGet("input_indices", "i")};
        if (input_index < 0 || input_index >= ${F$1("uniforms.input_shape", "i", e.length)}) {
          return false;
        }
      }
      return true;
    }`, wc$1 = (t, e, r, n) => t.rank > n ? `
    ${t.indicesSet("input_indices", e, "channel")};
    ${t.indicesSet("input_indices", r, "batch")};
` : "", Sy = (t, e, r, n, o) => {
    let [s, u, d, c] = r.length === 2 ? [-1, 0, 1, -1] : [0, 2, 3, 1], p = t.type.value;
    return `
    fn getInputValue(batch: u32, channel: u32, row: u32, col: u32) -> ${p} {
      var input_indices: ${t.type.indices};
      ${t.indicesSet("input_indices", u, `max(0, min(row, ${r[u]} - 1))`)};
      ${t.indicesSet("input_indices", d, `max(0, min(col, ${r[d]} - 1))`)};
      ${wc$1(t, c, s, 2)}
      return ${t.getByIndices("input_indices")};
    }

    fn bilinearInterpolation(output_indices: ${e.type.indices}) -> ${p} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var row:${p} = originalIndices[${u}];
      var col:${p} = originalIndices[${d}];
      ${n ? `if (row < 0 || row > (${r[u]} - 1) || col < 0 || col > (${r[d]} - 1)) {
        return ${o};
      }` : ""};
      row = max(0, min(row, ${r[u]} - 1));
      col = max(0, min(col, ${r[d]} - 1));
      var row1: u32 = u32(row);
      var col1: u32 = u32(col);
      var row2: u32 = u32(row + 1);
      var col2: u32 = u32(col + 1);
      var channel: u32 = ${r.length > 2 ? `u32(originalIndices[${c}])` : "0"};
      var batch: u32 =  ${r.length > 2 ? `u32(originalIndices[${s}])` : "0"};
      var x11: ${p} = getInputValue(batch, channel, row1, col1);
      var x12: ${p} = getInputValue(batch, channel, row1, col2);
      var x21: ${p} = getInputValue(batch, channel, row2, col1);
      var x22: ${p} = getInputValue(batch, channel, row2, col2);
      var dx1: ${p} = abs(row - ${p}(row1));
      var dx2: ${p} = abs(${p}(row2) - row);
      var dy1: ${p} = abs(col - ${p}(col1));
      var dy2: ${p} = abs(${p}(col2) - col);
      if (row1 == row2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (col1 == col2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      return (x11 * dx2 * dy2 + x12 * dx2 * dy1 + x21 * dx1 * dy2 + x22 * dx1 * dy1);
    }`;
  }, Ty = (t, e, r, n, o, i, s, u, d, c) => {
    let p = r.length === 2, [g, b] = p ? [0, 1] : [2, 3], y = t.type.value, w = (S) => {
      let x = S === g ? "row" : "col";
      return `
      fn ${x}CubicInterpolation(input_indices: ${t.type.indices}, output_indices: ${e.type.indices}) -> ${y} {
        var output_index = ${e.indicesGet("output_indices", S)};
        var originalIdx: ${y} = getOriginalCoordinateFromResizedCoordinate(output_index, ${o[S]},
        ${n[S]}, ${r[S]}, ${i[S]}, ${i[S]} + ${r.length});
        var fractOriginalIdx: ${y} = originalIdx - floor(originalIdx);
        var coefs = getCubicInterpolationCoefs(fractOriginalIdx);

        if (${u} && (originalIdx < 0 || originalIdx > (${r[S]} - 1))) {
          return ${d};
        }
        var data: array<${y}, 4> = array<${y}, 4>(0.0, 0.0, 0.0, 0.0);
        for (var i: i32 = -1; i < 3; i++) {
          var ${x}: ${y} = originalIdx + ${y}(i);
          if (${x} < 0 || ${x} >= ${r[S]}) {
            ${c ? `coefs[i + 1] = 0.0;
                        continue;` : u ? `return ${d};` : `${x} = max(0, min(${x}, ${r[S]} - 1));`};
          }
        var input_indices_copy: ${t.type.indices} = input_indices;
          ${t.indicesSet("input_indices_copy", S, `u32(${x})`)};
          data[i + 1] = ${S === g ? t.getByIndices("input_indices_copy") : "rowCubicInterpolation(input_indices_copy, output_indices)"};
        }
        return cubicInterpolation1D(data, coefs);
      }`;
    };
    return `
    ${w(g)};
    ${w(b)};
  fn getCubicInterpolationCoefs(s: ${y}) -> array<${y}, 4> {
    var absS = abs(s);
    var coeffs: array<${y}, 4> = array<${y}, 4>(0.0, 0.0, 0.0, 0.0);
    var oneMinusAbsS: ${y} = 1.0 - absS;
    var twoMinusAbsS: ${y} = 2.0 - absS;
    var onePlusAbsS: ${y} = 1.0 + absS;
    coeffs[0] = ((${s} * onePlusAbsS - 5 * ${s}) * onePlusAbsS + 8 * ${s}) * onePlusAbsS - 4 * ${s};
    coeffs[1] = ((${s} + 2) * absS - (${s} + 3)) * absS * absS + 1;
    coeffs[2] = ((${s} + 2) * oneMinusAbsS - (${s} + 3)) * oneMinusAbsS * oneMinusAbsS + 1;
    coeffs[3] = ((${s} * twoMinusAbsS - 5 * ${s}) * twoMinusAbsS + 8 * ${s}) * twoMinusAbsS - 4 * ${s};
    return coeffs;
  }

  fn cubicInterpolation1D(x: array<${y}, 4>, coefs: array<${y}, 4>) -> ${y} {
    var coefsSum: ${y} = coefs[0] + coefs[1] + coefs[2] + coefs[3];
    return (x[0] * coefs[0] + x[1] * coefs[1]+ x[2] * coefs[2]+ x[3] * coefs[3]) / coefsSum;
  }

  fn bicubicInterpolation(output_indices: ${e.type.indices}) -> ${y} {
    var input_indices: ${t.type.indices} = output_indices;
    return colCubicInterpolation(input_indices, output_indices);
  }
    `;
  }, Iy = (t, e, r, n, o) => {
    let [s, u, d, c, p] = r.length === 3 ? [-1, 0, 1, 2, -1] : [0, 2, 3, 4, 1], m = t.type.value;
    return `
    fn getInputValue(batch: u32, channel: u32, depth:u32, height: u32, width: u32) -> ${m} {
      var input_indices: ${t.type.indices};
      ${t.indicesSet("input_indices", u, `max(0, min(depth, ${r[u]} - 1))`)};
      ${t.indicesSet("input_indices", d, `max(0, min(height, ${r[d]} - 1))`)};
      ${t.indicesSet("input_indices", c, `max(0, min(width, ${r[c]} - 1))`)};
      ${wc$1(t, p, s, 3)}
      return ${t.getByIndices("input_indices")};
    }

    fn trilinearInterpolation(output_indices: ${e.type.indices}) -> ${m} {
      var originalIndices = calculateOriginalIndicesFromOutputIndices(output_indices);
      var depth:${m} = originalIndices[${u}];
      var height:${m} = originalIndices[${d}];
      var width:${m} = originalIndices[${c}];
      ${n ? `if (depth < 0 || depth > (${r[u]} - 1) || height < 0 || height > (${r[d]} - 1) || width < 0 || (width > ${r[c]} - 1)) {
      return ${o};
        }` : ""};

    depth = max(0, min(depth, ${r[u]} - 1));
      height = max(0, min(height, ${r[d]} - 1));
      width = max(0, min(width, ${r[c]} - 1));
      var depth1: u32 = u32(depth);
      var height1: u32 = u32(height);
      var width1: u32 = u32(width);
      var depth2: u32 = u32(depth + 1);
      var height2: u32 = u32(height + 1);
      var width2: u32 = u32(width + 1);
      var channel: u32 = ${r.length > 3 ? `u32(originalIndices[${p}])` : "0"};
      var batch: u32 =  ${r.length > 3 ? `u32(originalIndices[${s}])` : "0"};

      var x111: ${m} = getInputValue(batch, channel, depth1, height1, width1);
      var x112: ${m} = getInputValue(batch, channel, depth1, height1, width2);
      var x121: ${m} = getInputValue(batch, channel, depth1, height2, width1);
      var x122: ${m} = getInputValue(batch, channel, depth1, height2, width2);
      var x211: ${m} = getInputValue(batch, channel, depth2, height1, width1);
      var x212: ${m} = getInputValue(batch, channel, depth2, height1, width2);
      var x221: ${m} = getInputValue(batch, channel, depth2, height2, width1);
      var x222: ${m} = getInputValue(batch, channel, depth2, height2, width2);
      var dx1: ${m} = abs(depth - ${m}(depth1));
      var dx2: ${m} = abs(${m}(depth2) - depth);
      var dy1: ${m} = abs(height - ${m}(height1));
      var dy2: ${m} = abs(${m}(height2) - height);
      var dz1: ${m} = abs(width - ${m}(width1));
      var dz2: ${m} = abs(${m}(width2) - width);
      if (depth1 == depth2) {
        dx1 = 0.5;
        dx2 = 0.5;
      }
      if (height1 == height2) {
        dy1 = 0.5;
        dy2 = 0.5;
      }
      if (width1 == width2) {
        dz1 = 0.5;
        dz2 = 0.5;
      }
      return (x111 * dx2 * dy2 * dz2 + x112 * dx2 * dy2 * dz1 + x121 * dx2 * dy1 *dz2 + x122 * dx2 * dy1 * dz1 +
              x211 * dx1 * dy2 * dz2 + x212 * dx1 * dy2 * dz1 + x221 * dx1 * dy1 *dz2 + x222 * dx1 * dy1 * dz1);
    }`;
  }, Cy = (t, e, r, n, o, i) => {
    let s = t.dims, u = by(i, e.axes, s.length), d = wy(s, n, o, e.axes), c = n.slice();
    n.length === 0 && (c = s.map(($, T) => $ === 0 ? 1 : d[T] / $), e.keepAspectRatioPolicy !== "stretch" && (d = _y(s, c, e)));
    let p = R("output", t.dataType, d.length), m = O("input", t.dataType, s.length), g = k.size(d), b = s.length === d.length && s.every(($, T) => $ === d[T]), y = e.coordinateTransformMode === "tf_crop_and_resize", w = e.extrapolationValue, S = m.type.value, x = ($) => `
      ${b ? "" : `
      ${gy(e.coordinateTransformMode, S)};
      ${(() => {
      switch (e.mode) {
        case "nearest":
          return `
              ${xy(m, s)};
              ${yy(e.nearestMode, r, S)};
              ${$y(m, p, s, d, c.length, u.length, y)};
              `;
        case "linear":
          return `
              ${vy(p, s, d, c.length, u.length)};
              ${(() => {
            if (s.length === 2 || s.length === 4) return `${Sy(m, p, s, y, w)}`;
            if (s.length === 3 || s.length === 5) return `${Iy(m, p, s, y, w)}`;
            throw Error("Linear mode only supports input dims 2, 3, 4 and 5 are supported in linear mode.");
          })()};
            `;
        case "cubic":
          return `
            ${(() => {
            if (s.length === 2 || s.length === 4) return `${Ty(m, p, s, d, c, u, e.cubicCoeffA, y, e.extrapolationValue, e.excludeOutside)}`;
            throw Error("Cubic mode only supports input dims 2 and 4 are supported in linear mode.");
          })()};
            `;
        default:
          throw Error("Invalid resize mode");
      }
    })()};
      `}
      ${$.registerUniform("output_size", "u32").registerUniform("scales", "f32", c.length).registerUniform("roi", "f32", u.length).declareVariables(m, p)}
      ${$.mainStart()}
        ${$.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
        ${b ? "output[global_idx] = input[global_idx];" : `
        let output_indices = ${p.offsetToIndices("global_idx")};
        var input_indices: ${m.type.indices};
        ${(() => {
      switch (e.mode) {
        case "nearest":
          return `input_indices = calculateInputIndicesFromOutputIndices(output_indices);
                if (checkInputIndices(input_indices)) {
                  output[global_idx] = ${m.getByIndices("input_indices")};
                } else {
                  output[global_idx] = ${e.extrapolationValue};
                }`;
        case "linear":
          return `output[global_idx] = ${s.length === 2 || s.length === 4 ? "bilinearInterpolation" : "trilinearInterpolation"}(output_indices);`;
        case "cubic":
          return "output[global_idx] = bicubicInterpolation(output_indices);";
        default:
          throw Error(`Unsupported resize mode: ${e.mode}`);
      }
    })()};
`}
      }`;
    return { name: "Resize", shaderCache: { hint: `${e.cacheKey}|${r}|${c.length > 0 ? e.mode === "cubic" ? c : c.length : ""}|${o.length > 0 ? o : ""}|${u.length > 0 ? u : ""}|${b}|${e.mode === "nearest" ? s.length : s}`, inputDependencies: ["rank"] }, getShaderSource: x, getRunData: () => ({ outputs: [{ dims: d, dataType: t.dataType }], dispatchGroup: { x: Math.ceil(g / 64) }, programUniforms: [{ type: 12, data: g }, { type: 1, data: c }, { type: 1, data: u }, ...L(s, d)] }) };
  }, Ay = (t) => {
    let e = t.customDataBuffer;
    return new Uint32Array(e, e.byteOffset, 1)[0];
  }, _c = (t, e) => {
    let r = [], n = [], o = [], i = Ay(t);
    if (e.antialias !== 0) throw Error("Only default value (0) for Antialias attribute is supported");
    hy(t.inputs, e, i, r, n, o), t.compute(Cy(t.inputs[0], e, i, r, n, o), { inputs: [0] });
  }, vc$1 = (t) => {
    let e = t.antialias, r = t.axes, n = t.coordinateTransformMode, o = t.cubicCoeffA, i = t.excludeOutside !== 0, s = t.extrapolationValue, u = t.keepAspectRatioPolicy, d = t.mode, c = t.nearestMode === "" ? "simple" : t.nearestMode;
    return ee$1({ antialias: e, axes: r, coordinateTransformMode: n, cubicCoeffA: o, excludeOutside: i, extrapolationValue: s, keepAspectRatioPolicy: u, mode: d, nearestMode: c });
  };
});
var Ey, ky, xc, Sc$1 = V$1(() => {
  J();
  ne();
  ae();
  Ey = (t) => {
    if (!t || t.length < 3) throw new Error("layerNorm requires at least 3 inputs.");
    let e = t[0], r = t[1], n = t[2];
    if (e.dataType !== r.dataType || e.dataType !== n.dataType) throw new Error("All inputs must have the same data type");
    if (e.dims.length !== 3 && e.dims.length !== 2) throw new Error("Input must be 2D or 3D");
    if (r.dims.length !== 3 && r.dims.length !== 2) throw new Error("Skip must be 2D or 3D");
    let o = e.dims[e.dims.length - 1], i = e.dims[e.dims.length - 2];
    if (r.dims[r.dims.length - 1] !== o) throw new Error("Skip must have the same hidden size as input");
    if (r.dims[r.dims.length - 2] !== i) throw new Error("Skip must have the same sequence length as input");
    if (n.dims.length !== 1) throw new Error("Gamma must be 1D");
    if (n.dims[n.dims.length - 1] !== o) throw new Error("Gamma must have the same hidden size as input");
    if (t.length > 3) {
      let s = t[3];
      if (s.dims.length !== 1) throw new Error("Beta must be 1D");
      if (s.dims[s.dims.length - 1] !== o) throw new Error("Beta must have the same hidden size as input");
    }
    if (t.length > 4) {
      let s = t[4];
      if (s.dims.length !== 1) throw new Error("Bias must be 1D");
      if (s.dims[s.dims.length - 1] !== o) throw new Error("Bias must have the same hidden size as input");
    }
  }, ky = (t, e, r, n) => {
    let o = e.simplified, i = t[0].dims, s = k.size(i), u = i, d = s, c = i.slice(-1)[0], p = n ? i.slice(0, -1).concat(1) : [], m = !o && t.length > 3, g = t.length > 4, b = n && r > 1, y = n && r > 2, w = r > 3, S = 64, x = fe(c), $ = [{ type: 12, data: d }, { type: 12, data: x }, { type: 12, data: c }, { type: 1, data: e.epsilon }], T = (E) => {
      let A = [{ name: "output_size", type: "u32" }, { name: "components", type: "u32" }, { name: "hidden_size", type: "u32" }, { name: "epsilon", type: "f32" }], z2 = [O("x", t[0].dataType, t[0].dims, x), O("skip", t[1].dataType, t[1].dims, x), O("gamma", t[2].dataType, t[2].dims, x)];
      m && z2.push(O("beta", t[3].dataType, t[3].dims, x)), g && z2.push(O("bias", t[4].dataType, t[4].dims, x)), z2.push(R("output", t[0].dataType, u, x)), b && z2.push(R("mean_output", 1, p)), y && z2.push(R("inv_std_output", 1, p)), w && z2.push(R("input_skip_bias_sum", t[0].dataType, u, x));
      let v = be$1(t[0].dataType), M = be$1(1, x);
      return `

      ${E.registerUniforms(A).declareVariables(...z2)}
      var<workgroup> sum_shared : array<${M}, ${S}>;
      var<workgroup> sum_squared_shared : array<${M}, ${S}>;

      ${E.mainStart([S, 1, 1])}
        let ix = local_id.x;
        let iy = global_id.x / ${S};

        let hidden_size_vectorized: u32 = uniforms.hidden_size / uniforms.components;
        var stride = hidden_size_vectorized / ${S};
        let offset = ix * stride + iy * hidden_size_vectorized;
        let offset1d = stride * ix;
        if (ix == ${S - 1}) {
          stride = hidden_size_vectorized - stride * ix;
        }
        for (var i: u32 = 0; i < stride; i++) {
          let skip_value = skip[offset + i];
          let bias_value = ${g ? "bias[offset1d + i]" : v + "(0.0)"};
          let input_value = x[offset + i];
          let value = input_value + skip_value + bias_value;
          ${w ? "input_skip_bias_sum[offset + i] = value;" : ""}
          output[offset + i] = value;
          let f32_value = ${Bt$1(v, x, "value")};
          sum_shared[ix] += f32_value;
          sum_squared_shared[ix] += f32_value * f32_value;
        }
        workgroupBarrier();

        var reduce_size : u32 = ${S};
        for (var curr_size = reduce_size >> 1;  curr_size > 0; curr_size = reduce_size >> 1) {
          reduce_size = curr_size + (reduce_size & 1);
          if (ix < curr_size) {
            sum_shared[ix] += sum_shared[ix + reduce_size];
            sum_squared_shared[ix] += sum_squared_shared[ix + reduce_size];
          }
          workgroupBarrier();
        }

        let sum = sum_shared[0];
        let square_sum = sum_squared_shared[0];
        let mean = ${je("sum", x)} / f32(uniforms.hidden_size);
        let inv_std_dev = inverseSqrt(${je("square_sum", x)} / f32(uniforms.hidden_size) ${o ? "" : "- mean * mean"} + uniforms.epsilon);
        ${b ? "mean_output[global_idx] = mean;" : ""}
        ${y ? "inv_std_output[global_idx] = inv_std_dev;" : ""}

        for (var i: u32 = 0; i < stride; i++) {
          output[offset + i] = (output[offset + i] ${o ? "" : `- ${v}(mean)`}) *
            ${v}(inv_std_dev) * gamma[offset1d + i]
            ${m ? "+ beta[offset1d + i]" : ""};
        }
      }`;
    }, I = [{ dims: u, dataType: t[0].dataType }];
    return r > 1 && I.push({ dims: p, dataType: 1 }), r > 2 && I.push({ dims: p, dataType: 1 }), r > 3 && I.push({ dims: i, dataType: t[0].dataType }), { name: "SkipLayerNormalization", shaderCache: { hint: `${x};${b};${y};${w}`, inputDependencies: t.map((E, A) => "type") }, getShaderSource: T, getRunData: () => ({ outputs: I, dispatchGroup: { x: Math.ceil(d / c) }, programUniforms: $ }) };
  }, xc = (t, e) => {
    Ey(t.inputs);
    let n = [0];
    t.outputCount > 1 && n.push(-3), t.outputCount > 2 && n.push(-3), t.outputCount > 3 && n.push(3), t.compute(ky(t.inputs, e, t.outputCount, false), { outputs: n });
  };
});
var Py, pn$1, Oy, Tc$1, zy, Dy, Ic$1, Cc, Ac$1 = V$1(() => {
  J();
  ne();
  Ie();
  ae();
  Py = (t, e) => {
    if (!t || t.length < 1) throw new Error("too few inputs");
    if (e.axes.length !== 0) {
      if (e.axes.length !== e.starts.length || e.axes.length !== e.ends.length) throw new Error("axes, starts and ends must have the same length");
    } else if (e.starts.length !== e.ends.length) throw new Error("starts and ends must have the same length");
    t.slice(1).forEach((r, n) => {
      if (t[n + 1].dataType !== 6 && t[n + 1].dataType !== 7) throw new Error(`Input ${n} must be an array of int32 or int64`);
    });
  }, pn$1 = (t, e) => {
    let r = [];
    if (t.length > e) if (t[e].dataType === 7) t[e].getBigInt64Array().forEach((n) => r.push(Number(n)));
    else if (t[e].dataType === 6) t[e].getInt32Array().forEach((n) => r.push(Number(n)));
    else throw new Error(`Input ${e} must be an array of int32 or int64`);
    return r;
  }, Oy = (t, e) => {
    if (t.length > 1) {
      let r = pn$1(t, 1), n = pn$1(t, 2), o = pn$1(t, 3);
      return o.length === 0 && (o = [...Array(t[0].dims.length).keys()]), ee$1({ starts: r, ends: n, axes: o });
    } else return e;
  }, Tc$1 = (t, e, r, n, o) => {
    let i = t;
    return t < 0 && (i += r[n[e]]), o[e] < 0 ? Math.max(0, Math.min(i, r[n[e]] - 1)) : Math.max(0, Math.min(i, r[n[e]]));
  }, zy = (t, e, r) => `fn calculateInputIndices(output_indices: ${e.type.indices}) -> ${t.type.indices} {
          var input_indices: ${t.type.indices};
          var carry = 0u;
          for (var i = ${r.length - 1}; i >= 0; i--) {
            let input_shape_i = ${F$1("uniforms.input_shape", "i", r.length)};
            let steps_i = ${F$1("uniforms.steps", "i", r.length)};
            let signs_i = ${F$1("uniforms.signs", "i", r.length)};
            let starts_i = ${F$1("uniforms.starts", "i", r.length)};
            var output_index = ${e.indicesGet("output_indices", "i")};
            var input_index = output_index * steps_i + starts_i + carry;
            carry = input_index / input_shape_i;
            input_index = input_index % input_shape_i;
            if (signs_i < 0) {
              input_index = input_shape_i - input_index - 1u + starts_i;
            }
            ${t.indicesSet("input_indices", "i", "input_index")};
          }
          return input_indices;
      }`, Dy = (t, e) => {
    let r = t[0].dims, n = k.size(r), o = e.axes.length > 0 ? k.normalizeAxes(e.axes, r.length) : [...Array(r.length).keys()], i = pn$1(t, 4);
    i.forEach((x) => x !== 0 || (() => {
      throw new Error("step cannot be 0");
    })), i.length === 0 && (i = Array(o.length).fill(1));
    let s = e.starts.map((x, $) => Tc$1(x, $, r, o, i)), u = e.ends.map((x, $) => Tc$1(x, $, r, o, i));
    if (o.length !== s.length || o.length !== u.length) throw new Error("start, ends and axes should have the same number of elements");
    if (o.length !== r.length) for (let x = 0; x < r.length; ++x) o.includes(x) || (s.splice(x, 0, 0), u.splice(x, 0, r[x]), i.splice(x, 0, 1));
    let d = i.map((x) => Math.sign(x));
    i.forEach((x, $, T) => {
      if (x < 0) {
        let I = (u[$] - s[$]) / x, E = s[$], A = E + I * i[$];
        s[$] = A, u[$] = E, T[$] = -x;
      }
    });
    let c = r.slice(0);
    o.forEach((x, $) => {
      c[x] = Math.ceil((u[x] - s[x]) / i[x]);
    });
    let p = { dims: c, dataType: t[0].dataType }, m = R("output", t[0].dataType, c.length), g = O("input", t[0].dataType, t[0].dims.length), b = k.size(c), y = [{ name: "outputSize", type: "u32" }, { name: "starts", type: "u32", length: s.length }, { name: "signs", type: "i32", length: d.length }, { name: "steps", type: "u32", length: i.length }], w = [{ type: 12, data: b }, { type: 12, data: s }, { type: 6, data: d }, { type: 12, data: i }, ...L(t[0].dims, c)], S = (x) => `
      ${x.registerUniforms(y).declareVariables(g, m)}
        ${zy(g, m, r)}
        ${x.mainStart()}
          ${x.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.outputSize")}
          let output_indices = ${m.offsetToIndices("global_idx")};
          let input_indices = calculateInputIndices(output_indices);
          ${m.setByOffset("global_idx", g.getByIndices("input_indices"))}
      }`;
    return { name: "Slice", shaderCache: { hint: `${d.length}_${s.length}_${i.length}`, inputDependencies: ["rank"] }, getShaderSource: S, getRunData: () => ({ outputs: [p], dispatchGroup: { x: Math.ceil(n / 64) }, programUniforms: w }) };
  }, Ic$1 = (t, e) => {
    Py(t.inputs, e);
    let r = Oy(t.inputs, e);
    t.compute(Dy(t.inputs, r), { inputs: [0] });
  }, Cc = (t) => {
    let e = t.starts, r = t.ends, n = t.axes;
    return ee$1({ starts: e, ends: r, axes: n });
  };
});
var By, My, Ec$1, kc, Pc = V$1(() => {
  J();
  ne();
  Ie();
  pt();
  ae();
  By = (t) => {
    if (!t || t.length !== 1) throw new Error("Softmax op requires 1 input.");
  }, My = (t, e) => {
    let r = t.inputs[0], n = r.dims, o = k.size(n), i = n.length, s = k.normalizeAxis(e.axis, i), u = s < n.length - 1, d, c = [];
    u ? (c = Array.from({ length: i }, (z2, v) => v), c[s] = i - 1, c[i - 1] = s, d = t.compute(Oe(r, c), { inputs: [r], outputs: [-1] })[0]) : d = r;
    let p = d.dims, m = p[i - 1], g = o / m, b = fe(m), y = m / b, w = 64;
    g === 1 && (w = 256);
    let S = (z2, v) => v === 4 ? `max(max(${z2}.x, ${z2}.y), max(${z2}.z, ${z2}.w))` : v === 2 ? `max(${z2}.x, ${z2}.y)` : v === 3 ? `max(max(${z2}.x, ${z2}.y), ${z2}.z)` : z2, x = O("x", d.dataType, d.dims, b), $ = R("result", d.dataType, d.dims, b), T = x.type.value, I = be$1(d.dataType) === "f32" ? `var threadMax = ${T}(-3.4028234663852886e+38f);` : `var threadMax = ${T}(-65504.0h);`, E = (z2) => `
      var<workgroup> rowMaxShared : ${T};
      var<workgroup> rowSumShared : ${T};
      var<workgroup> threadShared : array<${T}, ${w}>;

      fn getValue(row: i32, col: i32, row_stride: i32) -> ${T} {
        let index = row * row_stride + col;
        return x[index];
      }

      fn setValue(row: i32, col: i32, row_stride: i32, value: ${T}) {
        let index = row * row_stride + col;
        result[index] = value;
      }
      ${z2.registerUniform("packedCols", "i32").declareVariables(x, $)}
      ${z2.mainStart(w)}
        let gindex = i32(global_idx);
        let lindex = i32(local_idx);
        const wg = ${w};
        let row = gindex / wg;
        let cols = uniforms.packedCols;
        let row_stride : i32 = uniforms.packedCols;

        // find the rows max
        ${I}
        for (var col = lindex; col < cols; col += wg) {
          let value = getValue(row, col, row_stride);
          threadMax = max(threadMax, value);
        }
        if (lindex < cols) {
          threadShared[lindex] = threadMax;
        }
        workgroupBarrier();

        var reduceSize = min(cols, wg);
        for (var currSize = reduceSize >> 1;  currSize > 0; currSize = reduceSize >> 1) {
          reduceSize = currSize + (reduceSize & 1);
          if (lindex < currSize) {
            threadShared[lindex] = max(threadShared[lindex], threadShared[lindex + reduceSize]);
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowMaxShared = ${T}(${S("threadShared[0]", b)});
        }
        workgroupBarrier();

        // find the rows sum
        var threadSum = ${T}(0.0);
        for (var col = lindex; col < cols; col += wg) {
          let subExp = exp(getValue(row, col, row_stride) - rowMaxShared);
          threadSum += subExp;
        }
        threadShared[lindex] = threadSum;
        workgroupBarrier();

        for (var currSize = wg >> 1;  currSize > 0; currSize = currSize >> 1) {
          if (lindex < currSize) {
            threadShared[lindex] = threadShared[lindex] + threadShared[lindex + currSize];
          }
          workgroupBarrier();
        }
        if (lindex == 0) {
          rowSumShared = ${T}(${je("threadShared[0]", b)});
        }
        workgroupBarrier();

        // calculate final value for each element in the row
        for (var col = lindex; col < cols; col += wg) {
          var value = exp(getValue(row, col, row_stride) - rowMaxShared) / rowSumShared;
          // max operation protects against NaN since all values should be >=0
          value = max(value, ${T}(0.0));
          setValue(row, col, row_stride, value);
        }
      }`, A = t.compute({ name: "Softmax", shaderCache: { hint: `${b};${w}`, inputDependencies: ["type"] }, getRunData: () => ({ outputs: [{ dims: p, dataType: d.dataType }], dispatchGroup: { x: g }, programUniforms: [{ type: 6, data: y }] }), getShaderSource: E }, { inputs: [d], outputs: [u ? -1 : 0] })[0];
    u && t.compute(Oe(A, c), { inputs: [A] });
  }, Ec$1 = (t, e) => {
    By(t.inputs), My(t, e);
  }, kc = (t) => ee$1({ axis: t.axis });
});
var Oc$1, Ry, Uy, Ny, zc, Dc = V$1(() => {
  J();
  ne();
  ae();
  Oc$1 = (t) => Array.from(t.getBigInt64Array(), Number), Ry = (t) => {
    if (!t || t.length !== 2) throw new Error("Tile requires 2 inputs.");
    if (t[0].dataType !== 1 && t[0].dataType !== 10 && t[0].dataType !== 6 && t[0].dataType !== 12) throw new Error("Tile only support float, float16, int32, and uint32 data types");
    if (t[1].dataType !== 7) throw new Error("Tile `repeats` input should be of int64 data type");
    if (t[1].dims.length !== 1) throw new Error("Tile `repeats` input should be 1-D");
    if (Oc$1(t[1]).length !== t[0].dims.length) throw new Error("Tile `repeats` input should have same number of elements as rank of input data tensor");
  }, Uy = (t, e) => {
    let r = [];
    for (let n = 0; n < t.length; ++n) r.push(t[n] * e[n]);
    return r;
  }, Ny = (t, e) => {
    let r = t[0].dims, n = e ?? Oc$1(t[1]), o = Uy(r, n), i = k.size(o), s = t[0].dataType, u = O("input", s, r.length), d = R("output", s, o.length), c = (p) => `
      const inputShape = ${u.indices(...r)};
      ${p.registerUniform("output_size", "u32").declareVariables(u, d)}
      ${p.mainStart()}
      ${p.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.output_size")}
      let output_indices = ${d.offsetToIndices("global_idx")};
      var input_indices: ${u.type.indices};
      for (var i = 0; i < ${r.length}; i++) {
        let input_dim_i = ${u.indicesGet("uniforms.input_shape", "i")};
        let input_dim_value = ${d.indicesGet("output_indices", "i")}  % input_dim_i;

        ${u.indicesSet("input_indices", "i", "input_dim_value")}
      }
      ${d.setByOffset("global_idx", u.getByIndices("input_indices"))}
    }`;
    return { name: "Tile", shaderCache: { hint: `${n}`, inputDependencies: ["rank"] }, getRunData: () => ({ outputs: [{ dims: o, dataType: t[0].dataType }], dispatchGroup: { x: Math.ceil(i / 64) }, programUniforms: [{ type: 12, data: i }, ...L(t[0].dims, o)] }), getShaderSource: c };
  }, zc = (t) => {
    Ry(t.inputs), t.compute(Ny(t.inputs), { inputs: [0] });
  };
});
var Vy, Ly, Bc$1, Mc = V$1(() => {
  J();
  ne();
  ae();
  Vy = (t, e, r, n, o) => {
    let i = R("output_data", o, r.length, 4), s = O("a_data", e[1].dataType, e[1].dims.length, 4), u = O("b_data", e[2].dataType, e[2].dims.length, 4), d = O("c_data", e[0].dataType, e[0].dims.length, 4), c, p = (m, g, b) => `select(${g}, ${m}, ${b})`;
    if (!n) c = i.setByOffset("global_idx", p(s.getByOffset("global_idx"), u.getByOffset("global_idx"), d.getByOffset("global_idx")));
    else {
      let m = (g, b, y = "") => {
        let w = `a_data[index_a${b}][component_a${b}]`, S = `b_data[index_b${b}][component_b${b}]`, x = `bool(c_data[index_c${b}] & (0xffu << (component_c${b} * 8)))`;
        return `
            let output_indices${b} = ${i.offsetToIndices(`global_idx * 4u + ${b}u`)};
            let offset_a${b} = ${s.broadcastedIndicesToOffset(`output_indices${b}`, i)};
            let offset_b${b} = ${u.broadcastedIndicesToOffset(`output_indices${b}`, i)};
            let offset_c${b} = ${d.broadcastedIndicesToOffset(`output_indices${b}`, i)};
            let index_a${b} = offset_a${b} / 4u;
            let index_b${b} = offset_b${b} / 4u;
            let index_c${b} = offset_c${b} / 4u;
            let component_a${b} = offset_a${b} % 4u;
            let component_b${b} = offset_b${b} % 4u;
            let component_c${b} = offset_c${b} % 4u;
            ${g}[${b}] = ${y}(${p(w, S, x)});
          `;
      };
      o === 9 ? c = `
            var data = vec4<u32>(0);
            ${m("data", 0, "u32")}
            ${m("data", 1, "u32")}
            ${m("data", 2, "u32")}
            ${m("data", 3, "u32")}
            output_data[global_idx] = dot(vec4<u32>(0x1, 0x100, 0x10000, 0x1000000), vec4<u32>(data));` : c = `
            ${m("output_data[global_idx]", 0)}
            ${m("output_data[global_idx]", 1)}
            ${m("output_data[global_idx]", 2)}
            ${m("output_data[global_idx]", 3)}
          `;
    }
    return `
        ${t.registerUniform("vec_size", "u32").declareVariables(d, s, u, i)}
        ${t.mainStart()}
        ${t.guardAgainstOutOfBoundsWorkgroupSizes("uniforms.vec_size")}
        ${c}
      }`;
  }, Ly = (t) => {
    let e = t[1].dims, r = t[2].dims, n = t[0].dims, o = t[1].dataType, i = !(k.areEqual(e, r) && k.areEqual(r, n)), s = e, u = k.size(e);
    if (i) {
      let c = ot$1.calcShape(ot$1.calcShape(e, r, false), n, false);
      if (!c) throw new Error("Can't perform where op on the given tensors");
      s = c, u = k.size(s);
    }
    let d = Math.ceil(u / 4);
    return { name: "Where", shaderCache: { inputDependencies: ["rank", "rank", "rank"] }, getShaderSource: (c) => Vy(c, t, s, i, o), getRunData: () => ({ outputs: [{ dims: s, dataType: o }], dispatchGroup: { x: Math.ceil(u / 64 / 4) }, programUniforms: [{ type: 12, data: d }, ...L(n, e, r, s)] }) };
  }, Bc$1 = (t) => {
    t.compute(Ly(t.inputs));
  };
});
var Rc, Uc = V$1(() => {
  bu();
  Jr$1();
  vu();
  xu();
  ud();
  wd();
  $d();
  Ud();
  Fd();
  jd();
  Yd();
  rl();
  il();
  sl();
  ll();
  ml();
  gl();
  wl();
  $l();
  Tl();
  Dl();
  Rl();
  Nl();
  Ll();
  Hl();
  ko();
  ql();
  dc$1();
  pc$1();
  fc$1();
  yc$1();
  Yr();
  $c();
  zo();
  Sc$1();
  Ac$1();
  Pc();
  Oo();
  Dc();
  pt();
  tn$1();
  Mc();
  Rc = /* @__PURE__ */ new Map([["Abs", [Su]], ["Acos", [Tu]], ["Acosh", [Iu]], ["Add", [dd]], ["ArgMax", [yu, yo]], ["ArgMin", [gu, yo]], ["Asin", [Cu]], ["Asinh", [Au]], ["Atan", [Eu]], ["Atanh", [ku]], ["Attention", [wu]], ["AveragePool", [ec$1, Jl]], ["BatchNormalization", [_u]], ["BiasAdd", [$u]], ["BiasSplitGelu", [sd]], ["Cast", [Ou, Pu]], ["Ceil", [Du]], ["Clip", [zu]], ["Concat", [_d, vd]], ["Conv", [Io, To]], ["ConvTranspose", [Hd, Wd]], ["Cos", [Bu]], ["Cosh", [Mu]], ["CumSum", [qd, Kd]], ["DepthToSpace", [Zd, Qd]], ["DequantizeLinear", [lc$1, cc$1]], ["Div", [ld]], ["Einsum", [el, tl]], ["Elu", [Ru, nr$1]], ["Equal", [cd]], ["Erf", [Uu]], ["Exp", [Nu]], ["Expand", [ol]], ["FastGelu", [al]], ["Floor", [Vu]], ["FusedConv", [Io, To]], ["Gather", [dl, ul]], ["GatherElements", [bl, yl]], ["GatherBlockQuantized", [fl, hl]], ["GatherND", [cl, pl]], ["Gelu", [Lu]], ["Gemm", [vl, _l]], ["GlobalAveragePool", [nc$1, rc$1]], ["GlobalMaxPool", [uc$1, sc$1]], ["Greater", [hd]], ["GreaterOrEqual", [yd]], ["GridSample", [xl, Sl]], ["GroupQueryAttention", [zl]], ["HardSigmoid", [Zu, ju]], ["InstanceNormalization", [Ml]], ["LayerNormalization", [Ul]], ["LeakyRelu", [Wu, nr$1]], ["Less", [gd]], ["LessOrEqual", [bd]], ["Log", [od]], ["MatMul", [Vl]], ["MatMulNBits", [Wl, Gl]], ["MaxPool", [ic$1, ac$1]], ["Mul", [pd]], ["MultiHeadAttention", [Al, Cl]], ["Neg", [Hu]], ["Not", [Gu]], ["Pad", [Fl]], ["Pow", [md]], ["QuickGelu", [id, nr$1]], ["Range", [mc$1]], ["Reciprocal", [Fu]], ["ReduceMin", [lu]], ["ReduceMean", [iu]], ["ReduceMax", [du]], ["ReduceSum", [pu]], ["ReduceProd", [cu]], ["ReduceL1", [au]], ["ReduceL2", [su]], ["ReduceLogSum", [fu]], ["ReduceLogSumExp", [uu]], ["ReduceSumSquare", [mu]], ["Relu", [qu]], ["Resize", [_c, vc$1]], ["RotaryEmbedding", [Pl]], ["ScatterND", [gc$1, hc$1]], ["Sigmoid", [Ku]], ["Sin", [Qu]], ["Sinh", [Yu]], ["Slice", [Ic$1, Cc]], ["SkipLayerNormalization", [xc]], ["Split", [El, kl]], ["Sqrt", [Xu]], ["Softmax", [Ec$1, kc]], ["Sub", [fd]], ["Tan", [Ju]], ["Tanh", [td]], ["ThresholdedRelu", [nd, nr$1]], ["Tile", [zc]], ["Transpose", [qs$1, Ks]], ["Where", [Bc$1]]]);
});
var mn$1, Nc = V$1(() => {
  Ve$1();
  nt();
  ae();
  mn$1 = class {
    constructor(e) {
      this.backend = e;
      this.repo = /* @__PURE__ */ new Map(), this.attributesBound = false;
    }
    getArtifact(e) {
      return this.repo.get(e);
    }
    setArtifact(e, r) {
      this.repo.set(e, r);
    }
    run(e, r, n, o, i) {
      Ne(e.programInfo.name);
      let s = this.backend.device, u = this.backend.getComputePassEncoder();
      this.backend.writeTimestamp(this.backend.pendingDispatchNumber * 2);
      let d = [];
      for (let p of r) d.push({ binding: d.length, resource: { buffer: p.buffer } });
      for (let p of n) d.push({ binding: d.length, resource: { buffer: p.buffer } });
      i && d.push({ binding: d.length, resource: i });
      let c = s.createBindGroup({ layout: e.computePipeline.getBindGroupLayout(0), entries: d, label: e.programInfo.name });
      if (this.backend.sessionStatus === "capturing") {
        let p = { kernelId: this.backend.currentKernelId, computePipeline: e.computePipeline, bindGroup: c, dispatchGroup: o };
        this.backend.capturedCommandList.get(this.backend.currentSessionId).push(p);
      }
      u.setPipeline(e.computePipeline), u.setBindGroup(0, c), u.dispatchWorkgroups(...o), this.backend.writeTimestamp(this.backend.pendingDispatchNumber * 2 + 1), this.backend.pendingDispatchNumber++, (this.backend.pendingDispatchNumber >= this.backend.maxDispatchNumber || this.backend.queryType === "at-passes") && this.backend.endComputePass(), this.backend.pendingDispatchNumber >= this.backend.maxDispatchNumber && this.backend.flush(), Me(e.programInfo.name);
    }
    dispose() {
    }
    build(e, r) {
      Ne(e.name);
      let n = this.backend.device, o = [];
      [{ feature: "shader-f16", extension: "f16" }, { feature: "subgroups", extension: "subgroups" }].forEach((m) => {
        n.features.has(m.feature) && o.push(`enable ${m.extension};`);
      });
      let s = Hs$1(r, this.backend.device.limits), u = e.getShaderSource(s), d = `${o.join(`
`)}
${s.additionalImplementations}
${u}`, c = n.createShaderModule({ code: d, label: e.name });
      se("verbose", () => `[WebGPU] ${e.name} shader code: ${d}`);
      let p = n.createComputePipeline({ compute: { module: c, entryPoint: "main" }, layout: "auto", label: e.name });
      return Me(e.name), { programInfo: e, computePipeline: p, uniformVariablesInfo: s.variablesInfo };
    }
    normalizeDispatchGroupSize(e) {
      let r = typeof e == "number" ? e : e.x, n = typeof e == "number" ? 1 : e.y || 1, o = typeof e == "number" ? 1 : e.z || 1, i = this.backend.device.limits.maxComputeWorkgroupsPerDimension;
      if (r <= i && n <= i && o <= i) return [r, n, o];
      let s = r * n * o, u = Math.ceil(Math.sqrt(s));
      if (u > i) {
        if (u = Math.ceil(Math.cbrt(s)), u > i) throw new Error("Total dispatch size exceeds WebGPU maximum.");
        return [u, u, u];
      } else return [u, u, 1];
    }
  };
});
var Vc = {};
Vt(Vc, { WebGpuBackend: () => Bo });
var Wy, Gy, Do, Bo, Lc$1 = V$1(() => {
  Ve$1();
  J();
  nt();
  oo();
  Ws$1();
  Uc();
  Nc();
  Wy = (t, e) => {
    if (e.length !== t.length) throw new Error(`inputDependencies length ${e.length} is not equal to inputTensors length ${t.length}.`);
    let r = [];
    for (let n = 0; n < t.length; ++n) {
      let o = t[n].dataType;
      switch (e[n]) {
        case "none": {
          r.push("");
          break;
        }
        case "type": {
          r.push(`${o}`);
          break;
        }
        case "rank": {
          let i = t[n].dims.length;
          r.push(`${o};${i}`);
          break;
        }
        case "dims": {
          let i = t[n].dims.join(",");
          r.push(`${o};${i}`);
          break;
        }
        default:
          throw new Error(`unsupported input dependency: ${e[n]}`);
      }
    }
    return r.join("|");
  }, Gy = (t, e, r) => {
    var _a2, _b;
    let n = t.name;
    return ((_a2 = t.shaderCache) == null ? void 0 : _a2.hint) && (n += "[" + t.shaderCache.hint + "]"), n += ":" + r + `:${Wy(e, ((_b = t.shaderCache) == null ? void 0 : _b.inputDependencies) ?? new Array(e.length).fill("dims"))}`, n;
  }, Do = class {
    constructor(e) {
      e && (this.architecture = e.architecture, this.vendor = e.vendor);
    }
    isArchitecture(e) {
      return this.architecture === e;
    }
    isVendor(e) {
      return this.vendor === e;
    }
  }, Bo = class {
    constructor() {
      this.currentSessionId = null;
      this.currentKernelId = null;
      this.commandEncoder = null;
      this.computePassEncoder = null;
      this.maxDispatchNumber = 16;
      this.pendingDispatchNumber = 0;
      this.pendingKernels = [];
      this.pendingQueries = /* @__PURE__ */ new Map();
      this.sessionStatus = "default";
      this.capturedCommandList = /* @__PURE__ */ new Map();
      this.capturedPendingKernels = /* @__PURE__ */ new Map();
      this.sessionExternalDataMapping = /* @__PURE__ */ new Map();
    }
    get currentKernelCustomData() {
      if (this.currentKernelId === null) throw new Error("currentKernelCustomData(): currentKernelId is null. (should not happen)");
      let e = this.kernelCustomData.get(this.currentKernelId);
      return e || (e = {}, this.kernelCustomData.set(this.currentKernelId, e)), e;
    }
    async initialize(e, r) {
      this.env = e;
      let n = [], o = { requiredLimits: { maxComputeWorkgroupStorageSize: r.limits.maxComputeWorkgroupStorageSize, maxComputeWorkgroupsPerDimension: r.limits.maxComputeWorkgroupsPerDimension, maxStorageBufferBindingSize: r.limits.maxStorageBufferBindingSize, maxBufferSize: r.limits.maxBufferSize, maxComputeInvocationsPerWorkgroup: r.limits.maxComputeInvocationsPerWorkgroup, maxComputeWorkgroupSizeX: r.limits.maxComputeWorkgroupSizeX, maxComputeWorkgroupSizeY: r.limits.maxComputeWorkgroupSizeY, maxComputeWorkgroupSizeZ: r.limits.maxComputeWorkgroupSizeZ }, requiredFeatures: n }, i = (s) => r.features.has(s) && n.push(s) && true;
      i("chromium-experimental-timestamp-query-inside-passes") || i("timestamp-query"), i("shader-f16"), i("subgroups"), this.device = await r.requestDevice(o), this.adapterInfo = new Do(r.info || await r.requestAdapterInfo()), this.gpuDataManager = Ls$1(this), this.programManager = new mn$1(this), this.kernels = /* @__PURE__ */ new Map(), this.kernelPersistentData = /* @__PURE__ */ new Map(), this.kernelCustomData = /* @__PURE__ */ new Map(), Lr(e.logLevel, !!e.debug), this.device.onuncapturederror = (s) => {
        s.error instanceof GPUValidationError && console.error(`An uncaught WebGPU validation error was raised: ${s.error.message}`);
      }, Object.defineProperty(this.env.webgpu, "device", { value: this.device, writable: false, enumerable: true, configurable: false }), Object.defineProperty(this.env.webgpu, "adapter", { value: r, writable: false, enumerable: true, configurable: false }), this.setQueryType();
    }
    dispose() {
      typeof this.querySet < "u" && this.querySet.destroy(), this.gpuDataManager.dispose();
    }
    getCommandEncoder() {
      return this.commandEncoder || (this.commandEncoder = this.device.createCommandEncoder()), this.commandEncoder;
    }
    getComputePassEncoder() {
      if (!this.computePassEncoder) {
        let e = this.getCommandEncoder(), r = {};
        this.queryType === "at-passes" && (r.timestampWrites = { querySet: this.querySet, beginningOfPassWriteIndex: this.pendingDispatchNumber * 2, endOfPassWriteIndex: this.pendingDispatchNumber * 2 + 1 }), this.computePassEncoder = e.beginComputePass(r);
      }
      return this.computePassEncoder;
    }
    endComputePass() {
      this.computePassEncoder && (this.computePassEncoder.end(), this.computePassEncoder = null);
    }
    flush() {
      if (!this.commandEncoder) return;
      Ne(), this.endComputePass();
      let e;
      this.queryType !== "none" && (this.commandEncoder.resolveQuerySet(this.querySet, 0, this.pendingDispatchNumber * 2, this.queryResolveBuffer, 0), e = this.device.createBuffer({ size: this.pendingDispatchNumber * 2 * 8, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }), this.pendingQueries.set(e, this.pendingKernels), this.pendingKernels = [], this.commandEncoder.copyBufferToBuffer(this.queryResolveBuffer, 0, e, 0, this.pendingDispatchNumber * 2 * 8)), this.device.queue.submit([this.commandEncoder.finish()]), this.gpuDataManager.refreshPendingBuffers(), this.commandEncoder = null, this.pendingDispatchNumber = 0, this.queryType !== "none" && e.mapAsync(GPUMapMode.READ).then(() => {
        var _a2;
        let r = new BigUint64Array(e.getMappedRange()), n = this.pendingQueries.get(e);
        for (let o = 0; o < r.length / 2; o++) {
          let i = n[o], s = i.kernelId, u = this.kernels.get(s), d = u.kernelType, c = u.kernelName, p = i.programName, m = i.inputTensorViews, g = i.outputTensorViews, b = r[o * 2], y = r[o * 2 + 1];
          typeof this.queryTimeBase > "u" && (this.queryTimeBase = b);
          let w = Number(b - this.queryTimeBase), S = Number(y - this.queryTimeBase);
          if (!Number.isSafeInteger(w) || !Number.isSafeInteger(S)) throw new RangeError("incorrect timestamp range");
          if ((_a2 = this.env.webgpu.profiling) == null ? void 0 : _a2.ondata) this.env.webgpu.profiling.ondata({ version: 1, inputsMetadata: m.map((x) => ({ dims: x.dims, dataType: rt$1(x.dataType) })), outputsMetadata: g.map((x) => ({ dims: x.dims, dataType: rt$1(x.dataType) })), kernelId: s, kernelType: d, kernelName: c, programName: p, startTime: w, endTime: S });
          else {
            let x = "";
            m.forEach((T, I) => {
              x += `input[${I}]: [${T.dims}] | ${rt$1(T.dataType)}, `;
            });
            let $ = "";
            g.forEach((T, I) => {
              $ += `output[${I}]: [${T.dims}] | ${rt$1(T.dataType)}, `;
            }), console.log(`[profiling] kernel "${s}|${d}|${c}|${p}" ${x}${$}start time: ${w} ns, execution time: ${S - w} ns`);
          }
          Sr("GPU", `${p}::${b}::${y}`);
        }
        e.unmap(), this.pendingQueries.delete(e);
      }), Me();
    }
    run(e, r, n, o, i, s) {
      Ne(e.name);
      let u = [];
      for (let T = 0; T < r.length; ++T) {
        let I = r[T].data;
        if (I === 0) continue;
        let E = this.gpuDataManager.get(I);
        if (!E) throw new Error(`no GPU data for input: ${I}`);
        u.push(E);
      }
      let { outputs: d, dispatchGroup: c, programUniforms: p } = e.getRunData(r), m = n.length === 0 ? d.map((T, I) => I) : n;
      if (m.length !== d.length) throw new Error(`Output size ${m.length} must be equal to ${d.length}.`);
      let g = [], b = [];
      for (let T = 0; T < d.length; ++T) {
        if (!Number.isInteger(m[T]) || m[T] < -3 || m[T] >= s) throw new Error(`Invalid output index: ${m[T]}`);
        if (m[T] === -3) continue;
        let I = m[T] === -1, E = m[T] === -2, A = I || E ? i(d[T].dataType, d[T].dims) : o(m[T], d[T].dataType, d[T].dims);
        if (g.push(A), A.data === 0) continue;
        let z2 = this.gpuDataManager.get(A.data);
        if (!z2) throw new Error(`no GPU data for output: ${A.data}`);
        if (I && this.temporaryData.push(z2), E) {
          let v = this.kernelPersistentData.get(this.currentKernelId);
          v || (v = [], this.kernelPersistentData.set(this.currentKernelId, v)), v.push(z2);
        }
        b.push(z2);
      }
      if (u.length !== r.length || b.length !== g.length) {
        if (b.length === 0) return Me(e.name), g;
        throw new Error(`Program ${e.name} has zero-sized tensor(s) in inputs or outputs. This is not supported now.`);
      }
      let y;
      if (p) {
        let T = 0, I = [];
        p.forEach((v) => {
          let M = typeof v.data == "number" ? [v.data] : v.data;
          if (M.length === 0) return;
          let N = v.type === 10 ? 2 : 4, K, q;
          v.type === 10 ? (q = M.length > 4 ? 16 : M.length > 2 ? 8 : M.length * N, K = M.length > 4 ? 16 : N * M.length) : (q = M.length <= 2 ? M.length * N : 16, K = 16), T = Math.ceil(T / q) * q, I.push(T);
          let Q = v.type === 10 ? 8 : 4;
          T += M.length > 4 ? Math.ceil(M.length / Q) * K : M.length * N;
        });
        let E = 16;
        T = Math.ceil(T / E) * E;
        let A = new ArrayBuffer(T);
        p.forEach((v, M) => {
          let N = I[M], K = typeof v.data == "number" ? [v.data] : v.data;
          if (v.type === 6) new Int32Array(A, N, K.length).set(K);
          else if (v.type === 12) new Uint32Array(A, N, K.length).set(K);
          else if (v.type === 10) new Uint16Array(A, N, K.length).set(K);
          else if (v.type === 1) new Float32Array(A, N, K.length).set(K);
          else throw new Error(`Unsupported uniform type: ${rt$1(v.type)}`);
        });
        let z2 = this.gpuDataManager.create(T, GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM);
        this.device.queue.writeBuffer(z2.buffer, 0, A, 0, T), this.gpuDataManager.release(z2.id), y = { offset: 0, size: T, buffer: z2.buffer };
      }
      let w = this.programManager.normalizeDispatchGroupSize(c), S = w[1] === 1 && w[2] === 1, x = Gy(e, r, S), $ = this.programManager.getArtifact(x);
      if ($ || ($ = this.programManager.build(e, w), this.programManager.setArtifact(x, $), se("info", () => `[artifact] key: ${x}, programName: ${e.name}`)), p && $.uniformVariablesInfo) {
        if (p.length !== $.uniformVariablesInfo.length) throw new Error(`Uniform variables count mismatch: expect ${$.uniformVariablesInfo.length}, got ${p.length} in program "${$.programInfo.name}".`);
        for (let T = 0; T < p.length; T++) {
          let I = p[T], E = I.type, A = typeof I.data == "number" ? 1 : I.data.length, [z2, v] = $.uniformVariablesInfo[T];
          if (E !== z2 || A !== v) throw new Error(`Uniform variable ${T} mismatch: expect type ${z2} with size ${v}, got type ${E} with size ${A} in program "${$.programInfo.name}".`);
        }
      }
      if (se("info", () => `[ProgramManager] run "${e.name}" (key=${x}) with ${w[0]}x${w[1]}x${w[2]}`), this.queryType !== "none" || this.sessionStatus === "capturing") {
        let T = { kernelId: this.currentKernelId, programName: $.programInfo.name, inputTensorViews: r, outputTensorViews: g };
        this.pendingKernels.push(T), this.sessionStatus === "capturing" && this.capturedPendingKernels.get(this.currentSessionId).push(T);
      }
      return this.programManager.run($, u, b, w, y), Me(e.name), g;
    }
    upload(e, r) {
      this.gpuDataManager.upload(e, r);
    }
    memcpy(e, r) {
      this.gpuDataManager.memcpy(e, r);
    }
    async download(e, r) {
      await this.gpuDataManager.download(e, r);
    }
    alloc(e) {
      return this.gpuDataManager.create(e).id;
    }
    free(e) {
      return this.gpuDataManager.release(e);
    }
    createKernel(e, r, n, o) {
      let i = Rc.get(e);
      if (!i) throw new Error(`kernel not implemented: ${e}`);
      let s = { kernelType: e, kernelName: o, kernelEntry: i[0], attributes: [i[1], n] };
      this.kernels.set(r, s);
    }
    releaseKernel(e) {
      let r = this.kernelPersistentData.get(e);
      if (r) {
        for (let n of r) this.gpuDataManager.release(n.id);
        this.kernelPersistentData.delete(e);
      }
      this.kernelCustomData.delete(e), this.kernels.delete(e);
    }
    computeKernel(e, r, n) {
      let o = this.kernels.get(e);
      if (!o) throw new Error(`kernel not created: ${e}`);
      let i = o.kernelType, s = o.kernelName, u = o.kernelEntry, d = o.attributes;
      if (this.currentKernelId !== null) throw new Error(`kernel "[${i}] ${s}" is not allowed to be called recursively`);
      this.currentKernelId = e, d[0] && (d[1] = d[0](d[1]), d[0] = void 0), se("info", () => `[WebGPU] Start to run kernel "[${i}] ${s}"...`);
      let c = this.env.debug;
      this.temporaryData = [];
      try {
        return c && this.device.pushErrorScope("validation"), u(r, d[1]), 0;
      } catch (p) {
        return n.push(Promise.resolve(`[WebGPU] Kernel "[${i}] ${s}" failed. ${p}`)), 1;
      } finally {
        c && n.push(this.device.popErrorScope().then((p) => p ? `GPU validation error for kernel "[${i}] ${s}": ${p.message}` : null));
        for (let p of this.temporaryData) this.gpuDataManager.release(p.id);
        this.temporaryData = [], this.currentKernelId = null;
      }
    }
    registerBuffer(e, r, n, o) {
      let i = this.sessionExternalDataMapping.get(e);
      i || (i = /* @__PURE__ */ new Map(), this.sessionExternalDataMapping.set(e, i));
      let s = i.get(r), u = this.gpuDataManager.registerExternalBuffer(n, o, s);
      return i.set(r, [u, n]), u;
    }
    unregisterBuffers(e) {
      let r = this.sessionExternalDataMapping.get(e);
      r && (r.forEach((n) => this.gpuDataManager.unregisterExternalBuffer(n[0])), this.sessionExternalDataMapping.delete(e));
    }
    getBuffer(e) {
      let r = this.gpuDataManager.get(e);
      if (!r) throw new Error(`no GPU data for buffer: ${e}`);
      return r.buffer;
    }
    createDownloader(e, r, n) {
      return async () => {
        let o = await co(this, e, r);
        return Gr(o.buffer, n);
      };
    }
    writeTimestamp(e) {
      this.queryType === "inside-passes" && this.computePassEncoder.writeTimestamp(this.querySet, e);
    }
    setQueryType() {
      var _a2;
      this.queryType = "none", (((_a2 = this.env.webgpu.profiling) == null ? void 0 : _a2.mode) === "default" || (typeof this.env.trace > "u" ? this.env.wasm.trace : this.env.trace)) && (this.device.features.has("chromium-experimental-timestamp-query-inside-passes") ? this.queryType = "inside-passes" : this.device.features.has("timestamp-query") && (this.queryType = "at-passes"), this.queryType !== "none" && typeof this.querySet > "u" && (this.querySet = this.device.createQuerySet({ type: "timestamp", count: this.maxDispatchNumber * 2 }), this.queryResolveBuffer = this.device.createBuffer({ size: this.maxDispatchNumber * 2 * 8, usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.QUERY_RESOLVE })));
    }
    captureBegin() {
      se("info", "captureBegin"), this.capturedCommandList.get(this.currentSessionId) || this.capturedCommandList.set(this.currentSessionId, []), this.capturedPendingKernels.get(this.currentSessionId) || this.capturedPendingKernels.set(this.currentSessionId, []), this.flush(), this.sessionStatus = "capturing";
    }
    captureEnd() {
      se("info", "captureEnd"), this.flush(), this.sessionStatus = "default";
    }
    replay() {
      se("info", "replay"), this.sessionStatus = "replaying";
      let e = this.capturedCommandList.get(this.currentSessionId), r = this.capturedPendingKernels.get(this.currentSessionId), n = e.length;
      this.pendingKernels = [];
      for (let o = 0; o < n; o++) {
        let i = this.getComputePassEncoder(), s = e[o];
        this.writeTimestamp(this.pendingDispatchNumber * 2), i.setPipeline(s.computePipeline), i.setBindGroup(0, s.bindGroup), i.dispatchWorkgroups(...s.dispatchGroup), this.writeTimestamp(this.pendingDispatchNumber * 2 + 1), this.pendingDispatchNumber++, this.queryType !== "none" && this.pendingKernels.push(r[o]), (this.pendingDispatchNumber >= this.maxDispatchNumber || this.queryType === "at-passes") && this.endComputePass(), this.pendingDispatchNumber >= this.maxDispatchNumber && this.flush();
      }
      this.flush(), this.sessionStatus = "default";
    }
    onCreateSession() {
      this.gpuDataManager.onCreateSession();
    }
    onReleaseSession(e) {
      this.unregisterBuffers(e), this.capturedCommandList.has(e) && this.capturedCommandList.delete(e), this.capturedPendingKernels.has(e) && this.capturedPendingKernels.delete(e), this.gpuDataManager.onReleaseSession(e);
    }
    onRunStart(e) {
      this.currentSessionId = e, this.setQueryType();
    }
  };
});
var Wc = {};
Vt(Wc, { init: () => Hy });
var sr$1, Mo, Hy, Gc = V$1(() => {
  J();
  nt();
  ne();
  Rs$1();
  sr$1 = class t {
    constructor(e, r, n, o) {
      this.module = e;
      this.dataType = r;
      this.data = n;
      this.dims = o;
    }
    getFloat32Array() {
      if (this.dataType !== 1) throw new Error("Invalid data type");
      let e = k.size(this.dims);
      return e === 0 ? new Float32Array() : new Float32Array(this.module.HEAP8.buffer, this.data, e);
    }
    getBigInt64Array() {
      if (this.dataType !== 7) throw new Error("Invalid data type");
      let e = k.size(this.dims);
      return e === 0 ? new BigInt64Array() : new BigInt64Array(this.module.HEAP8.buffer, this.data, e);
    }
    getInt32Array() {
      if (this.dataType !== 6) throw new Error("Invalid data type");
      let e = k.size(this.dims);
      return e === 0 ? new Int32Array() : new Int32Array(this.module.HEAP8.buffer, this.data, e);
    }
    getUint16Array() {
      if (this.dataType !== 10 && this.dataType !== 4) throw new Error("Invalid data type");
      let e = k.size(this.dims);
      return e === 0 ? new Uint16Array() : new Uint16Array(this.module.HEAP8.buffer, this.data, e);
    }
    reshape(e) {
      if (k.size(e) !== k.size(this.dims)) throw new Error("Invalid new shape");
      return new t(this.module, this.dataType, this.data, e);
    }
  }, Mo = class {
    constructor(e, r, n) {
      this.module = e;
      this.backend = r;
      this.customDataOffset = 0;
      this.customDataSize = 0;
      this.adapterInfo = r.adapterInfo;
      let o = e.PTR_SIZE, i = n / e.PTR_SIZE, s = o === 4 ? "i32" : "i64";
      this.opKernelContext = Number(e.getValue(o * i++, s));
      let u = Number(e.getValue(o * i++, s));
      this.outputCount = Number(e.getValue(o * i++, s)), this.customDataOffset = Number(e.getValue(o * i++, "*")), this.customDataSize = Number(e.getValue(o * i++, s));
      let d = [];
      for (let c = 0; c < u; c++) {
        let p = Number(e.getValue(o * i++, s)), m = Number(e.getValue(o * i++, "*")), g = Number(e.getValue(o * i++, s)), b = [];
        for (let y = 0; y < g; y++) b.push(Number(e.getValue(o * i++, s)));
        d.push(new sr$1(e, p, m, b));
      }
      this.inputs = d;
    }
    get kernelCustomData() {
      return this.backend.currentKernelCustomData;
    }
    get customDataBuffer() {
      return this.module.HEAPU8.subarray(this.customDataOffset, this.customDataOffset + this.customDataSize);
    }
    compute(e, r) {
      var _a2;
      let n = ((_a2 = r == null ? void 0 : r.inputs) == null ? void 0 : _a2.map((u) => typeof u == "number" ? this.inputs[u] : u)) ?? this.inputs, o = (r == null ? void 0 : r.outputs) ?? [], i = (u, d, c) => new sr$1(this.module, d, this.output(u, c), c), s = (u, d) => {
        let c = xt$1(u, d);
        if (!c) throw new Error(`Unsupported data type: ${u}`);
        let p = c > 0 ? this.backend.gpuDataManager.create(c).id : 0;
        return new sr$1(this.module, u, p, d);
      };
      return this.backend.run(e, n, o, i, s, this.outputCount);
    }
    output(e, r) {
      let n = this.module.stackSave();
      try {
        let o = this.module.PTR_SIZE, i = o === 4 ? "i32" : "i64", s = this.module.stackAlloc((1 + r.length) * o);
        this.module.setValue(s, r.length, i);
        for (let u = 0; u < r.length; u++) this.module.setValue(s + o * (u + 1), r[u], i);
        return this.module._JsepOutput(this.opKernelContext, e, s);
      } catch (o) {
        throw new Error(`Failed to generate kernel's output[${e}] with dims [${r}]. If you are running with pre-allocated output, please make sure the output type/dims are correct. Error: ${o}`);
      } finally {
        this.module.stackRestore(n);
      }
    }
  }, Hy = async (t, e, r, n) => {
    let o = e.jsepInit;
    if (!o) throw new Error("Failed to initialize JSEP. The WebAssembly module is not built with JSEP support.");
    if (t === "webgpu") {
      let i = (Lc$1(), Yt$1(Vc)).WebGpuBackend, s = new i();
      await s.initialize(r, n), o("webgpu", [s, (u) => s.alloc(Number(u)), (u) => s.free(u), (u, d, c, p = false) => {
        if (p) se("verbose", () => `[WebGPU] jsepCopyGpuToGpu: src=${Number(u)}, dst=${Number(d)}, size=${Number(c)}`), s.memcpy(Number(u), Number(d));
        else {
          se("verbose", () => `[WebGPU] jsepCopyCpuToGpu: dataOffset=${Number(u)}, gpuDataId=${Number(d)}, size=${Number(c)}`);
          let m = e.HEAPU8.subarray(Number(u >>> 0), Number(u >>> 0) + Number(c));
          s.upload(Number(d), m);
        }
      }, async (u, d, c) => {
        se("verbose", () => `[WebGPU] jsepCopyGpuToCpu: gpuDataId=${u}, dataOffset=${d}, size=${c}`), await s.download(Number(u), () => e.HEAPU8.subarray(Number(d) >>> 0, Number(d + c) >>> 0));
      }, (u, d, c) => s.createKernel(u, Number(d), c, e.UTF8ToString(e._JsepGetNodeName(Number(d)))), (u) => s.releaseKernel(u), (u, d, c, p) => {
        se("verbose", () => `[WebGPU] jsepRun: sessionHandle=${c}, kernel=${u}, contextDataOffset=${d}`);
        let m = new Mo(e, s, Number(d));
        return s.computeKernel(Number(u), m, p);
      }, () => s.captureBegin(), () => s.captureEnd(), () => s.replay()]);
    } else {
      let i = new Kr$1(r);
      o("webnn", [i, () => i.reserveTensorId(), (s) => i.releaseTensorId(s), async (s, u, d, c, p) => i.ensureTensor(s, u, d, c, p), (s, u) => {
        i.uploadTensor(s, u);
      }, async (s, u) => i.downloadTensor(s, u), (s, u) => i.registerMLContext(s, u), !!r.trace]);
    }
  };
});
var Fy, Er, kr, Mt$1, qy, Hc, Jt$1, Pr, Or, Fc, zr, Dr, Br, Qn = V$1(() => {
  Ve$1();
  Ss$1();
  Is$1();
  J();
  vt();
  Rr();
  ro();
  Fy = (t, e) => {
    ge()._OrtInit(t, e) !== 0 && me("Can't initialize onnxruntime.");
  }, Er = async (t) => {
    Fy(t.wasm.numThreads, tr$1(t.logLevel));
  }, kr = async (t, e) => {
    var _a2, _b;
    (_b = (_a2 = ge()).asyncInit) == null ? void 0 : _b.call(_a2);
    let r = t.webgpu.adapter;
    if (e === "webgpu") {
      if (typeof navigator > "u" || !navigator.gpu) throw new Error("WebGPU is not supported in current environment");
      if (r) {
        if (typeof r.limits != "object" || typeof r.features != "object" || typeof r.requestDevice != "function") throw new Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.");
      } else {
        let n = t.webgpu.powerPreference;
        if (n !== void 0 && n !== "low-power" && n !== "high-performance") throw new Error(`Invalid powerPreference setting: "${n}"`);
        let o = t.webgpu.forceFallbackAdapter;
        if (o !== void 0 && typeof o != "boolean") throw new Error(`Invalid forceFallbackAdapter setting: "${o}"`);
        if (r = await navigator.gpu.requestAdapter({ powerPreference: n, forceFallbackAdapter: o }), !r) throw new Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.');
      }
    }
    if (e === "webnn" && (typeof navigator > "u" || !navigator.ml)) throw new Error("WebNN is not supported in current environment");
    {
      let n = (Gc(), Yt$1(Wc)).init;
      e === "webgpu" && await n("webgpu", ge(), t, r), e === "webnn" && await n("webnn", ge(), t);
    }
  }, Mt$1 = /* @__PURE__ */ new Map(), qy = (t) => {
    let e = ge(), r = e.stackSave();
    try {
      let n = e.PTR_SIZE, o = e.stackAlloc(2 * n);
      e._OrtGetInputOutputCount(t, o, o + n) !== 0 && me("Can't get session input/output count.");
      let s = n === 4 ? "i32" : "i64";
      return [Number(e.getValue(o, s)), Number(e.getValue(o + n, s))];
    } finally {
      e.stackRestore(r);
    }
  }, Hc = (t, e) => {
    let r = ge(), n = r.stackSave(), o = 0;
    try {
      let i = r.PTR_SIZE, s = r.stackAlloc(2 * i);
      r._OrtGetInputOutputMetadata(t, e, s, s + i) !== 0 && me("Can't get session input/output metadata.");
      let d = Number(r.getValue(s, "*"));
      o = Number(r.getValue(s + i, "*"));
      let c = r.HEAP32[o / 4];
      if (c === 0) return [d, 0];
      let p = r.HEAPU32[o / 4 + 1], m = [];
      for (let g = 0; g < p; g++) {
        let b = Number(r.getValue(o + 8 + g * i, "*"));
        m.push(b !== 0 ? r.UTF8ToString(b) : Number(r.getValue(o + 8 + (g + p) * i, "*")));
      }
      return [d, c, m];
    } finally {
      r.stackRestore(n), o !== 0 && r._OrtFree(o);
    }
  }, Jt$1 = (t) => {
    let e = ge(), r = e._malloc(t.byteLength);
    if (r === 0) throw new Error(`Can't create a session. failed to allocate a buffer of size ${t.byteLength}.`);
    return e.HEAPU8.set(t, r), [r, t.byteLength];
  }, Pr = async (t, e) => {
    var _a2, _b, _c2, _d2;
    let r, n, o = ge();
    Array.isArray(t) ? [r, n] = t : t.buffer === o.HEAPU8.buffer ? [r, n] = [t.byteOffset, t.byteLength] : [r, n] = Jt$1(t);
    let i = 0, s = 0, u = 0, d = [], c = [], p = [];
    try {
      if ([s, d] = await Ts$1(e), (e == null ? void 0 : e.externalData) && o.mountExternalData) {
        let I = [];
        for (let E of e.externalData) {
          let A = typeof E == "string" ? E : E.path;
          I.push(rr$1(typeof E == "string" ? E : E.data).then((z2) => {
            o.mountExternalData(A, z2);
          }));
        }
        await Promise.all(I);
      }
      for (let I of (e == null ? void 0 : e.executionProviders) ?? []) if ((typeof I == "string" ? I : I.name) === "webnn") {
        if (o.shouldTransferToMLTensor = false, typeof I != "string") {
          let A = I, z2 = A == null ? void 0 : A.context, v = A == null ? void 0 : A.gpuDevice, M = A == null ? void 0 : A.deviceType, N = A == null ? void 0 : A.powerPreference;
          z2 ? o.currentContext = z2 : v ? o.currentContext = await o.webnnCreateMLContext(v) : o.currentContext = await o.webnnCreateMLContext({ deviceType: M, powerPreference: N });
        } else o.currentContext = await o.webnnCreateMLContext();
        break;
      }
      i = await o._OrtCreateSession(r, n, s), (_a2 = o.webgpuOnCreateSession) == null ? void 0 : _a2.call(o, i), i === 0 && me("Can't create a session."), (_b = o.jsepOnCreateSession) == null ? void 0 : _b.call(o), o.currentContext && (o.webnnRegisterMLContext(i, o.currentContext), o.currentContext = void 0, o.shouldTransferToMLTensor = true);
      let [m, g] = qy(i), b = !!(e == null ? void 0 : e.enableGraphCapture), y = [], w = [], S = [], x = [], $ = [];
      for (let I = 0; I < m; I++) {
        let [E, A, z2] = Hc(i, I);
        E === 0 && me("Can't get an input name."), c.push(E);
        let v = o.UTF8ToString(E);
        y.push(v), S.push(A === 0 ? { name: v, isTensor: false } : { name: v, isTensor: true, type: rt$1(A), shape: z2 });
      }
      for (let I = 0; I < g; I++) {
        let [E, A, z2] = Hc(i, I + m);
        E === 0 && me("Can't get an output name."), p.push(E);
        let v = o.UTF8ToString(E);
        w.push(v), x.push(A === 0 ? { name: v, isTensor: false } : { name: v, isTensor: true, type: rt$1(A), shape: z2 });
        {
          if (b && (e == null ? void 0 : e.preferredOutputLocation) === void 0) {
            $.push("gpu-buffer");
            continue;
          }
          let M = typeof (e == null ? void 0 : e.preferredOutputLocation) == "string" ? e.preferredOutputLocation : ((_c2 = e == null ? void 0 : e.preferredOutputLocation) == null ? void 0 : _c2[v]) ?? "cpu", N = o.webnnIsGraphOutput;
          if (M === "cpu" && N && N(i, v)) {
            $.push("ml-tensor-cpu-output");
            continue;
          }
          if (M !== "cpu" && M !== "cpu-pinned" && M !== "gpu-buffer" && M !== "ml-tensor") throw new Error(`Not supported preferred output location: ${M}.`);
          if (b && M !== "gpu-buffer") throw new Error(`Not supported preferred output location: ${M}. Only 'gpu-buffer' location is supported when enableGraphCapture is true.`);
          $.push(M);
        }
      }
      let T = null;
      return $.some((I) => I === "gpu-buffer" || I === "ml-tensor" || I === "ml-tensor-cpu-output") && (u = o._OrtCreateBinding(i), u === 0 && me("Can't create IO binding."), T = { handle: u, outputPreferredLocations: $, outputPreferredLocationsEncoded: $.map((I) => I === "ml-tensor-cpu-output" ? "ml-tensor" : I).map((I) => to(I)) }), Mt$1.set(i, [i, c, p, T, b, false]), [i, y, w, S, x];
    } catch (m) {
      throw c.forEach((g) => o._OrtFree(g)), p.forEach((g) => o._OrtFree(g)), u !== 0 && o._OrtReleaseBinding(u) !== 0 && me("Can't release IO binding."), i !== 0 && o._OrtReleaseSession(i) !== 0 && me("Can't release session."), m;
    } finally {
      o._free(r), s !== 0 && o._OrtReleaseSessionOptions(s) !== 0 && me("Can't release session options."), d.forEach((m) => o._free(m)), (_d2 = o.unmountExternalData) == null ? void 0 : _d2.call(o);
    }
  }, Or = (t) => {
    var _a2, _b, _c2;
    let e = ge(), r = Mt$1.get(t);
    if (!r) throw new Error(`cannot release session. invalid session id: ${t}`);
    let [n, o, i, s, u] = r;
    s && (u && e._OrtClearBoundOutputs(s.handle) !== 0 && me("Can't clear bound outputs."), e._OrtReleaseBinding(s.handle) !== 0 && me("Can't release IO binding.")), (_a2 = e.jsepOnReleaseSession) == null ? void 0 : _a2.call(e, t), (_b = e.webnnOnReleaseSession) == null ? void 0 : _b.call(e, t), (_c2 = e.webgpuOnReleaseSession) == null ? void 0 : _c2.call(e, t), o.forEach((d) => e._OrtFree(d)), i.forEach((d) => e._OrtFree(d)), e._OrtReleaseSession(n) !== 0 && me("Can't release session."), Mt$1.delete(t);
  }, Fc = async (t, e, r, n, o, i, s = false) => {
    if (!t) {
      e.push(0);
      return;
    }
    let u = ge(), d = u.PTR_SIZE, c = t[0], p = t[1], m = t[3], g = m, b, y;
    if (c === "string" && (m === "gpu-buffer" || m === "ml-tensor")) throw new Error("String tensor is not supported on GPU.");
    if (s && m !== "gpu-buffer") throw new Error(`External buffer must be provided for input/output index ${i} when enableGraphCapture is true.`);
    if (m === "gpu-buffer") {
      let x = t[2].gpuBuffer;
      y = xt$1($t(c), p);
      {
        let $ = u.jsepRegisterBuffer;
        if (!$) throw new Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');
        b = $(n, i, x, y);
      }
    } else if (m === "ml-tensor") {
      let x = t[2].mlTensor;
      y = xt$1($t(c), p);
      let $ = u.webnnRegisterMLTensor;
      if (!$) throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');
      b = $(n, x, $t(c), p);
    } else {
      let x = t[2];
      if (Array.isArray(x)) {
        y = d * x.length, b = u._malloc(y), r.push(b);
        for (let $ = 0; $ < x.length; $++) {
          if (typeof x[$] != "string") throw new TypeError(`tensor data at index ${$} is not a string`);
          u.setValue(b + $ * d, We(x[$], r), "*");
        }
      } else {
        let $ = u.webnnIsGraphInput, T = u.webnnIsGraphOutput;
        if (c !== "string" && $ && T) {
          let I = u.UTF8ToString(o);
          if ($(n, I) || T(n, I)) {
            let E = $t(c);
            y = xt$1(E, p), g = "ml-tensor";
            let A = u.webnnCreateTemporaryTensor, z2 = u.webnnUploadTensor;
            if (!A || !z2) throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');
            let v = await A(n, E, p);
            z2(v, new Uint8Array(x.buffer, x.byteOffset, x.byteLength)), b = v;
          } else y = x.byteLength, b = u._malloc(y), r.push(b), u.HEAPU8.set(new Uint8Array(x.buffer, x.byteOffset, y), b);
        } else y = x.byteLength, b = u._malloc(y), r.push(b), u.HEAPU8.set(new Uint8Array(x.buffer, x.byteOffset, y), b);
      }
    }
    let w = u.stackSave(), S = u.stackAlloc(4 * p.length);
    try {
      p.forEach(($, T) => u.setValue(S + T * d, $, d === 4 ? "i32" : "i64"));
      let x = u._OrtCreateTensor($t(c), b, y, S, p.length, to(g));
      x === 0 && me(`Can't create tensor for input/output. session=${n}, index=${i}.`), e.push(x);
    } finally {
      u.stackRestore(w);
    }
  }, zr = async (t, e, r, n, o, i) => {
    var _a2, _b, _c2, _d2;
    let s = ge(), u = s.PTR_SIZE, d = Mt$1.get(t);
    if (!d) throw new Error(`cannot run inference. invalid session id: ${t}`);
    let c = d[0], p = d[1], m = d[2], g = d[3], b = d[4], y = d[5], w = e.length, S = n.length, x = 0, $ = [], T = [], I = [], E = [], A = [], z2 = s.stackSave(), v = s.stackAlloc(w * u), M = s.stackAlloc(w * u), N = s.stackAlloc(S * u), K = s.stackAlloc(S * u);
    try {
      [x, $] = xs$1(i), wt("wasm prepareInputOutputTensor");
      for (let W = 0; W < w; W++) await Fc(r[W], T, E, t, p[e[W]], e[W], b);
      for (let W = 0; W < S; W++) await Fc(o[W], I, E, t, m[n[W]], w + n[W], b);
      _t("wasm prepareInputOutputTensor");
      for (let W = 0; W < w; W++) s.setValue(v + W * u, T[W], "*"), s.setValue(M + W * u, p[e[W]], "*");
      for (let W = 0; W < S; W++) s.setValue(N + W * u, I[W], "*"), s.setValue(K + W * u, m[n[W]], "*");
      if (g && !y) {
        let { handle: W, outputPreferredLocations: j, outputPreferredLocationsEncoded: Y } = g;
        if (p.length !== w) throw new Error(`input count from feeds (${w}) is expected to be always equal to model's input count (${p.length}).`);
        wt("wasm bindInputsOutputs");
        for (let Z = 0; Z < w; Z++) {
          let te = e[Z];
          await s._OrtBindInput(W, p[te], T[Z]) !== 0 && me(`Can't bind input[${Z}] for session=${t}.`);
        }
        for (let Z = 0; Z < S; Z++) {
          let te = n[Z];
          ((_a2 = o[Z]) == null ? void 0 : _a2[3]) ? (A.push(I[Z]), s._OrtBindOutput(W, m[te], I[Z], 0) !== 0 && me(`Can't bind pre-allocated output[${Z}] for session=${t}.`)) : s._OrtBindOutput(W, m[te], 0, Y[te]) !== 0 && me(`Can't bind output[${Z}] to ${j[Z]} for session=${t}.`);
        }
        _t("wasm bindInputsOutputs"), Mt$1.set(t, [c, p, m, g, b, true]);
      }
      (_b = s.jsepOnRunStart) == null ? void 0 : _b.call(s, c), (_c2 = s.webnnOnRunStart) == null ? void 0 : _c2.call(s, c);
      let q;
      g ? q = await s._OrtRunWithBinding(c, g.handle, S, N, x) : q = await s._OrtRun(c, M, v, w, K, S, N, x), q !== 0 && me("failed to call OrtRun().");
      let Q = [], D = [];
      wt("wasm ProcessOutputTensor");
      for (let W = 0; W < S; W++) {
        let j = Number(s.getValue(N + W * u, "*"));
        if (j === I[W] || A.includes(I[W])) {
          Q.push(o[W]), j !== I[W] && s._OrtReleaseTensor(j) !== 0 && me("Can't release tensor.");
          continue;
        }
        let Y = s.stackSave(), Z = s.stackAlloc(4 * u), te = false, ie, we = 0;
        try {
          s._OrtGetTensorData(j, Z, Z + u, Z + 2 * u, Z + 3 * u) !== 0 && me(`Can't access output tensor data on index ${W}.`);
          let re = u === 4 ? "i32" : "i64", U = Number(s.getValue(Z, re));
          we = s.getValue(Z + u, "*");
          let X = s.getValue(Z + u * 2, "*"), Se = Number(s.getValue(Z + u * 3, re)), Be = [];
          for (let Ce = 0; Ce < Se; Ce++) Be.push(Number(s.getValue(X + Ce * u, re)));
          s._OrtFree(X) !== 0 && me("Can't free memory for tensor dims.");
          let ze2 = Be.reduce((Ce, $e2) => Ce * $e2, 1);
          ie = rt$1(U);
          let Xe = g == null ? void 0 : g.outputPreferredLocations[n[W]];
          if (ie === "string") {
            if (Xe === "gpu-buffer" || Xe === "ml-tensor") throw new Error("String tensor is not supported on GPU.");
            let Ce = [];
            for (let $e2 = 0; $e2 < ze2; $e2++) {
              let Fe = s.getValue(we + $e2 * u, "*"), Ue = s.getValue(we + ($e2 + 1) * u, "*"), ve = $e2 === ze2 - 1 ? void 0 : Ue - Fe;
              Ce.push(s.UTF8ToString(Fe, ve));
            }
            Q.push([ie, Be, Ce, "cpu"]);
          } else if (Xe === "gpu-buffer" && ze2 > 0) {
            let Ce = s.jsepGetBuffer;
            if (!Ce) throw new Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');
            let $e2 = Ce(we), Fe = xt$1(U, ze2);
            if (Fe === void 0 || !Nr(ie)) throw new Error(`Unsupported data type: ${ie}`);
            te = true, Q.push([ie, Be, { gpuBuffer: $e2, download: s.jsepCreateDownloader($e2, Fe, ie), dispose: () => {
              s._OrtReleaseTensor(j) !== 0 && me("Can't release tensor.");
            } }, "gpu-buffer"]);
          } else if (Xe === "ml-tensor" && ze2 > 0) {
            let Ce = s.webnnEnsureTensor, $e2 = s.webnnIsGraphInputOutputTypeSupported;
            if (!Ce || !$e2) throw new Error('preferredLocation "ml-tensor" is not supported without using WebNN.');
            if (xt$1(U, ze2) === void 0 || !Vr(ie)) throw new Error(`Unsupported data type: ${ie}`);
            if (!$e2(t, ie, false)) throw new Error(`preferredLocation "ml-tensor" for ${ie} output is not supported by current WebNN Context.`);
            let Ue = await Ce(t, we, U, Be, false);
            te = true, Q.push([ie, Be, { mlTensor: Ue, download: s.webnnCreateMLTensorDownloader(we, ie), dispose: () => {
              s.webnnReleaseTensorId(we), s._OrtReleaseTensor(j);
            } }, "ml-tensor"]);
          } else if (Xe === "ml-tensor-cpu-output" && ze2 > 0) {
            let Ce = s.webnnCreateMLTensorDownloader(we, ie)(), $e2 = Q.length;
            te = true, D.push((async () => {
              let Fe = [$e2, await Ce];
              return s.webnnReleaseTensorId(we), s._OrtReleaseTensor(j), Fe;
            })()), Q.push([ie, Be, [], "cpu"]);
          } else {
            let Ce = Lt$1(ie), $e2 = new Ce(ze2);
            new Uint8Array($e2.buffer, $e2.byteOffset, $e2.byteLength).set(s.HEAPU8.subarray(we, we + $e2.byteLength)), Q.push([ie, Be, $e2, "cpu"]);
          }
        } finally {
          s.stackRestore(Y), ie === "string" && we && s._free(we), te || s._OrtReleaseTensor(j);
        }
      }
      g && !b && (s._OrtClearBoundOutputs(g.handle) !== 0 && me("Can't clear bound outputs."), Mt$1.set(t, [c, p, m, g, b, false]));
      for (let [W, j] of await Promise.all(D)) Q[W][2] = j;
      return _t("wasm ProcessOutputTensor"), Q;
    } finally {
      (_d2 = s.webnnOnRunEnd) == null ? void 0 : _d2.call(s, c), s.stackRestore(z2), T.forEach((q) => s._OrtReleaseTensor(q)), I.forEach((q) => s._OrtReleaseTensor(q)), E.forEach((q) => s._free(q)), x !== 0 && s._OrtReleaseRunOptions(x), $.forEach((q) => s._free(q));
    }
  }, Dr = (t) => {
    let e = ge(), r = Mt$1.get(t);
    if (!r) throw new Error("invalid session id");
    let n = r[0], o = e._OrtEndProfiling(n);
    o === 0 && me("Can't get an profile file name."), e._OrtFree(o);
  }, Br = (t) => {
    let e = [];
    for (let r of t) {
      let n = r[2];
      !Array.isArray(n) && "buffer" in n && e.push(n.buffer);
    }
    return e;
  };
});
var Rt, He$1, ur$1, hn$1, gn, fn$1, Ro, Uo, Ft, qt$1, jy, qc, Kc, jc, Zc, Qc, Yc, Xc, No = V$1(() => {
  Ve$1();
  Qn();
  vt();
  Cr();
  Rt = () => !!ye.wasm.proxy && typeof document < "u", ur$1 = false, hn$1 = false, gn = false, Uo = /* @__PURE__ */ new Map(), Ft = (t, e) => {
    let r = Uo.get(t);
    r ? r.push(e) : Uo.set(t, [e]);
  }, qt$1 = () => {
    if (ur$1 || !hn$1 || gn || !He$1) throw new Error("worker not ready");
  }, jy = (t) => {
    switch (t.data.type) {
      case "init-wasm":
        ur$1 = false, t.data.err ? (gn = true, Ro[1](t.data.err)) : (hn$1 = true, Ro[0]()), fn$1 && (URL.revokeObjectURL(fn$1), fn$1 = void 0);
        break;
      case "init-ep":
      case "copy-from":
      case "create":
      case "release":
      case "run":
      case "end-profiling": {
        let e = Uo.get(t.data.type);
        t.data.err ? e.shift()[1](t.data.err) : e.shift()[0](t.data.out);
        break;
      }
    }
  }, qc = async () => {
    if (!hn$1) {
      if (ur$1) throw new Error("multiple calls to 'initWasm()' detected.");
      if (gn) throw new Error("previous call to 'initWasm()' failed.");
      if (ur$1 = true, Rt()) return new Promise((t, e) => {
        He$1 == null ? void 0 : He$1.terminate(), _s$1().then(([r, n]) => {
          try {
            He$1 = n, He$1.onerror = (i) => e(i), He$1.onmessage = jy, Ro = [t, e];
            let o = { type: "init-wasm", in: ye };
            !o.in.wasm.wasmPaths && (r || Xn) && (o.in.wasm.wasmPaths = { wasm: new URL("" + new URL("ort-wasm-simd-threaded.jsep-6MnTkKum.wasm", import.meta.url).href, import.meta.url).href }), He$1.postMessage(o), fn$1 = r;
          } catch (o) {
            e(o);
          }
        }, e);
      });
      try {
        await Ar(ye.wasm), await Er(ye), hn$1 = true;
      } catch (t) {
        throw gn = true, t;
      } finally {
        ur$1 = false;
      }
    }
  }, Kc = async (t) => {
    if (Rt()) return qt$1(), new Promise((e, r) => {
      Ft("init-ep", [e, r]);
      let n = { type: "init-ep", in: { epName: t, env: ye } };
      He$1.postMessage(n);
    });
    await kr(ye, t);
  }, jc = async (t) => Rt() ? (qt$1(), new Promise((e, r) => {
    Ft("copy-from", [e, r]);
    let n = { type: "copy-from", in: { buffer: t } };
    He$1.postMessage(n, [t.buffer]);
  })) : Jt$1(t), Zc = async (t, e) => {
    if (Rt()) {
      if (e == null ? void 0 : e.preferredOutputLocation) throw new Error('session option "preferredOutputLocation" is not supported for proxy.');
      return qt$1(), new Promise((r, n) => {
        Ft("create", [r, n]);
        let o = { type: "create", in: { model: t, options: { ...e } } }, i = [];
        t instanceof Uint8Array && i.push(t.buffer), He$1.postMessage(o, i);
      });
    } else return Pr(t, e);
  }, Qc = async (t) => {
    if (Rt()) return qt$1(), new Promise((e, r) => {
      Ft("release", [e, r]);
      let n = { type: "release", in: t };
      He$1.postMessage(n);
    });
    Or(t);
  }, Yc = async (t, e, r, n, o, i) => {
    if (Rt()) {
      if (r.some((s) => s[3] !== "cpu")) throw new Error("input tensor on GPU is not supported for proxy.");
      if (o.some((s) => s)) throw new Error("pre-allocated output tensor is not supported for proxy.");
      return qt$1(), new Promise((s, u) => {
        Ft("run", [s, u]);
        let d = r, c = { type: "run", in: { sessionId: t, inputIndices: e, inputs: d, outputIndices: n, options: i } };
        He$1.postMessage(c, Br(d));
      });
    } else return zr(t, e, r, n, o, i);
  }, Xc = async (t) => {
    if (Rt()) return qt$1(), new Promise((e, r) => {
      Ft("end-profiling", [e, r]);
      let n = { type: "end-profiling", in: t };
      He$1.postMessage(n);
    });
    Dr(t);
  };
});
var Jc, Zy, yn$1, ep = V$1(() => {
  Ve$1();
  No();
  J();
  Ir();
  ro();
  Jc = (t, e) => {
    switch (t.location) {
      case "cpu":
        return [t.type, t.dims, t.data, "cpu"];
      case "gpu-buffer":
        return [t.type, t.dims, { gpuBuffer: t.gpuBuffer }, "gpu-buffer"];
      case "ml-tensor":
        return [t.type, t.dims, { mlTensor: t.mlTensor }, "ml-tensor"];
      default:
        throw new Error(`invalid data location: ${t.location} for ${e()}`);
    }
  }, Zy = (t) => {
    switch (t[3]) {
      case "cpu":
        return new Ke$1(t[0], t[2], t[1]);
      case "gpu-buffer": {
        let e = t[0];
        if (!Nr(e)) throw new Error(`not supported data type: ${e} for deserializing GPU tensor`);
        let { gpuBuffer: r, download: n, dispose: o } = t[2];
        return Ke$1.fromGpuBuffer(r, { dataType: e, dims: t[1], download: n, dispose: o });
      }
      case "ml-tensor": {
        let e = t[0];
        if (!Vr(e)) throw new Error(`not supported data type: ${e} for deserializing MLTensor tensor`);
        let { mlTensor: r, download: n, dispose: o } = t[2];
        return Ke$1.fromMLTensor(r, { dataType: e, dims: t[1], download: n, dispose: o });
      }
      default:
        throw new Error(`invalid data location: ${t[3]}`);
    }
  }, yn$1 = class {
    async fetchModelAndCopyToWasmMemory(e) {
      return jc(await rr$1(e));
    }
    async loadModel(e, r) {
      Ne();
      let n;
      typeof e == "string" ? n = await this.fetchModelAndCopyToWasmMemory(e) : n = e, [this.sessionId, this.inputNames, this.outputNames, this.inputMetadata, this.outputMetadata] = await Zc(n, r), Me();
    }
    async dispose() {
      return Qc(this.sessionId);
    }
    async run(e, r, n) {
      Ne();
      let o = [], i = [];
      Object.entries(e).forEach((g) => {
        let b = g[0], y = g[1], w = this.inputNames.indexOf(b);
        if (w === -1) throw new Error(`invalid input '${b}'`);
        o.push(y), i.push(w);
      });
      let s = [], u = [];
      Object.entries(r).forEach((g) => {
        let b = g[0], y = g[1], w = this.outputNames.indexOf(b);
        if (w === -1) throw new Error(`invalid output '${b}'`);
        s.push(y), u.push(w);
      });
      let d = o.map((g, b) => Jc(g, () => `input "${this.inputNames[i[b]]}"`)), c = s.map((g, b) => g ? Jc(g, () => `output "${this.outputNames[u[b]]}"`) : null), p = await Yc(this.sessionId, i, d, u, c, n), m = {};
      for (let g = 0; g < p.length; g++) m[this.outputNames[u[g]]] = s[g] ?? Zy(p[g]);
      return Me(), m;
    }
    startProfiling() {
    }
    endProfiling() {
      Xc(this.sessionId);
    }
  };
});
var rp = {};
Vt(rp, { OnnxruntimeWebAssemblyBackend: () => bn$1, initializeFlags: () => tp, wasmBackend: () => Qy });
var tp, bn$1, Qy, np = V$1(() => {
  Ve$1();
  No();
  ep();
  tp = () => {
    (typeof ye.wasm.initTimeout != "number" || ye.wasm.initTimeout < 0) && (ye.wasm.initTimeout = 0);
    let t = ye.wasm.simd;
    if (typeof t != "boolean" && t !== void 0 && t !== "fixed" && t !== "relaxed" && (console.warn(`Property "env.wasm.simd" is set to unknown value "${t}". Reset it to \`false\` and ignore SIMD feature checking.`), ye.wasm.simd = false), typeof ye.wasm.proxy != "boolean" && (ye.wasm.proxy = false), typeof ye.wasm.trace != "boolean" && (ye.wasm.trace = false), typeof ye.wasm.numThreads != "number" || !Number.isInteger(ye.wasm.numThreads) || ye.wasm.numThreads <= 0) if (typeof self < "u" && !self.crossOriginIsolated) ye.wasm.numThreads = 1;
    else {
      let e = typeof navigator > "u" ? Gn("node:os").cpus().length : navigator.hardwareConcurrency;
      ye.wasm.numThreads = Math.min(4, Math.ceil((e || 1) / 2));
    }
  }, bn$1 = class {
    async init(e) {
      tp(), await qc(), await Kc(e);
    }
    async createInferenceSessionHandler(e, r) {
      let n = new yn$1();
      return await n.loadModel(e, r), n;
    }
  }, Qy = new bn$1();
});
Ve$1();
Ve$1();
Ve$1();
var ss$1 = "1.24.1";
var sT = Zn;
{
  let t = (np(), Yt$1(rp)).wasmBackend;
  kt("webgpu", t, 5), kt("webnn", t, 5), kt("cpu", t, 10), kt("wasm", t, 10);
}
Object.defineProperty(ye.versions, "web", { value: ss$1, enumerable: true });
/**
* @license
* Copyright 2021 Google LLC. All Rights Reserved.
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
* =============================================================================
*/
/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
var ort = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  get InferenceSession() {
    return vf;
  },
  get TRACE() {
    return Sr;
  },
  get TRACE_EVENT_BEGIN() {
    return wt;
  },
  get TRACE_EVENT_END() {
    return _t;
  },
  get TRACE_FUNC_BEGIN() {
    return Ne;
  },
  get TRACE_FUNC_END() {
    return Me;
  },
  get Tensor() {
    return Ke$1;
  },
  default: sT,
  get env() {
    return ye;
  },
  get registerBackend() {
    return kt;
  }
});
/*!
 * ONNX Runtime Web v1.24.1
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */
var qr = Object.defineProperty;
var Kf = Object.getOwnPropertyDescriptor;
var Qf = Object.getOwnPropertyNames;
var ec = Object.prototype.hasOwnProperty;
var Jr = ((a) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(a, { get: (r, s) => (typeof require < "u" ? require : r)[s] }) : a)(function(a) {
  if (typeof require < "u") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + a + '" is not supported');
});
var F = (a, r) => () => (a && (r = a(a = 0)), r);
var At = (a, r) => {
  for (var s in r) qr(a, s, { get: r[s], enumerable: true });
}, tc = (a, r, s, f) => {
  if (r && typeof r == "object" || typeof r == "function") for (let i of Qf(r)) !ec.call(a, i) && i !== s && qr(a, i, { get: () => r[i], enumerable: !(f = Kf(r, i)) || f.enumerable });
  return a;
};
var Ht = (a) => tc(qr({}, "__esModule", { value: true }), a);
var jt, Ke, Qe, rc, La, Xr = F(() => {
  jt = /* @__PURE__ */ new Map(), Ke = [], Qe = (a, r, s) => {
    if (r && typeof r.init == "function" && typeof r.createInferenceSessionHandler == "function") {
      let f = jt.get(a);
      if (f === void 0) jt.set(a, { backend: r, priority: s });
      else {
        if (f.priority > s) return;
        if (f.priority === s && f.backend !== r) throw new Error(`cannot register backend "${a}" using priority ${s}`);
      }
      if (s >= 0) {
        let i = Ke.indexOf(a);
        i !== -1 && Ke.splice(i, 1);
        for (let d = 0; d < Ke.length; d++) if (jt.get(Ke[d]).priority <= s) {
          Ke.splice(d, 0, a);
          return;
        }
        Ke.push(a);
      }
      return;
    }
    throw new TypeError("not a valid backend");
  }, rc = async (a) => {
    let r = jt.get(a);
    if (!r) return "backend not found.";
    if (r.initialized) return r.backend;
    if (r.aborted) return r.error;
    {
      let s = !!r.initPromise;
      try {
        return s || (r.initPromise = r.backend.init(a)), await r.initPromise, r.initialized = true, r.backend;
      } catch (f) {
        return s || (r.error = `${f}`, r.aborted = true), r.error;
      } finally {
        delete r.initPromise;
      }
    }
  }, La = async (a) => {
    let r = a.executionProviders || [], s = r.map((y) => typeof y == "string" ? y : y.name), f = s.length === 0 ? Ke : s, i, d = [], p = /* @__PURE__ */ new Set();
    for (let y of f) {
      let w = await rc(y);
      typeof w == "string" ? d.push({ name: y, err: w }) : (i || (i = w), i === w && p.add(y));
    }
    if (!i) throw new Error(`no available backend found. ERR: ${d.map((y) => `[${y.name}] ${y.err}`).join(", ")}`);
    for (let { name: y, err: w } of d) s.includes(y) && console.warn(`removing requested execution provider "${y}" from session options because it is not available: ${w}`);
    let m = r.filter((y) => p.has(typeof y == "string" ? y : y.name));
    return [i, new Proxy(a, { get: (y, w) => w === "executionProviders" ? m : Reflect.get(y, w) })];
  };
});
var Oa = F(() => {
  Xr();
});
var Ba, Ma = F(() => {
  Ba = "1.24.1";
});
var Ua, ue, Zr = F(() => {
  Ma();
  Ua = "warning", ue = { wasm: {}, webgl: {}, webgpu: {}, versions: { common: Ba }, set logLevel(a) {
    if (a !== void 0) {
      if (typeof a != "string" || ["verbose", "info", "warning", "error", "fatal"].indexOf(a) === -1) throw new Error(`Unsupported logging level: ${a}`);
      Ua = a;
    }
  }, get logLevel() {
    return Ua;
  } };
  Object.defineProperty(ue, "logLevel", { enumerable: true });
});
var ee, Ca = F(() => {
  Zr();
  ee = ue;
});
var Da, Pa, _a = F(() => {
  Da = (a, r) => {
    let s = typeof document < "u" ? document.createElement("canvas") : new OffscreenCanvas(1, 1);
    s.width = a.dims[3], s.height = a.dims[2];
    let f = s.getContext("2d");
    if (f != null) {
      let i, d;
      (r == null ? void 0 : r.tensorLayout) !== void 0 && r.tensorLayout === "NHWC" ? (i = a.dims[2], d = a.dims[3]) : (i = a.dims[3], d = a.dims[2]);
      let p = (r == null ? void 0 : r.format) !== void 0 ? r.format : "RGB", m = r == null ? void 0 : r.norm, y, w;
      m === void 0 || m.mean === void 0 ? y = [255, 255, 255, 255] : typeof m.mean == "number" ? y = [m.mean, m.mean, m.mean, m.mean] : (y = [m.mean[0], m.mean[1], m.mean[2], 0], m.mean[3] !== void 0 && (y[3] = m.mean[3])), m === void 0 || m.bias === void 0 ? w = [0, 0, 0, 0] : typeof m.bias == "number" ? w = [m.bias, m.bias, m.bias, m.bias] : (w = [m.bias[0], m.bias[1], m.bias[2], 0], m.bias[3] !== void 0 && (w[3] = m.bias[3]));
      let T = d * i, g = 0, v = T, S = T * 2, M = -1;
      p === "RGBA" ? (g = 0, v = T, S = T * 2, M = T * 3) : p === "RGB" ? (g = 0, v = T, S = T * 2) : p === "RBG" && (g = 0, S = T, v = T * 2);
      for (let R2 = 0; R2 < d; R2++) for (let j = 0; j < i; j++) {
        let P = (a.data[g++] - w[0]) * y[0], U = (a.data[v++] - w[1]) * y[1], Y = (a.data[S++] - w[2]) * y[2], O2 = M === -1 ? 255 : (a.data[M++] - w[3]) * y[3];
        f.fillStyle = "rgba(" + P + "," + U + "," + Y + "," + O2 + ")", f.fillRect(j, R2, 1, 1);
      }
      if ("toDataURL" in s) return s.toDataURL();
      throw new Error("toDataURL is not supported");
    } else throw new Error("Can not access image data");
  }, Pa = (a, r) => {
    let s = typeof document < "u" ? document.createElement("canvas").getContext("2d") : new OffscreenCanvas(1, 1).getContext("2d"), f;
    if (s != null) {
      let i, d, p;
      (r == null ? void 0 : r.tensorLayout) !== void 0 && r.tensorLayout === "NHWC" ? (i = a.dims[2], d = a.dims[1], p = a.dims[3]) : (i = a.dims[3], d = a.dims[2], p = a.dims[1]);
      let m = r !== void 0 && r.format !== void 0 ? r.format : "RGB", y = r == null ? void 0 : r.norm, w, T;
      y === void 0 || y.mean === void 0 ? w = [255, 255, 255, 255] : typeof y.mean == "number" ? w = [y.mean, y.mean, y.mean, y.mean] : (w = [y.mean[0], y.mean[1], y.mean[2], 255], y.mean[3] !== void 0 && (w[3] = y.mean[3])), y === void 0 || y.bias === void 0 ? T = [0, 0, 0, 0] : typeof y.bias == "number" ? T = [y.bias, y.bias, y.bias, y.bias] : (T = [y.bias[0], y.bias[1], y.bias[2], 0], y.bias[3] !== void 0 && (T[3] = y.bias[3]));
      let g = d * i;
      if (r !== void 0 && (r.format !== void 0 && p === 4 && r.format !== "RGBA" || p === 3 && r.format !== "RGB" && r.format !== "BGR")) throw new Error("Tensor format doesn't match input tensor dims");
      let v = 4, S = 0, M = 1, R2 = 2, j = 3, P = 0, U = g, Y = g * 2, O2 = -1;
      m === "RGBA" ? (P = 0, U = g, Y = g * 2, O2 = g * 3) : m === "RGB" ? (P = 0, U = g, Y = g * 2) : m === "RBG" && (P = 0, Y = g, U = g * 2), f = s.createImageData(i, d);
      for (let G = 0; G < d * i; S += v, M += v, R2 += v, j += v, G++) f.data[S] = (a.data[P++] - T[0]) * w[0], f.data[M] = (a.data[U++] - T[1]) * w[1], f.data[R2] = (a.data[Y++] - T[2]) * w[2], f.data[j] = O2 === -1 ? 255 : (a.data[O2++] - T[3]) * w[3];
    } else throw new Error("Can not access image data");
    return f;
  };
});
var Kr, Ra, Na, Wa, ka, Fa, Ga = F(() => {
  Yt();
  Kr = (a, r) => {
    if (a === void 0) throw new Error("Image buffer must be defined");
    if (r.height === void 0 || r.width === void 0) throw new Error("Image height and width must be defined");
    if (r.tensorLayout === "NHWC") throw new Error("NHWC Tensor layout is not supported yet");
    let { height: s, width: f } = r, i = r.norm ?? { mean: 255, bias: 0 }, d, p;
    typeof i.mean == "number" ? d = [i.mean, i.mean, i.mean, i.mean] : d = [i.mean[0], i.mean[1], i.mean[2], i.mean[3] ?? 255], typeof i.bias == "number" ? p = [i.bias, i.bias, i.bias, i.bias] : p = [i.bias[0], i.bias[1], i.bias[2], i.bias[3] ?? 0];
    let m = r.format !== void 0 ? r.format : "RGBA", y = r.tensorFormat !== void 0 && r.tensorFormat !== void 0 ? r.tensorFormat : "RGB", w = s * f, T = y === "RGBA" ? new Float32Array(w * 4) : new Float32Array(w * 3), g = 4, v = 0, S = 1, M = 2, R2 = 3, j = 0, P = w, U = w * 2, Y = -1;
    m === "RGB" && (g = 3, v = 0, S = 1, M = 2, R2 = -1), y === "RGBA" ? Y = w * 3 : y === "RBG" ? (j = 0, U = w, P = w * 2) : y === "BGR" && (U = 0, P = w, j = w * 2);
    for (let G = 0; G < w; G++, v += g, M += g, S += g, R2 += g) T[j++] = (a[v] + p[0]) / d[0], T[P++] = (a[S] + p[1]) / d[1], T[U++] = (a[M] + p[2]) / d[2], Y !== -1 && R2 !== -1 && (T[Y++] = (a[R2] + p[3]) / d[3]);
    return y === "RGBA" ? new ce("float32", T, [1, 4, s, f]) : new ce("float32", T, [1, 3, s, f]);
  }, Ra = async (a, r) => {
    let s = typeof HTMLImageElement < "u" && a instanceof HTMLImageElement, f = typeof ImageData < "u" && a instanceof ImageData, i = typeof ImageBitmap < "u" && a instanceof ImageBitmap, d = typeof a == "string", p, m = r ?? {}, y = () => {
      if (typeof document < "u") return document.createElement("canvas");
      if (typeof OffscreenCanvas < "u") return new OffscreenCanvas(1, 1);
      throw new Error("Canvas is not supported");
    }, w = (T) => typeof HTMLCanvasElement < "u" && T instanceof HTMLCanvasElement || T instanceof OffscreenCanvas ? T.getContext("2d") : null;
    if (s) {
      let T = y();
      T.width = a.width, T.height = a.height;
      let g = w(T);
      if (g != null) {
        let v = a.height, S = a.width;
        if (r !== void 0 && r.resizedHeight !== void 0 && r.resizedWidth !== void 0 && (v = r.resizedHeight, S = r.resizedWidth), r !== void 0) {
          if (m = r, r.tensorFormat !== void 0) throw new Error("Image input config format must be RGBA for HTMLImageElement");
          m.tensorFormat = "RGBA", m.height = v, m.width = S;
        } else m.tensorFormat = "RGBA", m.height = v, m.width = S;
        g.drawImage(a, 0, 0), p = g.getImageData(0, 0, S, v).data;
      } else throw new Error("Can not access image data");
    } else if (f) {
      let T, g;
      if (r !== void 0 && r.resizedWidth !== void 0 && r.resizedHeight !== void 0 ? (T = r.resizedHeight, g = r.resizedWidth) : (T = a.height, g = a.width), r !== void 0 && (m = r), m.format = "RGBA", m.height = T, m.width = g, r !== void 0) {
        let v = y();
        v.width = g, v.height = T;
        let S = w(v);
        if (S != null) S.putImageData(a, 0, 0), p = S.getImageData(0, 0, g, T).data;
        else throw new Error("Can not access image data");
      } else p = a.data;
    } else if (i) {
      if (r === void 0) throw new Error("Please provide image config with format for Imagebitmap");
      let T = y();
      T.width = a.width, T.height = a.height;
      let g = w(T);
      if (g != null) {
        let v = a.height, S = a.width;
        return g.drawImage(a, 0, 0, S, v), p = g.getImageData(0, 0, S, v).data, m.height = v, m.width = S, Kr(p, m);
      } else throw new Error("Can not access image data");
    } else {
      if (d) return new Promise((T, g) => {
        let v = y(), S = w(v);
        if (!a || !S) return g();
        let M = new Image();
        M.crossOrigin = "Anonymous", M.src = a, M.onload = () => {
          v.width = M.width, v.height = M.height, S.drawImage(M, 0, 0, v.width, v.height);
          let R2 = S.getImageData(0, 0, v.width, v.height);
          m.height = v.height, m.width = v.width, T(Kr(R2.data, m));
        };
      });
      throw new Error("Input data provided is not supported - aborted tensor creation");
    }
    if (p !== void 0) return Kr(p, m);
    throw new Error("Input data provided is not supported - aborted tensor creation");
  }, Na = (a, r) => {
    let { width: s, height: f, download: i, dispose: d } = r, p = [1, f, s, 4];
    return new ce({ location: "texture", type: "float32", texture: a, dims: p, download: i, dispose: d });
  }, Wa = (a, r) => {
    let { dataType: s, dims: f, download: i, dispose: d } = r;
    return new ce({ location: "gpu-buffer", type: s ?? "float32", gpuBuffer: a, dims: f, download: i, dispose: d });
  }, ka = (a, r) => {
    let { dataType: s, dims: f, download: i, dispose: d } = r;
    return new ce({ location: "ml-tensor", type: s ?? "float32", mlTensor: a, dims: f, download: i, dispose: d });
  }, Fa = (a, r, s) => new ce({ location: "cpu-pinned", type: a, data: r, dims: s ?? [r.length] });
});
var et, It, $a, za, Va = F(() => {
  et = /* @__PURE__ */ new Map([["float32", Float32Array], ["uint8", Uint8Array], ["int8", Int8Array], ["uint16", Uint16Array], ["int16", Int16Array], ["int32", Int32Array], ["bool", Uint8Array], ["float64", Float64Array], ["uint32", Uint32Array], ["int4", Uint8Array], ["uint4", Uint8Array]]), It = /* @__PURE__ */ new Map([[Float32Array, "float32"], [Uint8Array, "uint8"], [Int8Array, "int8"], [Uint16Array, "uint16"], [Int16Array, "int16"], [Int32Array, "int32"], [Float64Array, "float64"], [Uint32Array, "uint32"]]), $a = false, za = () => {
    if (!$a) {
      $a = true;
      let a = typeof BigInt64Array < "u" && BigInt64Array.from, r = typeof BigUint64Array < "u" && BigUint64Array.from, s = globalThis.Float16Array, f = typeof s < "u" && s.from;
      a && (et.set("int64", BigInt64Array), It.set(BigInt64Array, "int64")), r && (et.set("uint64", BigUint64Array), It.set(BigUint64Array, "uint64")), f ? (et.set("float16", s), It.set(s, "float16")) : et.set("float16", Uint16Array);
    }
  };
});
var Ha, ja, Ya = F(() => {
  Yt();
  Ha = (a) => {
    let r = 1;
    for (let s = 0; s < a.length; s++) {
      let f = a[s];
      if (typeof f != "number" || !Number.isSafeInteger(f)) throw new TypeError(`dims[${s}] must be an integer, got: ${f}`);
      if (f < 0) throw new RangeError(`dims[${s}] must be a non-negative integer, got: ${f}`);
      r *= f;
    }
    return r;
  }, ja = (a, r) => {
    switch (a.location) {
      case "cpu":
        return new ce(a.type, a.data, r);
      case "cpu-pinned":
        return new ce({ location: "cpu-pinned", data: a.data, type: a.type, dims: r });
      case "texture":
        return new ce({ location: "texture", texture: a.texture, type: a.type, dims: r });
      case "gpu-buffer":
        return new ce({ location: "gpu-buffer", gpuBuffer: a.gpuBuffer, type: a.type, dims: r });
      case "ml-tensor":
        return new ce({ location: "ml-tensor", mlTensor: a.mlTensor, type: a.type, dims: r });
      default:
        throw new Error(`tensorReshape: tensor location ${a.location} is not supported`);
    }
  };
});
var ce, Yt = F(() => {
  _a();
  Ga();
  Va();
  Ya();
  ce = class {
    constructor(r, s, f) {
      za();
      let i, d;
      if (typeof r == "object" && "location" in r) switch (this.dataLocation = r.location, i = r.type, d = r.dims, r.location) {
        case "cpu-pinned": {
          let m = et.get(i);
          if (!m) throw new TypeError(`unsupported type "${i}" to create tensor from pinned buffer`);
          if (!(r.data instanceof m)) throw new TypeError(`buffer should be of type ${m.name}`);
          this.cpuData = r.data;
          break;
        }
        case "texture": {
          if (i !== "float32") throw new TypeError(`unsupported type "${i}" to create tensor from texture`);
          this.gpuTextureData = r.texture, this.downloader = r.download, this.disposer = r.dispose;
          break;
        }
        case "gpu-buffer": {
          if (i !== "float32" && i !== "float16" && i !== "int32" && i !== "int64" && i !== "uint32" && i !== "uint8" && i !== "bool" && i !== "uint4" && i !== "int4") throw new TypeError(`unsupported type "${i}" to create tensor from gpu buffer`);
          this.gpuBufferData = r.gpuBuffer, this.downloader = r.download, this.disposer = r.dispose;
          break;
        }
        case "ml-tensor": {
          if (i !== "float32" && i !== "float16" && i !== "int32" && i !== "int64" && i !== "uint32" && i !== "uint64" && i !== "int8" && i !== "uint8" && i !== "bool" && i !== "uint4" && i !== "int4") throw new TypeError(`unsupported type "${i}" to create tensor from MLTensor`);
          this.mlTensorData = r.mlTensor, this.downloader = r.download, this.disposer = r.dispose;
          break;
        }
        default:
          throw new Error(`Tensor constructor: unsupported location '${this.dataLocation}'`);
      }
      else {
        let m, y;
        if (typeof r == "string") if (i = r, y = f, r === "string") {
          if (!Array.isArray(s)) throw new TypeError("A string tensor's data must be a string array.");
          m = s;
        } else {
          let w = et.get(r);
          if (w === void 0) throw new TypeError(`Unsupported tensor type: ${r}.`);
          if (Array.isArray(s)) {
            if (r === "float16" && w === Uint16Array || r === "uint4" || r === "int4") throw new TypeError(`Creating a ${r} tensor from number array is not supported. Please use ${w.name} as data.`);
            r === "uint64" || r === "int64" ? m = w.from(s, BigInt) : m = w.from(s);
          } else if (s instanceof w) m = s;
          else if (s instanceof Uint8ClampedArray) if (r === "uint8") m = Uint8Array.from(s);
          else throw new TypeError("A Uint8ClampedArray tensor's data must be type of uint8");
          else if (r === "float16" && s instanceof Uint16Array && w !== Uint16Array) m = new globalThis.Float16Array(s.buffer, s.byteOffset, s.length);
          else throw new TypeError(`A ${i} tensor's data must be type of ${w}`);
        }
        else if (y = s, Array.isArray(r)) {
          if (r.length === 0) throw new TypeError("Tensor type cannot be inferred from an empty array.");
          let w = typeof r[0];
          if (w === "string") i = "string", m = r;
          else if (w === "boolean") i = "bool", m = Uint8Array.from(r);
          else throw new TypeError(`Invalid element type of data array: ${w}.`);
        } else if (r instanceof Uint8ClampedArray) i = "uint8", m = Uint8Array.from(r);
        else {
          let w = It.get(r.constructor);
          if (w === void 0) throw new TypeError(`Unsupported type for tensor data: ${r.constructor}.`);
          i = w, m = r;
        }
        if (y === void 0) y = [m.length];
        else if (!Array.isArray(y)) throw new TypeError("A tensor's dims must be a number array");
        d = y, this.cpuData = m, this.dataLocation = "cpu";
      }
      let p = Ha(d);
      if (this.cpuData && p !== this.cpuData.length && !((i === "uint4" || i === "int4") && Math.ceil(p / 2) === this.cpuData.length)) throw new Error(`Tensor's size(${p}) does not match data length(${this.cpuData.length}).`);
      this.type = i, this.dims = d, this.size = p;
    }
    static async fromImage(r, s) {
      return Ra(r, s);
    }
    static fromTexture(r, s) {
      return Na(r, s);
    }
    static fromGpuBuffer(r, s) {
      return Wa(r, s);
    }
    static fromMLTensor(r, s) {
      return ka(r, s);
    }
    static fromPinnedBuffer(r, s, f) {
      return Fa(r, s, f);
    }
    toDataURL(r) {
      return Da(this, r);
    }
    toImageData(r) {
      return Pa(this, r);
    }
    get data() {
      if (this.ensureValid(), !this.cpuData) throw new Error("The data is not on CPU. Use `getData()` to download GPU data to CPU, or use `texture` or `gpuBuffer` property to access the GPU data directly.");
      return this.cpuData;
    }
    get location() {
      return this.dataLocation;
    }
    get texture() {
      if (this.ensureValid(), !this.gpuTextureData) throw new Error("The data is not stored as a WebGL texture.");
      return this.gpuTextureData;
    }
    get gpuBuffer() {
      if (this.ensureValid(), !this.gpuBufferData) throw new Error("The data is not stored as a WebGPU buffer.");
      return this.gpuBufferData;
    }
    get mlTensor() {
      if (this.ensureValid(), !this.mlTensorData) throw new Error("The data is not stored as a WebNN MLTensor.");
      return this.mlTensorData;
    }
    async getData(r) {
      switch (this.ensureValid(), this.dataLocation) {
        case "cpu":
        case "cpu-pinned":
          return this.data;
        case "texture":
        case "gpu-buffer":
        case "ml-tensor": {
          if (!this.downloader) throw new Error("The current tensor is not created with a specified data downloader.");
          if (this.isDownloading) throw new Error("The current tensor is being downloaded.");
          try {
            this.isDownloading = true;
            let s = await this.downloader();
            return this.downloader = void 0, this.dataLocation = "cpu", this.cpuData = s, r && this.disposer && (this.disposer(), this.disposer = void 0), s;
          } finally {
            this.isDownloading = false;
          }
        }
        default:
          throw new Error(`cannot get data from location: ${this.dataLocation}`);
      }
    }
    dispose() {
      if (this.isDownloading) throw new Error("The current tensor is being downloaded.");
      this.disposer && (this.disposer(), this.disposer = void 0), this.cpuData = void 0, this.gpuTextureData = void 0, this.gpuBufferData = void 0, this.mlTensorData = void 0, this.downloader = void 0, this.isDownloading = void 0, this.dataLocation = "none";
    }
    ensureValid() {
      if (this.dataLocation === "none") throw new Error("The tensor is disposed.");
    }
    reshape(r) {
      if (this.ensureValid(), this.downloader || this.disposer) throw new Error("Cannot reshape a tensor that owns GPU resource.");
      return ja(this, r);
    }
  };
});
var xe, Qr = F(() => {
  Yt();
  xe = ce;
});
var qa, Ja, tt, rt, Ge, $e, en = F(() => {
  Zr();
  qa = (a, r) => {
    (typeof ue.trace > "u" ? !ue.wasm.trace : !ue.trace) || console.timeStamp(`${a}::ORT::${r}`);
  }, Ja = (a, r) => {
    var _a2;
    let s = ((_a2 = new Error().stack) == null ? void 0 : _a2.split(/\r\n|\r|\n/g)) || [], f = false;
    for (let i = 0; i < s.length; i++) {
      if (f && !s[i].includes("TRACE_FUNC")) {
        let d = `FUNC_${a}::${s[i].trim().split(" ")[1]}`;
        r && (d += `::${r}`), qa("CPU", d);
        return;
      }
      s[i].includes("TRACE_FUNC") && (f = true);
    }
  }, tt = (a) => {
    (typeof ue.trace > "u" ? !ue.wasm.trace : !ue.trace) || Ja("BEGIN", a);
  }, rt = (a) => {
    (typeof ue.trace > "u" ? !ue.wasm.trace : !ue.trace) || Ja("END", a);
  }, Ge = (a) => {
    (typeof ue.trace > "u" ? !ue.wasm.trace : !ue.trace) || console.time(`ORT::${a}`);
  }, $e = (a) => {
    (typeof ue.trace > "u" ? !ue.wasm.trace : !ue.trace) || console.timeEnd(`ORT::${a}`);
  };
});
var qt, Xa = F(() => {
  Xr();
  Qr();
  en();
  qt = class a {
    constructor(r) {
      this.handler = r;
    }
    async run(r, s, f) {
      tt(), Ge("InferenceSession.run");
      let i = {}, d = {};
      if (typeof r != "object" || r === null || r instanceof xe || Array.isArray(r)) throw new TypeError("'feeds' must be an object that use input names as keys and OnnxValue as corresponding values.");
      let p = true;
      if (typeof s == "object") {
        if (s === null) throw new TypeError("Unexpected argument[1]: cannot be null.");
        if (s instanceof xe) throw new TypeError("'fetches' cannot be a Tensor");
        if (Array.isArray(s)) {
          if (s.length === 0) throw new TypeError("'fetches' cannot be an empty array.");
          p = false;
          for (let w of s) {
            if (typeof w != "string") throw new TypeError("'fetches' must be a string array or an object.");
            if (this.outputNames.indexOf(w) === -1) throw new RangeError(`'fetches' contains invalid output name: ${w}.`);
            i[w] = null;
          }
          if (typeof f == "object" && f !== null) d = f;
          else if (typeof f < "u") throw new TypeError("'options' must be an object.");
        } else {
          let w = false, T = Object.getOwnPropertyNames(s);
          for (let g of this.outputNames) if (T.indexOf(g) !== -1) {
            let v = s[g];
            (v === null || v instanceof xe) && (w = true, p = false, i[g] = v);
          }
          if (w) {
            if (typeof f == "object" && f !== null) d = f;
            else if (typeof f < "u") throw new TypeError("'options' must be an object.");
          } else d = s;
        }
      } else if (typeof s < "u") throw new TypeError("Unexpected argument[1]: must be 'fetches' or 'options'.");
      for (let w of this.inputNames) if (typeof r[w] > "u") throw new Error(`input '${w}' is missing in 'feeds'.`);
      if (p) for (let w of this.outputNames) i[w] = null;
      let m = await this.handler.run(r, i, d), y = {};
      for (let w in m) if (Object.hasOwnProperty.call(m, w)) {
        let T = m[w];
        T instanceof xe ? y[w] = T : y[w] = new xe(T.type, T.data, T.dims);
      }
      return $e("InferenceSession.run"), rt(), y;
    }
    async release() {
      return this.handler.dispose();
    }
    static async create(r, s, f, i) {
      tt(), Ge("InferenceSession.create");
      let d, p = {};
      if (typeof r == "string") {
        if (d = r, typeof s == "object" && s !== null) p = s;
        else if (typeof s < "u") throw new TypeError("'options' must be an object.");
      } else if (r instanceof Uint8Array) {
        if (d = r, typeof s == "object" && s !== null) p = s;
        else if (typeof s < "u") throw new TypeError("'options' must be an object.");
      } else if (r instanceof ArrayBuffer || typeof SharedArrayBuffer < "u" && r instanceof SharedArrayBuffer) {
        let T = r, g = 0, v = r.byteLength;
        if (typeof s == "object" && s !== null) p = s;
        else if (typeof s == "number") {
          if (g = s, !Number.isSafeInteger(g)) throw new RangeError("'byteOffset' must be an integer.");
          if (g < 0 || g >= T.byteLength) throw new RangeError(`'byteOffset' is out of range [0, ${T.byteLength}).`);
          if (v = r.byteLength - g, typeof f == "number") {
            if (v = f, !Number.isSafeInteger(v)) throw new RangeError("'byteLength' must be an integer.");
            if (v <= 0 || g + v > T.byteLength) throw new RangeError(`'byteLength' is out of range (0, ${T.byteLength - g}].`);
            if (typeof i == "object" && i !== null) p = i;
            else if (typeof i < "u") throw new TypeError("'options' must be an object.");
          } else if (typeof f < "u") throw new TypeError("'byteLength' must be a number.");
        } else if (typeof s < "u") throw new TypeError("'options' must be an object.");
        d = new Uint8Array(T, g, v);
      } else throw new TypeError("Unexpected argument[0]: must be 'path' or 'buffer'.");
      let [m, y] = await La(p), w = await m.createInferenceSessionHandler(d, y);
      return $e("InferenceSession.create"), rt(), new a(w);
    }
    startProfiling() {
      this.handler.startProfiling();
    }
    endProfiling() {
      this.handler.endProfiling();
    }
    get inputNames() {
      return this.handler.inputNames;
    }
    get outputNames() {
      return this.handler.outputNames;
    }
    get inputMetadata() {
      return this.handler.inputMetadata;
    }
    get outputMetadata() {
      return this.handler.outputMetadata;
    }
  };
});
var nc, Za = F(() => {
  Xa();
  nc = qt;
});
var Ka = F(() => {
});
var Qa = F(() => {
});
var es = F(() => {
});
var ts = F(() => {
});
var tn = {};
At(tn, { InferenceSession: () => nc, TRACE: () => qa, TRACE_EVENT_BEGIN: () => Ge, TRACE_EVENT_END: () => $e, TRACE_FUNC_BEGIN: () => tt, TRACE_FUNC_END: () => rt, Tensor: () => xe, env: () => ee, registerBackend: () => Qe });
var ze = F(() => {
  Oa();
  Ca();
  Za();
  Qr();
  Ka();
  Qa();
  en();
  es();
  ts();
});
var Jt = F(() => {
});
var as = {};
At(as, { default: () => oc });
var ns, os, oc, ss = F(() => {
  var _a2;
  rn();
  Ve();
  Xt();
  ns = "ort-wasm-proxy-worker", os = ((_a2 = globalThis.self) == null ? void 0 : _a2.name) === ns;
  os && (self.onmessage = (a) => {
    let { type: r, in: s } = a.data;
    try {
      switch (r) {
        case "init-wasm":
          Zt(s.wasm).then(() => {
            Kt(s).then(() => {
              postMessage({ type: r });
            }, (f) => {
              postMessage({ type: r, err: f });
            });
          }, (f) => {
            postMessage({ type: r, err: f });
          });
          break;
        case "init-ep": {
          let { epName: f, env: i } = s;
          Qt(i, f).then(() => {
            postMessage({ type: r });
          }, (d) => {
            postMessage({ type: r, err: d });
          });
          break;
        }
        case "copy-from": {
          let { buffer: f } = s, i = xt(f);
          postMessage({ type: r, out: i });
          break;
        }
        case "create": {
          let { model: f, options: i } = s;
          er(f, i).then((d) => {
            postMessage({ type: r, out: d });
          }, (d) => {
            postMessage({ type: r, err: d });
          });
          break;
        }
        case "release":
          tr(s), postMessage({ type: r });
          break;
        case "run": {
          let { sessionId: f, inputIndices: i, inputs: d, outputIndices: p, options: m } = s;
          rr(f, i, d, p, new Array(p.length).fill(null), m).then((y) => {
            y.some((w) => w[3] !== "cpu") ? postMessage({ type: r, err: "Proxy does not support non-cpu tensor location." }) : postMessage({ type: r, out: y }, or([...d, ...y]));
          }, (y) => {
            postMessage({ type: r, err: y });
          });
          break;
        }
        case "end-profiling":
          nr(s), postMessage({ type: r });
          break;
        default:
      }
    } catch (f) {
      postMessage({ type: r, err: f });
    }
  });
  oc = os ? null : (a) => new Worker(a ?? be, { type: "module", name: ns });
});
var us = {};
At(us, { default: () => ac });
async function is(a = {}) {
  var _a2, _b;
  var r = a, s = !!globalThis.window, f = !!globalThis.WorkerGlobalScope, i = f && ((_a2 = self.name) == null ? void 0 : _a2.startsWith("em-pthread"));
  r.mountExternalData = (e, t) => {
    e.startsWith("./") && (e = e.substring(2)), (r.Zc || (r.Zc = /* @__PURE__ */ new Map())).set(e, t);
  }, r.unmountExternalData = () => {
    delete r.Zc;
  }, globalThis.SharedArrayBuffer ?? new WebAssembly.Memory({ initial: 0, maximum: 0, Me: true }).buffer.constructor;
  let d = () => {
    let e = (t) => (...n) => {
      let o = Be;
      return n = t(...n), Be != o ? new Promise((u, c) => {
        Mr2 = { resolve: u, reject: c };
      }) : n;
    };
    (() => {
      for (let t of ["_OrtAppendExecutionProvider", "_OrtCreateSession", "_OrtRun", "_OrtRunWithBinding", "_OrtBindInput"]) r[t] = e(r[t]);
    })(), typeof jsepRunAsync < "u" && (r._OrtRun = jsepRunAsync(r._OrtRun), r._OrtRunWithBinding = jsepRunAsync(r._OrtRunWithBinding)), d = void 0;
  };
  r.asyncInit = () => {
    d == null ? void 0 : d();
  };
  var p, m, y = (e, t) => {
    throw t;
  }, w = import.meta.url, T = "";
  if (s || f) {
    try {
      T = new URL(".", w).href;
    } catch {
    }
    f && (m = (e) => {
      var t = new XMLHttpRequest();
      return t.open("GET", e, false), t.responseType = "arraybuffer", t.send(null), new Uint8Array(t.response);
    }), p = async (e) => {
      if (oe(e)) return new Promise((n, o) => {
        var u = new XMLHttpRequest();
        u.open("GET", e, true), u.responseType = "arraybuffer", u.onload = () => {
          u.status == 200 || u.status == 0 && u.response ? n(u.response) : o(u.status);
        }, u.onerror = o, u.send(null);
      });
      var t = await fetch(e, { credentials: "same-origin" });
      if (t.ok) return t.arrayBuffer();
      throw Error(t.status + " : " + t.url);
    };
  }
  var g, v, S, M, R2, j, P = console.log.bind(console), U = console.error.bind(console), Y = P, O2 = U, G = false, oe = (e) => e.startsWith("file://");
  function l() {
    ke2.buffer != Z.buffer && se2();
  }
  if (i) {
    let e = function(t) {
      try {
        var n = t.data, o = n.Uc;
        if (o === "load") {
          let u = [];
          self.onmessage = (c) => u.push(c), j = () => {
            postMessage({ Uc: "loaded" });
            for (let c of u) e(c);
            self.onmessage = e;
          };
          for (let c of n.ne) r[c] && !r[c].proxy || (r[c] = (...h) => {
            postMessage({ Uc: "callHandler", me: c, args: h });
          }, c == "print" && (Y = r[c]), c == "printErr" && (O2 = r[c]));
          ke2 = n.we, se2(), v = n.xe, wt2(), Vt2();
        } else if (o === "run") {
          (function(u) {
            var c = (l(), A)[u + 52 >>> 2 >>> 0];
            u = (l(), A)[u + 56 >>> 2 >>> 0], Ro2(c, c - u), C(c);
          })(n.Sc), $r2(n.Sc, 0, 0, 1, 0, 0), Tn(), Lr2(n.Sc), ne2 || (wo2(), ne2 = true);
          try {
            Js2(n.te, n.ad);
          } catch (u) {
            if (u != "unwind") throw u;
          }
        } else n.target !== "setimmediate" && (o === "checkMailbox" ? ne2 && Pt2() : o && (O2(`worker: received unknown command ${o}`), O2(n)));
      } catch (u) {
        throw Uo2(), u;
      }
    };
    var ne2 = false;
    self.onunhandledrejection = (t) => {
      throw t.reason || t;
    }, self.onmessage = e;
  }
  var Z, J2, Ce, K, x, A, _, ae2, le, q, ye2, re = false;
  function se2() {
    var e = ke2.buffer;
    r.HEAP8 = Z = new Int8Array(e), Ce = new Int16Array(e), r.HEAPU8 = J2 = new Uint8Array(e), K = new Uint16Array(e), r.HEAP32 = x = new Int32Array(e), r.HEAPU32 = A = new Uint32Array(e), _ = new Float32Array(e), ae2 = new Float64Array(e), le = new BigInt64Array(e), q = new BigUint64Array(e);
  }
  function wr() {
    re = true, i ? j() : Ne2.dc();
  }
  function we(e) {
    throw O2(e = "Aborted(" + e + ")"), G = true, e = new WebAssembly.RuntimeError(e + ". Build with -sASSERTIONS for more info."), R2 == null ? void 0 : R2(e), e;
  }
  function je2() {
    return { a: { sa: lf, g: Xs2, K: Zs2, f: Ks2, n: Qs2, h: ei, wa: ti, b: ri, ea: ni, Ja: xn, o: oi, fa: Mn, Za: Un, $b: Cn, bc: Dn, _a: Pn, Xa: _n, Qa: Rn, Wa: Nn, qa: Wn2, ac: kn, Zb: Fn2, Ya: Gn2, _b: $n, db: ai, Fa: ii, Ub: ui, Sb: ci, Ea: li, P: pi, I: mi, Tb: hi, ma: Ei, Vb: Si, Ta: Ai, Xb: xi, Ka: Li, Pb: Oi, Ha: Bi, Sa: Lr2, ab: Mi, W: Pi, r: ki, c: Ir2, tb: Fi, y: Gi, N: $i, D: zi, m: Vi, t: Xn2, ub: Hi, J: ji, V: Yi, j: qi, u: Ji, q: Xi, l: Zi, Na: Ki, Oa: Qi, Pa: eu2, La: eo2, Ma: to2, Rb: ro2, fb: ru2, cb: au2, $: su2, sb: iu2, na: uu2, bb: nu2, Y: fu2, $a: cu2, Yb: du2, G: tu2, ib: lu2, _: pu2, ra: kt2, Wb: hu2, hb: mu2, gb: yu2, pb: Su2, F: Au2, va: Iu2, ua: xu2, rb: Lu2, Z: Ou2, w: Bu2, ob: Mu2, nb: Uu2, mb: Cu2, qb: Du2, lb: Pu2, kb: _u2, jb: Ru2, Ua: co2, Va: lo2, Ia: Tr2, ga: po2, pa: mo2, Ra: ho2, oa: yo2, Eb: Jf2, za: $f2, Fb: qf2, Aa: Gf2, H: Cf2, e: yf2, s: mf, x: pf, B: xf2, Ib: Wf2, L: Bf2, v: wf2, Ba: kf2, ca: zf2, ja: Nf2, Gb: Yf2, Hb: jf2, Da: Df2, Ca: Rf2, Kb: Pf2, O: Mf2, da: Ff2, d: bf2, A: gf2, k: hf, Db: Xf2, p: vf2, z: If2, C: Tf2, E: Ef2, M: Lf2, Lb: Uf2, U: Vf2, ka: Of2, ba: Hf2, Mb: Af2, Nb: Sf2, R: _f2, i: Wu2, a: ke2, eb: Ye2, Jb: ku2, la: Fu2, Q: Gu2, ta: $u2, Ob: zu2, S: Vu2, Ab: Hu2, Bb: ju2, xa: Yu2, ha: qu2, T: Ju2, Ga: Xu2, ya: Zu2, aa: Ku2, yb: Qu2, cc: ef, X: tf, Cb: rf, vb: nf, wb: af, xb: sf, ia: uf, zb: ff, Qb: cf } };
  }
  async function wt2() {
    function e(o, u) {
      var c = Ne2 = o.exports;
      o = {};
      for (let [h, b] of Object.entries(c)) typeof b == "function" ? (c = Ui(b), o[h] = c) : o[h] = b;
      return Ne2 = o, Ne2 = function() {
        var h = Ne2, b = (I) => (N) => I(N) >>> 0, E = (I) => () => I() >>> 0;
        return (h = Object.assign({}, h)).ec = b(h.ec), h.Hc = E(h.Hc), h.Jc = b(h.Jc), h.vd = /* @__PURE__ */ ((I) => (N, W) => I(N, W) >>> 0)(h.vd), h.Ad = b(h.Ad), h.Bd = E(h.Bd), h.Fd = b(h.Fd), h;
      }(), wn.push(Ne2.md), bo2 = (o = Ne2).ec, wo2 = o.fc, r._OrtInit = o.gc, r._OrtGetLastError = o.hc, r._OrtCreateSessionOptions = o.ic, r._OrtAppendExecutionProvider = o.jc, r._OrtAddFreeDimensionOverride = o.kc, r._OrtAddSessionConfigEntry = o.lc, r._OrtReleaseSessionOptions = o.mc, r._OrtCreateSession = o.nc, r._OrtReleaseSession = o.oc, r._OrtGetInputOutputCount = o.pc, r._OrtGetInputOutputMetadata = o.qc, r._OrtFree = o.rc, r._OrtCreateTensor = o.sc, r._OrtGetTensorData = o.tc, r._OrtReleaseTensor = o.uc, r._OrtCreateRunOptions = o.vc, r._OrtAddRunConfigEntry = o.wc, r._OrtReleaseRunOptions = o.xc, r._OrtCreateBinding = o.yc, r._OrtBindInput = o.zc, r._OrtBindOutput = o.Ac, r._OrtClearBoundOutputs = o.Bc, r._OrtReleaseBinding = o.Cc, r._OrtRunWithBinding = o.Dc, r._OrtRun = o.Ec, r._OrtEndProfiling = o.Fc, Rr2 = r._OrtGetWebGpuDevice = o.Gc, $t2 = o.Hc, Te = r._free = o.Ic, mt2 = r._malloc = o.Jc, go2 = r._wgpuBufferRelease = o.Kc, To2 = r._wgpuCreateInstance = o.Lc, vo2 = o.Mc, Eo2 = o.Nc, So2 = o.Oc, Ao2 = o.Pc, Io2 = o.Qc, xo2 = o.Tc, Lo = o.bd, Oo2 = o.cd, Bo2 = o.dd, Nr2 = o.fd, Wr2 = o.gd, kr2 = o.hd, Fr2 = o.id, Et2 = o.jd, Gr2 = o.kd, Mo2 = o.ld, $r2 = o.od, Uo2 = o.pd, Co2 = o.qd, Do2 = o.rd, zr2 = o.sd, Po2 = o.td, _o2 = o.ud, Vr2 = o.vd, k2 = o.wd, St2 = o.xd, Ro2 = o.yd, C = o.zd, zt2 = o.Ad, D = o.Bd, No2 = o.Cd, Hr2 = o.Dd, Wo = o.Ed, ko2 = o.Fd, Fo = o.Gd, jr2 = o.Hd, Go = o.Id, $o2 = o.Jd, zo2 = o.Kd, Vo = o.Ld, Ho = o.Md, jo = o.Nd, Yo = o.Od, qo = o.Pd, Jo = o.Qd, Xo = o.Rd, Zo = o.Sd, Ko = o.Td, Qo = o.Ud, ea = o.Vd, ta = o.Wd, ra = o.Yd, na = o.Zd, oa = o._d, aa = o.$d, sa = o.be, ia = o.ce, ua = o.de, fa = o.ee, ca = o.fe, da = o.ge, la = o.qe, pa = o.ve, ma = o.ye, ha = o.ze, ya = o.Ae, ba = o.Be, wa = o.Ce, ga = o.De, Ta = o.Ee, va = o.Fe, Ea = o.Ge, Sa = o.ef, Aa = o.ff, Ia = o.gf, xa = o.hf, v = u, Ne2;
    }
    var t, n = je2();
    return r.instantiateWasm ? new Promise((o) => {
      r.instantiateWasm(n, (u, c) => {
        o(e(u, c));
      });
    }) : i ? e(new WebAssembly.Instance(v, je2()), v) : (ye2 ?? (ye2 = r.locateFile ? r.locateFile ? r.locateFile("ort-wasm-simd-threaded.asyncify.wasm", T) : T + "ort-wasm-simd-threaded.asyncify.wasm" : new URL("" + new URL("ort-wasm-simd-threaded.asyncify-DGj6wBfM.wasm", import.meta.url).href, import.meta.url).href), t = await async function(o) {
      var u = ye2;
      if (!g && !oe(u)) try {
        var c = fetch(u, { credentials: "same-origin" });
        return await WebAssembly.instantiateStreaming(c, o);
      } catch (h) {
        O2(`wasm streaming compile failed: ${h}`), O2("falling back to ArrayBuffer instantiation");
      }
      return async function(h, b) {
        try {
          var E = await async function(I) {
            if (!g) try {
              var N = await p(I);
              return new Uint8Array(N);
            } catch {
            }
            if (I == ye2 && g) I = new Uint8Array(g);
            else {
              if (!m) throw "both async and sync fetching of the wasm failed";
              I = m(I);
            }
            return I;
          }(h);
          return await WebAssembly.instantiate(E, b);
        } catch (I) {
          O2(`failed to asynchronously prepare wasm: ${I}`), we(I);
        }
      }(u, o);
    }(n), e(t.instance, t.module));
  }
  class gt {
    constructor(t) {
      __publicField(this, "name", "ExitStatus");
      this.message = `Program terminated with exit(${t})`, this.status = t;
    }
  }
  var Se = (e) => {
    e.terminate(), e.onmessage = () => {
    };
  }, Ae = [], Le2 = 0, te = null, Q = (e) => {
    We2.length == 0 && (En(), vn(We2[0]));
    var t = We2.pop();
    if (!t) return 6;
    Tt2.push(t), qe[e.Sc] = t, t.Sc = e.Sc;
    var n = { Uc: "run", te: e.se, ad: e.ad, Sc: e.Sc };
    return t.postMessage(n, e.he), 0;
  }, $ = 0, H = (e, t, ...n) => {
    var o, u = 16 * n.length, c = D(), h = zt2(u), b = h >>> 3;
    for (o of n) typeof o == "bigint" ? ((l(), le)[b++ >>> 0] = 1n, (l(), le)[b++ >>> 0] = o) : ((l(), le)[b++ >>> 0] = 0n, (l(), ae2)[b++ >>> 0] = o);
    return e = Co2(e, 0, u, h, t), C(c), e;
  };
  function Ye2(e) {
    if (i) return H(0, 1, e);
    if (S = e, !(0 < $)) {
      for (var t of Tt2) Se(t);
      for (t of We2) Se(t);
      We2 = [], Tt2 = [], qe = {}, G = true;
    }
    y(0, new gt(e));
  }
  function gr(e) {
    if (i) return H(1, 0, e);
    Tr2(e);
  }
  var Tr2 = (e) => {
    if (S = e, i) throw gr(e), "unwind";
    Ye2(e);
  }, We2 = [], Tt2 = [], wn = [], qe = {}, gn2 = (e) => {
    var t = e.Sc;
    delete qe[t], We2.push(e), Tt2.splice(Tt2.indexOf(e), 1), e.Sc = 0, Do2(t);
  };
  function Tn() {
    wn.forEach((e) => e());
  }
  var vn = (e) => new Promise((t) => {
    e.onmessage = (u) => {
      var c = u.data;
      if (u = c.Uc, c.$c && c.$c != $t2()) {
        var h = qe[c.$c];
        h ? h.postMessage(c, c.he) : O2(`Internal error! Worker sent a message "${u}" to target pthread ${c.$c}, but that thread no longer exists!`);
      } else u === "checkMailbox" ? Pt2() : u === "spawnThread" ? Q(c) : u === "cleanupThread" ? Dt2(() => {
        gn2(qe[c.ue]);
      }) : u === "loaded" ? (e.loaded = true, t(e)) : c.target === "setimmediate" ? e.postMessage(c) : u === "uncaughtException" ? e.onerror(c.error) : u === "callHandler" ? r[c.me](...c.args) : u && O2(`worker sent an unknown command ${u}`);
    }, e.onerror = (u) => {
      throw O2(`worker sent an error! ${u.filename}:${u.lineno}: ${u.message}`), u;
    };
    var n, o = [];
    for (n of []) r.propertyIsEnumerable(n) && o.push(n);
    e.postMessage({ Uc: "load", ne: o, we: ke2, xe: v });
  });
  function En() {
    var e = new Worker((() => {
      let t = URL;
      return import.meta.url > "file:" && import.meta.url < "file;" ? new t("ort.webgpu.bundle.min.mjs", import.meta.url) : new URL(import.meta.url);
    })(), { type: "module", workerData: "em-pthread", name: "em-pthread" });
    We2.push(e);
  }
  var ke2, Js2 = (e, t) => {
    $ = 0, e = jr2(e, t), 0 < $ ? S = e : zr2(e);
  }, Ut = [], Ct = 0, pe = (e) => -9007199254740992 > e || 9007199254740992 < e ? NaN : Number(e);
  function Xs2(e) {
    var t = new vr(e >>>= 0);
    return (l(), Z)[t.Vc + 12 >>> 0] == 0 && (Sn(t, true), Ct--), An(t, false), Ut.push(t), ko2(e);
  }
  var ft = 0, Zs2 = () => {
    k2(0, 0);
    var e = Ut.pop();
    No2(e.nd), ft = 0;
  };
  function Sn(e, t) {
    t = t ? 1 : 0, (l(), Z)[e.Vc + 12 >>> 0] = t;
  }
  function An(e, t) {
    t = t ? 1 : 0, (l(), Z)[e.Vc + 13 >>> 0] = t;
  }
  class vr {
    constructor(t) {
      this.nd = t, this.Vc = t - 24;
    }
  }
  var Er2 = (e) => {
    var t = ft;
    if (!t) return St2(0), 0;
    var n = new vr(t);
    (l(), A)[n.Vc + 16 >>> 2 >>> 0] = t;
    var o = (l(), A)[n.Vc + 4 >>> 2 >>> 0];
    if (!o) return St2(0), t;
    for (var u of e) {
      if (u === 0 || u === o) break;
      if (Wo(u, o, n.Vc + 16)) return St2(u), t;
    }
    return St2(o), t;
  };
  function Ks2() {
    return Er2([]);
  }
  function Qs2(e) {
    return Er2([e >>> 0]);
  }
  function ei(e, t, n, o) {
    return Er2([e >>> 0, t >>> 0, n >>> 0, o >>> 0]);
  }
  var ti = () => {
    var e = Ut.pop();
    e || we("no exception to throw");
    var t = e.nd;
    throw (l(), Z)[e.Vc + 13 >>> 0] == 0 && (Ut.push(e), An(e, true), Sn(e, false), Ct++), Hr2(t), ft = t;
  };
  function ri(e, t, n) {
    var o = new vr(e >>>= 0);
    throw t >>>= 0, n >>>= 0, (l(), A)[o.Vc + 16 >>> 2 >>> 0] = 0, (l(), A)[o.Vc + 4 >>> 2 >>> 0] = t, (l(), A)[o.Vc + 8 >>> 2 >>> 0] = n, Hr2(e), Ct++, ft = e;
  }
  var ni = () => Ct;
  function In(e, t, n, o) {
    return i ? H(2, 1, e, t, n, o) : xn(e, t, n, o);
  }
  function xn(e, t, n, o) {
    if (e >>>= 0, t >>>= 0, n >>>= 0, o >>>= 0, !globalThis.SharedArrayBuffer) return 6;
    var u = [];
    return i && u.length === 0 ? In(e, t, n, o) : (e = { se: n, Sc: e, ad: o, he: u }, i ? (e.Uc = "spawnThread", postMessage(e, u), 0) : Q(e));
  }
  function oi(e) {
    throw ft || (ft = e >>> 0), ft;
  }
  var Ln = globalThis.TextDecoder && new TextDecoder(), On = (e, t, n, o) => {
    if (n = t + n, o) return n;
    for (; e[t] && !(t >= n); ) ++t;
    return t;
  }, Bn = (e, t = 0, n, o) => {
    if (16 < (n = On(e, t >>>= 0, n, o)) - t && e.buffer && Ln) return Ln.decode(e.buffer instanceof ArrayBuffer ? e.subarray(t, n) : e.slice(t, n));
    for (o = ""; t < n; ) {
      var u = e[t++];
      if (128 & u) {
        var c = 63 & e[t++];
        if ((224 & u) == 192) o += String.fromCharCode((31 & u) << 6 | c);
        else {
          var h = 63 & e[t++];
          65536 > (u = (240 & u) == 224 ? (15 & u) << 12 | c << 6 | h : (7 & u) << 18 | c << 12 | h << 6 | 63 & e[t++]) ? o += String.fromCharCode(u) : (u -= 65536, o += String.fromCharCode(55296 | u >> 10, 56320 | 1023 & u));
        }
      } else o += String.fromCharCode(u);
    }
    return o;
  }, ct = (e, t, n) => (e >>>= 0) ? Bn((l(), J2), e, t, n) : "";
  function Mn(e, t, n) {
    return i ? H(3, 1, e, t, n) : 0;
  }
  function Un(e, t) {
    if (i) return H(4, 1, e, t);
  }
  function Cn(e, t) {
    if (i) return H(5, 1, e, t);
  }
  function Dn(e, t, n) {
    if (i) return H(6, 1, e, t, n);
  }
  function Pn(e, t, n) {
    return i ? H(7, 1, e, t, n) : 0;
  }
  function _n(e, t) {
    if (i) return H(8, 1, e, t);
  }
  function Rn(e, t, n) {
    if (i) return H(9, 1, e, t, n);
  }
  function Nn(e, t, n, o) {
    if (i) return H(10, 1, e, t, n, o);
  }
  function Wn2(e, t, n, o) {
    if (i) return H(11, 1, e, t, n, o);
  }
  function kn(e, t, n, o) {
    if (i) return H(12, 1, e, t, n, o);
  }
  function Fn2(e) {
    if (i) return H(13, 1, e);
  }
  function Gn2(e, t) {
    if (i) return H(14, 1, e, t);
  }
  function $n(e, t, n) {
    if (i) return H(15, 1, e, t, n);
  }
  var ai = () => we(""), Oe2 = (e) => {
    e >>>= 0;
    for (var t = ""; ; ) {
      var n = (l(), J2)[e++ >>> 0];
      if (!n) return t;
      t += String.fromCharCode(n);
    }
  }, Sr2 = {}, Ar2 = {}, dt2 = class extends Error {
    constructor(e) {
      super(e), this.name = "BindingError";
    }
  };
  function De2(e, t, n = {}) {
    return function(o, u, c = {}) {
      var h = u.name;
      if (!o) throw new dt2(`type "${h}" must have a positive integer typeid pointer`);
      if (Ar2.hasOwnProperty(o)) {
        if (c.oe) return;
        throw new dt2(`Cannot register type '${h}' twice`);
      }
      Ar2[o] = u, Sr2.hasOwnProperty(o) && (u = Sr2[o], delete Sr2[o], u.forEach((b) => b()));
    }(e, t, n);
  }
  var zn = (e, t, n) => {
    switch (t) {
      case 1:
        return n ? (o) => (l(), Z)[o >>> 0] : (o) => (l(), J2)[o >>> 0];
      case 2:
        return n ? (o) => (l(), Ce)[o >>> 1 >>> 0] : (o) => (l(), K)[o >>> 1 >>> 0];
      case 4:
        return n ? (o) => (l(), x)[o >>> 2 >>> 0] : (o) => (l(), A)[o >>> 2 >>> 0];
      case 8:
        return n ? (o) => (l(), le)[o >>> 3 >>> 0] : (o) => (l(), q)[o >>> 3 >>> 0];
      default:
        throw new TypeError(`invalid integer width (${t}): ${e}`);
    }
  };
  function ii(e, t, n, o, u) {
    e >>>= 0, n >>>= 0, t = Oe2(t >>> 0);
    let c = (h) => h;
    if (o = o === 0n) {
      let h = 8 * n;
      c = (b) => BigInt.asUintN(h, b), u = c(u);
    }
    De2(e, { name: t, Rc: c, Xc: (h, b) => (typeof b == "number" && (b = BigInt(b)), b), Wc: zn(t, n, !o), Yc: null });
  }
  function ui(e, t, n, o) {
    De2(e >>>= 0, { name: t = Oe2(t >>> 0), Rc: function(u) {
      return !!u;
    }, Xc: function(u, c) {
      return c ? n : o;
    }, Wc: function(u) {
      return this.Rc((l(), J2)[u >>> 0]);
    }, Yc: null });
  }
  var Vn = [], Je = [0, 1, , 1, null, 1, true, 1, false, 1];
  function Ir2(e) {
    9 < (e >>>= 0) && --Je[e + 1] == 0 && (Je[e] = void 0, Vn.push(e));
  }
  var ge2 = (e) => {
    if (!e) throw new dt2(`Cannot use deleted val. handle = ${e}`);
    return Je[e];
  }, Ie2 = (e) => {
    switch (e) {
      case void 0:
        return 2;
      case null:
        return 4;
      case true:
        return 6;
      case false:
        return 8;
      default:
        let t = Vn.pop() || Je.length;
        return Je[t] = e, Je[t + 1] = 1, t;
    }
  };
  function xr2(e) {
    return this.Rc((l(), A)[e >>> 2 >>> 0]);
  }
  var fi = { name: "emscripten::val", Rc: (e) => {
    var t = ge2(e);
    return Ir2(e), t;
  }, Xc: (e, t) => Ie2(t), Wc: xr2, Yc: null };
  function ci(e) {
    return De2(e >>> 0, fi);
  }
  var di = (e, t) => {
    switch (t) {
      case 4:
        return function(n) {
          return this.Rc((l(), _)[n >>> 2 >>> 0]);
        };
      case 8:
        return function(n) {
          return this.Rc((l(), ae2)[n >>> 3 >>> 0]);
        };
      default:
        throw new TypeError(`invalid float width (${t}): ${e}`);
    }
  };
  function li(e, t, n) {
    n >>>= 0, De2(e >>>= 0, { name: t = Oe2(t >>> 0), Rc: (o) => o, Xc: (o, u) => u, Wc: di(t, n), Yc: null });
  }
  function pi(e, t, n, o, u) {
    e >>>= 0, n >>>= 0, t = Oe2(t >>> 0);
    let c = (b) => b;
    if (o === 0) {
      var h = 32 - 8 * n;
      c = (b) => b << h >>> h, u = c(u);
    }
    De2(e, { name: t, Rc: c, Xc: (b, E) => E, Wc: zn(t, n, o !== 0), Yc: null });
  }
  function mi(e, t, n) {
    function o(c) {
      var h = (l(), A)[c >>> 2 >>> 0];
      return c = (l(), A)[c + 4 >>> 2 >>> 0], new u((l(), Z).buffer, c, h);
    }
    var u = [Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array][t];
    De2(e >>>= 0, { name: n = Oe2(n >>> 0), Rc: o, Wc: o }, { oe: true });
  }
  var Pe2 = (e, t, n) => {
    var o = (l(), J2);
    if (t >>>= 0, 0 < n) {
      var u = t;
      n = t + n - 1;
      for (var c = 0; c < e.length; ++c) {
        var h = e.codePointAt(c);
        if (127 >= h) {
          if (t >= n) break;
          o[t++ >>> 0] = h;
        } else if (2047 >= h) {
          if (t + 1 >= n) break;
          o[t++ >>> 0] = 192 | h >> 6, o[t++ >>> 0] = 128 | 63 & h;
        } else if (65535 >= h) {
          if (t + 2 >= n) break;
          o[t++ >>> 0] = 224 | h >> 12, o[t++ >>> 0] = 128 | h >> 6 & 63, o[t++ >>> 0] = 128 | 63 & h;
        } else {
          if (t + 3 >= n) break;
          o[t++ >>> 0] = 240 | h >> 18, o[t++ >>> 0] = 128 | h >> 12 & 63, o[t++ >>> 0] = 128 | h >> 6 & 63, o[t++ >>> 0] = 128 | 63 & h, c++;
        }
      }
      o[t >>> 0] = 0, e = t - u;
    } else e = 0;
    return e;
  }, _e = (e) => {
    for (var t = 0, n = 0; n < e.length; ++n) {
      var o = e.charCodeAt(n);
      127 >= o ? t++ : 2047 >= o ? t += 2 : 55296 <= o && 57343 >= o ? (t += 4, ++n) : t += 3;
    }
    return t;
  };
  function hi(e, t) {
    De2(e >>>= 0, { name: t = Oe2(t >>> 0), Rc(n) {
      var o = (l(), A)[n >>> 2 >>> 0];
      return o = ct(n + 4, o, true), Te(n), o;
    }, Xc(n, o) {
      o instanceof ArrayBuffer && (o = new Uint8Array(o));
      var u = typeof o == "string";
      if (!(u || ArrayBuffer.isView(o) && o.BYTES_PER_ELEMENT == 1)) throw new dt2("Cannot pass non-string to std::string");
      var c = u ? _e(o) : o.length, h = mt2(4 + c + 1), b = h + 4;
      return (l(), A)[h >>> 2 >>> 0] = c, u ? Pe2(o, b, c + 1) : (l(), J2).set(o, b >>> 0), n !== null && n.push(Te, h), h;
    }, Wc: xr2, Yc(n) {
      Te(n);
    } });
  }
  var Hn2 = globalThis.TextDecoder ? new TextDecoder("utf-16le") : void 0, yi = (e, t, n) => {
    if (e >>>= 1, 16 < (t = On((l(), K), e, t / 2, n)) - e && Hn2) return Hn2.decode((l(), K).slice(e, t));
    for (n = ""; e < t; ++e) {
      var o = (l(), K)[e >>> 0];
      n += String.fromCharCode(o);
    }
    return n;
  }, bi = (e, t, n) => {
    if (n ?? (n = 2147483647), 2 > n) return 0;
    var o = t;
    n = (n -= 2) < 2 * e.length ? n / 2 : e.length;
    for (var u = 0; u < n; ++u) {
      var c = e.charCodeAt(u);
      (l(), Ce)[t >>> 1 >>> 0] = c, t += 2;
    }
    return (l(), Ce)[t >>> 1 >>> 0] = 0, t - o;
  }, wi = (e) => 2 * e.length, gi = (e, t, n) => {
    var o = "";
    e >>>= 2;
    for (var u = 0; !(u >= t / 4); u++) {
      var c = (l(), A)[e + u >>> 0];
      if (!c && !n) break;
      o += String.fromCodePoint(c);
    }
    return o;
  }, Ti = (e, t, n) => {
    if (t >>>= 0, n ?? (n = 2147483647), 4 > n) return 0;
    var o = t;
    n = o + n - 4;
    for (var u = 0; u < e.length; ++u) {
      var c = e.codePointAt(u);
      if (65535 < c && u++, (l(), x)[t >>> 2 >>> 0] = c, (t += 4) + 4 > n) break;
    }
    return (l(), x)[t >>> 2 >>> 0] = 0, t - o;
  }, vi = (e) => {
    for (var t = 0, n = 0; n < e.length; ++n) 65535 < e.codePointAt(n) && n++, t += 4;
    return t;
  };
  function Ei(e, t, n) {
    if (e >>>= 0, t >>>= 0, n = Oe2(n >>>= 0), t === 2) var o = yi, u = bi, c = wi;
    else o = gi, u = Ti, c = vi;
    De2(e, { name: n, Rc: (h) => {
      var b = (l(), A)[h >>> 2 >>> 0];
      return b = o(h + 4, b * t, true), Te(h), b;
    }, Xc: (h, b) => {
      if (typeof b != "string") throw new dt2(`Cannot pass non-string to C++ string type ${n}`);
      var E = c(b), I = mt2(4 + E + t);
      return (l(), A)[I >>> 2 >>> 0] = E / t, u(b, I + 4, E + t), h !== null && h.push(Te, I), I;
    }, Wc: xr2, Yc(h) {
      Te(h);
    } });
  }
  function Si(e, t) {
    De2(e >>>= 0, { pe: true, name: t = Oe2(t >>> 0), Rc: () => {
    }, Xc: () => {
    } });
  }
  function Ai(e) {
    $r2(e >>> 0, !f, 1, !s, 131072, false), Tn();
  }
  var Dt2 = (e) => {
    if (!G) try {
      if (e(), !(0 < $)) try {
        i ? $t2() && zr2(S) : Tr2(S);
      } catch (t) {
        t instanceof gt || t == "unwind" || y(0, t);
      }
    } catch (t) {
      t instanceof gt || t == "unwind" || y(0, t);
    }
  }, Ii = !Atomics.waitAsync || ((_b = globalThis.navigator) == null ? void 0 : _b.userAgent) && 91 > Number((navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./) || [])[2]);
  function Lr2(e) {
    e >>>= 0, Ii || (Atomics.waitAsync((l(), x), e >>> 2, e).value.then(Pt2), e += 128, Atomics.store((l(), x), e >>> 2, 1));
  }
  var Pt2 = () => Dt2(() => {
    var e = $t2();
    e && (Lr2(e), _o2());
  });
  function xi(e, t) {
    (e >>>= 0) == t >>> 0 ? setTimeout(Pt2) : i ? postMessage({ $c: e, Uc: "checkMailbox" }) : (e = qe[e]) && e.postMessage({ Uc: "checkMailbox" });
  }
  var Or2 = [];
  function Li(e, t, n, o, u) {
    for (t >>>= 0, u >>>= 0, Or2.length = 0, n = u >>> 3, o = u + o >>> 3; n < o; ) {
      var c;
      c = (l(), le)[n++ >>> 0] ? (l(), le)[n++ >>> 0] : (l(), ae2)[n++ >>> 0], Or2.push(c);
    }
    return (t ? Yr2[t] : df[e])(...Or2);
  }
  var Oi = () => {
    $ = 0;
  };
  function Bi(e) {
    e >>>= 0, i ? postMessage({ Uc: "cleanupThread", ue: e }) : gn2(qe[e]);
  }
  function Mi(e) {
  }
  var _t2 = (e) => {
    try {
      e();
    } catch (t) {
      we(t);
    }
  };
  function Ui(e) {
    var t = (...n) => {
      Rt2.push(e);
      try {
        return e(...n);
      } finally {
        G || (Rt2.pop(), Be && Fe === 1 && Rt2.length === 0 && (Fe = 0, $ += 1, _t2(Aa), typeof Fibers < "u" && Fibers.Oe()));
      }
    };
    return qn2.set(e, t), t;
  }
  var Fe = 0, Be = null, jn2 = 0, Rt2 = [], Br2 = /* @__PURE__ */ new Map(), Yn2 = /* @__PURE__ */ new Map(), qn2 = /* @__PURE__ */ new Map(), Ci = 0, Mr2 = null, Di = [], Jn2 = (e) => function(t) {
    if (!G) {
      if (Fe === 0) {
        var n = false, o = false;
        t((u = 0) => {
          if (!G && (jn2 = u, n = true, o)) {
            Fe = 2, _t2(() => Ia(Be)), typeof MainLoop < "u" && MainLoop.le && MainLoop.resume(), u = false;
            try {
              var c = function() {
                var E = (l(), x)[Be + 8 >>> 2 >>> 0];
                return E = Yn2.get(E), E = qn2.get(E), --$, E();
              }();
            } catch (E) {
              c = E, u = true;
            }
            var h = false;
            if (!Be) {
              var b = Mr2;
              b && (Mr2 = null, (u ? b.reject : b.resolve)(c), h = true);
            }
            if (u && !h) throw c;
          }
        }), o = true, n || (Fe = 1, Be = function() {
          var u = mt2(65548), c = u + 12;
          if ((l(), A)[u >>> 2 >>> 0] = c, (l(), A)[u + 4 >>> 2 >>> 0] = c + 65536, c = Rt2[0], !Br2.has(c)) {
            var h = Ci++;
            Br2.set(c, h), Yn2.set(h, c);
          }
          return c = Br2.get(c), (l(), x)[u + 8 >>> 2 >>> 0] = c, u;
        }(), typeof MainLoop < "u" && MainLoop.le && MainLoop.pause(), _t2(() => Sa(Be)));
      } else Fe === 2 ? (Fe = 0, _t2(xa), Te(Be), Be = null, Di.forEach(Dt2)) : we(`invalid state: ${Fe}`);
      return jn2;
    }
  }((t) => {
    e().then(t);
  });
  function Pi(e) {
    return e >>>= 0, Jn2(async () => {
      var t = await ge2(e);
      return Ie2(t);
    });
  }
  var Ur2 = [], _i = (e) => {
    var t = Ur2.length;
    return Ur2.push(e), t;
  }, Ri = (e, t) => {
    for (var n = Array(e), o = 0; o < e; ++o) {
      var u = o, c = (l(), A)[t + 4 * o >>> 2 >>> 0], h = Ar2[c];
      if (h === void 0) throw e = `parameter ${o}`, c = bo2(c), t = Oe2(c), Te(c), new dt2(`${e} has unknown type ${t}`);
      n[u] = h;
    }
    return n;
  }, Ni = (e, t, n) => {
    var o = [];
    return e = e(o, n), o.length && ((l(), A)[t >>> 2 >>> 0] = Ie2(o)), e;
  }, Wi = {}, Nt = (e) => {
    var t = Wi[e];
    return t === void 0 ? Oe2(e) : t;
  };
  function ki(e, t, n) {
    var [o, ...u] = Ri(e, t >>> 0);
    t = o.Xc.bind(o);
    var c = u.map((E) => E.Wc.bind(E));
    e--;
    var h = { toValue: ge2 };
    switch (e = c.map((E, I) => {
      var N = `argFromPtr${I}`;
      return h[N] = E, `${N}(args${I ? "+" + 8 * I : ""})`;
    }), n) {
      case 0:
        var b = "toValue(handle)";
        break;
      case 2:
        b = "new (toValue(handle))";
        break;
      case 3:
        b = "";
        break;
      case 1:
        h.getStringOrSymbol = Nt, b = "toValue(handle)[getStringOrSymbol(methodName)]";
    }
    return b += `(${e})`, o.pe || (h.toReturnWire = t, h.emval_returnValue = Ni, b = `return emval_returnValue(toReturnWire, destructorsRef, ${b})`), b = `return function (handle, methodName, destructorsRef, args) {
  ${b}
  }`, n = new Function(Object.keys(h), b)(...Object.values(h)), b = `methodCaller<(${u.map((E) => E.name)}) => ${o.name}>`, _i(Object.defineProperty(n, "name", { value: b }));
  }
  function Fi(e, t) {
    return t >>>= 0, (e = ge2(e >>> 0)) == ge2(t);
  }
  function Gi(e) {
    return (e >>>= 0) ? (e = Nt(e), Ie2(globalThis[e])) : Ie2(globalThis);
  }
  function $i(e) {
    return e = Nt(e >>> 0), Ie2(r[e]);
  }
  function zi(e, t) {
    return t >>>= 0, e = ge2(e >>> 0), t = ge2(t), Ie2(e[t]);
  }
  function Vi(e) {
    9 < (e >>>= 0) && (Je[e + 1] += 1);
  }
  function Xn2(e, t, n, o, u) {
    return Ur2[e >>> 0](t >>> 0, n >>> 0, o >>> 0, u >>> 0);
  }
  function Hi(e, t, n, o, u) {
    return Xn2(e >>> 0, t >>> 0, n >>> 0, o >>> 0, u >>> 0);
  }
  function ji() {
    return Ie2([]);
  }
  function Yi(e) {
    e = ge2(e >>> 0);
    for (var t = Array(e.length), n = 0; n < e.length; n++) t[n] = e[n];
    return Ie2(t);
  }
  function qi(e) {
    return Ie2(Nt(e >>> 0));
  }
  function Ji() {
    return Ie2({});
  }
  function Xi(e) {
    for (var t = ge2(e >>>= 0); t.length; ) {
      var n = t.pop();
      t.pop()(n);
    }
    Ir2(e);
  }
  function Zi(e, t, n) {
    t >>>= 0, n >>>= 0, e = ge2(e >>> 0), t = ge2(t), n = ge2(n), e[t] = n;
  }
  function Ki(e, t) {
    e = pe(e), t >>>= 0, e = new Date(1e3 * e), (l(), x)[t >>> 2 >>> 0] = e.getUTCSeconds(), (l(), x)[t + 4 >>> 2 >>> 0] = e.getUTCMinutes(), (l(), x)[t + 8 >>> 2 >>> 0] = e.getUTCHours(), (l(), x)[t + 12 >>> 2 >>> 0] = e.getUTCDate(), (l(), x)[t + 16 >>> 2 >>> 0] = e.getUTCMonth(), (l(), x)[t + 20 >>> 2 >>> 0] = e.getUTCFullYear() - 1900, (l(), x)[t + 24 >>> 2 >>> 0] = e.getUTCDay(), e = (e.getTime() - Date.UTC(e.getUTCFullYear(), 0, 1, 0, 0, 0, 0)) / 864e5 | 0, (l(), x)[t + 28 >>> 2 >>> 0] = e;
  }
  var Zn2 = (e) => e % 4 == 0 && (e % 100 != 0 || e % 400 == 0), Kn2 = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335], Qn2 = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  function Qi(e, t) {
    e = pe(e), t >>>= 0, e = new Date(1e3 * e), (l(), x)[t >>> 2 >>> 0] = e.getSeconds(), (l(), x)[t + 4 >>> 2 >>> 0] = e.getMinutes(), (l(), x)[t + 8 >>> 2 >>> 0] = e.getHours(), (l(), x)[t + 12 >>> 2 >>> 0] = e.getDate(), (l(), x)[t + 16 >>> 2 >>> 0] = e.getMonth(), (l(), x)[t + 20 >>> 2 >>> 0] = e.getFullYear() - 1900, (l(), x)[t + 24 >>> 2 >>> 0] = e.getDay();
    var n = (Zn2(e.getFullYear()) ? Kn2 : Qn2)[e.getMonth()] + e.getDate() - 1 | 0;
    (l(), x)[t + 28 >>> 2 >>> 0] = n, (l(), x)[t + 36 >>> 2 >>> 0] = -60 * e.getTimezoneOffset(), n = new Date(e.getFullYear(), 6, 1).getTimezoneOffset();
    var o = new Date(e.getFullYear(), 0, 1).getTimezoneOffset();
    e = 0 | (n != o && e.getTimezoneOffset() == Math.min(o, n)), (l(), x)[t + 32 >>> 2 >>> 0] = e;
  }
  function eu2(e) {
    e >>>= 0;
    var t = new Date((l(), x)[e + 20 >>> 2 >>> 0] + 1900, (l(), x)[e + 16 >>> 2 >>> 0], (l(), x)[e + 12 >>> 2 >>> 0], (l(), x)[e + 8 >>> 2 >>> 0], (l(), x)[e + 4 >>> 2 >>> 0], (l(), x)[e >>> 2 >>> 0], 0), n = (l(), x)[e + 32 >>> 2 >>> 0], o = t.getTimezoneOffset(), u = new Date(t.getFullYear(), 6, 1).getTimezoneOffset(), c = new Date(t.getFullYear(), 0, 1).getTimezoneOffset(), h = Math.min(c, u);
    return 0 > n ? (l(), x)[e + 32 >>> 2 >>> 0] = +(u != c && h == o) : 0 < n != (h == o) && (u = Math.max(c, u), t.setTime(t.getTime() + 6e4 * ((0 < n ? h : u) - o))), (l(), x)[e + 24 >>> 2 >>> 0] = t.getDay(), n = (Zn2(t.getFullYear()) ? Kn2 : Qn2)[t.getMonth()] + t.getDate() - 1 | 0, (l(), x)[e + 28 >>> 2 >>> 0] = n, (l(), x)[e >>> 2 >>> 0] = t.getSeconds(), (l(), x)[e + 4 >>> 2 >>> 0] = t.getMinutes(), (l(), x)[e + 8 >>> 2 >>> 0] = t.getHours(), (l(), x)[e + 12 >>> 2 >>> 0] = t.getDate(), (l(), x)[e + 16 >>> 2 >>> 0] = t.getMonth(), (l(), x)[e + 20 >>> 2 >>> 0] = t.getYear(), e = t.getTime(), BigInt(isNaN(e) ? -1 : e / 1e3);
  }
  function eo2(e, t, n, o, u, c, h) {
    return i ? H(16, 1, e, t, n, o, u, c, h) : -52;
  }
  function to2(e, t, n, o, u, c) {
    if (i) return H(17, 1, e, t, n, o, u, c);
  }
  var vt2 = {}, tu2 = () => performance.timeOrigin + performance.now();
  function ro2(e, t) {
    if (i) return H(18, 1, e, t);
    if (vt2[e] && (clearTimeout(vt2[e].id), delete vt2[e]), !t) return 0;
    var n = setTimeout(() => {
      delete vt2[e], Dt2(() => Po2(e, performance.timeOrigin + performance.now()));
    }, t);
    return vt2[e] = { id: n, Ne: t }, 0;
  }
  function ru2(e, t, n, o) {
    e >>>= 0, t >>>= 0, n >>>= 0, o >>>= 0;
    var u = (/* @__PURE__ */ new Date()).getFullYear(), c = new Date(u, 0, 1).getTimezoneOffset();
    u = new Date(u, 6, 1).getTimezoneOffset();
    var h = Math.max(c, u);
    (l(), A)[e >>> 2 >>> 0] = 60 * h, (l(), x)[t >>> 2 >>> 0] = +(c != u), e = (t = (b) => {
      var E = Math.abs(b);
      return `UTC${0 <= b ? "-" : "+"}${String(Math.floor(E / 60)).padStart(2, "0")}${String(E % 60).padStart(2, "0")}`;
    })(c), t = t(u), u < c ? (Pe2(e, n, 17), Pe2(t, o, 17)) : (Pe2(e, o, 17), Pe2(t, n, 17));
  }
  var nu2 = () => Date.now();
  function au2(e, t, n) {
    if (n >>>= 0, !(0 <= e && 3 >= e)) return 28;
    if (e === 0) e = Date.now();
    else {
      e = performance.timeOrigin + performance.now();
    }
    return e = Math.round(1e6 * e), (l(), le)[n >>> 3 >>> 0] = BigInt(e), 0;
  }
  var Cr2 = [], no2 = (e, t) => {
    Cr2.length = 0;
    for (var n; n = (l(), J2)[e++ >>> 0]; ) {
      var o = n != 105;
      t += (o &= n != 112) && t % 8 ? 4 : 0, Cr2.push(n == 112 ? (l(), A)[t >>> 2 >>> 0] : n == 106 ? (l(), le)[t >>> 3 >>> 0] : n == 105 ? (l(), x)[t >>> 2 >>> 0] : (l(), ae2)[t >>> 3 >>> 0]), t += o ? 8 : 4;
    }
    return Cr2;
  };
  function su2(e, t, n) {
    return e >>>= 0, t = no2(t >>> 0, n >>> 0), Yr2[e](...t);
  }
  function iu2(e, t, n) {
    return e >>>= 0, t = no2(t >>> 0, n >>> 0), Yr2[e](...t);
  }
  var uu2 = () => {
  };
  function fu2(e, t) {
    return O2(ct(e >>> 0, t >>> 0));
  }
  var cu2 = () => {
    throw $ += 1, "unwind";
  };
  function du2() {
    return 4294901760;
  }
  var lu2 = () => 1, pu2 = () => navigator.hardwareConcurrency, Xe = {}, oo2 = (e) => {
    var t = _e(e) + 1, n = mt2(t);
    return n && Pe2(e, n, t), n;
  }, Wt2 = (e) => {
    var t;
    return (t = /\bwasm-function\[\d+\]:(0x[0-9a-f]+)/.exec(e)) ? +t[1] : (t = /:(\d+):\d+(?:\)|$)/.exec(e)) ? 2147483648 | +t[1] : 0;
  }, ao2 = (e) => {
    for (var t of e) (e = Wt2(t)) && (Xe[e] = t);
  };
  function mu2() {
    var e = Error().stack.toString().split(`
`);
    return e[0] == "Error" && e.shift(), ao2(e), Xe.Xd = Wt2(e[3]), Xe.re = e, Xe.Xd;
  }
  function kt2(e) {
    if (!(e = Xe[e >>> 0])) return 0;
    var t;
    if (t = /^\s+at .*\.wasm\.(.*) \(.*\)$/.exec(e)) e = t[1];
    else if (t = /^\s+at (.*) \(.*\)$/.exec(e)) e = t[1];
    else {
      if (!(t = /^(.+?)@/.exec(e))) return 0;
      e = t[1];
    }
    return Te(kt2.ae ?? 0), kt2.ae = oo2(e), kt2.ae;
  }
  function hu2(e) {
    e >>>= 0;
    var t = (l(), J2).length;
    if (e <= t || 4294901760 < e) return false;
    for (var n = 1; 4 >= n; n *= 2) {
      var o = t * (1 + 0.2 / n);
      o = Math.min(o, e + 100663296);
      e: {
        o = (Math.min(4294901760, 65536 * Math.ceil(Math.max(e, o) / 65536)) - ke2.buffer.byteLength + 65535) / 65536 | 0;
        try {
          ke2.grow(o), se2();
          var u = 1;
          break e;
        } catch {
        }
        u = void 0;
      }
      if (u) return true;
    }
    return false;
  }
  function yu2(e, t, n) {
    if (e >>>= 0, t >>>= 0, Xe.Xd == e) var o = Xe.re;
    else (o = Error().stack.toString().split(`
`))[0] == "Error" && o.shift(), ao2(o);
    for (var u = 3; o[u] && Wt2(o[u]) != e; ) ++u;
    for (e = 0; e < n && o[e + u]; ++e) (l(), x)[t + 4 * e >>> 2 >>> 0] = Wt2(o[e + u]);
    return e;
  }
  var Me2 = (e) => {
    var t = _e(e) + 1, n = zt2(t);
    return Pe2(e, n, t), n;
  }, Dr2 = [], me2 = (e, t) => {
    Dr2[e >>>= 0] = t;
  }, Ue = [], Ft2 = [], lt = (e, t) => {
    Ft2[e] = new Promise((n) => t.finally(() => n(e)));
  }, B = (e) => {
    if (e) return Dr2[e >>> 0];
  }, Gt2 = (e, t, n) => {
    (l(), A)[e >>> 2 >>> 0] = t, (l(), A)[e + 4 >>> 2 >>> 0] = n;
  }, so2 = (e) => {
    var t = (l(), A)[e >>> 2 >>> 0];
    return e = (l(), A)[e + 4 >>> 2 >>> 0], ct(t, e);
  }, Re2 = (e) => {
    var t = (l(), A)[e >>> 2 >>> 0];
    return e = (l(), A)[e + 4 >>> 2 >>> 0], t ? ct(t, e) : e === 0 ? "" : void 0;
  }, bu2 = (e) => {
    var t = Re2(e + 4), n = (n = (l(), A)[e + 12 >>> 2 >>> 0]) ? B(n) : "auto";
    if (e += 16) {
      var o = B((l(), A)[e + 4 >>> 2 >>> 0]), u = (l(), A)[e + 16 >>> 2 >>> 0], c = (l(), A)[e + 20 >>> 2 >>> 0];
      if (u) {
        for (var h = {}, b = 0; b < u; ++b) {
          var E = c + 24 * b;
          h[so2(E + 4)] = (l(), ae2)[E + 16 >>> 3 >>> 0];
        }
        u = h;
      } else u = void 0;
      e = { module: o, constants: u, entryPoint: Re2(e + 8) };
    } else e = void 0;
    return { label: t, layout: n, compute: e };
  }, io2 = (e, t) => {
    function n(u, c) {
      u = e[u], (l(), x)[t + c >>> 2 >>> 0] = u;
    }
    function o(u, c) {
      u = e[u], (l(), le)[t + c >>> 3 >>> 0] = BigInt(u);
    }
    n("maxTextureDimension1D", 4), n("maxTextureDimension2D", 8), n("maxTextureDimension3D", 12), n("maxTextureArrayLayers", 16), n("maxBindGroups", 20), n("maxBindGroupsPlusVertexBuffers", 24), n("maxBindingsPerBindGroup", 28), n("maxDynamicUniformBuffersPerPipelineLayout", 32), n("maxDynamicStorageBuffersPerPipelineLayout", 36), n("maxSampledTexturesPerShaderStage", 40), n("maxSamplersPerShaderStage", 44), n("maxStorageBuffersPerShaderStage", 48), n("maxStorageTexturesPerShaderStage", 52), n("maxUniformBuffersPerShaderStage", 56), n("minUniformBufferOffsetAlignment", 80), n("minStorageBufferOffsetAlignment", 84), o("maxUniformBufferBindingSize", 64), o("maxStorageBufferBindingSize", 72), n("maxVertexBuffers", 88), o("maxBufferSize", 96), n("maxVertexAttributes", 104), n("maxVertexBufferArrayStride", 108), n("maxInterStageShaderVariables", 112), n("maxColorAttachments", 116), n("maxColorAttachmentBytesPerSample", 120), n("maxComputeWorkgroupStorageSize", 124), n("maxComputeInvocationsPerWorkgroup", 128), n("maxComputeWorkgroupSizeX", 132), n("maxComputeWorkgroupSizeY", 136), n("maxComputeWorkgroupSizeZ", 140), n("maxComputeWorkgroupsPerDimension", 144), e.Le !== void 0 && n("maxImmediateSize", 148);
  }, wu2 = [, "validation", "out-of-memory", "internal"], gu2 = [, "compatibility", "core"], uo2 = { 1: "core-features-and-limits", 2: "depth-clip-control", 3: "depth32float-stencil8", 4: "texture-compression-bc", 5: "texture-compression-bc-sliced-3d", 6: "texture-compression-etc2", 7: "texture-compression-astc", 8: "texture-compression-astc-sliced-3d", 9: "timestamp-query", 10: "indirect-first-instance", 11: "shader-f16", 12: "rg11b10ufloat-renderable", 13: "bgra8unorm-storage", 14: "float32-filterable", 15: "float32-blendable", 16: "clip-distances", 17: "dual-source-blending", 18: "subgroups", 19: "texture-formats-tier1", 20: "texture-formats-tier2", 21: "primitive-index", 327692: "chromium-experimental-unorm16-texture-formats", 327693: "chromium-experimental-snorm16-texture-formats", 327732: "chromium-experimental-multi-draw-indirect" }, Tu2 = [, "low-power", "high-performance"], vu2 = [, "occlusion", "timestamp"], Eu2 = { undefined: 1, unknown: 1, destroyed: 2 };
  function Su2(e, t, n, o, u, c) {
    t = pe(t), n = pe(n), o >>>= 0, u >>>= 0, c >>>= 0;
    var h = B(e >>> 0);
    if (e = {}, c) {
      var b = (l(), A)[c + 12 >>> 2 >>> 0];
      if (b) {
        var E = (l(), A)[c + 16 >>> 2 >>> 0];
        e.requiredFeatures = Array.from((l(), A).subarray(E >>> 2 >>> 0, E + 4 * b >>> 2 >>> 0), (L2) => uo2[L2]);
      }
      var I = (l(), A)[c + 20 >>> 2 >>> 0];
      if (I) {
        let L2 = function(ve, ie, Ze2 = false) {
          ie = I + ie, (ie = (l(), A)[ie >>> 2 >>> 0]) == 4294967295 || Ze2 && ie == 0 || (N[ve] = ie);
        }, fe2 = function(ve, ie) {
          ie = I + ie;
          var Ze2 = (l(), A)[ie >>> 2 >>> 0], Zf2 = (l(), A)[ie + 4 >>> 2 >>> 0];
          Ze2 == 4294967295 && Zf2 == 4294967295 || (N[ve] = 4294967296 * (l(), A)[ie + 4 >>> 2 >>> 0] + (l(), A)[ie >>> 2 >>> 0]);
        };
        var N = {};
        L2("maxTextureDimension1D", 4), L2("maxTextureDimension2D", 8), L2("maxTextureDimension3D", 12), L2("maxTextureArrayLayers", 16), L2("maxBindGroups", 20), L2("maxBindGroupsPlusVertexBuffers", 24), L2("maxDynamicUniformBuffersPerPipelineLayout", 32), L2("maxDynamicStorageBuffersPerPipelineLayout", 36), L2("maxSampledTexturesPerShaderStage", 40), L2("maxSamplersPerShaderStage", 44), L2("maxStorageBuffersPerShaderStage", 48), L2("maxStorageTexturesPerShaderStage", 52), L2("maxUniformBuffersPerShaderStage", 56), L2("minUniformBufferOffsetAlignment", 80), L2("minStorageBufferOffsetAlignment", 84), fe2("maxUniformBufferBindingSize", 64), fe2("maxStorageBufferBindingSize", 72), L2("maxVertexBuffers", 88), fe2("maxBufferSize", 96), L2("maxVertexAttributes", 104), L2("maxVertexBufferArrayStride", 108), L2("maxInterStageShaderVariables", 112), L2("maxColorAttachments", 116), L2("maxColorAttachmentBytesPerSample", 120), L2("maxComputeWorkgroupStorageSize", 124), L2("maxComputeInvocationsPerWorkgroup", 128), L2("maxComputeWorkgroupSizeX", 132), L2("maxComputeWorkgroupSizeY", 136), L2("maxComputeWorkgroupSizeZ", 140), L2("maxComputeWorkgroupsPerDimension", 144), L2("maxImmediateSize", 148, true), e.requiredLimits = N;
      }
      (b = (l(), A)[c + 24 >>> 2 >>> 0]) && (b = { label: Re2(b + 4) }, e.defaultQueue = b), e.label = Re2(c + 4);
    }
    $ += 1, lt(t, h.requestDevice(e).then((L2) => {
      --$, me2(u, L2.queue), me2(o, L2), n && ($ += 1, lt(n, L2.lost.then((fe2) => {
        --$, L2.onuncapturederror = () => {
        };
        var ve = D(), ie = Me2(fe2.message);
        Wr2(n, Eu2[fe2.reason], ie), C(ve);
      }))), L2.onuncapturederror = (fe2) => {
        var ve = 5;
        fe2.error instanceof GPUValidationError ? ve = 2 : fe2.error instanceof GPUOutOfMemoryError ? ve = 3 : fe2.error instanceof GPUInternalError && (ve = 4);
        var ie = D();
        fe2 = Me2(fe2.error.message), Mo2(o, ve, fe2), C(ie);
      }, "adapterInfo" in L2 || (L2.adapterInfo = h.info), Gr2(t, 1, o, 0);
    }, (L2) => {
      --$;
      var fe2 = D();
      L2 = Me2(L2.message), Gr2(t, 3, o, L2), n && Wr2(n, 4, L2), C(fe2);
    }));
  }
  function Au2(e) {
    var t = B(e >>>= 0), n = Ue[e];
    if (n) {
      for (var o = 0; o < n.length; ++o) n[o]();
      delete Ue[e];
    }
    t.destroy();
  }
  var pt2 = () => {
    var e = "getMappedRange size=0 no longer means WGPU_WHOLE_MAP_SIZE";
    pt2.ed || (pt2.ed = {}), pt2.ed[e] || (pt2.ed[e] = 1, O2(e));
  };
  function Iu2(e, t, n) {
    t >>>= 0, n >>>= 0;
    var o = B(e >>>= 0);
    n === 0 && pt2(), n == 4294967295 && (n = void 0);
    try {
      var u = o.getMappedRange(t, n);
    } catch {
      return 0;
    }
    var c = Vr2(16, u.byteLength);
    return (l(), J2).set(new Uint8Array(u), c >>> 0), Ue[e].push(() => Te(c)), c;
  }
  function xu2(e, t, n) {
    t >>>= 0, n >>>= 0;
    var o = B(e >>>= 0);
    n === 0 && pt2(), n == 4294967295 && (n = void 0);
    try {
      var u = o.getMappedRange(t, n);
    } catch {
      return 0;
    }
    var c = Vr2(16, u.byteLength);
    return (l(), J2).fill(0, c, u.byteLength), Ue[e].push(() => {
      new Uint8Array(u).set((l(), J2).subarray(c >>> 0, c + u.byteLength >>> 0)), Te(c);
    }), c;
  }
  function Lu2(e, t, n, o, u) {
    e >>>= 0, t = pe(t), n = pe(n), u >>>= 0;
    var c = B(e);
    Ue[e] = [], u == 4294967295 && (u = void 0), $ += 1, lt(t, c.mapAsync(n, o >>> 0, u).then(() => {
      --$, kr2(t, 1, 0);
    }, (h) => {
      --$, D();
      var b = Me2(h.message);
      kr2(t, h.name === "AbortError" ? 4 : h.name === "OperationError" ? 3 : 0, b), delete Ue[e];
    }));
  }
  function Ou2(e) {
    var t = B(e >>>= 0), n = Ue[e];
    if (n) {
      for (var o = 0; o < n.length; ++o) n[o]();
      delete Ue[e], t.unmap();
    }
  }
  function Bu2(e) {
    delete Dr2[e >>> 0];
  }
  function Mu2(e, t, n) {
    e >>>= 0, t >>>= 0, n >>>= 0;
    var o = !!(l(), A)[t + 32 >>> 2 >>> 0];
    t = { label: Re2(t + 4), usage: (l(), A)[t + 16 >>> 2 >>> 0], size: 4294967296 * (l(), A)[t + 28 >>> 2 >>> 0] + (l(), A)[t + 24 >>> 2 >>> 0], mappedAtCreation: o }, e = B(e);
    try {
      var u = e.createBuffer(t);
    } catch {
      return false;
    }
    return me2(n, u), o && (Ue[n] = []), true;
  }
  function Uu2(e, t, n, o) {
    e >>>= 0, t = pe(t), o >>>= 0, n = bu2(n >>> 0), e = B(e), $ += 1, lt(t, e.createComputePipelineAsync(n).then((u) => {
      --$, me2(o, u), Nr2(t, 1, o, 0);
    }, (u) => {
      --$;
      var c = D(), h = Me2(u.message);
      Nr2(t, u.reason === "validation" ? 3 : u.reason === "internal" ? 4 : 0, o, h), C(c);
    }));
  }
  function Cu2(e, t, n) {
    e >>>= 0, t >>>= 0, n >>>= 0;
    var o = (l(), A)[t >>> 2 >>> 0], u = (l(), A)[o + 4 >>> 2 >>> 0];
    t = { label: Re2(t + 4), code: "" }, u === 2 && (t.code = so2(o + 8)), me2(n, B(e).createShaderModule(t));
  }
  var Du2 = (e) => {
    (e = B(e)).onuncapturederror = null, e.destroy();
  };
  function Pu2(e, t) {
    t = pe(t), e = B(e >>> 0), $ += 1, lt(t, e.popErrorScope().then((n) => {
      --$;
      var o = 5;
      n ? n instanceof GPUValidationError ? o = 2 : n instanceof GPUOutOfMemoryError ? o = 3 : n instanceof GPUInternalError && (o = 4) : o = 1;
      var u = D();
      n = n ? Me2(n.message) : 0, Fr2(t, 1, o, n), C(u);
    }, (n) => {
      --$;
      var o = D();
      n = Me2(n.message), Fr2(t, 1, 5, n), C(o);
    }));
  }
  function _u2(e, t, n, o) {
    if (t = pe(t), o >>>= 0, n >>>= 0) {
      var u = (l(), A)[n + 4 >>> 2 >>> 0];
      u = { featureLevel: gu2[u], powerPreference: Tu2[(l(), A)[n + 8 >>> 2 >>> 0]], forceFallbackAdapter: !!(l(), A)[n + 12 >>> 2 >>> 0] }, (n = (l(), A)[n >>> 2 >>> 0]) !== 0 && (l(), u.Qe = !!(l(), A)[n + 8 >>> 2 >>> 0]);
    }
    "gpu" in navigator ? ($ += 1, lt(t, navigator.gpu.requestAdapter(u).then((c) => {
      if (--$, c) me2(o, c), Et2(t, 1, o, 0);
      else {
        c = D();
        var h = Me2("WebGPU not available on this browser (requestAdapter returned null)");
        Et2(t, 3, o, h), C(c);
      }
    }, (c) => {
      --$;
      var h = D();
      c = Me2(c.message), Et2(t, 4, o, c), C(h);
    }))) : (n = D(), u = Me2("WebGPU not available on this browser (navigator.gpu is not available)"), Et2(t, 3, o, u), C(n));
  }
  function Ru2(e, t, n) {
    return e >>>= 0, t >>>= 0, n >>>= 0, Jn2(async () => {
      var o = [];
      if (n) {
        var u = (l(), x)[n >>> 2 >>> 0];
        o.length = t + 1, o[t] = new Promise((b) => setTimeout(b, u, 0));
      } else o.length = t;
      for (var c = 0; c < t; ++c) {
        var h = 4294967296 * (l(), A)[e + 8 * c + 4 >>> 2 >>> 0] + (l(), A)[e + 8 * c >>> 2 >>> 0];
        if (!(h in Ft2)) return h;
        o[c] = Ft2[h];
      }
      return o = await Promise.race(o), delete Ft2[o], o;
    });
  }
  var Pr2, _r = {}, fo2 = () => {
    var _a3;
    if (!Pr2) {
      var e, t = { USER: "web_user", LOGNAME: "web_user", PATH: "/", PWD: "/", HOME: "/home/web_user", LANG: (((_a3 = globalThis.navigator) == null ? void 0 : _a3.language) ?? "C").replace("-", "_") + ".UTF-8", _: "./this.program" };
      for (e in _r) _r[e] === void 0 ? delete t[e] : t[e] = _r[e];
      var n = [];
      for (e in t) n.push(`${e}=${t[e]}`);
      Pr2 = n;
    }
    return Pr2;
  };
  function co2(e, t) {
    if (i) return H(19, 1, e, t);
    e >>>= 0, t >>>= 0;
    var n, o = 0, u = 0;
    for (n of fo2()) {
      var c = t + o;
      (l(), A)[e + u >>> 2 >>> 0] = c, o += Pe2(n, c, 1 / 0) + 1, u += 4;
    }
    return 0;
  }
  function lo2(e, t) {
    if (i) return H(20, 1, e, t);
    e >>>= 0, t >>>= 0;
    var n = fo2();
    for (var o of ((l(), A)[e >>> 2 >>> 0] = n.length, e = 0, n)) e += _e(o) + 1;
    return (l(), A)[t >>> 2 >>> 0] = e, 0;
  }
  function po2(e) {
    return i ? H(21, 1, e) : 52;
  }
  function mo2(e, t, n, o) {
    return i ? H(22, 1, e, t, n, o) : 52;
  }
  function ho2(e, t, n, o) {
    return i ? H(23, 1, e, t, n, o) : 70;
  }
  var Nu2 = [null, [], []];
  function yo2(e, t, n, o) {
    if (i) return H(24, 1, e, t, n, o);
    t >>>= 0, n >>>= 0, o >>>= 0;
    for (var u = 0, c = 0; c < n; c++) {
      var h = (l(), A)[t >>> 2 >>> 0], b = (l(), A)[t + 4 >>> 2 >>> 0];
      t += 8;
      for (var E = 0; E < b; E++) {
        var I = e, N = (l(), J2)[h + E >>> 0], W = Nu2[I];
        N === 0 || N === 10 ? ((I === 1 ? Y : O2)(Bn(W)), W.length = 0) : W.push(N);
      }
      u += b;
    }
    return (l(), A)[o >>> 2 >>> 0] = u, 0;
  }
  function Wu2(e) {
    return e >>> 0;
  }
  function ku2(e, t) {
    return io2(B(e >>> 0).limits, t >>> 0), 1;
  }
  function Fu2(e, t) {
    return B(e >>> 0).features.has(uo2[t]);
  }
  function Gu2(e) {
    return BigInt(B(e >>> 0).size);
  }
  function $u2(e) {
    return BigInt(B(e >>> 0).usage);
  }
  function zu2(e, t) {
    if (e >>>= 0, t >>>= 0) {
      var n = Re2(t + 4);
      n = { label: n, timestampWrites: t = (t = (l(), A)[t + 12 >>> 2 >>> 0]) !== 0 ? { querySet: B((l(), A)[t + 4 >>> 2 >>> 0]), beginningOfPassWriteIndex: (l(), A)[t + 8 >>> 2 >>> 0], endOfPassWriteIndex: (l(), A)[t + 12 >>> 2 >>> 0] } : void 0 };
    }
    return e = B(e), t = Io2(0), me2(t, e.beginComputePass(n)), t;
  }
  function Vu2(e, t, n, o, u, c) {
    n = pe(n), u = pe(u), c = pe(c), B(e >>> 0).copyBufferToBuffer(B(t >>> 0), n, B(o >>> 0), u, c);
  }
  function Hu2(e) {
    e = B(e >>> 0);
    var t = So2(0);
    return me2(t, e.finish()), t;
  }
  function ju2(e, t, n, o, u, c) {
    c = pe(c), B(e >>> 0).resolveQuerySet(B(t >>> 0), n, o, B(u >>> 0), c);
  }
  function Yu2(e, t, n, o) {
    B(e >>> 0).dispatchWorkgroups(t, n, o);
  }
  function qu2(e, t, n) {
    n = pe(n), B(e >>> 0).dispatchWorkgroupsIndirect(B(t >>> 0), n);
  }
  function Ju2(e) {
    B(e >>> 0).end();
  }
  function Xu2(e, t, n, o, u) {
    o >>>= 0, u >>>= 0, e = B(e >>> 0), n = B(n >>> 0), o == 0 ? e.setBindGroup(t, n) : e.setBindGroup(t, n, (l(), A), u >>> 2, o);
  }
  function Zu2(e, t) {
    B(e >>> 0).setPipeline(B(t >>> 0));
  }
  function Ku2(e, t, n) {
    B(e >>> 0).Pe(B(t >>> 0), n);
  }
  function Qu2(e, t) {
    e = B(e >>> 0);
    var n = Eo2(0);
    return me2(n, e.getBindGroupLayout(t)), n;
  }
  function ef(e, t) {
    e >>>= 0;
    var n = Re2(4 + (t >>>= 0)), o = B((l(), A)[t + 12 >>> 2 >>> 0]), u = (l(), A)[t + 16 >>> 2 >>> 0];
    t = (l(), A)[t + 20 >>> 2 >>> 0];
    for (var c = [], h = 0; h < u; ++h) {
      var b = c, E = b.push, I = t + 40 * h, N = (l(), A)[I + 8 >>> 2 >>> 0], W = (l(), A)[I + 32 >>> 2 >>> 0], X = (l(), A)[I + 36 >>> 2 >>> 0], L2 = (l(), A)[I + 4 >>> 2 >>> 0];
      N ? (W = I + 24, (W = (l(), A)[W >>> 2 >>> 0] + 4294967296 * (l(), x)[W + 4 >>> 2 >>> 0]) == -1 && (W = void 0), I = { binding: L2, resource: { buffer: B(N), offset: 4294967296 * (l(), A)[I + 4 + 16 >>> 2 >>> 0] + (l(), A)[I + 16 >>> 2 >>> 0], size: W } }) : I = W ? { binding: L2, resource: B(W) } : { binding: L2, resource: B(X) }, E.call(b, I);
    }
    return n = { label: n, layout: o, entries: c }, e = B(e), o = vo2(0), me2(o, e.createBindGroup(n)), o;
  }
  function tf(e, t) {
    var n;
    return e >>>= 0, (t >>>= 0) && (n = { label: Re2(t + 4) }), e = B(e), t = Ao2(0), me2(t, e.createCommandEncoder(n)), t;
  }
  function rf(e, t) {
    e >>>= 0, t >>>= 0, t = { type: vu2[(l(), A)[t + 12 >>> 2 >>> 0]], count: (l(), A)[t + 16 >>> 2 >>> 0] }, e = B(e);
    var n = xo2(0);
    return me2(n, e.createQuerySet(t)), n;
  }
  function nf(e, t) {
    e = B(e >>> 0).adapterInfo, t >>>= 0, (l(), x)[t + 52 >>> 2 >>> 0] = e.subgroupMinSize, (l(), x)[t + 56 >>> 2 >>> 0] = e.subgroupMaxSize;
    var n = oo2(e.vendor + e.architecture + e.device + e.description), o = _e(e.vendor);
    return Gt2(t + 4, n, o), n += o, o = _e(e.architecture), Gt2(t + 12, n, o), n += o, o = _e(e.device), Gt2(t + 20, n, o), Gt2(t + 28, n + o, _e(e.description)), (l(), x)[t + 36 >>> 2 >>> 0] = 2, e = e.isFallbackAdapter ? 3 : 4, (l(), x)[t + 40 >>> 2 >>> 0] = e, (l(), x)[t + 44 >>> 2 >>> 0] = 0, (l(), x)[t + 48 >>> 2 >>> 0] = 0, 1;
  }
  var of = { "core-features-and-limits": 1, "depth-clip-control": 2, "depth32float-stencil8": 3, "texture-compression-bc": 4, "texture-compression-bc-sliced-3d": 5, "texture-compression-etc2": 6, "texture-compression-astc": 7, "texture-compression-astc-sliced-3d": 8, "timestamp-query": 9, "indirect-first-instance": 10, "shader-f16": 11, "rg11b10ufloat-renderable": 12, "bgra8unorm-storage": 13, "float32-filterable": 14, "float32-blendable": 15, "clip-distances": 16, "dual-source-blending": 17, subgroups: 18, "texture-formats-tier1": 19, "texture-formats-tier2": 20, "primitive-index": 21, "chromium-experimental-unorm16-texture-formats": 327692, "chromium-experimental-snorm16-texture-formats": 327693, "chromium-experimental-multi-draw-indirect": 327732 };
  function af(e, t) {
    t >>>= 0, e = B(e >>> 0);
    var n = mt2(4 * e.features.size), o = 0, u = 0;
    e.features.forEach((c) => {
      0 <= (c = of[c]) && ((l(), x)[n + o >>> 2 >>> 0] = c, o += 4, u++);
    }), (l(), A)[t + 4 >>> 2 >>> 0] = n, (l(), A)[t >>> 2 >>> 0] = u;
  }
  function sf(e, t) {
    return io2(B(e >>> 0).limits, t >>> 0), 1;
  }
  function uf(e, t) {
    B(e >>> 0).pushErrorScope(wu2[t]);
  }
  function ff(e, t, n) {
    t >>>= 0, n >>>= 0, e = B(e >>> 0), t = Array.from((l(), x).subarray(n >>> 2 >>> 0, n + 4 * t >>> 2 >>> 0), (o) => B(o)), e.submit(t);
  }
  function cf(e, t, n, o, u) {
    n = pe(n), o >>>= 0, u >>>= 0, e = B(e >>> 0), t = B(t >>> 0), o = (l(), J2).subarray(o >>> 0, o + u >>> 0), e.writeBuffer(t, n, o, 0, u);
  }
  i || function() {
    for (var e = r.numThreads - 1; e--; ) En();
    Ae.push(async () => {
      var t = async function() {
        if (!i) return Promise.all(We2.map(vn));
      }();
      Le2++, await t, --Le2 == 0 && te && (t = te, te = null, t());
    });
  }(), i || (ke2 = new WebAssembly.Memory({ initial: 256, maximum: 65536, shared: true }), se2()), r.wasmBinary && (g = r.wasmBinary), r.stackSave = () => D(), r.stackRestore = (e) => C(e), r.stackAlloc = (e) => zt2(e), r.setValue = function(e, t, n = "i8") {
    switch (n.endsWith("*") && (n = "*"), n) {
      case "i1":
      case "i8":
        (l(), Z)[e >>> 0] = t;
        break;
      case "i16":
        (l(), Ce)[e >>> 1 >>> 0] = t;
        break;
      case "i32":
        (l(), x)[e >>> 2 >>> 0] = t;
        break;
      case "i64":
        (l(), le)[e >>> 3 >>> 0] = BigInt(t);
        break;
      case "float":
        (l(), _)[e >>> 2 >>> 0] = t;
        break;
      case "double":
        (l(), ae2)[e >>> 3 >>> 0] = t;
        break;
      case "*":
        (l(), A)[e >>> 2 >>> 0] = t;
        break;
      default:
        we(`invalid type for setValue: ${n}`);
    }
  }, r.getValue = function(e, t = "i8") {
    switch (t.endsWith("*") && (t = "*"), t) {
      case "i1":
      case "i8":
        return (l(), Z)[e >>> 0];
      case "i16":
        return (l(), Ce)[e >>> 1 >>> 0];
      case "i32":
        return (l(), x)[e >>> 2 >>> 0];
      case "i64":
        return (l(), le)[e >>> 3 >>> 0];
      case "float":
        return (l(), _)[e >>> 2 >>> 0];
      case "double":
        return (l(), ae2)[e >>> 3 >>> 0];
      case "*":
        return (l(), A)[e >>> 2 >>> 0];
      default:
        we(`invalid type for getValue: ${t}`);
    }
  }, r.UTF8ToString = ct, r.stringToUTF8 = Pe2, r.lengthBytesUTF8 = _e;
  var bo2, wo2, Rr2, $t2, Te, mt2, go2, To2, vo2, Eo2, So2, Ao2, Io2, xo2, Lo, Oo2, Bo2, Nr2, Wr2, kr2, Fr2, Et2, Gr2, Mo2, $r2, Uo2, Co2, Do2, zr2, Po2, _o2, Vr2, k2, St2, Ro2, C, zt2, D, No2, Hr2, Wo, ko2, Fo, jr2, Go, $o2, zo2, Vo, Ho, jo, Yo, qo, Jo, Xo, Zo, Ko, Qo, ea, ta, ra, na, oa, aa, sa, ia, ua, fa, ca, da, la, pa, ma, ha, ya, ba, wa, ga, Ta, va, Ea, Sa, Aa, Ia, xa, Ne2, df = [Ye2, gr, In, Mn, Un, Cn, Dn, Pn, _n, Rn, Nn, Wn2, kn, Fn2, Gn2, $n, eo2, to2, ro2, co2, lo2, po2, mo2, ho2, yo2], Yr2 = { 1111036: (e, t, n, o, u) => {
    if (r === void 0 || !r.Zc) return 1;
    if ((e = ct(Number(e >>> 0))).startsWith("./") && (e = e.substring(2)), !(e = r.Zc.get(e))) return 2;
    if (t = Number(t >>> 0), n = Number(n >>> 0), o = Number(o >>> 0), t + n > e.byteLength) return 3;
    try {
      let c = e.subarray(t, t + n);
      switch (u) {
        case 0:
          (l(), J2).set(c, o >>> 0);
          break;
        case 1:
          r.ie ? r.ie(o, c) : r.Ke(o, c);
          break;
        default:
          return 4;
      }
      return 0;
    } catch {
      return 4;
    }
  }, 1111860: (e, t, n) => {
    r.ke(e, (l(), J2).subarray(t >>> 0, t + n >>> 0));
  }, 1111924: () => r.Ie(), 1111966: (e) => {
    r.je(e);
  }, 1112003: () => typeof wasmOffsetConverter < "u" };
  function lf() {
    return typeof wasmOffsetConverter < "u";
  }
  function pf(e, t, n, o) {
    var u = D();
    try {
      return qo(e, t, n, o);
    } catch (c) {
      if (C(u), c !== c + 0) throw c;
      k2(1, 0);
    }
  }
  function mf(e, t, n) {
    var o = D();
    try {
      return Ho(e, t, n);
    } catch (u) {
      if (C(o), u !== u + 0) throw u;
      k2(1, 0);
    }
  }
  function hf(e, t, n) {
    var o = D();
    try {
      Fo(e, t, n);
    } catch (u) {
      if (C(o), u !== u + 0) throw u;
      k2(1, 0);
    }
  }
  function yf2(e, t) {
    var n = D();
    try {
      return jr2(e, t);
    } catch (o) {
      if (C(n), o !== o + 0) throw o;
      k2(1, 0);
    }
  }
  function bf2(e) {
    var t = D();
    try {
      Go(e);
    } catch (n) {
      if (C(t), n !== n + 0) throw n;
      k2(1, 0);
    }
  }
  function wf2(e, t, n, o, u, c, h) {
    var b = D();
    try {
      return Vo(e, t, n, o, u, c, h);
    } catch (E) {
      if (C(b), E !== E + 0) throw E;
      k2(1, 0);
    }
  }
  function gf2(e, t) {
    var n = D();
    try {
      Jo(e, t);
    } catch (o) {
      if (C(n), o !== o + 0) throw o;
      k2(1, 0);
    }
  }
  function Tf2(e, t, n, o, u, c) {
    var h = D();
    try {
      $o2(e, t, n, o, u, c);
    } catch (b) {
      if (C(h), b !== b + 0) throw b;
      k2(1, 0);
    }
  }
  function vf2(e, t, n, o) {
    var u = D();
    try {
      Yo(e, t, n, o);
    } catch (c) {
      if (C(u), c !== c + 0) throw c;
      k2(1, 0);
    }
  }
  function Ef2(e, t, n, o, u, c, h) {
    var b = D();
    try {
      Zo(e, t, n, o, u, c, h);
    } catch (E) {
      if (C(b), E !== E + 0) throw E;
      k2(1, 0);
    }
  }
  function Sf2(e, t, n, o, u, c, h) {
    var b = D();
    try {
      Ko(e, t, n, o, u, c, h);
    } catch (E) {
      if (C(b), E !== E + 0) throw E;
      k2(1, 0);
    }
  }
  function Af2(e, t, n, o, u, c, h, b) {
    var E = D();
    try {
      ua(e, t, n, o, u, c, h, b);
    } catch (I) {
      if (C(E), I !== I + 0) throw I;
      k2(1, 0);
    }
  }
  function If2(e, t, n, o, u) {
    var c = D();
    try {
      zo2(e, t, n, o, u);
    } catch (h) {
      if (C(c), h !== h + 0) throw h;
      k2(1, 0);
    }
  }
  function xf2(e, t, n, o, u) {
    var c = D();
    try {
      return Xo(e, t, n, o, u);
    } catch (h) {
      if (C(c), h !== h + 0) throw h;
      k2(1, 0);
    }
  }
  function Lf2(e, t, n, o, u, c, h, b) {
    var E = D();
    try {
      fa(e, t, n, o, u, c, h, b);
    } catch (I) {
      if (C(E), I !== I + 0) throw I;
      k2(1, 0);
    }
  }
  function Of2(e, t, n, o, u, c, h, b, E, I, N, W) {
    var X = D();
    try {
      Qo(e, t, n, o, u, c, h, b, E, I, N, W);
    } catch (L2) {
      if (C(X), L2 !== L2 + 0) throw L2;
      k2(1, 0);
    }
  }
  function Bf2(e, t, n, o, u, c) {
    var h = D();
    try {
      return sa(e, t, n, o, u, c);
    } catch (b) {
      if (C(h), b !== b + 0) throw b;
      k2(1, 0);
    }
  }
  function Mf2(e, t, n) {
    var o = D();
    try {
      return na(e, t, n);
    } catch (u) {
      if (C(o), u !== u + 0) throw u;
      return k2(1, 0), 0n;
    }
  }
  function Uf2(e, t, n, o, u, c, h, b, E) {
    var I = D();
    try {
      jo(e, t, n, o, u, c, h, b, E);
    } catch (N) {
      if (C(I), N !== N + 0) throw N;
      k2(1, 0);
    }
  }
  function Cf2(e) {
    var t = D();
    try {
      return ta(e);
    } catch (n) {
      if (C(t), n !== n + 0) throw n;
      k2(1, 0);
    }
  }
  function Df2(e, t, n) {
    var o = D();
    try {
      return ca(e, t, n);
    } catch (u) {
      if (C(o), u !== u + 0) throw u;
      k2(1, 0);
    }
  }
  function Pf2(e, t) {
    var n = D();
    try {
      return Ea(e, t);
    } catch (o) {
      if (C(n), o !== o + 0) throw o;
      return k2(1, 0), 0n;
    }
  }
  function _f2(e, t, n, o, u) {
    var c = D();
    try {
      da(e, t, n, o, u);
    } catch (h) {
      if (C(c), h !== h + 0) throw h;
      k2(1, 0);
    }
  }
  function Rf2(e) {
    var t = D();
    try {
      return ea(e);
    } catch (n) {
      if (C(t), n !== n + 0) throw n;
      return k2(1, 0), 0n;
    }
  }
  function Nf2(e, t, n, o, u, c) {
    var h = D();
    try {
      return ma(e, t, n, o, u, c);
    } catch (b) {
      if (C(h), b !== b + 0) throw b;
      k2(1, 0);
    }
  }
  function Wf2(e, t, n, o, u, c) {
    var h = D();
    try {
      return ha(e, t, n, o, u, c);
    } catch (b) {
      if (C(h), b !== b + 0) throw b;
      k2(1, 0);
    }
  }
  function kf2(e, t, n, o, u, c, h, b) {
    var E = D();
    try {
      return ia(e, t, n, o, u, c, h, b);
    } catch (I) {
      if (C(E), I !== I + 0) throw I;
      k2(1, 0);
    }
  }
  function Ff2(e, t, n, o, u) {
    var c = D();
    try {
      return ya(e, t, n, o, u);
    } catch (h) {
      if (C(c), h !== h + 0) throw h;
      return k2(1, 0), 0n;
    }
  }
  function Gf2(e, t, n, o) {
    var u = D();
    try {
      return ba(e, t, n, o);
    } catch (c) {
      if (C(u), c !== c + 0) throw c;
      k2(1, 0);
    }
  }
  function $f2(e, t, n, o) {
    var u = D();
    try {
      return wa(e, t, n, o);
    } catch (c) {
      if (C(u), c !== c + 0) throw c;
      k2(1, 0);
    }
  }
  function zf2(e, t, n, o, u, c, h, b, E, I, N, W) {
    var X = D();
    try {
      return ga(e, t, n, o, u, c, h, b, E, I, N, W);
    } catch (L2) {
      if (C(X), L2 !== L2 + 0) throw L2;
      k2(1, 0);
    }
  }
  function Vf2(e, t, n, o, u, c, h, b, E, I, N) {
    var W = D();
    try {
      la(e, t, n, o, u, c, h, b, E, I, N);
    } catch (X) {
      if (C(W), X !== X + 0) throw X;
      k2(1, 0);
    }
  }
  function Hf2(e, t, n, o, u, c, h, b, E, I, N, W, X, L2, fe2, ve) {
    var ie = D();
    try {
      pa(e, t, n, o, u, c, h, b, E, I, N, W, X, L2, fe2, ve);
    } catch (Ze2) {
      if (C(ie), Ze2 !== Ze2 + 0) throw Ze2;
      k2(1, 0);
    }
  }
  function jf2(e, t, n, o) {
    var u = D();
    try {
      return Ta(e, t, n, o);
    } catch (c) {
      if (C(u), c !== c + 0) throw c;
      k2(1, 0);
    }
  }
  function Yf2(e, t, n, o, u) {
    var c = D();
    try {
      return va(e, t, n, o, u);
    } catch (h) {
      if (C(c), h !== h + 0) throw h;
      k2(1, 0);
    }
  }
  function qf2(e, t, n) {
    var o = D();
    try {
      return ra(e, t, n);
    } catch (u) {
      if (C(o), u !== u + 0) throw u;
      k2(1, 0);
    }
  }
  function Jf2(e, t, n) {
    var o = D();
    try {
      return oa(e, t, n);
    } catch (u) {
      if (C(o), u !== u + 0) throw u;
      k2(1, 0);
    }
  }
  function Xf2(e, t, n, o) {
    var u = D();
    try {
      aa(e, t, n, o);
    } catch (c) {
      if (C(u), c !== c + 0) throw c;
      k2(1, 0);
    }
  }
  function Vt2() {
    if (0 < Le2) te = Vt2;
    else if (i) M == null ? void 0 : M(r), wr();
    else {
      for (var e = Ae; 0 < e.length; ) e.shift()(r);
      0 < Le2 ? te = Vt2 : (r.calledRun = true, G || (wr(), M == null ? void 0 : M(r)));
    }
  }
  return i || (Ne2 = await wt2(), Vt2()), r.PTR_SIZE = 4, r.webgpuInit = (e) => {
    let t = /* @__PURE__ */ new WeakMap(), n, o, u = 1;
    r.webgpuRegisterDevice = (b) => {
      if (o !== void 0) throw Error("another WebGPU EP inference session is being created.");
      if (b) {
        var E = t.get(b);
        if (!E) {
          let I = ((N, W = 0) => {
            var X = Bo2(W);
            return W = Oo2(W, X), me2(X, N.queue), me2(W, N), W;
          })(b, E = To2(0));
          E = [u++, E, I], t.set(b, E);
        }
        return n = b, o = E[0], E;
      }
      n = void 0, o = 0;
    };
    let c = /* @__PURE__ */ new Map();
    r.webgpuOnCreateSession = (b) => {
      if (o !== void 0) {
        var E = o;
        if (o = void 0, b) {
          let I = Rr2(E);
          c.set(b, I), E === 0 && e(n ?? B(I));
        }
        n = void 0;
      }
    }, r.webgpuOnReleaseSession = (b) => {
      c.delete(b);
    };
    let h = Symbol("gpuBufferMetadata");
    r.webgpuRegisterBuffer = (b, E, I) => {
      if (I) return b[h] = [I, NaN], I;
      if (I = b[h]) return I[1]++, I[0];
      if ((E = c.get(E)) === void 0) throw Error("Invalid session handle passed to webgpuRegisterBuffer");
      return E = ((N, W = 0) => (N.mapState != "pending" || we(), W = Lo(W, N.mapState == "mapped" ? 3 : 1), me2(W, N), N.mapState == "mapped" && (Ue[W] = []), W))(b, E), b[h] = [E, 1], E;
    }, r.webgpuUnregisterBuffer = (b) => {
      let E = b[h];
      if (!E) throw Error("Buffer is not registered");
      E[1]--, E[1] === 0 && (go2(E[0]), delete b[h]);
    }, r.webgpuGetBuffer = (b) => B(b), r.webgpuCreateDownloader = (b, E, I) => {
      if ((I = c.get(I)) === void 0) throw Error("Invalid session handle passed to webgpuRegisterBuffer");
      let N = B(I), W = 16 * Math.ceil(Number(E) / 16);
      return async () => {
        let X = N.createBuffer({ size: W, usage: 9 });
        try {
          let L2 = N.createCommandEncoder();
          return L2.copyBufferToBuffer(b, 0, X, 0, W), N.queue.submit([L2.finish()]), await X.mapAsync(GPUMapMode.READ), X.getMappedRange().slice(0, E);
        } finally {
          X.destroy();
        }
      };
    }, r.ie = (b, E) => {
      var I = E.buffer;
      let N = E.byteOffset, W = E.byteLength;
      if (E = 16 * Math.ceil(Number(W) / 16), b = B(b), !n) {
        var X = Rr2(o);
        n = B(X);
      }
      let L2 = (X = n.createBuffer({ mappedAtCreation: true, size: E, usage: 6 })).getMappedRange();
      new Uint8Array(L2).set(new Uint8Array(I, N, W)), X.unmap(), (I = n.createCommandEncoder()).copyBufferToBuffer(X, 0, b, 0, E), n.queue.submit([I.finish()]), X.destroy();
    };
  }, r.webnnInit = (e) => {
    let t = e[0];
    [r.Ie, r.je, r.webnnEnsureTensor, r.ke, r.webnnDownloadTensor, r.He, r.webnnEnableTraceEvent] = e.slice(1), r.webnnReleaseTensorId = r.je, r.webnnUploadTensor = r.ke, r.webnnRegisterMLContext = r.He, r.webnnOnRunStart = (n) => t.onRunStart(n), r.webnnOnRunEnd = t.onRunEnd.bind(t), r.webnnOnReleaseSession = (n) => {
      t.onReleaseSession(n);
    }, r.webnnCreateMLTensorDownloader = (n, o) => t.createMLTensorDownloader(n, o), r.webnnRegisterMLTensor = (n, o, u, c) => t.registerMLTensor(n, o, u, c), r.webnnCreateMLContext = (n) => t.createMLContext(n), r.webnnRegisterMLConstant = (n, o, u, c, h, b) => t.registerMLConstant(n, o, u, c, h, r.Zc, b), r.webnnRegisterGraphInput = t.registerGraphInput.bind(t), r.webnnIsGraphInput = t.isGraphInput.bind(t), r.webnnRegisterGraphOutput = t.registerGraphOutput.bind(t), r.webnnIsGraphOutput = t.isGraphOutput.bind(t), r.webnnCreateTemporaryTensor = t.createTemporaryTensor.bind(t), r.webnnIsGraphInputOutputTypeSupported = t.isGraphInputOutputTypeSupported.bind(t);
  }, re ? r : new Promise((e, t) => {
    M = e, R2 = t;
  });
}
var ac, sc, fs = F(() => {
  var _a2, _b;
  ac = is, sc = (_b = (_a2 = globalThis.self) == null ? void 0 : _a2.name) == null ? void 0 : _b.startsWith("em-pthread");
  sc && is();
});
var ls, on, ic, be, ps, nn, uc, fc, ms, cc, cs, hs, ds, ys, Xt = F(() => {
  Jt();
  ls = typeof location > "u" ? void 0 : location.origin, on = import.meta.url > "file:" && import.meta.url < "file;", ic = () => {
    {
      if (on) {
        let a = URL;
        return new URL(new a("ort.webgpu.bundle.min.mjs", import.meta.url).href, ls).href;
      }
      return import.meta.url;
    }
  }, be = ic(), ps = () => {
    if (be && !be.startsWith("blob:")) return be.substring(0, be.lastIndexOf("/") + 1);
  }, nn = (a, r) => {
    try {
      let s = r ?? be;
      return (s ? new URL(a, s) : new URL(a)).origin === ls;
    } catch {
      return false;
    }
  }, uc = (a, r) => {
    let s = r ?? be;
    try {
      return (s ? new URL(a, s) : new URL(a)).href;
    } catch {
      return;
    }
  }, fc = (a, r) => `${r ?? "./"}${a}`, ms = async (a) => {
    let s = await (await fetch(a, { credentials: "same-origin" })).blob();
    return URL.createObjectURL(s);
  }, cc = async (a) => (await import(
    /*webpackIgnore:true*/
    /*@vite-ignore*/
    a
  )).default, cs = (ss(), Ht(as)).default, hs = async () => {
    if (!be) throw new Error("Failed to load proxy worker: cannot determine the script source URL.");
    if (nn(be)) return [void 0, cs()];
    let a = await ms(be);
    return [a, cs(a)];
  }, ds = (fs(), Ht(us)).default, ys = async (a, r, s, f) => {
    let i = ds && !(a || r);
    if (i) if (be) i = nn(be);
    else if (f && !s) i = true;
    else throw new Error("cannot determine the script source URL.");
    if (i) return [void 0, ds];
    {
      let d = "ort-wasm-simd-threaded.asyncify.mjs", p = a ?? uc(d, r), m = s && p && !nn(p, r), y = m ? await ms(p) : p ?? fc(d, r);
      return [m ? y : void 0, await cc(y)];
    }
  };
});
var an, sn, ar, bs, dc, lc, pc, Zt, V, Ve = F(() => {
  Xt();
  sn = false, ar = false, bs = false, dc = () => {
    if (typeof SharedArrayBuffer > "u") return false;
    try {
      return typeof MessageChannel < "u" && new MessageChannel().port1.postMessage(new SharedArrayBuffer(1)), WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 5, 4, 1, 3, 1, 1, 10, 11, 1, 9, 0, 65, 0, 254, 16, 2, 0, 26, 11]));
    } catch {
      return false;
    }
  }, lc = () => {
    try {
      return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 30, 1, 28, 0, 65, 0, 253, 15, 253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 253, 186, 1, 26, 11]));
    } catch {
      return false;
    }
  }, pc = () => {
    try {
      return WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 19, 1, 17, 0, 65, 1, 253, 15, 65, 2, 253, 15, 65, 3, 253, 15, 253, 147, 2, 11]));
    } catch {
      return false;
    }
  }, Zt = async (a) => {
    if (sn) return Promise.resolve();
    if (ar) throw new Error("multiple calls to 'initializeWebAssembly()' detected.");
    if (bs) throw new Error("previous call to 'initializeWebAssembly()' failed.");
    ar = true;
    let r = a.initTimeout, s = a.numThreads;
    if (a.simd !== false) {
      if (a.simd === "relaxed") {
        if (!pc()) throw new Error("Relaxed WebAssembly SIMD is not supported in the current environment.");
      } else if (!lc()) throw new Error("WebAssembly SIMD is not supported in the current environment.");
    }
    let f = dc();
    s > 1 && !f && (typeof self < "u" && !self.crossOriginIsolated && console.warn("env.wasm.numThreads is set to " + s + ", but this will not work unless you enable crossOriginIsolated mode. See https://web.dev/cross-origin-isolation-guide/ for more info."), console.warn("WebAssembly multi-threading is not supported in the current environment. Falling back to single-threading."), a.numThreads = s = 1);
    let i = a.wasmPaths, d = typeof i == "string" ? i : void 0, p = i == null ? void 0 : i.mjs, m = (p == null ? void 0 : p.href) ?? p, y = i == null ? void 0 : i.wasm, w = (y == null ? void 0 : y.href) ?? y, T = a.wasmBinary, [g, v] = await ys(m, d, s > 1, !!T || !!w), S = false, M = [];
    if (r > 0 && M.push(new Promise((R2) => {
      setTimeout(() => {
        S = true, R2();
      }, r);
    })), M.push(new Promise((R2, j) => {
      let P = { numThreads: s };
      if (T) P.wasmBinary = T;
      else if (w || d) P.locateFile = (U) => w ?? d + U;
      else if (m && m.indexOf("blob:") !== 0) P.locateFile = (U) => new URL(U, m).href;
      else if (g) {
        let U = ps();
        U && (P.locateFile = (Y) => U + Y);
      }
      v(P).then((U) => {
        ar = false, sn = true, an = U, R2(), g && URL.revokeObjectURL(g);
      }, (U) => {
        ar = false, bs = true, j(U);
      });
    })), await Promise.race(M), S) throw new Error(`WebAssembly backend initializing failed due to timeout: ${r}ms`);
  }, V = () => {
    if (sn && an) return an;
    throw new Error("WebAssembly is not initialized yet.");
  };
});
var he, Lt, z, sr = F(() => {
  Ve();
  he = (a, r) => {
    let s = V(), f = s.lengthBytesUTF8(a) + 1, i = s._malloc(f);
    return s.stringToUTF8(a, i, f), r.push(i), i;
  }, Lt = (a, r, s, f) => {
    if (typeof a == "object" && a !== null) {
      if (s.has(a)) throw new Error("Circular reference in options");
      s.add(a);
    }
    Object.entries(a).forEach(([i, d]) => {
      let p = r ? r + i : i;
      if (typeof d == "object") Lt(d, p + ".", s, f);
      else if (typeof d == "string" || typeof d == "number") f(p, d.toString());
      else if (typeof d == "boolean") f(p, d ? "1" : "0");
      else throw new Error(`Can't handle extra config type: ${typeof d}`);
    });
  }, z = (a) => {
    let r = V(), s = r.stackSave();
    try {
      let f = r.PTR_SIZE, i = r.stackAlloc(2 * f);
      r._OrtGetLastError(i, i + f);
      let d = Number(r.getValue(i, f === 4 ? "i32" : "i64")), p = r.getValue(i + f, "*"), m = p ? r.UTF8ToString(p) : "";
      throw new Error(`${a} ERROR_CODE: ${d}, ERROR_MESSAGE: ${m}`);
    } finally {
      r.stackRestore(s);
    }
  };
});
var ws, gs = F(() => {
  Ve();
  sr();
  ws = (a) => {
    let r = V(), s = 0, f = [], i = a || {};
    try {
      if ((a == null ? void 0 : a.logSeverityLevel) === void 0) i.logSeverityLevel = 2;
      else if (typeof a.logSeverityLevel != "number" || !Number.isInteger(a.logSeverityLevel) || a.logSeverityLevel < 0 || a.logSeverityLevel > 4) throw new Error(`log severity level is not valid: ${a.logSeverityLevel}`);
      if ((a == null ? void 0 : a.logVerbosityLevel) === void 0) i.logVerbosityLevel = 0;
      else if (typeof a.logVerbosityLevel != "number" || !Number.isInteger(a.logVerbosityLevel)) throw new Error(`log verbosity level is not valid: ${a.logVerbosityLevel}`);
      (a == null ? void 0 : a.terminate) === void 0 && (i.terminate = false);
      let d = 0;
      return (a == null ? void 0 : a.tag) !== void 0 && (d = he(a.tag, f)), s = r._OrtCreateRunOptions(i.logSeverityLevel, i.logVerbosityLevel, !!i.terminate, d), s === 0 && z("Can't create run options."), (a == null ? void 0 : a.extra) !== void 0 && Lt(a.extra, "", /* @__PURE__ */ new WeakSet(), (p, m) => {
        let y = he(p, f), w = he(m, f);
        r._OrtAddRunConfigEntry(s, y, w) !== 0 && z(`Can't set a run config entry: ${p} - ${m}.`);
      }), [s, f];
    } catch (d) {
      throw s !== 0 && r._OrtReleaseRunOptions(s), f.forEach((p) => r._free(p)), d;
    }
  };
});
var mc, hc, yc, un, ot, bc, Ts, vs = F(() => {
  Ve();
  sr();
  mc = (a) => {
    switch (a) {
      case "disabled":
        return 0;
      case "basic":
        return 1;
      case "extended":
        return 2;
      case "layout":
        return 3;
      case "all":
        return 99;
      default:
        throw new Error(`unsupported graph optimization level: ${a}`);
    }
  }, hc = (a) => {
    switch (a) {
      case "sequential":
        return 0;
      case "parallel":
        return 1;
      default:
        throw new Error(`unsupported execution mode: ${a}`);
    }
  }, yc = (a) => {
    a.extra || (a.extra = {}), a.extra.session || (a.extra.session = {});
    let r = a.extra.session;
    r.use_ort_model_bytes_directly || (r.use_ort_model_bytes_directly = "1"), a.executionProviders && a.executionProviders.some((s) => (typeof s == "string" ? s : s.name) === "webgpu") && (a.enableMemPattern = false);
  }, un = (a, r, s, f) => {
    let i = he(r, f), d = he(s, f);
    V()._OrtAddSessionConfigEntry(a, i, d) !== 0 && z(`Can't set a session config entry: ${r} - ${s}.`);
  }, ot = (a, r, s, f) => {
    let i = he(r, f), d = he(s, f);
    a.push([i, d]);
  }, bc = async (a, r, s) => {
    let f = r.executionProviders;
    for (let i of f) {
      let d = typeof i == "string" ? i : i.name, p = [];
      switch (d) {
        case "webnn":
          if (d = "WEBNN", typeof i != "string") {
            let v = i == null ? void 0 : i.deviceType;
            v && un(a, "deviceType", v, s);
          }
          break;
        case "webgpu":
          {
            d = "WebGPU";
            let g;
            if (typeof i != "string") {
              let S = i;
              if (S.device) if (typeof GPUDevice < "u" && S.device instanceof GPUDevice) g = S.device;
              else throw new Error("Invalid GPU device set in WebGPU EP options.");
              let { enableGraphCapture: M } = r;
              if (typeof M == "boolean" && M && ot(p, "enableGraphCapture", "1", s), typeof S.preferredLayout == "string" && ot(p, "preferredLayout", S.preferredLayout, s), S.forceCpuNodeNames) {
                let R2 = Array.isArray(S.forceCpuNodeNames) ? S.forceCpuNodeNames : [S.forceCpuNodeNames];
                ot(p, "forceCpuNodeNames", R2.join(`
`), s);
              }
              S.validationMode && ot(p, "validationMode", S.validationMode, s);
            }
            let v = V().webgpuRegisterDevice(g);
            if (v) {
              let [S, M, R2] = v;
              ot(p, "deviceId", S.toString(), s), ot(p, "webgpuInstance", M.toString(), s), ot(p, "webgpuDevice", R2.toString(), s);
            }
          }
          break;
        case "wasm":
        case "cpu":
          continue;
        default:
          throw new Error(`not supported execution provider: ${d}`);
      }
      let m = he(d, s), y = p.length, w = 0, T = 0;
      if (y > 0) {
        w = V()._malloc(y * V().PTR_SIZE), s.push(w), T = V()._malloc(y * V().PTR_SIZE), s.push(T);
        for (let g = 0; g < y; g++) V().setValue(w + g * V().PTR_SIZE, p[g][0], "*"), V().setValue(T + g * V().PTR_SIZE, p[g][1], "*");
      }
      await V()._OrtAppendExecutionProvider(a, m, w, T, y) !== 0 && z(`Can't append execution provider: ${d}.`);
    }
  }, Ts = async (a) => {
    let r = V(), s = 0, f = [], i = a || {};
    yc(i);
    try {
      let d = mc(i.graphOptimizationLevel ?? "all"), p = hc(i.executionMode ?? "sequential"), m = typeof i.logId == "string" ? he(i.logId, f) : 0, y = i.logSeverityLevel ?? 2;
      if (!Number.isInteger(y) || y < 0 || y > 4) throw new Error(`log severity level is not valid: ${y}`);
      let w = i.logVerbosityLevel ?? 0;
      if (!Number.isInteger(w) || w < 0 || w > 4) throw new Error(`log verbosity level is not valid: ${w}`);
      let T = typeof i.optimizedModelFilePath == "string" ? he(i.optimizedModelFilePath, f) : 0;
      if (s = r._OrtCreateSessionOptions(d, !!i.enableCpuMemArena, !!i.enableMemPattern, p, !!i.enableProfiling, 0, m, y, w, T), s === 0 && z("Can't create session options."), i.executionProviders && await bc(s, i, f), i.enableGraphCapture !== void 0) {
        if (typeof i.enableGraphCapture != "boolean") throw new Error(`enableGraphCapture must be a boolean value: ${i.enableGraphCapture}`);
        un(s, "enableGraphCapture", i.enableGraphCapture.toString(), f);
      }
      if (i.freeDimensionOverrides) for (let [g, v] of Object.entries(i.freeDimensionOverrides)) {
        if (typeof g != "string") throw new Error(`free dimension override name must be a string: ${g}`);
        if (typeof v != "number" || !Number.isInteger(v) || v < 0) throw new Error(`free dimension override value must be a non-negative integer: ${v}`);
        let S = he(g, f);
        r._OrtAddFreeDimensionOverride(s, S, v) !== 0 && z(`Can't set a free dimension override: ${g} - ${v}.`);
      }
      return i.extra !== void 0 && Lt(i.extra, "", /* @__PURE__ */ new WeakSet(), (g, v) => {
        un(s, g, v, f);
      }), [s, f];
    } catch (d) {
      throw s !== 0 && r._OrtReleaseSessionOptions(s) !== 0 && z("Can't release session options."), f.forEach((p) => r._free(p)), d;
    }
  };
});
var He, ir, ht, at, Ot, ur, fr, fn, st = F(() => {
  He = (a) => {
    switch (a) {
      case "int8":
        return 3;
      case "uint8":
        return 2;
      case "bool":
        return 9;
      case "int16":
        return 5;
      case "uint16":
        return 4;
      case "int32":
        return 6;
      case "uint32":
        return 12;
      case "float16":
        return 10;
      case "float32":
        return 1;
      case "float64":
        return 11;
      case "string":
        return 8;
      case "int64":
        return 7;
      case "uint64":
        return 13;
      case "int4":
        return 22;
      case "uint4":
        return 21;
      default:
        throw new Error(`unsupported data type: ${a}`);
    }
  }, ir = (a) => {
    switch (a) {
      case 3:
        return "int8";
      case 2:
        return "uint8";
      case 9:
        return "bool";
      case 5:
        return "int16";
      case 4:
        return "uint16";
      case 6:
        return "int32";
      case 12:
        return "uint32";
      case 10:
        return "float16";
      case 1:
        return "float32";
      case 11:
        return "float64";
      case 8:
        return "string";
      case 7:
        return "int64";
      case 13:
        return "uint64";
      case 22:
        return "int4";
      case 21:
        return "uint4";
      default:
        throw new Error(`unsupported data type: ${a}`);
    }
  }, ht = (a, r) => {
    let s = [-1, 4, 1, 1, 2, 2, 4, 8, -1, 1, 2, 8, 4, 8, -1, -1, -1, -1, -1, -1, -1, 0.5, 0.5][a], f = typeof r == "number" ? r : r.reduce((i, d) => i * d, 1);
    return s > 0 ? Math.ceil(f * s) : void 0;
  }, at = (a) => {
    switch (a) {
      case "float16":
        return typeof Float16Array < "u" && Float16Array.from ? Float16Array : Uint16Array;
      case "float32":
        return Float32Array;
      case "uint8":
        return Uint8Array;
      case "int8":
        return Int8Array;
      case "uint16":
        return Uint16Array;
      case "int16":
        return Int16Array;
      case "int32":
        return Int32Array;
      case "bool":
        return Uint8Array;
      case "float64":
        return Float64Array;
      case "uint32":
        return Uint32Array;
      case "int64":
        return BigInt64Array;
      case "uint64":
        return BigUint64Array;
      default:
        throw new Error(`unsupported type: ${a}`);
    }
  }, Ot = (a) => {
    switch (a) {
      case "verbose":
        return 0;
      case "info":
        return 1;
      case "warning":
        return 2;
      case "error":
        return 3;
      case "fatal":
        return 4;
      default:
        throw new Error(`unsupported logging level: ${a}`);
    }
  }, ur = (a) => a === "float32" || a === "float16" || a === "int32" || a === "int64" || a === "uint32" || a === "uint8" || a === "bool" || a === "uint4" || a === "int4", fr = (a) => a === "float32" || a === "float16" || a === "int32" || a === "int64" || a === "uint32" || a === "uint64" || a === "int8" || a === "uint8" || a === "bool" || a === "uint4" || a === "int4", fn = (a) => {
    switch (a) {
      case "none":
        return 0;
      case "cpu":
        return 1;
      case "cpu-pinned":
        return 2;
      case "texture":
        return 3;
      case "gpu-buffer":
        return 4;
      case "ml-tensor":
        return 5;
      default:
        throw new Error(`unsupported data location: ${a}`);
    }
  };
});
var Bt, cn = F(() => {
  Jt();
  Bt = async (a) => {
    if (typeof a == "string") {
      let r = await fetch(a);
      if (!r.ok) throw new Error(`failed to load external data file: ${a}`);
      let s = r.headers.get("Content-Length"), f = s ? parseInt(s, 10) : 0;
      if (f < 1073741824) return new Uint8Array(await r.arrayBuffer());
      {
        if (!r.body) throw new Error(`failed to load external data file: ${a}, no response body.`);
        let i = r.body.getReader(), d;
        try {
          d = new ArrayBuffer(f);
        } catch (m) {
          if (m instanceof RangeError) {
            let y = Math.ceil(f / 65536);
            d = new WebAssembly.Memory({ initial: y, maximum: y }).buffer;
          } else throw m;
        }
        let p = 0;
        for (; ; ) {
          let { done: m, value: y } = await i.read();
          if (m) break;
          let w = y.byteLength;
          new Uint8Array(d, p, w).set(y), p += w;
        }
        return new Uint8Array(d, 0, f);
      }
    } else return a instanceof Blob ? new Uint8Array(await a.arrayBuffer()) : a instanceof Uint8Array ? a : new Uint8Array(a);
  };
});
var Es, Ss = F(() => {
  st();
  Es = (a, r) => new (at(r))(a);
});
var wc, gc, As, Is, xs, Tc, de, dn = F(() => {
  st();
  wc = ["V", "I", "W", "E", "F"], gc = (a, r) => {
    console.log(`[${wc[a]},${(/* @__PURE__ */ new Date()).toISOString()}]${r}`);
  }, xs = (a, r) => {
    As = a, Is = r;
  }, Tc = (a, r) => {
    let s = Ot(a), f = Ot(As);
    s >= f && gc(s, typeof r == "function" ? r() : r);
  }, de = (...a) => {
    Is && Tc(...a);
  };
});
var Os, pn, Bs, vc, Ls, Ec, Ms, cr, dr, ln, Us, Cs = F(() => {
  st();
  dn();
  Os = /* @__PURE__ */ new Map([["float32", 32], ["float16", 16], ["int32", 32], ["uint32", 32], ["int64", 64], ["uint64", 64], ["int8", 8], ["uint8", 8], ["int4", 4], ["uint4", 4]]), pn = (a, r) => {
    if (r === "int32") return a;
    let s = Os.get(r);
    if (!s) throw new Error(`WebNN backend does not support data type: ${r}`);
    let f = s / 8;
    if (a.byteLength % f !== 0) throw new Error(`Invalid Uint8Array length - must be a multiple of ${f}.`);
    let i = a.byteLength / f, d = new (at(r))(a.buffer, a.byteOffset, i);
    switch (r) {
      case "int64":
      case "uint64": {
        let p = new Int32Array(i);
        for (let m = 0; m < i; m++) {
          let y = d[m];
          if (y > 2147483647n || y < -2147483648n) throw new Error("Can not convert int64 data to int32 - value out of range.");
          p[m] = Number(y);
        }
        return new Uint8Array(p.buffer);
      }
      case "int8":
      case "uint8":
      case "uint32": {
        if (r === "uint32" && d.some((m) => m > 2147483647)) throw new Error("Can not convert uint32 data to int32 - value out of range.");
        let p = Int32Array.from(d, Number);
        return new Uint8Array(p.buffer);
      }
      default:
        throw new Error(`Unsupported data conversion from ${r} to 'int32'`);
    }
  }, Bs = (a, r) => {
    if (r === "int32") return a;
    if (a.byteLength % 4 !== 0) throw new Error("Invalid Uint8Array length - must be a multiple of 4 (int32).");
    let s = a.byteLength / 4, f = new Int32Array(a.buffer, a.byteOffset, s);
    switch (r) {
      case "int64": {
        let i = BigInt64Array.from(f, BigInt);
        return new Uint8Array(i.buffer);
      }
      case "uint64": {
        if (f.some((d) => d < 0)) throw new Error("Can not convert int32 data to uin64 - negative value found.");
        let i = BigUint64Array.from(f, BigInt);
        return new Uint8Array(i.buffer);
      }
      case "int8": {
        if (f.some((d) => d < -128 || d > 127)) throw new Error("Can not convert int32 data to int8 - value out of range.");
        let i = Int8Array.from(f, Number);
        return new Uint8Array(i.buffer);
      }
      case "uint8": {
        if (f.some((i) => i < 0 || i > 255)) throw new Error("Can not convert int32 data to uint8 - value out of range.");
        return Uint8Array.from(f, Number);
      }
      case "uint32": {
        if (f.some((d) => d < 0)) throw new Error("Can not convert int32 data to uint32 - negative value found.");
        let i = Uint32Array.from(f, Number);
        return new Uint8Array(i.buffer);
      }
      default:
        throw new Error(`Unsupported data conversion from 'int32' to ${r}`);
    }
  }, vc = 1, Ls = () => vc++, Ec = /* @__PURE__ */ new Map([["int8", "int32"], ["uint8", "int32"], ["uint32", "int32"], ["int64", "int32"]]), Ms = (a, r) => {
    let s = Os.get(a);
    if (!s) throw new Error(`WebNN backend does not support data type: ${a}`);
    return r.length > 0 ? Math.ceil(r.reduce((f, i) => f * i) * s / 8) : 0;
  }, cr = class {
    constructor(r) {
      this.isDataConverted = false;
      let { sessionId: s, context: f, tensor: i, dataType: d, shape: p, fallbackDataType: m } = r;
      this.sessionId = s, this.mlContext = f, this.mlTensor = i, this.dataType = d, this.tensorShape = p, this.fallbackDataType = m;
    }
    get tensor() {
      return this.mlTensor;
    }
    get type() {
      return this.dataType;
    }
    get fallbackType() {
      return this.fallbackDataType;
    }
    get shape() {
      return this.tensorShape;
    }
    get byteLength() {
      return Ms(this.dataType, this.tensorShape);
    }
    destroy() {
      de("verbose", () => "[WebNN] TensorWrapper.destroy"), this.mlTensor.destroy();
    }
    write(r) {
      this.mlContext.writeTensor(this.mlTensor, r);
    }
    async read(r) {
      if (this.fallbackDataType) {
        let s = await this.mlContext.readTensor(this.mlTensor), f = Bs(new Uint8Array(s), this.dataType);
        if (r) {
          (r instanceof ArrayBuffer ? new Uint8Array(r) : new Uint8Array(r.buffer, r.byteOffset, r.byteLength)).set(f);
          return;
        } else return f.buffer;
      } else return r ? this.mlContext.readTensor(this.mlTensor, r) : this.mlContext.readTensor(this.mlTensor);
    }
    canReuseTensor(r, s, f) {
      return this.mlContext === r && this.dataType === s && this.tensorShape.length === f.length && this.tensorShape.every((i, d) => i === f[d]);
    }
    setIsDataConverted(r) {
      this.isDataConverted = r;
    }
  }, dr = class {
    constructor(r, s) {
      this.tensorManager = r;
      this.wrapper = s;
    }
    get tensorWrapper() {
      return this.wrapper;
    }
    releaseTensor() {
      this.tensorWrapper && (this.tensorManager.releaseTensor(this.tensorWrapper), this.wrapper = void 0);
    }
    async ensureTensor(r, s, f, i) {
      let d = this.tensorManager.getMLContext(r), p = this.tensorManager.getMLOpSupportLimits(r), m;
      if (!(p == null ? void 0 : p.input.dataTypes.includes(s))) {
        if (m = Ec.get(s), !m || (p == null ? void 0 : p.input.dataTypes.includes(m))) throw new Error(`WebNN backend does not support data type: ${s}`);
        de("verbose", () => `[WebNN] TensorIdTracker.ensureTensor: fallback dataType from ${s} to ${m}`);
      }
      if (this.wrapper) {
        if (this.wrapper.canReuseTensor(d, s, f)) return this.wrapper.tensor;
        if (i) {
          if (this.wrapper.byteLength !== Ms(s, f)) throw new Error("Unable to copy data to tensor with different size.");
          this.activeUpload = new Uint8Array(await this.wrapper.read());
        }
        this.tensorManager.releaseTensor(this.wrapper);
      }
      let y = typeof MLTensorUsage > "u" ? void 0 : MLTensorUsage.READ | MLTensorUsage.WRITE;
      return this.wrapper = await this.tensorManager.getCachedTensor(r, s, f, y, true, true, m), i && this.activeUpload && (this.wrapper.write(this.activeUpload), this.activeUpload = void 0), this.wrapper.tensor;
    }
    upload(r) {
      let s = r;
      if (this.wrapper) {
        if (this.wrapper.fallbackType) if (this.wrapper.fallbackType === "int32") s = pn(r, this.wrapper.type), this.wrapper.setIsDataConverted(true);
        else throw new Error(`Unsupported fallback data type: ${this.wrapper.fallbackType}`);
        if (r.byteLength === this.wrapper.byteLength) {
          this.wrapper.write(s);
          return;
        } else de("verbose", () => "Data size does not match tensor size. Releasing tensor."), this.releaseTensor();
      }
      this.activeUpload ? this.activeUpload.set(s) : this.activeUpload = new Uint8Array(s);
    }
    async download(r) {
      var _a2, _b;
      if (this.activeUpload) {
        let s = ((_a2 = this.wrapper) == null ? void 0 : _a2.isDataConverted) ? Bs(this.activeUpload, (_b = this.wrapper) == null ? void 0 : _b.type) : this.activeUpload;
        if (r) {
          r instanceof ArrayBuffer ? new Uint8Array(r).set(s) : new Uint8Array(r.buffer, r.byteOffset, r.byteLength).set(s);
          return;
        } else return s.buffer;
      }
      if (!this.wrapper) throw new Error("Tensor has not been created.");
      return r ? this.wrapper.read(r) : this.wrapper.read();
    }
  }, ln = class {
    constructor(r) {
      this.backend = r;
      this.tensorTrackersById = /* @__PURE__ */ new Map();
      this.freeTensors = [];
      this.externalTensors = /* @__PURE__ */ new Set();
    }
    getMLContext(r) {
      let s = this.backend.getMLContext(r);
      if (!s) throw new Error("MLContext not found for session.");
      return s;
    }
    getMLOpSupportLimits(r) {
      return this.backend.getMLOpSupportLimits(r);
    }
    reserveTensorId() {
      let r = Ls();
      return this.tensorTrackersById.set(r, new dr(this)), r;
    }
    releaseTensorId(r) {
      let s = this.tensorTrackersById.get(r);
      s && (this.tensorTrackersById.delete(r), s.tensorWrapper && this.releaseTensor(s.tensorWrapper));
    }
    async ensureTensor(r, s, f, i, d) {
      de("verbose", () => `[WebNN] TensorManager.ensureTensor {tensorId: ${s}, dataType: ${f}, shape: ${i}, copyOld: ${d}}`);
      let p = this.tensorTrackersById.get(s);
      if (!p) throw new Error("Tensor not found.");
      return p.ensureTensor(r, f, i, d);
    }
    upload(r, s) {
      let f = this.tensorTrackersById.get(r);
      if (!f) throw new Error("Tensor not found.");
      f.upload(s);
    }
    async download(r, s) {
      de("verbose", () => `[WebNN] TensorManager.download {tensorId: ${r}, dstBuffer: ${s == null ? void 0 : s.byteLength}}`);
      let f = this.tensorTrackersById.get(r);
      if (!f) throw new Error("Tensor not found.");
      return f.download(s);
    }
    releaseTensorsForSession(r) {
      for (let s of this.freeTensors) s.sessionId === r && s.destroy();
      this.freeTensors = this.freeTensors.filter((s) => s.sessionId !== r);
    }
    registerTensor(r, s, f, i) {
      let d = this.getMLContext(r), p = Ls(), m = new cr({ sessionId: r, context: d, tensor: s, dataType: f, shape: i });
      return this.tensorTrackersById.set(p, new dr(this, m)), this.externalTensors.add(m), p;
    }
    async getCachedTensor(r, s, f, i, d, p, m) {
      let y = this.getMLContext(r);
      for (let [T, g] of this.freeTensors.entries()) if (g.canReuseTensor(y, s, f)) {
        de("verbose", () => `[WebNN] Reusing tensor {dataType: ${s}, ${m ? `fallbackDataType: ${m},` : ""} shape: ${f}`);
        let v = this.freeTensors.splice(T, 1)[0];
        return v.sessionId = r, v;
      }
      de("verbose", () => `[WebNN] MLContext.createTensor {dataType: ${s}, ${m ? `fallbackDataType: ${m},` : ""} shape: ${f}}`);
      let w = await y.createTensor({ dataType: m ?? s, shape: f, dimensions: f, usage: i, writable: d, readable: p });
      return new cr({ sessionId: r, context: y, tensor: w, dataType: s, shape: f, fallbackDataType: m });
    }
    releaseTensor(r) {
      this.externalTensors.has(r) && this.externalTensors.delete(r), this.freeTensors.push(r);
    }
  }, Us = (...a) => new ln(...a);
});
var Ds = {};
At(Ds, { WebNNBackend: () => mn });
var lr, Sc, mn, Ps = F(() => {
  st();
  Ve();
  Ss();
  Cs();
  dn();
  lr = /* @__PURE__ */ new Map([[1, "float32"], [10, "float16"], [6, "int32"], [12, "uint32"], [7, "int64"], [13, "uint64"], [22, "int4"], [21, "uint4"], [3, "int8"], [2, "uint8"], [9, "uint8"]]), Sc = (a, r) => {
    if (a === r) return true;
    if (a === void 0 || r === void 0) return false;
    let s = Object.keys(a).sort(), f = Object.keys(r).sort();
    return s.length === f.length && s.every((i, d) => i === f[d] && a[i] === r[i]);
  }, mn = class {
    constructor(r) {
      this.tensorManager = Us(this);
      this.mlContextBySessionId = /* @__PURE__ */ new Map();
      this.sessionIdsByMLContext = /* @__PURE__ */ new Map();
      this.mlContextCache = [];
      this.sessionGraphInputs = /* @__PURE__ */ new Map();
      this.sessionGraphOutputs = /* @__PURE__ */ new Map();
      this.temporaryGraphInputs = [];
      this.temporaryGraphOutputs = [];
      this.temporarySessionTensorIds = /* @__PURE__ */ new Map();
      this.mlOpSupportLimitsBySessionId = /* @__PURE__ */ new Map();
      xs(r.logLevel, !!r.debug);
    }
    get currentSessionId() {
      if (this.activeSessionId === void 0) throw new Error("No active session");
      return this.activeSessionId;
    }
    onRunStart(r) {
      de("verbose", () => `[WebNN] onRunStart {sessionId: ${r}}`), this.activeSessionId = r;
    }
    onRunEnd(r) {
      de("verbose", () => `[WebNN] onRunEnd {sessionId: ${r}}`);
      let s = this.temporarySessionTensorIds.get(r);
      if (s) {
        for (let f of s) de("verbose", () => `[WebNN] releasing temporary tensor {tensorId: ${f}}`), this.tensorManager.releaseTensorId(f);
        this.temporarySessionTensorIds.delete(r), this.activeSessionId = void 0;
      }
    }
    async createMLContext(r) {
      if (r instanceof GPUDevice) {
        let f = this.mlContextCache.findIndex((i) => i.gpuDevice === r);
        if (f !== -1) return this.mlContextCache[f].mlContext;
        {
          let i = await navigator.ml.createContext(r);
          return this.mlContextCache.push({ gpuDevice: r, mlContext: i }), i;
        }
      } else if (r === void 0) {
        let f = this.mlContextCache.findIndex((i) => i.options === void 0 && i.gpuDevice === void 0);
        if (f !== -1) return this.mlContextCache[f].mlContext;
        {
          let i = await navigator.ml.createContext();
          return this.mlContextCache.push({ mlContext: i }), i;
        }
      }
      let s = this.mlContextCache.findIndex((f) => Sc(f.options, r));
      if (s !== -1) return this.mlContextCache[s].mlContext;
      {
        let f = await navigator.ml.createContext(r);
        return this.mlContextCache.push({ options: r, mlContext: f }), f;
      }
    }
    registerMLContext(r, s) {
      this.mlContextBySessionId.set(r, s);
      let f = this.sessionIdsByMLContext.get(s);
      f || (f = /* @__PURE__ */ new Set(), this.sessionIdsByMLContext.set(s, f)), f.add(r), this.mlOpSupportLimitsBySessionId.has(r) || this.mlOpSupportLimitsBySessionId.set(r, s.opSupportLimits()), this.temporaryGraphInputs.length > 0 && (this.sessionGraphInputs.set(r, this.temporaryGraphInputs), this.temporaryGraphInputs = []), this.temporaryGraphOutputs.length > 0 && (this.sessionGraphOutputs.set(r, this.temporaryGraphOutputs), this.temporaryGraphOutputs = []);
    }
    onReleaseSession(r) {
      this.sessionGraphInputs.delete(r), this.sessionGraphOutputs.delete(r);
      let s = this.mlContextBySessionId.get(r);
      if (!s) return;
      this.tensorManager.releaseTensorsForSession(r), this.mlContextBySessionId.delete(r), this.mlOpSupportLimitsBySessionId.delete(r);
      let f = this.sessionIdsByMLContext.get(s);
      if (f.delete(r), f.size === 0) {
        this.sessionIdsByMLContext.delete(s);
        let i = this.mlContextCache.findIndex((d) => d.mlContext === s);
        i !== -1 && this.mlContextCache.splice(i, 1);
      }
    }
    getMLContext(r) {
      return this.mlContextBySessionId.get(r);
    }
    getMLOpSupportLimits(r) {
      return this.mlOpSupportLimitsBySessionId.get(r);
    }
    reserveTensorId() {
      return this.tensorManager.reserveTensorId();
    }
    releaseTensorId(r) {
      de("verbose", () => `[WebNN] releaseTensorId {tensorId: ${r}}`), this.tensorManager.releaseTensorId(r);
    }
    async ensureTensor(r, s, f, i, d) {
      let p = lr.get(f);
      if (!p) throw new Error(`Unsupported ONNX data type: ${f}`);
      return this.tensorManager.ensureTensor(r ?? this.currentSessionId, s, p, i, d);
    }
    async createTemporaryTensor(r, s, f) {
      de("verbose", () => `[WebNN] createTemporaryTensor {onnxDataType: ${s}, shape: ${f}}`);
      let i = lr.get(s);
      if (!i) throw new Error(`Unsupported ONNX data type: ${s}`);
      let d = this.tensorManager.reserveTensorId();
      await this.tensorManager.ensureTensor(r, d, i, f, false);
      let p = this.temporarySessionTensorIds.get(r);
      return p ? p.push(d) : this.temporarySessionTensorIds.set(r, [d]), d;
    }
    uploadTensor(r, s) {
      if (!V().shouldTransferToMLTensor) throw new Error("Trying to upload to a MLTensor while shouldTransferToMLTensor is false");
      de("verbose", () => `[WebNN] uploadTensor {tensorId: ${r}, data: ${s.byteLength}}`), this.tensorManager.upload(r, s);
    }
    async downloadTensor(r, s) {
      return this.tensorManager.download(r, s);
    }
    createMLTensorDownloader(r, s) {
      return async () => {
        let f = await this.tensorManager.download(r);
        return Es(f, s);
      };
    }
    registerMLTensor(r, s, f, i) {
      let d = lr.get(f);
      if (!d) throw new Error(`Unsupported ONNX data type: ${f}`);
      let p = this.tensorManager.registerTensor(r, s, d, i);
      return de("verbose", () => `[WebNN] registerMLTensor {tensor: ${s}, dataType: ${d}, dimensions: ${i}} -> {tensorId: ${p}}`), p;
    }
    registerMLConstant(r, s, f, i, d, p, m = false) {
      if (!p) throw new Error("External mounted files are not available.");
      let y = r;
      r.startsWith("./") && (y = r.substring(2));
      let w = p.get(y);
      if (!w) throw new Error(`File with name ${y} not found in preloaded files.`);
      if (s + f > w.byteLength) throw new Error("Out of bounds: data offset and length exceed the external file data size.");
      let T = w.slice(s, s + f).buffer, g;
      switch (d.dataType) {
        case "float32":
          g = new Float32Array(T);
          break;
        case "float16":
          g = typeof Float16Array < "u" && Float16Array.from ? new Float16Array(T) : new Uint16Array(T);
          break;
        case "int32":
          g = new Int32Array(T);
          break;
        case "uint32":
          g = new Uint32Array(T);
          break;
        case "int64":
          if (m) {
            let v = pn(new Uint8Array(T), "int64");
            g = new Int32Array(v.buffer), d.dataType = "int32";
          } else g = new BigInt64Array(T);
          break;
        case "uint64":
          g = new BigUint64Array(T);
          break;
        case "int8":
          g = new Int8Array(T);
          break;
        case "int4":
        case "uint4":
        case "uint8":
          g = new Uint8Array(T);
          break;
        default:
          throw new Error(`Unsupported data type: ${d.dataType} in creating WebNN Constant from external data.`);
      }
      return de("verbose", () => `[WebNN] registerMLConstant {dataType: ${d.dataType}, shape: ${d.shape}}} ${m ? "(Note: it was int64 data type and registered to int32 as workaround)" : ""}`), i.constant(d, g);
    }
    registerGraphInput(r) {
      this.temporaryGraphInputs.push(r);
    }
    registerGraphOutput(r) {
      this.temporaryGraphOutputs.push(r);
    }
    isGraphInput(r, s) {
      let f = this.sessionGraphInputs.get(r);
      return f ? f.includes(s) : false;
    }
    isGraphOutput(r, s) {
      let f = this.sessionGraphOutputs.get(r);
      return f ? f.includes(s) : false;
    }
    isGraphInputOutputTypeSupported(r, s, f = true) {
      let i = lr.get(He(s)), d = this.mlOpSupportLimitsBySessionId.get(r);
      return typeof i > "u" ? false : f ? !!(d == null ? void 0 : d.input.dataTypes.includes(i)) : !!(d == null ? void 0 : d.output.dataTypes.includes(i));
    }
    flush() {
    }
  };
});
var Ac, Kt, Qt, it, Ic, _s, xt, er, tr, Rs, rr, nr, or, rn = F(() => {
  ze();
  gs();
  vs();
  st();
  Ve();
  sr();
  cn();
  Ac = (a, r) => {
    V()._OrtInit(a, r) !== 0 && z("Can't initialize onnxruntime.");
  }, Kt = async (a) => {
    Ac(a.wasm.numThreads, Ot(a.logLevel));
  }, Qt = async (a, r) => {
    var _a2, _b;
    (_b = (_a2 = V()).asyncInit) == null ? void 0 : _b.call(_a2);
    let s = a.webgpu.adapter;
    if (r === "webgpu") {
      if (typeof navigator > "u" || !navigator.gpu) throw new Error("WebGPU is not supported in current environment");
      if (s) {
        if (typeof s.limits != "object" || typeof s.features != "object" || typeof s.requestDevice != "function") throw new Error("Invalid GPU adapter set in `env.webgpu.adapter`. It must be a GPUAdapter object.");
      } else {
        let f = a.webgpu.powerPreference;
        if (f !== void 0 && f !== "low-power" && f !== "high-performance") throw new Error(`Invalid powerPreference setting: "${f}"`);
        let i = a.webgpu.forceFallbackAdapter;
        if (i !== void 0 && typeof i != "boolean") throw new Error(`Invalid forceFallbackAdapter setting: "${i}"`);
        if (s = await navigator.gpu.requestAdapter({ powerPreference: f, forceFallbackAdapter: i }), !s) throw new Error('Failed to get GPU adapter. You may need to enable flag "--enable-unsafe-webgpu" if you are using Chrome.');
      }
    }
    if (r === "webnn" && (typeof navigator > "u" || !navigator.ml)) throw new Error("WebNN is not supported in current environment");
    if (r === "webgpu" && V().webgpuInit((f) => {
      a.webgpu.device = f;
    }), r === "webnn") {
      let f = new (Ps(), Ht(Ds)).WebNNBackend(a);
      V().webnnInit([f, () => f.reserveTensorId(), (i) => f.releaseTensorId(i), async (i, d, p, m, y) => f.ensureTensor(i, d, p, m, y), (i, d) => {
        f.uploadTensor(i, d);
      }, async (i, d) => f.downloadTensor(i, d), (i, d) => f.registerMLContext(i, d), !!a.trace]);
    }
  }, it = /* @__PURE__ */ new Map(), Ic = (a) => {
    let r = V(), s = r.stackSave();
    try {
      let f = r.PTR_SIZE, i = r.stackAlloc(2 * f);
      r._OrtGetInputOutputCount(a, i, i + f) !== 0 && z("Can't get session input/output count.");
      let p = f === 4 ? "i32" : "i64";
      return [Number(r.getValue(i, p)), Number(r.getValue(i + f, p))];
    } finally {
      r.stackRestore(s);
    }
  }, _s = (a, r) => {
    let s = V(), f = s.stackSave(), i = 0;
    try {
      let d = s.PTR_SIZE, p = s.stackAlloc(2 * d);
      s._OrtGetInputOutputMetadata(a, r, p, p + d) !== 0 && z("Can't get session input/output metadata.");
      let y = Number(s.getValue(p, "*"));
      i = Number(s.getValue(p + d, "*"));
      let w = s.HEAP32[i / 4];
      if (w === 0) return [y, 0];
      let T = s.HEAPU32[i / 4 + 1], g = [];
      for (let v = 0; v < T; v++) {
        let S = Number(s.getValue(i + 8 + v * d, "*"));
        g.push(S !== 0 ? s.UTF8ToString(S) : Number(s.getValue(i + 8 + (v + T) * d, "*")));
      }
      return [y, w, g];
    } finally {
      s.stackRestore(f), i !== 0 && s._OrtFree(i);
    }
  }, xt = (a) => {
    let r = V(), s = r._malloc(a.byteLength);
    if (s === 0) throw new Error(`Can't create a session. failed to allocate a buffer of size ${a.byteLength}.`);
    return r.HEAPU8.set(a, s), [s, a.byteLength];
  }, er = async (a, r) => {
    var _a2, _b, _c2, _d2;
    let s, f, i = V();
    Array.isArray(a) ? [s, f] = a : a.buffer === i.HEAPU8.buffer ? [s, f] = [a.byteOffset, a.byteLength] : [s, f] = xt(a);
    let d = 0, p = 0, m = 0, y = [], w = [], T = [];
    try {
      if ([p, y] = await Ts(r), (r == null ? void 0 : r.externalData) && i.mountExternalData) {
        let O2 = [];
        for (let G of r.externalData) {
          let oe = typeof G == "string" ? G : G.path;
          O2.push(Bt(typeof G == "string" ? G : G.data).then((l) => {
            i.mountExternalData(oe, l);
          }));
        }
        await Promise.all(O2);
      }
      for (let O2 of (r == null ? void 0 : r.executionProviders) ?? []) if ((typeof O2 == "string" ? O2 : O2.name) === "webnn") {
        if (i.shouldTransferToMLTensor = false, typeof O2 != "string") {
          let oe = O2, l = oe == null ? void 0 : oe.context, ne2 = oe == null ? void 0 : oe.gpuDevice, Z = oe == null ? void 0 : oe.deviceType, J2 = oe == null ? void 0 : oe.powerPreference;
          l ? i.currentContext = l : ne2 ? i.currentContext = await i.webnnCreateMLContext(ne2) : i.currentContext = await i.webnnCreateMLContext({ deviceType: Z, powerPreference: J2 });
        } else i.currentContext = await i.webnnCreateMLContext();
        break;
      }
      d = await i._OrtCreateSession(s, f, p), (_a2 = i.webgpuOnCreateSession) == null ? void 0 : _a2.call(i, d), d === 0 && z("Can't create a session."), (_b = i.jsepOnCreateSession) == null ? void 0 : _b.call(i), i.currentContext && (i.webnnRegisterMLContext(d, i.currentContext), i.currentContext = void 0, i.shouldTransferToMLTensor = true);
      let [g, v] = Ic(d), S = !!(r == null ? void 0 : r.enableGraphCapture), M = [], R2 = [], j = [], P = [], U = [];
      for (let O2 = 0; O2 < g; O2++) {
        let [G, oe, l] = _s(d, O2);
        G === 0 && z("Can't get an input name."), w.push(G);
        let ne2 = i.UTF8ToString(G);
        M.push(ne2), j.push(oe === 0 ? { name: ne2, isTensor: false } : { name: ne2, isTensor: true, type: ir(oe), shape: l });
      }
      for (let O2 = 0; O2 < v; O2++) {
        let [G, oe, l] = _s(d, O2 + g);
        G === 0 && z("Can't get an output name."), T.push(G);
        let ne2 = i.UTF8ToString(G);
        R2.push(ne2), P.push(oe === 0 ? { name: ne2, isTensor: false } : { name: ne2, isTensor: true, type: ir(oe), shape: l });
        {
          if (S && (r == null ? void 0 : r.preferredOutputLocation) === void 0) {
            U.push("gpu-buffer");
            continue;
          }
          let Z = typeof (r == null ? void 0 : r.preferredOutputLocation) == "string" ? r.preferredOutputLocation : ((_c2 = r == null ? void 0 : r.preferredOutputLocation) == null ? void 0 : _c2[ne2]) ?? "cpu", J2 = i.webnnIsGraphOutput;
          if (Z === "cpu" && J2 && J2(d, ne2)) {
            U.push("ml-tensor-cpu-output");
            continue;
          }
          if (Z !== "cpu" && Z !== "cpu-pinned" && Z !== "gpu-buffer" && Z !== "ml-tensor") throw new Error(`Not supported preferred output location: ${Z}.`);
          if (S && Z !== "gpu-buffer") throw new Error(`Not supported preferred output location: ${Z}. Only 'gpu-buffer' location is supported when enableGraphCapture is true.`);
          U.push(Z);
        }
      }
      let Y = null;
      return U.some((O2) => O2 === "gpu-buffer" || O2 === "ml-tensor" || O2 === "ml-tensor-cpu-output") && (m = i._OrtCreateBinding(d), m === 0 && z("Can't create IO binding."), Y = { handle: m, outputPreferredLocations: U, outputPreferredLocationsEncoded: U.map((O2) => O2 === "ml-tensor-cpu-output" ? "ml-tensor" : O2).map((O2) => fn(O2)) }), it.set(d, [d, w, T, Y, S, false]), [d, M, R2, j, P];
    } catch (g) {
      throw w.forEach((v) => i._OrtFree(v)), T.forEach((v) => i._OrtFree(v)), m !== 0 && i._OrtReleaseBinding(m) !== 0 && z("Can't release IO binding."), d !== 0 && i._OrtReleaseSession(d) !== 0 && z("Can't release session."), g;
    } finally {
      i._free(s), p !== 0 && i._OrtReleaseSessionOptions(p) !== 0 && z("Can't release session options."), y.forEach((g) => i._free(g)), (_d2 = i.unmountExternalData) == null ? void 0 : _d2.call(i);
    }
  }, tr = (a) => {
    var _a2, _b, _c2;
    let r = V(), s = it.get(a);
    if (!s) throw new Error(`cannot release session. invalid session id: ${a}`);
    let [f, i, d, p, m] = s;
    p && (m && r._OrtClearBoundOutputs(p.handle) !== 0 && z("Can't clear bound outputs."), r._OrtReleaseBinding(p.handle) !== 0 && z("Can't release IO binding.")), (_a2 = r.jsepOnReleaseSession) == null ? void 0 : _a2.call(r, a), (_b = r.webnnOnReleaseSession) == null ? void 0 : _b.call(r, a), (_c2 = r.webgpuOnReleaseSession) == null ? void 0 : _c2.call(r, a), i.forEach((y) => r._OrtFree(y)), d.forEach((y) => r._OrtFree(y)), r._OrtReleaseSession(f) !== 0 && z("Can't release session."), it.delete(a);
  }, Rs = async (a, r, s, f, i, d, p = false) => {
    if (!a) {
      r.push(0);
      return;
    }
    let m = V(), y = m.PTR_SIZE, w = a[0], T = a[1], g = a[3], v = g, S, M;
    if (w === "string" && (g === "gpu-buffer" || g === "ml-tensor")) throw new Error("String tensor is not supported on GPU.");
    if (p && g !== "gpu-buffer") throw new Error(`External buffer must be provided for input/output index ${d} when enableGraphCapture is true.`);
    if (g === "gpu-buffer") {
      let P = a[2].gpuBuffer;
      M = ht(He(w), T);
      {
        let U = m.webgpuRegisterBuffer;
        if (!U) throw new Error('Tensor location "gpu-buffer" is not supported without using WebGPU.');
        S = U(P, f);
      }
    } else if (g === "ml-tensor") {
      let P = a[2].mlTensor;
      M = ht(He(w), T);
      let U = m.webnnRegisterMLTensor;
      if (!U) throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');
      S = U(f, P, He(w), T);
    } else {
      let P = a[2];
      if (Array.isArray(P)) {
        M = y * P.length, S = m._malloc(M), s.push(S);
        for (let U = 0; U < P.length; U++) {
          if (typeof P[U] != "string") throw new TypeError(`tensor data at index ${U} is not a string`);
          m.setValue(S + U * y, he(P[U], s), "*");
        }
      } else {
        let U = m.webnnIsGraphInput, Y = m.webnnIsGraphOutput;
        if (w !== "string" && U && Y) {
          let O2 = m.UTF8ToString(i);
          if (U(f, O2) || Y(f, O2)) {
            let G = He(w);
            M = ht(G, T), v = "ml-tensor";
            let oe = m.webnnCreateTemporaryTensor, l = m.webnnUploadTensor;
            if (!oe || !l) throw new Error('Tensor location "ml-tensor" is not supported without using WebNN.');
            let ne2 = await oe(f, G, T);
            l(ne2, new Uint8Array(P.buffer, P.byteOffset, P.byteLength)), S = ne2;
          } else M = P.byteLength, S = m._malloc(M), s.push(S), m.HEAPU8.set(new Uint8Array(P.buffer, P.byteOffset, M), S);
        } else M = P.byteLength, S = m._malloc(M), s.push(S), m.HEAPU8.set(new Uint8Array(P.buffer, P.byteOffset, M), S);
      }
    }
    let R2 = m.stackSave(), j = m.stackAlloc(4 * T.length);
    try {
      T.forEach((U, Y) => m.setValue(j + Y * y, U, y === 4 ? "i32" : "i64"));
      let P = m._OrtCreateTensor(He(w), S, M, j, T.length, fn(v));
      P === 0 && z(`Can't create tensor for input/output. session=${f}, index=${d}.`), r.push(P);
    } finally {
      m.stackRestore(R2);
    }
  }, rr = async (a, r, s, f, i, d) => {
    var _a2, _b, _c2, _d2;
    let p = V(), m = p.PTR_SIZE, y = it.get(a);
    if (!y) throw new Error(`cannot run inference. invalid session id: ${a}`);
    let w = y[0], T = y[1], g = y[2], v = y[3], S = y[4], M = y[5], R2 = r.length, j = f.length, P = 0, U = [], Y = [], O2 = [], G = [], oe = [], l = p.stackSave(), ne2 = p.stackAlloc(R2 * m), Z = p.stackAlloc(R2 * m), J2 = p.stackAlloc(j * m), Ce = p.stackAlloc(j * m);
    try {
      [P, U] = ws(d), Ge("wasm prepareInputOutputTensor");
      for (let _ = 0; _ < R2; _++) await Rs(s[_], Y, G, a, T[r[_]], r[_], S);
      for (let _ = 0; _ < j; _++) await Rs(i[_], O2, G, a, g[f[_]], R2 + f[_], S);
      $e("wasm prepareInputOutputTensor");
      for (let _ = 0; _ < R2; _++) p.setValue(ne2 + _ * m, Y[_], "*"), p.setValue(Z + _ * m, T[r[_]], "*");
      for (let _ = 0; _ < j; _++) p.setValue(J2 + _ * m, O2[_], "*"), p.setValue(Ce + _ * m, g[f[_]], "*");
      if (v && !M) {
        let { handle: _, outputPreferredLocations: ae2, outputPreferredLocationsEncoded: le } = v;
        if (T.length !== R2) throw new Error(`input count from feeds (${R2}) is expected to be always equal to model's input count (${T.length}).`);
        Ge("wasm bindInputsOutputs");
        for (let q = 0; q < R2; q++) {
          let ye2 = r[q];
          await p._OrtBindInput(_, T[ye2], Y[q]) !== 0 && z(`Can't bind input[${q}] for session=${a}.`);
        }
        for (let q = 0; q < j; q++) {
          let ye2 = f[q];
          ((_a2 = i[q]) == null ? void 0 : _a2[3]) ? (oe.push(O2[q]), p._OrtBindOutput(_, g[ye2], O2[q], 0) !== 0 && z(`Can't bind pre-allocated output[${q}] for session=${a}.`)) : p._OrtBindOutput(_, g[ye2], 0, le[ye2]) !== 0 && z(`Can't bind output[${q}] to ${ae2[q]} for session=${a}.`);
        }
        $e("wasm bindInputsOutputs"), it.set(a, [w, T, g, v, S, true]);
      }
      (_b = p.jsepOnRunStart) == null ? void 0 : _b.call(p, w), (_c2 = p.webnnOnRunStart) == null ? void 0 : _c2.call(p, w);
      let K;
      v ? K = await p._OrtRunWithBinding(w, v.handle, j, J2, P) : K = await p._OrtRun(w, Z, ne2, R2, Ce, j, J2, P), K !== 0 && z("failed to call OrtRun().");
      let x = [], A = [];
      Ge("wasm ProcessOutputTensor");
      for (let _ = 0; _ < j; _++) {
        let ae2 = Number(p.getValue(J2 + _ * m, "*"));
        if (ae2 === O2[_] || oe.includes(O2[_])) {
          x.push(i[_]), ae2 !== O2[_] && p._OrtReleaseTensor(ae2) !== 0 && z("Can't release tensor.");
          continue;
        }
        let le = p.stackSave(), q = p.stackAlloc(4 * m), ye2 = false, re, se2 = 0;
        try {
          p._OrtGetTensorData(ae2, q, q + m, q + 2 * m, q + 3 * m) !== 0 && z(`Can't access output tensor data on index ${_}.`);
          let we = m === 4 ? "i32" : "i64", je2 = Number(p.getValue(q, we));
          se2 = p.getValue(q + m, "*");
          let wt2 = p.getValue(q + m * 2, "*"), gt = Number(p.getValue(q + m * 3, we)), Se = [];
          for (let te = 0; te < gt; te++) Se.push(Number(p.getValue(wt2 + te * m, we)));
          p._OrtFree(wt2) !== 0 && z("Can't free memory for tensor dims.");
          let Ae = Se.reduce((te, Q) => te * Q, 1);
          re = ir(je2);
          let Le2 = v == null ? void 0 : v.outputPreferredLocations[f[_]];
          if (re === "string") {
            if (Le2 === "gpu-buffer" || Le2 === "ml-tensor") throw new Error("String tensor is not supported on GPU.");
            let te = [];
            for (let Q = 0; Q < Ae; Q++) {
              let $ = p.getValue(se2 + Q * m, "*"), H = p.getValue(se2 + (Q + 1) * m, "*"), Ye2 = Q === Ae - 1 ? void 0 : H - $;
              te.push(p.UTF8ToString($, Ye2));
            }
            x.push([re, Se, te, "cpu"]);
          } else if (Le2 === "gpu-buffer" && Ae > 0) {
            let te = p.webgpuGetBuffer;
            if (!te) throw new Error('preferredLocation "gpu-buffer" is not supported without using WebGPU.');
            let Q = te(se2), $ = ht(je2, Ae);
            if ($ === void 0 || !ur(re)) throw new Error(`Unsupported data type: ${re}`);
            ye2 = true;
            {
              p.webgpuRegisterBuffer(Q, a, se2);
              let H = p.webgpuCreateDownloader(Q, $, a);
              x.push([re, Se, { gpuBuffer: Q, download: async () => {
                let Ye2 = await H();
                return new (at(re))(Ye2);
              }, dispose: () => {
                p._OrtReleaseTensor(ae2) !== 0 && z("Can't release tensor.");
              } }, "gpu-buffer"]);
            }
          } else if (Le2 === "ml-tensor" && Ae > 0) {
            let te = p.webnnEnsureTensor, Q = p.webnnIsGraphInputOutputTypeSupported;
            if (!te || !Q) throw new Error('preferredLocation "ml-tensor" is not supported without using WebNN.');
            if (ht(je2, Ae) === void 0 || !fr(re)) throw new Error(`Unsupported data type: ${re}`);
            if (!Q(a, re, false)) throw new Error(`preferredLocation "ml-tensor" for ${re} output is not supported by current WebNN Context.`);
            let H = await te(a, se2, je2, Se, false);
            ye2 = true, x.push([re, Se, { mlTensor: H, download: p.webnnCreateMLTensorDownloader(se2, re), dispose: () => {
              p.webnnReleaseTensorId(se2), p._OrtReleaseTensor(ae2);
            } }, "ml-tensor"]);
          } else if (Le2 === "ml-tensor-cpu-output" && Ae > 0) {
            let te = p.webnnCreateMLTensorDownloader(se2, re)(), Q = x.length;
            ye2 = true, A.push((async () => {
              let $ = [Q, await te];
              return p.webnnReleaseTensorId(se2), p._OrtReleaseTensor(ae2), $;
            })()), x.push([re, Se, [], "cpu"]);
          } else {
            let te = at(re), Q = new te(Ae);
            new Uint8Array(Q.buffer, Q.byteOffset, Q.byteLength).set(p.HEAPU8.subarray(se2, se2 + Q.byteLength)), x.push([re, Se, Q, "cpu"]);
          }
        } finally {
          p.stackRestore(le), re === "string" && se2 && p._free(se2), ye2 || p._OrtReleaseTensor(ae2);
        }
      }
      v && !S && (p._OrtClearBoundOutputs(v.handle) !== 0 && z("Can't clear bound outputs."), it.set(a, [w, T, g, v, S, false]));
      for (let [_, ae2] of await Promise.all(A)) x[_][2] = ae2;
      return $e("wasm ProcessOutputTensor"), x;
    } finally {
      (_d2 = p.webnnOnRunEnd) == null ? void 0 : _d2.call(p, w), p.stackRestore(l), s.forEach((K) => {
        K && K[3] === "gpu-buffer" && p.webgpuUnregisterBuffer(K[2].gpuBuffer);
      }), i.forEach((K) => {
        K && K[3] === "gpu-buffer" && p.webgpuUnregisterBuffer(K[2].gpuBuffer);
      }), Y.forEach((K) => p._OrtReleaseTensor(K)), O2.forEach((K) => p._OrtReleaseTensor(K)), G.forEach((K) => p._free(K)), P !== 0 && p._OrtReleaseRunOptions(P), U.forEach((K) => p._free(K));
    }
  }, nr = (a) => {
    let r = V(), s = it.get(a);
    if (!s) throw new Error("invalid session id");
    let f = s[0], i = r._OrtEndProfiling(f);
    i === 0 && z("Can't get an profile file name."), r._OrtFree(i);
  }, or = (a) => {
    let r = [];
    for (let s of a) {
      let f = s[2];
      !Array.isArray(f) && "buffer" in f && r.push(f.buffer);
    }
    return r;
  };
});
var ut, Ee, Mt, mr, hr, pr, hn, yn, yt, bt, Lc, Ns, Ws, ks, Fs, Gs, $s, zs, bn = F(() => {
  ze();
  rn();
  Ve();
  Xt();
  ut = () => !!ee.wasm.proxy && typeof document < "u", Mt = false, mr = false, hr = false, yn = /* @__PURE__ */ new Map(), yt = (a, r) => {
    let s = yn.get(a);
    s ? s.push(r) : yn.set(a, [r]);
  }, bt = () => {
    if (Mt || !mr || hr || !Ee) throw new Error("worker not ready");
  }, Lc = (a) => {
    switch (a.data.type) {
      case "init-wasm":
        Mt = false, a.data.err ? (hr = true, hn[1](a.data.err)) : (mr = true, hn[0]()), pr && (URL.revokeObjectURL(pr), pr = void 0);
        break;
      case "init-ep":
      case "copy-from":
      case "create":
      case "release":
      case "run":
      case "end-profiling": {
        let r = yn.get(a.data.type);
        a.data.err ? r.shift()[1](a.data.err) : r.shift()[0](a.data.out);
        break;
      }
    }
  }, Ns = async () => {
    if (!mr) {
      if (Mt) throw new Error("multiple calls to 'initWasm()' detected.");
      if (hr) throw new Error("previous call to 'initWasm()' failed.");
      if (Mt = true, ut()) return new Promise((a, r) => {
        Ee == null ? void 0 : Ee.terminate(), hs().then(([s, f]) => {
          try {
            Ee = f, Ee.onerror = (d) => r(d), Ee.onmessage = Lc, hn = [a, r];
            let i = { type: "init-wasm", in: ee };
            !i.in.wasm.wasmPaths && (s || on) && (i.in.wasm.wasmPaths = { wasm: new URL("" + new URL("ort-wasm-simd-threaded.asyncify-DGj6wBfM.wasm", import.meta.url).href, import.meta.url).href }), Ee.postMessage(i), pr = s;
          } catch (i) {
            r(i);
          }
        }, r);
      });
      try {
        await Zt(ee.wasm), await Kt(ee), mr = true;
      } catch (a) {
        throw hr = true, a;
      } finally {
        Mt = false;
      }
    }
  }, Ws = async (a) => {
    if (ut()) return bt(), new Promise((r, s) => {
      yt("init-ep", [r, s]);
      let f = { type: "init-ep", in: { epName: a, env: ee } };
      Ee.postMessage(f);
    });
    await Qt(ee, a);
  }, ks = async (a) => ut() ? (bt(), new Promise((r, s) => {
    yt("copy-from", [r, s]);
    let f = { type: "copy-from", in: { buffer: a } };
    Ee.postMessage(f, [a.buffer]);
  })) : xt(a), Fs = async (a, r) => {
    if (ut()) {
      if (r == null ? void 0 : r.preferredOutputLocation) throw new Error('session option "preferredOutputLocation" is not supported for proxy.');
      return bt(), new Promise((s, f) => {
        yt("create", [s, f]);
        let i = { type: "create", in: { model: a, options: { ...r } } }, d = [];
        a instanceof Uint8Array && d.push(a.buffer), Ee.postMessage(i, d);
      });
    } else return er(a, r);
  }, Gs = async (a) => {
    if (ut()) return bt(), new Promise((r, s) => {
      yt("release", [r, s]);
      let f = { type: "release", in: a };
      Ee.postMessage(f);
    });
    tr(a);
  }, $s = async (a, r, s, f, i, d) => {
    if (ut()) {
      if (s.some((p) => p[3] !== "cpu")) throw new Error("input tensor on GPU is not supported for proxy.");
      if (i.some((p) => p)) throw new Error("pre-allocated output tensor is not supported for proxy.");
      return bt(), new Promise((p, m) => {
        yt("run", [p, m]);
        let y = s, w = { type: "run", in: { sessionId: a, inputIndices: r, inputs: y, outputIndices: f, options: d } };
        Ee.postMessage(w, or(y));
      });
    } else return rr(a, r, s, f, i, d);
  }, zs = async (a) => {
    if (ut()) return bt(), new Promise((r, s) => {
      yt("end-profiling", [r, s]);
      let f = { type: "end-profiling", in: a };
      Ee.postMessage(f);
    });
    nr(a);
  };
});
var Vs, Oc, yr, Hs = F(() => {
  ze();
  bn();
  st();
  Jt();
  cn();
  Vs = (a, r) => {
    switch (a.location) {
      case "cpu":
        return [a.type, a.dims, a.data, "cpu"];
      case "gpu-buffer":
        return [a.type, a.dims, { gpuBuffer: a.gpuBuffer }, "gpu-buffer"];
      case "ml-tensor":
        return [a.type, a.dims, { mlTensor: a.mlTensor }, "ml-tensor"];
      default:
        throw new Error(`invalid data location: ${a.location} for ${r()}`);
    }
  }, Oc = (a) => {
    switch (a[3]) {
      case "cpu":
        return new xe(a[0], a[2], a[1]);
      case "gpu-buffer": {
        let r = a[0];
        if (!ur(r)) throw new Error(`not supported data type: ${r} for deserializing GPU tensor`);
        let { gpuBuffer: s, download: f, dispose: i } = a[2];
        return xe.fromGpuBuffer(s, { dataType: r, dims: a[1], download: f, dispose: i });
      }
      case "ml-tensor": {
        let r = a[0];
        if (!fr(r)) throw new Error(`not supported data type: ${r} for deserializing MLTensor tensor`);
        let { mlTensor: s, download: f, dispose: i } = a[2];
        return xe.fromMLTensor(s, { dataType: r, dims: a[1], download: f, dispose: i });
      }
      default:
        throw new Error(`invalid data location: ${a[3]}`);
    }
  }, yr = class {
    async fetchModelAndCopyToWasmMemory(r) {
      return ks(await Bt(r));
    }
    async loadModel(r, s) {
      tt();
      let f;
      typeof r == "string" ? f = await this.fetchModelAndCopyToWasmMemory(r) : f = r, [this.sessionId, this.inputNames, this.outputNames, this.inputMetadata, this.outputMetadata] = await Fs(f, s), rt();
    }
    async dispose() {
      return Gs(this.sessionId);
    }
    async run(r, s, f) {
      tt();
      let i = [], d = [];
      Object.entries(r).forEach((v) => {
        let S = v[0], M = v[1], R2 = this.inputNames.indexOf(S);
        if (R2 === -1) throw new Error(`invalid input '${S}'`);
        i.push(M), d.push(R2);
      });
      let p = [], m = [];
      Object.entries(s).forEach((v) => {
        let S = v[0], M = v[1], R2 = this.outputNames.indexOf(S);
        if (R2 === -1) throw new Error(`invalid output '${S}'`);
        p.push(M), m.push(R2);
      });
      let y = i.map((v, S) => Vs(v, () => `input "${this.inputNames[d[S]]}"`)), w = p.map((v, S) => v ? Vs(v, () => `output "${this.outputNames[m[S]]}"`) : null), T = await $s(this.sessionId, d, y, m, w, f), g = {};
      for (let v = 0; v < T.length; v++) g[this.outputNames[m[v]]] = p[v] ?? Oc(T[v]);
      return rt(), g;
    }
    startProfiling() {
    }
    endProfiling() {
      zs(this.sessionId);
    }
  };
});
var Ys = {};
At(Ys, { OnnxruntimeWebAssemblyBackend: () => br, initializeFlags: () => js, wasmBackend: () => Bc });
var js, br, Bc, qs = F(() => {
  ze();
  bn();
  Hs();
  js = () => {
    (typeof ee.wasm.initTimeout != "number" || ee.wasm.initTimeout < 0) && (ee.wasm.initTimeout = 0);
    let a = ee.wasm.simd;
    if (typeof a != "boolean" && a !== void 0 && a !== "fixed" && a !== "relaxed" && (console.warn(`Property "env.wasm.simd" is set to unknown value "${a}". Reset it to \`false\` and ignore SIMD feature checking.`), ee.wasm.simd = false), typeof ee.wasm.proxy != "boolean" && (ee.wasm.proxy = false), typeof ee.wasm.trace != "boolean" && (ee.wasm.trace = false), typeof ee.wasm.numThreads != "number" || !Number.isInteger(ee.wasm.numThreads) || ee.wasm.numThreads <= 0) if (typeof self < "u" && !self.crossOriginIsolated) ee.wasm.numThreads = 1;
    else {
      let r = typeof navigator > "u" ? Jr("node:os").cpus().length : navigator.hardwareConcurrency;
      ee.wasm.numThreads = Math.min(4, Math.ceil((r || 1) / 2));
    }
  }, br = class {
    async init(r) {
      js(), await Ns(), await Ws(r);
    }
    async createInferenceSessionHandler(r, s) {
      let f = new yr();
      return await f.loadModel(r, s), f;
    }
  }, Bc = new br();
});
ze();
ze();
ze();
var rs = "1.24.1";
{
  let a = (qs(), Ht(Ys)).wasmBackend;
  Qe("webgpu", a, 5), Qe("webnn", a, 5), Qe("cpu", a, 10), Qe("wasm", a, 10);
}
Object.defineProperty(ee.versions, "web", { value: rs, enumerable: true });
const ENCODER_MODEL_URL = "https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX/resolve/main/onnx/vision_encoder.onnx";
const ENCODER_DATA_URL = "https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX/resolve/main/onnx/vision_encoder.onnx_data";
const DECODER_MODEL_URL = "https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX/resolve/main/onnx/prompt_encoder_mask_decoder.onnx";
const DECODER_DATA_URL = "https://huggingface.co/onnx-community/sam2.1-hiera-tiny-ONNX/resolve/main/onnx/prompt_encoder_mask_decoder.onnx_data";
async function getOpfsRoot() {
  try {
    if ("storage" in navigator && "getDirectory" in navigator.storage) {
      return await navigator.storage.getDirectory();
    }
  } catch {
  }
  return null;
}
async function fetchWithCache(url, opfsRoot, signal) {
  const name = url.split("/").pop() || "model";
  if (opfsRoot) {
    try {
      const handle = await opfsRoot.getFileHandle(name, { create: false });
      const file = await handle.getFile();
      return await file.arrayBuffer();
    } catch {
    }
  }
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buffer = await res.arrayBuffer();
  if (opfsRoot) {
    try {
      const handle = await opfsRoot.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(buffer);
      await writable.close();
    } catch {
    }
  }
  return buffer;
}
class SAM2 {
  constructor() {
    __publicField(this, "encoderSession", null);
    __publicField(this, "decoderSession", null);
    /**
     * Cached encoder outputs keyed by tensor name. These are fed back into
     * the decoder, which expects multiple embeddings (image, high-res feats, etc.).
     */
    __publicField(this, "encodedTensors", null);
  }
  /**
   * Try webgpu then cpu; return [session, provider] on success.
   * Mirrors the working onnx-test implementation's session creation logic.
   */
  async createSession(ort2, model, externalData) {
    const providers = ["webgpu", "cpu"];
    for (const ep2 of providers) {
      try {
        const session = await ort2.InferenceSession.create(model, {
          executionProviders: [ep2],
          ...externalData ? { externalData } : {},
          graphOptimizationLevel: "all"
        });
        return [session, ep2];
      } catch (e) {
        console.warn(`[SAM2] Session create failed for ${ep2}:`, e);
      }
    }
    throw new Error("[SAM2] Could not create session with webgpu or cpu");
  }
  async load(ort2, signal) {
    const opfsRoot = await getOpfsRoot();
    const [
      encoderModelBuffer,
      encoderDataBuffer,
      decoderModelBuffer,
      decoderDataBuffer
    ] = await Promise.all([
      fetchWithCache(ENCODER_MODEL_URL, opfsRoot, signal),
      fetchWithCache(ENCODER_DATA_URL, opfsRoot, signal),
      fetchWithCache(DECODER_MODEL_URL, opfsRoot, signal),
      fetchWithCache(DECODER_DATA_URL, opfsRoot, signal)
    ]);
    const encoderExternalData = [
      {
        data: new Uint8Array(encoderDataBuffer),
        path: "vision_encoder.onnx_data"
      }
    ];
    const decoderExternalData = [
      {
        data: new Uint8Array(decoderDataBuffer),
        path: "prompt_encoder_mask_decoder.onnx_data"
      }
    ];
    const [encoderSession, encoderDevice] = await this.createSession(
      ort2,
      encoderModelBuffer,
      encoderExternalData
    );
    const [decoderSession] = await this.createSession(
      ort2,
      decoderModelBuffer,
      decoderExternalData
    );
    this.encoderSession = encoderSession;
    this.decoderSession = decoderSession;
    const device = encoderDevice;
    console.log(
      `[SAM2] Running on ${device === "webgpu" ? "GPU (WebGPU)" : "CPU (CPU execution provider)"}`
    );
    return device;
  }
  async encode(ort2, float32Array, shape) {
    if (!this.encoderSession) throw new Error("Encoder not loaded");
    const imageTensor = new ort2.Tensor("float32", float32Array, shape);
    const inputName = this.encoderSession.inputNames[0];
    const results = await this.encoderSession.run({ [inputName]: imageTensor });
    const encodedTensors = {};
    for (const name of Object.keys(results)) {
      encodedTensors[name] = results[name];
    }
    this.encodedTensors = encodedTensors;
  }
  async decode(ort2, points, maskArray, boxes) {
    var _a2, _b, _c2;
    if (!this.decoderSession || !this.encodedTensors) {
      throw new Error("Image must be encoded before decode()");
    }
    const n = points.length;
    const pointCoords = new Float32Array(1 * 1 * n * 2);
    const pointLabels = new BigInt64Array(1 * 1 * n);
    for (let i = 0; i < n; i++) {
      const base = i * 2;
      pointCoords[base] = ((_a2 = points[i]) == null ? void 0 : _a2.x) ?? 0;
      pointCoords[base + 1] = ((_b = points[i]) == null ? void 0 : _b.y) ?? 0;
      pointLabels[i] = BigInt(((_c2 = points[i]) == null ? void 0 : _c2.label) ?? 0);
    }
    const maskInputArray = maskArray ?? new Float32Array(256 * 256);
    const hasMaskInputFlag = new BigInt64Array([maskArray ? 1n : 0n]);
    const feeds = {};
    const encodedTensors = this.encodedTensors;
    for (const name of this.decoderSession.inputNames) {
      if (encodedTensors == null ? void 0 : encodedTensors[name]) {
        feeds[name] = encodedTensors[name];
        continue;
      }
      if (name === "input_points" || name === "point_coords") {
        feeds[name] = new ort2.Tensor("float32", pointCoords, [1, 1, n, 2]);
      } else if (name === "input_labels" || name === "point_labels") {
        feeds[name] = new ort2.Tensor("int64", pointLabels, [1, 1, n]);
      } else if (name === "input_boxes") {
        if (boxes && boxes.length > 0) {
          const flat = new Float32Array(boxes.length * 4);
          for (let i = 0; i < boxes.length; i++) {
            const [x1, y1, x2, y2] = boxes[i];
            const o = i * 4;
            flat[o] = x1;
            flat[o + 1] = y1;
            flat[o + 2] = x2;
            flat[o + 3] = y2;
          }
          feeds[name] = new ort2.Tensor("float32", flat, [1, boxes.length, 4]);
        } else {
          feeds[name] = new ort2.Tensor(
            "float32",
            new Float32Array(0),
            [1, 0, 4]
          );
        }
      } else if (name === "mask_input") {
        feeds[name] = new ort2.Tensor(
          "float32",
          maskInputArray,
          [1, 1, 256, 256]
        );
      } else if (name === "has_mask_input") {
        feeds[name] = new ort2.Tensor("int64", hasMaskInputFlag, [1]);
      }
    }
    const results = await this.decoderSession.run(feeds);
    const outputNames = this.decoderSession.outputNames;
    if (outputNames.length < 2) {
      throw new Error(
        `Unexpected number of decoder outputs: ${outputNames.length}`
      );
    }
    const out0 = results[outputNames[0]];
    const out1 = results[outputNames[1]];
    const out0IsMasks = out0.dims.length >= 4 || out0.data.length > out1.data.length;
    const masksTensor = out0IsMasks ? out0 : out1;
    const iouTensor = out0IsMasks ? out1 : out0;
    return {
      masks: {
        dims: masksTensor.dims,
        cpuData: masksTensor.data
      },
      iou_predictions: iouTensor.data
    };
  }
}
const { pathname: workerPathname, origin: workerOrigin } = self.location;
const assetsIx = workerPathname.indexOf("/assets/");
let wasmPaths;
if (assetsIx >= 0) {
  const mount = assetsIx === 0 ? "" : workerPathname.slice(0, assetsIx).replace(/\/$/, "");
  wasmPaths = `${workerOrigin}${mount}/wasm/`;
} else {
  const prefix = "";
  wasmPaths = `${workerOrigin}${prefix}/wasm/`;
}
ye.wasm.wasmPaths = wasmPaths;
let sam2 = null;
async function ensureLoaded() {
  if (!sam2) {
    sam2 = new SAM2();
    return await sam2.load(ort);
  }
  return "cpu";
}
let messageQueue = Promise.resolve();
self.onmessage = (e) => {
  messageQueue = messageQueue.then(() => handleMessage(e));
};
async function handleMessage(e) {
  const { type } = e.data;
  try {
    if (type === "ping") {
      self.postMessage({ type: "loadingInProgress" });
      const device = await ensureLoaded();
      self.postMessage({ type: "pong", success: true, device });
      return;
    }
    if (type === "encodeImage") {
      const data = e.data;
      const { float32Array, shape } = data;
      if (!sam2) await ensureLoaded();
      if (!sam2) throw new Error("SAM2 not loaded");
      self.postMessage({ type: "loadingInProgress" });
      await sam2.encode(ort, float32Array, shape);
      self.postMessage({ type: "encodeImageDone", data: {} });
      return;
    }
    if (type === "decodeMask") {
      const data = e.data;
      const { points, maskArray } = data;
      if (!sam2) throw new Error("Encode first");
      const result = await sam2.decode(ort, points, maskArray ?? null);
      self.postMessage({
        type: "decodeMaskResult",
        masks: { dims: result.masks.dims, cpuData: result.masks.cpuData },
        iou_predictions: result.iou_predictions
      });
      return;
    }
  } catch (err) {
    console.error("[SAM2 worker] Error in handleMessage:", err);
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err)
    });
  }
}
