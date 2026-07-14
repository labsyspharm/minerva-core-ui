/* @ts-self-types="./psudo.d.ts" */

/**
 * One NM restart result for WASM worker pools (`run_nm_restart`).
 */
class NmRestartWasmResult {
    static __wrap(ptr) {
        const obj = Object.create(NmRestartWasmResult.prototype);
        obj.__wbg_ptr = ptr;
        NmRestartWasmResultFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        NmRestartWasmResultFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_nmrestartwasmresult_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get min_display_rgb_distance() {
        const ret = wasm.nmrestartwasmresult_min_display_rgb_distance(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {Float32Array}
     */
    get oklab() {
        const ret = wasm.nmrestartwasmresult_oklab(this.__wbg_ptr);
        var v1 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
    /**
     * @returns {number}
     */
    get total() {
        const ret = wasm.nmrestartwasmresult_total(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) NmRestartWasmResult.prototype[Symbol.dispose] = NmRestartWasmResult.prototype.free;

/**
 * @param {Uint16Array} intensities
 * @param {Uint16Array} colors
 * @param {Uint16Array} contrast_limits
 * @param {Uint16Array} luminance_values
 * @param {string[]} excluded_colors
 * @param {string[]} color_names
 * @param {boolean | null} [include_spatial_channel_overlap]
 * @returns {any}
 */
function calculate_palette_loss(intensities, colors, contrast_limits, luminance_values, excluded_colors, color_names, include_spatial_channel_overlap) {
    const ptr0 = passArray16ToWasm0(intensities, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray16ToWasm0(colors, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray16ToWasm0(contrast_limits, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray16ToWasm0(luminance_values, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArrayJsValueToWasm0(excluded_colors, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayJsValueToWasm0(color_names, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ret = wasm.calculate_palette_loss(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, isLikeNone(include_spatial_channel_overlap) ? 0xFFFFFF : include_spatial_channel_overlap ? 1 : 0);
    return ret;
}

/**
 * @param {Uint16Array} array
 * @returns {Float32Array}
 */
function channel_gmm(array) {
    const ptr0 = passArray16ToWasm0(array, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.channel_gmm(ptr0, len0);
    var v2 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}

/**
 * Polish + refine best OKLab and return linear sRGB (after parallel restarts).
 * @param {Uint16Array} colors
 * @param {Uint16Array} locked_colors
 * @param {Uint16Array} intensities
 * @param {Uint16Array} contrast_limits
 * @param {Uint16Array} luminance_values
 * @param {string[]} excluded_colors
 * @param {string[]} color_names
 * @param {number | null | undefined} max_iters
 * @param {number | null | undefined} confusion_baseline_samples
 * @param {boolean | null | undefined} include_spatial_channel_overlap
 * @param {Float32Array} oklab_best
 * @returns {Float32Array}
 */
function finalize_palette_optimize(colors, locked_colors, intensities, contrast_limits, luminance_values, excluded_colors, color_names, max_iters, confusion_baseline_samples, include_spatial_channel_overlap, oklab_best) {
    const ptr0 = passArray16ToWasm0(colors, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray16ToWasm0(locked_colors, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray16ToWasm0(intensities, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray16ToWasm0(contrast_limits, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray16ToWasm0(luminance_values, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayJsValueToWasm0(excluded_colors, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ptr6 = passArrayJsValueToWasm0(color_names, wasm.__wbindgen_malloc);
    const len6 = WASM_VECTOR_LEN;
    const ptr7 = passArrayF32ToWasm0(oklab_best, wasm.__wbindgen_malloc);
    const len7 = WASM_VECTOR_LEN;
    const ret = wasm.finalize_palette_optimize(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, ptr6, len6, isLikeNone(max_iters) ? Number.MAX_SAFE_INTEGER : (max_iters) >>> 0, isLikeNone(confusion_baseline_samples) ? Number.MAX_SAFE_INTEGER : (confusion_baseline_samples) >>> 0, isLikeNone(include_spatial_channel_overlap) ? 0xFFFFFF : include_spatial_channel_overlap ? 1 : 0, ptr7, len7);
    var v9 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v9;
}

/**
 * @param {Uint16Array} array
 * @returns {Float32Array}
 */
function ln(array) {
    const ptr0 = passArray16ToWasm0(array, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.ln(ptr0, len0);
    var v2 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v2;
}

/**
 * Defaults: `max_iters` 3000, `confusion_baseline_samples` 32, full polish + refine after search.
 * @param {Uint16Array} colors
 * @param {Uint16Array} locked_colors
 * @param {Uint16Array} intensities
 * @param {Uint16Array} contrast_limits
 * @param {Uint16Array} luminance_values
 * @param {string[]} excluded_colors
 * @param {string[]} color_names
 * @param {number | null} [max_iters]
 * @param {number | null} [confusion_baseline_samples]
 * @param {boolean | null} [include_spatial_channel_overlap]
 * @param {number | null} [num_restarts]
 * @returns {Float32Array}
 */
function optimize(colors, locked_colors, intensities, contrast_limits, luminance_values, excluded_colors, color_names, max_iters, confusion_baseline_samples, include_spatial_channel_overlap, num_restarts) {
    const ptr0 = passArray16ToWasm0(colors, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray16ToWasm0(locked_colors, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray16ToWasm0(intensities, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray16ToWasm0(contrast_limits, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray16ToWasm0(luminance_values, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayJsValueToWasm0(excluded_colors, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ptr6 = passArrayJsValueToWasm0(color_names, wasm.__wbindgen_malloc);
    const len6 = WASM_VECTOR_LEN;
    const ret = wasm.optimize(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, ptr6, len6, isLikeNone(max_iters) ? Number.MAX_SAFE_INTEGER : (max_iters) >>> 0, isLikeNone(confusion_baseline_samples) ? Number.MAX_SAFE_INTEGER : (confusion_baseline_samples) >>> 0, isLikeNone(include_spatial_channel_overlap) ? 0xFFFFFF : include_spatial_channel_overlap ? 1 : 0, isLikeNone(num_restarts) ? Number.MAX_SAFE_INTEGER : (num_restarts) >>> 0);
    var v8 = getArrayF32FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
    return v8;
}

/**
 * @param {Uint16Array} intensities
 * @param {Uint16Array} colors
 * @param {Uint16Array} contrast_limits
 * @param {Uint16Array} luminance_values
 * @returns {number}
 */
function optimize_in_lens(intensities, colors, contrast_limits, luminance_values) {
    const ptr0 = passArray16ToWasm0(intensities, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray16ToWasm0(colors, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray16ToWasm0(contrast_limits, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray16ToWasm0(luminance_values, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ret = wasm.optimize_in_lens(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
    return ret;
}

/**
 * Run a single Nelder–Mead multistart (for parallel Web Workers). Matches one leg of [`optimize_palette_pipeline`].
 * @param {Uint16Array} colors
 * @param {Uint16Array} locked_colors
 * @param {Uint16Array} intensities
 * @param {Uint16Array} contrast_limits
 * @param {Uint16Array} luminance_values
 * @param {string[]} excluded_colors
 * @param {string[]} color_names
 * @param {number | null | undefined} max_iters
 * @param {number | null | undefined} confusion_baseline_samples
 * @param {boolean | null | undefined} include_spatial_channel_overlap
 * @param {number} restart_index
 * @param {number} seed_salt
 * @param {boolean} rescue_random_init
 * @returns {NmRestartWasmResult}
 */
function run_nm_restart(colors, locked_colors, intensities, contrast_limits, luminance_values, excluded_colors, color_names, max_iters, confusion_baseline_samples, include_spatial_channel_overlap, restart_index, seed_salt, rescue_random_init) {
    const ptr0 = passArray16ToWasm0(colors, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray16ToWasm0(locked_colors, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passArray16ToWasm0(intensities, wasm.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN;
    const ptr3 = passArray16ToWasm0(contrast_limits, wasm.__wbindgen_malloc);
    const len3 = WASM_VECTOR_LEN;
    const ptr4 = passArray16ToWasm0(luminance_values, wasm.__wbindgen_malloc);
    const len4 = WASM_VECTOR_LEN;
    const ptr5 = passArrayJsValueToWasm0(excluded_colors, wasm.__wbindgen_malloc);
    const len5 = WASM_VECTOR_LEN;
    const ptr6 = passArrayJsValueToWasm0(color_names, wasm.__wbindgen_malloc);
    const len6 = WASM_VECTOR_LEN;
    const ret = wasm.run_nm_restart(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, ptr4, len4, ptr5, len5, ptr6, len6, isLikeNone(max_iters) ? Number.MAX_SAFE_INTEGER : (max_iters) >>> 0, isLikeNone(confusion_baseline_samples) ? Number.MAX_SAFE_INTEGER : (confusion_baseline_samples) >>> 0, isLikeNone(include_spatial_channel_overlap) ? 0xFFFFFF : include_spatial_channel_overlap ? 1 : 0, restart_index, seed_salt, rescue_random_init);
    return NmRestartWasmResult.__wrap(ret);
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_debug_string_edece8177ad01481: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_is_function_5cd60d5cf78b4eef: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_object_b4593df85baada48: function(arg0) {
            const val = arg0;
            const ret = typeof(val) === 'object' && val !== null;
            return ret;
        },
        __wbg___wbindgen_is_string_dde0fd9020db4434: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_35bb9f4c7fd651d5: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_string_get_d109740c0d18f4d7: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_9c31b086c2b26051: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_call_dfde26266607c996: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_crypto_b9be447aa422134f: function(arg0) {
            const ret = arg0.crypto;
            return ret;
        },
        __wbg_error_a6fa202b58aa1cd3: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_getRandomValues_57f4e4df7a423812: function() { return handleError(function (arg0, arg1) {
            arg0.getRandomValues(arg1);
        }, arguments); },
        __wbg_get_dcf82ab8aad1a593: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_length_56fcd3e2b7e0299d: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_log_eb752234eec406d1: function(arg0) {
            console.log(arg0);
        },
        __wbg_msCrypto_99c672bc62a82892: function(arg0) {
            const ret = arg0.msCrypto;
            return ret;
        },
        __wbg_new_227d7c05414eb861: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_new_with_length_99887c91eae4abab: function(arg0) {
            const ret = new Uint8Array(arg0 >>> 0);
            return ret;
        },
        __wbg_node_ac5a354e22181b95: function(arg0) {
            const ret = arg0.node;
            return ret;
        },
        __wbg_now_3cd905700d21a70b: function(arg0) {
            const ret = arg0.now();
            return ret;
        },
        __wbg_parse_802d5ccafd064a6e: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                const ret = JSON.parse(getStringFromWasm0(arg0, arg1));
                return ret;
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_process_99502ff594d66db2: function(arg0) {
            const ret = arg0.process;
            return ret;
        },
        __wbg_prototypesetcall_5f9bdc8d75e07276: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_randomFillSync_c30a6c2d3e809182: function() { return handleError(function (arg0, arg1) {
            arg0.randomFillSync(arg1);
        }, arguments); },
        __wbg_require_ceb6837efca524c5: function() { return handleError(function () {
            const ret = module.require;
            return ret;
        }, arguments); },
        __wbg_stack_3b0d974bbf31e44f: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_static_accessor_GLOBAL_THIS_02344c9b09eb08a9: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_ac6d4ac874d5cd54: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_9b2406c23aeb2023: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_b34d2126934e16ba: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_subarray_7c6a0da8f3b4a1ba: function(arg0, arg1, arg2) {
            const ret = arg0.subarray(arg1 >>> 0, arg2 >>> 0);
            return ret;
        },
        __wbg_versions_4f6b17dcf04db054: function(arg0) {
            const ret = arg0.versions;
            return ret;
        },
        __wbindgen_cast_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(Slice(U8)) -> NamedExternref("Uint8Array")`.
            const ret = getArrayU8FromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./psudo_bg.js": import0,
    };
}

const NmRestartWasmResultFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_nmrestartwasmresult_free(ptr, 1));
(typeof FinalizationRegistry === 'undefined')
    ? { }
    : new FinalizationRegistry(ptr => wasm.__wbg_optimizemetricsresult_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint16ArrayMemory0 = null;
function getUint16ArrayMemory0() {
    if (cachedUint16ArrayMemory0 === null || cachedUint16ArrayMemory0.byteLength === 0) {
        cachedUint16ArrayMemory0 = new Uint16Array(wasm.memory.buffer);
    }
    return cachedUint16ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray16ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 2, 2) >>> 0;
    getUint16ArrayMemory0().set(arg, ptr / 2);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    for (let i = 0; i < array.length; i++) {
        const add = addToExternrefTable0(array[i]);
        getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedUint16ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path);
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead');
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL(""+new URL('psudo_bg-CAWdwn8a.wasm', import.meta.url).href+"", import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance);
}

/**
 * Module worker: loads WASM once and runs psudo exports off the main thread.
 */

let readyPromise;

function ensureReady() {
  if (!readyPromise) readyPromise = __wbg_init();
  return readyPromise;
}

function cloneFloat32(src) {
  const out = new Float32Array(src.length);
  out.set(src);
  return out;
}

function packResult(result) {
  if (result instanceof Float32Array) {
    const copy = cloneFloat32(result);
    return { result: copy, transfer: [copy.buffer] };
  }
  return { result, transfer: [] };
}

function packNmRestart(result) {
  const oklab = cloneFloat32(result.oklab);
  return {
    result: {
      oklab,
      total: result.total,
      min_display_rgb_distance: result.min_display_rgb_distance,
    },
    transfer: [oklab.buffer],
  };
}

self.onmessage = async (event) => {
  const { id, method, args } = event.data;
  try {
    await ensureReady();
    let result;
    switch (method) {
      case "warmup":
        result = true;
        break;
      case "optimize":
        result = optimize(
          args[0],
          args[1],
          args[2],
          args[3],
          args[4],
          args[5],
          args[6],
          args[7],
          args[8],
          args[9],
          args[10]
        );
        break;
      case "nmRestart":
        result = run_nm_restart(
          args[0],
          args[1],
          args[2],
          args[3],
          args[4],
          args[5],
          args[6],
          args[7],
          args[8],
          args[9],
          args[10],
          args[11],
          args[12]
        );
        break;
      case "finalizePalette":
        result = finalize_palette_optimize(
          args[0],
          args[1],
          args[2],
          args[3],
          args[4],
          args[5],
          args[6],
          args[7],
          args[8],
          args[9],
          args[10]
        );
        break;
      case "calculate_palette_loss":
        result = calculate_palette_loss(
          args[0],
          args[1],
          args[2],
          args[3],
          args[4],
          args[5],
          args[6]
        );
        break;
      case "optimize_in_lens":
        result = optimize_in_lens(args[0], args[1], args[2], args[3]);
        break;
      case "channel_gmm":
        result = channel_gmm(args[0]);
        break;
      case "ln":
        result = ln(args[0]);
        break;
      default:
        throw new Error(`unknown psudo worker method: ${method}`);
    }
    const packed =
      method === "nmRestart" ? packNmRestart(result) : packResult(result);
    self.postMessage({ id, ok: true, result: packed.result }, packed.transfer);
  } catch (err) {
    self.postMessage({
      id,
      ok: false,
      error: err?.message ? String(err.message) : String(err),
    });
  }
};
