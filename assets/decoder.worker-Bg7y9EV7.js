let BaseDecoder;
let __tla = (async ()=>{
    const registry = new Map();
    const preferWorkerMap = new Map();
    function addDecoder(cases, importFn, preferWorker_ = true) {
        if (!Array.isArray(cases)) {
            cases = [
                cases
            ];
        }
        cases.forEach((c)=>{
            registry.set(c, importFn);
            preferWorkerMap.set(c, preferWorker_);
        });
    }
    async function getDecoder(fileDirectory) {
        const importFn = registry.get(fileDirectory.Compression);
        if (!importFn) {
            throw new Error(`Unknown compression method identifier: ${fileDirectory.Compression}`);
        }
        const Decoder = await importFn();
        return new Decoder(fileDirectory);
    }
    addDecoder([
        undefined,
        1
    ], ()=>import('./raw-C840hFpd.js').then((m)=>m.default), false);
    addDecoder(5, ()=>import('./lzw-BM79gN-F.js').then((m)=>m.default));
    addDecoder(6, ()=>{
        throw new Error('old style JPEG compression is not supported.');
    });
    addDecoder(7, ()=>import('./jpeg-ClEdF0pP.js').then((m)=>m.default));
    addDecoder([
        8,
        32946
    ], ()=>import('./deflate-DctsEs35.js').then((m)=>m.default));
    addDecoder(32773, ()=>import('./packbits-DLixJnFz.js').then((m)=>m.default));
    addDecoder(34887, ()=>import('./lerc-DkhdKyKj.js').then(async (m)=>{
            await m.zstd.init();
            return m;
        }).then((m)=>m.default));
    addDecoder(50000, ()=>import('./zstd-jb_Fhn4p.js').then(async (m)=>{
            await m.zstd.init();
            return m;
        }).then((m)=>m.default));
    addDecoder(50001, ()=>import('./webimage-BwHk5OfR.js').then((m)=>m.default), false);
    function decodeRowAcc(row, stride) {
        let length = row.length - stride;
        let offset = 0;
        do {
            for(let i = stride; i > 0; i--){
                row[offset + stride] += row[offset];
                offset++;
            }
            length -= stride;
        }while (length > 0);
    }
    function decodeRowFloatingPoint(row, stride, bytesPerSample) {
        let index = 0;
        let count = row.length;
        const wc = count / bytesPerSample;
        while(count > stride){
            for(let i = stride; i > 0; --i){
                row[index + stride] += row[index];
                ++index;
            }
            count -= stride;
        }
        const copy = row.slice();
        for(let i = 0; i < wc; ++i){
            for(let b = 0; b < bytesPerSample; ++b){
                row[(bytesPerSample * i) + b] = copy[((bytesPerSample - b - 1) * wc) + i];
            }
        }
    }
    function applyPredictor(block, predictor, width, height, bitsPerSample, planarConfiguration) {
        if (predictor === 1) {
            return block;
        }
        for(let i = 0; i < bitsPerSample.length; ++i){
            if (bitsPerSample[i] % 8 !== 0) {
                throw new Error('When decoding with predictor, only multiple of 8 bits are supported.');
            }
            if (bitsPerSample[i] !== bitsPerSample[0]) {
                throw new Error('When decoding with predictor, all samples must have the same size.');
            }
        }
        const bytesPerSample = bitsPerSample[0] / 8;
        const stride = planarConfiguration === 2 ? 1 : bitsPerSample.length;
        for(let i = 0; i < height; ++i){
            if (i * stride * width * bytesPerSample >= block.byteLength) {
                break;
            }
            let row;
            if (predictor === 2) {
                switch(bitsPerSample[0]){
                    case 8:
                        row = new Uint8Array(block, i * stride * width * bytesPerSample, stride * width * bytesPerSample);
                        break;
                    case 16:
                        row = new Uint16Array(block, i * stride * width * bytesPerSample, stride * width * bytesPerSample / 2);
                        break;
                    case 32:
                        row = new Uint32Array(block, i * stride * width * bytesPerSample, stride * width * bytesPerSample / 4);
                        break;
                    default:
                        throw new Error(`Predictor 2 not allowed with ${bitsPerSample[0]} bits per sample.`);
                }
                decodeRowAcc(row, stride);
            } else if (predictor === 3) {
                row = new Uint8Array(block, i * stride * width * bytesPerSample, stride * width * bytesPerSample);
                decodeRowFloatingPoint(row, stride, bytesPerSample);
            }
        }
        return block;
    }
    BaseDecoder = class {
        async decode(fileDirectory, buffer) {
            const decoded = await this.decodeBlock(buffer);
            const predictor = fileDirectory.Predictor || 1;
            if (predictor !== 1) {
                const isTiled = !fileDirectory.StripOffsets;
                const tileWidth = isTiled ? fileDirectory.TileWidth : fileDirectory.ImageWidth;
                const tileHeight = isTiled ? fileDirectory.TileLength : (fileDirectory.RowsPerStrip || fileDirectory.ImageLength);
                return applyPredictor(decoded, predictor, tileWidth, tileHeight, fileDirectory.BitsPerSample, fileDirectory.PlanarConfiguration);
            }
            return decoded;
        }
    };
    function expandThroughLut(data, lut) {
        const out = new Uint16Array(data.length);
        for(let i = 0; i < data.length; i++){
            out[i] = lut[data[i] & 255];
        }
        return out;
    }
    function initEmscriptenModule(moduleFactory, wasmModule, moduleOptionOverrides = {}) {
        let instantiateWasm;
        if (wasmModule) {
            instantiateWasm = (imports, callback)=>{
                const instance = new WebAssembly.Instance(wasmModule, imports);
                callback(instance);
                return instance.exports;
            };
        }
        return moduleFactory({
            noInitialRun: true,
            instantiateWasm,
            ...moduleOptionOverrides
        });
    }
    var Module = (()=>{
        var _scriptDir = import.meta.url;
        return (function(moduleArg = {}) {
            var Module = moduleArg;
            var readyPromiseResolve, readyPromiseReject;
            var readyPromise = new Promise((resolve, reject)=>{
                readyPromiseResolve = resolve;
                readyPromiseReject = reject;
            });
            const isServiceWorker = globalThis.ServiceWorkerGlobalScope !== undefined;
            const isRunningInCloudFlareWorkers = isServiceWorker && typeof self !== "undefined" && globalThis.caches && globalThis.caches.default !== undefined;
            const isRunningInNode = typeof process === "object" && process.release && process.release.name === "node";
            if (isRunningInCloudFlareWorkers || isRunningInNode) {
                if (!globalThis.ImageData) {
                    globalThis.ImageData = class ImageData {
                        constructor(data, width, height){
                            this.data = data;
                            this.width = width;
                            this.height = height;
                        }
                    };
                }
                if (import.meta.url === undefined) {
                    import.meta.url = "https://localhost";
                }
                if (typeof self !== "undefined" && self.location === undefined) {
                    self.location = {
                        href: ""
                    };
                }
            }
            var moduleOverrides = Object.assign({}, Module);
            var thisProgram = "./this.program";
            var quit_ = (status, toThrow)=>{
                throw toThrow;
            };
            var ENVIRONMENT_IS_WEB = typeof window == "object";
            var ENVIRONMENT_IS_WORKER = typeof importScripts == "function";
            typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string";
            var scriptDirectory = "";
            function locateFile(path) {
                if (Module["locateFile"]) {
                    return Module["locateFile"](path, scriptDirectory);
                }
                return scriptDirectory + path;
            }
            var readBinary;
            if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
                if (ENVIRONMENT_IS_WORKER) {
                    scriptDirectory = self.location.href;
                } else if (typeof document != "undefined" && document.currentScript) {
                    scriptDirectory = document.currentScript.src;
                }
                if (_scriptDir) {
                    scriptDirectory = _scriptDir;
                }
                if (scriptDirectory.startsWith("blob:")) {
                    scriptDirectory = "";
                } else {
                    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
                }
                {
                    if (ENVIRONMENT_IS_WORKER) {
                        readBinary = (url)=>{
                            var xhr = new XMLHttpRequest;
                            xhr.open("GET", url, false);
                            xhr.responseType = "arraybuffer";
                            xhr.send(null);
                            return new Uint8Array(xhr.response);
                        };
                    }
                }
            }
            var out = Module["print"] || console.log.bind(console);
            var err = Module["printErr"] || console.error.bind(console);
            Object.assign(Module, moduleOverrides);
            moduleOverrides = null;
            if (Module["arguments"]) Module["arguments"];
            if (Module["thisProgram"]) thisProgram = Module["thisProgram"];
            if (Module["quit"]) quit_ = Module["quit"];
            var wasmBinary;
            if (Module["wasmBinary"]) wasmBinary = Module["wasmBinary"];
            var wasmMemory;
            var ABORT = false;
            var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
            function updateMemoryViews() {
                var b = wasmMemory.buffer;
                Module["HEAP8"] = HEAP8 = new Int8Array(b);
                Module["HEAP16"] = HEAP16 = new Int16Array(b);
                Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
                Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
                Module["HEAP32"] = HEAP32 = new Int32Array(b);
                Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
                Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
                Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
            }
            var __ATPRERUN__ = [];
            var __ATINIT__ = [];
            var __ATPOSTRUN__ = [];
            function preRun() {
                if (Module["preRun"]) {
                    if (typeof Module["preRun"] == "function") Module["preRun"] = [
                        Module["preRun"]
                    ];
                    while(Module["preRun"].length){
                        addOnPreRun(Module["preRun"].shift());
                    }
                }
                callRuntimeCallbacks(__ATPRERUN__);
            }
            function initRuntime() {
                callRuntimeCallbacks(__ATINIT__);
            }
            function postRun() {
                if (Module["postRun"]) {
                    if (typeof Module["postRun"] == "function") Module["postRun"] = [
                        Module["postRun"]
                    ];
                    while(Module["postRun"].length){
                        addOnPostRun(Module["postRun"].shift());
                    }
                }
                callRuntimeCallbacks(__ATPOSTRUN__);
            }
            function addOnPreRun(cb) {
                __ATPRERUN__.unshift(cb);
            }
            function addOnInit(cb) {
                __ATINIT__.unshift(cb);
            }
            function addOnPostRun(cb) {
                __ATPOSTRUN__.unshift(cb);
            }
            var runDependencies = 0;
            var dependenciesFulfilled = null;
            function addRunDependency(id) {
                runDependencies++;
                Module["monitorRunDependencies"]?.(runDependencies);
            }
            function removeRunDependency(id) {
                runDependencies--;
                Module["monitorRunDependencies"]?.(runDependencies);
                if (runDependencies == 0) {
                    if (dependenciesFulfilled) {
                        var callback = dependenciesFulfilled;
                        dependenciesFulfilled = null;
                        callback();
                    }
                }
            }
            function abort(what) {
                Module["onAbort"]?.(what);
                what = "Aborted(" + what + ")";
                err(what);
                ABORT = true;
                what += ". Build with -sASSERTIONS for more info.";
                var e = new WebAssembly.RuntimeError(what);
                readyPromiseReject(e);
                throw e;
            }
            var dataURIPrefix = "data:application/octet-stream;base64,";
            var isDataURI = (filename)=>filename.startsWith(dataURIPrefix);
            var wasmBinaryFile;
            if (Module["locateFile"]) {
                wasmBinaryFile = "mozjpeg_dec.wasm";
                if (!isDataURI(wasmBinaryFile)) {
                    wasmBinaryFile = locateFile(wasmBinaryFile);
                }
            } else {
                wasmBinaryFile = new URL("" + new URL('mozjpeg_dec-muSO2n8T.wasm', import.meta.url).href + "", import.meta.url).href;
            }
            function getBinarySync(file) {
                if (file == wasmBinaryFile && wasmBinary) {
                    return new Uint8Array(wasmBinary);
                }
                if (readBinary) {
                    return readBinary(file);
                }
                throw "both async and sync fetching of the wasm failed";
            }
            function getBinaryPromise(binaryFile) {
                if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
                    if (typeof fetch == "function") {
                        return fetch(binaryFile, {
                            credentials: "same-origin"
                        }).then((response)=>{
                            if (!response["ok"]) {
                                throw `failed to load wasm binary file at '${binaryFile}'`;
                            }
                            return response["arrayBuffer"]();
                        }).catch(()=>getBinarySync(binaryFile));
                    }
                }
                return Promise.resolve().then(()=>getBinarySync(binaryFile));
            }
            function instantiateArrayBuffer(binaryFile, imports, receiver) {
                return getBinaryPromise(binaryFile).then((binary)=>WebAssembly.instantiate(binary, imports)).then(receiver, (reason)=>{
                    err(`failed to asynchronously prepare wasm: ${reason}`);
                    abort(reason);
                });
            }
            function instantiateAsync(binary, binaryFile, imports, callback) {
                if (!binary && typeof WebAssembly.instantiateStreaming == "function" && !isDataURI(binaryFile) && typeof fetch == "function") {
                    return fetch(binaryFile, {
                        credentials: "same-origin"
                    }).then((response)=>{
                        var result = WebAssembly.instantiateStreaming(response, imports);
                        return result.then(callback, function(reason) {
                            err(`wasm streaming compile failed: ${reason}`);
                            err("falling back to ArrayBuffer instantiation");
                            return instantiateArrayBuffer(binaryFile, imports, callback);
                        });
                    });
                }
                return instantiateArrayBuffer(binaryFile, imports, callback);
            }
            function createWasm() {
                var info = {
                    "a": wasmImports
                };
                function receiveInstance(instance, module) {
                    wasmExports = instance.exports;
                    wasmMemory = wasmExports["A"];
                    updateMemoryViews();
                    wasmTable = wasmExports["F"];
                    addOnInit(wasmExports["B"]);
                    removeRunDependency();
                    return wasmExports;
                }
                addRunDependency();
                function receiveInstantiationResult(result) {
                    receiveInstance(result["instance"]);
                }
                if (Module["instantiateWasm"]) {
                    try {
                        return Module["instantiateWasm"](info, receiveInstance);
                    } catch (e) {
                        err(`Module.instantiateWasm callback failed with error: ${e}`);
                        readyPromiseReject(e);
                    }
                }
                instantiateAsync(wasmBinary, wasmBinaryFile, info, receiveInstantiationResult).catch(readyPromiseReject);
                return {};
            }
            function ExitStatus(status) {
                this.name = "ExitStatus";
                this.message = `Program terminated with exit(${status})`;
                this.status = status;
            }
            var callRuntimeCallbacks = (callbacks)=>{
                while(callbacks.length > 0){
                    callbacks.shift()(Module);
                }
            };
            Module["noExitRuntime"] || true;
            class ExceptionInfo {
                constructor(excPtr){
                    this.excPtr = excPtr;
                    this.ptr = excPtr - 24;
                }
                set_type(type) {
                    HEAPU32[this.ptr + 4 >> 2] = type;
                }
                get_type() {
                    return HEAPU32[this.ptr + 4 >> 2];
                }
                set_destructor(destructor) {
                    HEAPU32[this.ptr + 8 >> 2] = destructor;
                }
                get_destructor() {
                    return HEAPU32[this.ptr + 8 >> 2];
                }
                set_caught(caught) {
                    caught = caught ? 1 : 0;
                    HEAP8[this.ptr + 12] = caught;
                }
                get_caught() {
                    return HEAP8[this.ptr + 12] != 0;
                }
                set_rethrown(rethrown) {
                    rethrown = rethrown ? 1 : 0;
                    HEAP8[this.ptr + 13] = rethrown;
                }
                get_rethrown() {
                    return HEAP8[this.ptr + 13] != 0;
                }
                init(type, destructor) {
                    this.set_adjusted_ptr(0);
                    this.set_type(type);
                    this.set_destructor(destructor);
                }
                set_adjusted_ptr(adjustedPtr) {
                    HEAPU32[this.ptr + 16 >> 2] = adjustedPtr;
                }
                get_adjusted_ptr() {
                    return HEAPU32[this.ptr + 16 >> 2];
                }
                get_exception_ptr() {
                    var isPointer = ___cxa_is_pointer_type(this.get_type());
                    if (isPointer) {
                        return HEAPU32[this.excPtr >> 2];
                    }
                    var adjusted = this.get_adjusted_ptr();
                    if (adjusted !== 0) return adjusted;
                    return this.excPtr;
                }
            }
            var exceptionLast = 0;
            var ___cxa_throw = (ptr, type, destructor)=>{
                var info = new ExceptionInfo(ptr);
                info.init(type, destructor);
                exceptionLast = ptr;
                throw exceptionLast;
            };
            var __embind_register_bigint = (primitiveType, name, size, minRange, maxRange)=>{};
            var embind_init_charCodes = ()=>{
                var codes = new Array(256);
                for(var i = 0; i < 256; ++i){
                    codes[i] = String.fromCharCode(i);
                }
                embind_charCodes = codes;
            };
            var embind_charCodes;
            var readLatin1String = (ptr)=>{
                var ret = "";
                var c = ptr;
                while(HEAPU8[c]){
                    ret += embind_charCodes[HEAPU8[c++]];
                }
                return ret;
            };
            var awaitingDependencies = {};
            var registeredTypes = {};
            var typeDependencies = {};
            var BindingError;
            var throwBindingError = (message)=>{
                throw new BindingError(message);
            };
            var InternalError;
            var throwInternalError = (message)=>{
                throw new InternalError(message);
            };
            var whenDependentTypesAreResolved = (myTypes, dependentTypes, getTypeConverters)=>{
                myTypes.forEach(function(type) {
                    typeDependencies[type] = dependentTypes;
                });
                function onComplete(typeConverters) {
                    var myTypeConverters = getTypeConverters(typeConverters);
                    if (myTypeConverters.length !== myTypes.length) {
                        throwInternalError("Mismatched type converter count");
                    }
                    for(var i = 0; i < myTypes.length; ++i){
                        registerType(myTypes[i], myTypeConverters[i]);
                    }
                }
                var typeConverters = new Array(dependentTypes.length);
                var unregisteredTypes = [];
                var registered = 0;
                dependentTypes.forEach((dt, i)=>{
                    if (registeredTypes.hasOwnProperty(dt)) {
                        typeConverters[i] = registeredTypes[dt];
                    } else {
                        unregisteredTypes.push(dt);
                        if (!awaitingDependencies.hasOwnProperty(dt)) {
                            awaitingDependencies[dt] = [];
                        }
                        awaitingDependencies[dt].push(()=>{
                            typeConverters[i] = registeredTypes[dt];
                            ++registered;
                            if (registered === unregisteredTypes.length) {
                                onComplete(typeConverters);
                            }
                        });
                    }
                });
                if (0 === unregisteredTypes.length) {
                    onComplete(typeConverters);
                }
            };
            function sharedRegisterType(rawType, registeredInstance, options = {}) {
                var name = registeredInstance.name;
                if (!rawType) {
                    throwBindingError(`type "${name}" must have a positive integer typeid pointer`);
                }
                if (registeredTypes.hasOwnProperty(rawType)) {
                    if (options.ignoreDuplicateRegistrations) {
                        return;
                    } else {
                        throwBindingError(`Cannot register type '${name}' twice`);
                    }
                }
                registeredTypes[rawType] = registeredInstance;
                delete typeDependencies[rawType];
                if (awaitingDependencies.hasOwnProperty(rawType)) {
                    var callbacks = awaitingDependencies[rawType];
                    delete awaitingDependencies[rawType];
                    callbacks.forEach((cb)=>cb());
                }
            }
            function registerType(rawType, registeredInstance, options = {}) {
                if (!("argPackAdvance" in registeredInstance)) {
                    throw new TypeError("registerType registeredInstance requires argPackAdvance");
                }
                return sharedRegisterType(rawType, registeredInstance, options);
            }
            var GenericWireTypeSize = 8;
            var __embind_register_bool = (rawType, name, trueValue, falseValue)=>{
                name = readLatin1String(name);
                registerType(rawType, {
                    name: name,
                    "fromWireType": function(wt) {
                        return !!wt;
                    },
                    "toWireType": function(destructors, o) {
                        return o ? trueValue : falseValue;
                    },
                    "argPackAdvance": GenericWireTypeSize,
                    "readValueFromPointer": function(pointer) {
                        return this["fromWireType"](HEAPU8[pointer]);
                    },
                    destructorFunction: null
                });
            };
            var emval_freelist = [];
            var emval_handles = [];
            var __emval_decref = (handle)=>{
                if (handle > 9 && 0 === --emval_handles[handle + 1]) {
                    emval_handles[handle] = undefined;
                    emval_freelist.push(handle);
                }
            };
            var count_emval_handles = ()=>emval_handles.length / 2 - 5 - emval_freelist.length;
            var init_emval = ()=>{
                emval_handles.push(0, 1, undefined, 1, null, 1, true, 1, false, 1);
                Module["count_emval_handles"] = count_emval_handles;
            };
            var Emval = {
                toValue: (handle)=>{
                    if (!handle) {
                        throwBindingError("Cannot use deleted val. handle = " + handle);
                    }
                    return emval_handles[handle];
                },
                toHandle: (value)=>{
                    switch(value){
                        case undefined:
                            return 2;
                        case null:
                            return 4;
                        case true:
                            return 6;
                        case false:
                            return 8;
                        default:
                            {
                                const handle = emval_freelist.pop() || emval_handles.length;
                                emval_handles[handle] = value;
                                emval_handles[handle + 1] = 1;
                                return handle;
                            }
                    }
                }
            };
            function readPointer(pointer) {
                return this["fromWireType"](HEAPU32[pointer >> 2]);
            }
            var EmValType = {
                name: "emscripten::val",
                "fromWireType": (handle)=>{
                    var rv = Emval.toValue(handle);
                    __emval_decref(handle);
                    return rv;
                },
                "toWireType": (destructors, value)=>Emval.toHandle(value),
                "argPackAdvance": GenericWireTypeSize,
                "readValueFromPointer": readPointer,
                destructorFunction: null
            };
            var __embind_register_emval = (rawType)=>registerType(rawType, EmValType);
            var floatReadValueFromPointer = (name, width)=>{
                switch(width){
                    case 4:
                        return function(pointer) {
                            return this["fromWireType"](HEAPF32[pointer >> 2]);
                        };
                    case 8:
                        return function(pointer) {
                            return this["fromWireType"](HEAPF64[pointer >> 3]);
                        };
                    default:
                        throw new TypeError(`invalid float width (${width}): ${name}`);
                }
            };
            var __embind_register_float = (rawType, name, size)=>{
                name = readLatin1String(name);
                registerType(rawType, {
                    name: name,
                    "fromWireType": (value)=>value,
                    "toWireType": (destructors, value)=>value,
                    "argPackAdvance": GenericWireTypeSize,
                    "readValueFromPointer": floatReadValueFromPointer(name, size),
                    destructorFunction: null
                });
            };
            var createNamedFunction = (name, body)=>Object.defineProperty(body, "name", {
                    value: name
                });
            var runDestructors = (destructors)=>{
                while(destructors.length){
                    var ptr = destructors.pop();
                    var del = destructors.pop();
                    del(ptr);
                }
            };
            function usesDestructorStack(argTypes) {
                for(var i = 1; i < argTypes.length; ++i){
                    if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) {
                        return true;
                    }
                }
                return false;
            }
            function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc, isAsync) {
                var argCount = argTypes.length;
                if (argCount < 2) {
                    throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
                }
                argTypes[1] !== null && classType !== null;
                var needsDestructorStack = usesDestructorStack(argTypes);
                var returns = argTypes[0].name !== "void";
                var expectedArgCount = argCount - 2;
                var argsWired = new Array(expectedArgCount);
                var invokerFuncArgs = [];
                var destructors = [];
                var invokerFn = function(...args) {
                    if (args.length !== expectedArgCount) {
                        throwBindingError(`function ${humanName} called with ${args.length} arguments, expected ${expectedArgCount}`);
                    }
                    destructors.length = 0;
                    var thisWired;
                    invokerFuncArgs.length = 1;
                    invokerFuncArgs[0] = cppTargetFunc;
                    for(var i = 0; i < expectedArgCount; ++i){
                        argsWired[i] = argTypes[i + 2]["toWireType"](destructors, args[i]);
                        invokerFuncArgs.push(argsWired[i]);
                    }
                    var rv = cppInvokerFunc(...invokerFuncArgs);
                    function onDone(rv) {
                        if (needsDestructorStack) {
                            runDestructors(destructors);
                        } else {
                            for(var i = 2; i < argTypes.length; i++){
                                var param = i === 1 ? thisWired : argsWired[i - 2];
                                if (argTypes[i].destructorFunction !== null) {
                                    argTypes[i].destructorFunction(param);
                                }
                            }
                        }
                        if (returns) {
                            return argTypes[0]["fromWireType"](rv);
                        }
                    }
                    return onDone(rv);
                };
                return createNamedFunction(humanName, invokerFn);
            }
            var ensureOverloadTable = (proto, methodName, humanName)=>{
                if (undefined === proto[methodName].overloadTable) {
                    var prevFunc = proto[methodName];
                    proto[methodName] = function(...args) {
                        if (!proto[methodName].overloadTable.hasOwnProperty(args.length)) {
                            throwBindingError(`Function '${humanName}' called with an invalid number of arguments (${args.length}) - expects one of (${proto[methodName].overloadTable})!`);
                        }
                        return proto[methodName].overloadTable[args.length].apply(this, args);
                    };
                    proto[methodName].overloadTable = [];
                    proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
                }
            };
            var exposePublicSymbol = (name, value, numArguments)=>{
                if (Module.hasOwnProperty(name)) {
                    if (undefined === numArguments || undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments]) {
                        throwBindingError(`Cannot register public name '${name}' twice`);
                    }
                    ensureOverloadTable(Module, name, name);
                    if (Module.hasOwnProperty(numArguments)) {
                        throwBindingError(`Cannot register multiple overloads of a function with the same number of arguments (${numArguments})!`);
                    }
                    Module[name].overloadTable[numArguments] = value;
                } else {
                    Module[name] = value;
                    if (undefined !== numArguments) {
                        Module[name].numArguments = numArguments;
                    }
                }
            };
            var heap32VectorToArray = (count, firstElement)=>{
                var array = [];
                for(var i = 0; i < count; i++){
                    array.push(HEAPU32[firstElement + i * 4 >> 2]);
                }
                return array;
            };
            var replacePublicSymbol = (name, value, numArguments)=>{
                if (!Module.hasOwnProperty(name)) {
                    throwInternalError("Replacing nonexistent public symbol");
                }
                if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
                    Module[name].overloadTable[numArguments] = value;
                } else {
                    Module[name] = value;
                    Module[name].argCount = numArguments;
                }
            };
            var dynCallLegacy = (sig, ptr, args)=>{
                sig = sig.replace(/p/g, "i");
                var f = Module["dynCall_" + sig];
                return f(ptr, ...args);
            };
            var wasmTableMirror = [];
            var wasmTable;
            var getWasmTableEntry = (funcPtr)=>{
                var func = wasmTableMirror[funcPtr];
                if (!func) {
                    if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
                    wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr);
                }
                return func;
            };
            var dynCall = (sig, ptr, args = [])=>{
                if (sig.includes("j")) {
                    return dynCallLegacy(sig, ptr, args);
                }
                var rtn = getWasmTableEntry(ptr)(...args);
                return rtn;
            };
            var getDynCaller = (sig, ptr)=>(...args)=>dynCall(sig, ptr, args);
            var embind__requireFunction = (signature, rawFunction)=>{
                signature = readLatin1String(signature);
                function makeDynCaller() {
                    if (signature.includes("j")) {
                        return getDynCaller(signature, rawFunction);
                    }
                    return getWasmTableEntry(rawFunction);
                }
                var fp = makeDynCaller();
                if (typeof fp != "function") {
                    throwBindingError(`unknown function pointer with signature ${signature}: ${rawFunction}`);
                }
                return fp;
            };
            var extendError = (baseErrorType, errorName)=>{
                var errorClass = createNamedFunction(errorName, function(message) {
                    this.name = errorName;
                    this.message = message;
                    var stack = new Error(message).stack;
                    if (stack !== undefined) {
                        this.stack = this.toString() + "\n" + stack.replace(/^Error(:[^\n]*)?\n/, "");
                    }
                });
                errorClass.prototype = Object.create(baseErrorType.prototype);
                errorClass.prototype.constructor = errorClass;
                errorClass.prototype.toString = function() {
                    if (this.message === undefined) {
                        return this.name;
                    } else {
                        return `${this.name}: ${this.message}`;
                    }
                };
                return errorClass;
            };
            var UnboundTypeError;
            var getTypeName = (type)=>{
                var ptr = ___getTypeName(type);
                var rv = readLatin1String(ptr);
                _free(ptr);
                return rv;
            };
            var throwUnboundTypeError = (message, types)=>{
                var unboundTypes = [];
                var seen = {};
                function visit(type) {
                    if (seen[type]) {
                        return;
                    }
                    if (registeredTypes[type]) {
                        return;
                    }
                    if (typeDependencies[type]) {
                        typeDependencies[type].forEach(visit);
                        return;
                    }
                    unboundTypes.push(type);
                    seen[type] = true;
                }
                types.forEach(visit);
                throw new UnboundTypeError(`${message}: ` + unboundTypes.map(getTypeName).join([
                    ", "
                ]));
            };
            var getFunctionName = (signature)=>{
                signature = signature.trim();
                const argsIndex = signature.indexOf("(");
                if (argsIndex !== -1) {
                    return signature.substr(0, argsIndex);
                } else {
                    return signature;
                }
            };
            var __embind_register_function = (name, argCount, rawArgTypesAddr, signature, rawInvoker, fn, isAsync)=>{
                var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
                name = readLatin1String(name);
                name = getFunctionName(name);
                rawInvoker = embind__requireFunction(signature, rawInvoker);
                exposePublicSymbol(name, function() {
                    throwUnboundTypeError(`Cannot call ${name} due to unbound types`, argTypes);
                }, argCount - 1);
                whenDependentTypesAreResolved([], argTypes, (argTypes)=>{
                    var invokerArgsArray = [
                        argTypes[0],
                        null
                    ].concat(argTypes.slice(1));
                    replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null, rawInvoker, fn), argCount - 1);
                    return [];
                });
            };
            var integerReadValueFromPointer = (name, width, signed)=>{
                switch(width){
                    case 1:
                        return signed ? (pointer)=>HEAP8[pointer] : (pointer)=>HEAPU8[pointer];
                    case 2:
                        return signed ? (pointer)=>HEAP16[pointer >> 1] : (pointer)=>HEAPU16[pointer >> 1];
                    case 4:
                        return signed ? (pointer)=>HEAP32[pointer >> 2] : (pointer)=>HEAPU32[pointer >> 2];
                    default:
                        throw new TypeError(`invalid integer width (${width}): ${name}`);
                }
            };
            var __embind_register_integer = (primitiveType, name, size, minRange, maxRange)=>{
                name = readLatin1String(name);
                var fromWireType = (value)=>value;
                if (minRange === 0) {
                    var bitshift = 32 - 8 * size;
                    fromWireType = (value)=>value << bitshift >>> bitshift;
                }
                var isUnsignedType = name.includes("unsigned");
                var checkAssertions = (value, toTypeName)=>{};
                var toWireType;
                if (isUnsignedType) {
                    toWireType = function(destructors, value) {
                        checkAssertions(value, this.name);
                        return value >>> 0;
                    };
                } else {
                    toWireType = function(destructors, value) {
                        checkAssertions(value, this.name);
                        return value;
                    };
                }
                registerType(primitiveType, {
                    name: name,
                    "fromWireType": fromWireType,
                    "toWireType": toWireType,
                    "argPackAdvance": GenericWireTypeSize,
                    "readValueFromPointer": integerReadValueFromPointer(name, size, minRange !== 0),
                    destructorFunction: null
                });
            };
            var __embind_register_memory_view = (rawType, dataTypeIndex, name)=>{
                var typeMapping = [
                    Int8Array,
                    Uint8Array,
                    Int16Array,
                    Uint16Array,
                    Int32Array,
                    Uint32Array,
                    Float32Array,
                    Float64Array
                ];
                var TA = typeMapping[dataTypeIndex];
                function decodeMemoryView(handle) {
                    var size = HEAPU32[handle >> 2];
                    var data = HEAPU32[handle + 4 >> 2];
                    return new TA(HEAP8.buffer, data, size);
                }
                name = readLatin1String(name);
                registerType(rawType, {
                    name: name,
                    "fromWireType": decodeMemoryView,
                    "argPackAdvance": GenericWireTypeSize,
                    "readValueFromPointer": decodeMemoryView
                }, {
                    ignoreDuplicateRegistrations: true
                });
            };
            var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite)=>{
                if (!(maxBytesToWrite > 0)) return 0;
                var startIdx = outIdx;
                var endIdx = outIdx + maxBytesToWrite - 1;
                for(var i = 0; i < str.length; ++i){
                    var u = str.charCodeAt(i);
                    if (u >= 55296 && u <= 57343) {
                        var u1 = str.charCodeAt(++i);
                        u = 65536 + ((u & 1023) << 10) | u1 & 1023;
                    }
                    if (u <= 127) {
                        if (outIdx >= endIdx) break;
                        heap[outIdx++] = u;
                    } else if (u <= 2047) {
                        if (outIdx + 1 >= endIdx) break;
                        heap[outIdx++] = 192 | u >> 6;
                        heap[outIdx++] = 128 | u & 63;
                    } else if (u <= 65535) {
                        if (outIdx + 2 >= endIdx) break;
                        heap[outIdx++] = 224 | u >> 12;
                        heap[outIdx++] = 128 | u >> 6 & 63;
                        heap[outIdx++] = 128 | u & 63;
                    } else {
                        if (outIdx + 3 >= endIdx) break;
                        heap[outIdx++] = 240 | u >> 18;
                        heap[outIdx++] = 128 | u >> 12 & 63;
                        heap[outIdx++] = 128 | u >> 6 & 63;
                        heap[outIdx++] = 128 | u & 63;
                    }
                }
                heap[outIdx] = 0;
                return outIdx - startIdx;
            };
            var stringToUTF8 = (str, outPtr, maxBytesToWrite)=>stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
            var lengthBytesUTF8 = (str)=>{
                var len = 0;
                for(var i = 0; i < str.length; ++i){
                    var c = str.charCodeAt(i);
                    if (c <= 127) {
                        len++;
                    } else if (c <= 2047) {
                        len += 2;
                    } else if (c >= 55296 && c <= 57343) {
                        len += 4;
                        ++i;
                    } else {
                        len += 3;
                    }
                }
                return len;
            };
            var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead)=>{
                var endIdx = idx + maxBytesToRead;
                var str = "";
                while(!(idx >= endIdx)){
                    var u0 = heapOrArray[idx++];
                    if (!u0) return str;
                    if (!(u0 & 128)) {
                        str += String.fromCharCode(u0);
                        continue;
                    }
                    var u1 = heapOrArray[idx++] & 63;
                    if ((u0 & 224) == 192) {
                        str += String.fromCharCode((u0 & 31) << 6 | u1);
                        continue;
                    }
                    var u2 = heapOrArray[idx++] & 63;
                    if ((u0 & 240) == 224) {
                        u0 = (u0 & 15) << 12 | u1 << 6 | u2;
                    } else {
                        u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heapOrArray[idx++] & 63;
                    }
                    if (u0 < 65536) {
                        str += String.fromCharCode(u0);
                    } else {
                        var ch = u0 - 65536;
                        str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
                    }
                }
                return str;
            };
            var UTF8ToString = (ptr, maxBytesToRead)=>ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
            var __embind_register_std_string = (rawType, name)=>{
                name = readLatin1String(name);
                var stdStringIsUTF8 = name === "std::string";
                registerType(rawType, {
                    name: name,
                    "fromWireType" (value) {
                        var length = HEAPU32[value >> 2];
                        var payload = value + 4;
                        var str;
                        if (stdStringIsUTF8) {
                            var decodeStartPtr = payload;
                            for(var i = 0; i <= length; ++i){
                                var currentBytePtr = payload + i;
                                if (i == length || HEAPU8[currentBytePtr] == 0) {
                                    var maxRead = currentBytePtr - decodeStartPtr;
                                    var stringSegment = UTF8ToString(decodeStartPtr, maxRead);
                                    if (str === undefined) {
                                        str = stringSegment;
                                    } else {
                                        str += String.fromCharCode(0);
                                        str += stringSegment;
                                    }
                                    decodeStartPtr = currentBytePtr + 1;
                                }
                            }
                        } else {
                            var a = new Array(length);
                            for(var i = 0; i < length; ++i){
                                a[i] = String.fromCharCode(HEAPU8[payload + i]);
                            }
                            str = a.join("");
                        }
                        _free(value);
                        return str;
                    },
                    "toWireType" (destructors, value) {
                        if (value instanceof ArrayBuffer) {
                            value = new Uint8Array(value);
                        }
                        var length;
                        var valueIsOfTypeString = typeof value == "string";
                        if (!(valueIsOfTypeString || value instanceof Uint8Array || value instanceof Uint8ClampedArray || value instanceof Int8Array)) {
                            throwBindingError("Cannot pass non-string to std::string");
                        }
                        if (stdStringIsUTF8 && valueIsOfTypeString) {
                            length = lengthBytesUTF8(value);
                        } else {
                            length = value.length;
                        }
                        var base = _malloc(4 + length + 1);
                        var ptr = base + 4;
                        HEAPU32[base >> 2] = length;
                        if (stdStringIsUTF8 && valueIsOfTypeString) {
                            stringToUTF8(value, ptr, length + 1);
                        } else {
                            if (valueIsOfTypeString) {
                                for(var i = 0; i < length; ++i){
                                    var charCode = value.charCodeAt(i);
                                    if (charCode > 255) {
                                        _free(ptr);
                                        throwBindingError("String has UTF-16 code units that do not fit in 8 bits");
                                    }
                                    HEAPU8[ptr + i] = charCode;
                                }
                            } else {
                                for(var i = 0; i < length; ++i){
                                    HEAPU8[ptr + i] = value[i];
                                }
                            }
                        }
                        if (destructors !== null) {
                            destructors.push(_free, base);
                        }
                        return base;
                    },
                    "argPackAdvance": GenericWireTypeSize,
                    "readValueFromPointer": readPointer,
                    destructorFunction (ptr) {
                        _free(ptr);
                    }
                });
            };
            var UTF16ToString = (ptr, maxBytesToRead)=>{
                var str = "";
                for(var i = 0; !(i >= maxBytesToRead / 2); ++i){
                    var codeUnit = HEAP16[ptr + i * 2 >> 1];
                    if (codeUnit == 0) break;
                    str += String.fromCharCode(codeUnit);
                }
                return str;
            };
            var stringToUTF16 = (str, outPtr, maxBytesToWrite)=>{
                maxBytesToWrite ??= 2147483647;
                if (maxBytesToWrite < 2) return 0;
                maxBytesToWrite -= 2;
                var startPtr = outPtr;
                var numCharsToWrite = maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
                for(var i = 0; i < numCharsToWrite; ++i){
                    var codeUnit = str.charCodeAt(i);
                    HEAP16[outPtr >> 1] = codeUnit;
                    outPtr += 2;
                }
                HEAP16[outPtr >> 1] = 0;
                return outPtr - startPtr;
            };
            var lengthBytesUTF16 = (str)=>str.length * 2;
            var UTF32ToString = (ptr, maxBytesToRead)=>{
                var i = 0;
                var str = "";
                while(!(i >= maxBytesToRead / 4)){
                    var utf32 = HEAP32[ptr + i * 4 >> 2];
                    if (utf32 == 0) break;
                    ++i;
                    if (utf32 >= 65536) {
                        var ch = utf32 - 65536;
                        str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023);
                    } else {
                        str += String.fromCharCode(utf32);
                    }
                }
                return str;
            };
            var stringToUTF32 = (str, outPtr, maxBytesToWrite)=>{
                maxBytesToWrite ??= 2147483647;
                if (maxBytesToWrite < 4) return 0;
                var startPtr = outPtr;
                var endPtr = startPtr + maxBytesToWrite - 4;
                for(var i = 0; i < str.length; ++i){
                    var codeUnit = str.charCodeAt(i);
                    if (codeUnit >= 55296 && codeUnit <= 57343) {
                        var trailSurrogate = str.charCodeAt(++i);
                        codeUnit = 65536 + ((codeUnit & 1023) << 10) | trailSurrogate & 1023;
                    }
                    HEAP32[outPtr >> 2] = codeUnit;
                    outPtr += 4;
                    if (outPtr + 4 > endPtr) break;
                }
                HEAP32[outPtr >> 2] = 0;
                return outPtr - startPtr;
            };
            var lengthBytesUTF32 = (str)=>{
                var len = 0;
                for(var i = 0; i < str.length; ++i){
                    var codeUnit = str.charCodeAt(i);
                    if (codeUnit >= 55296 && codeUnit <= 57343) ++i;
                    len += 4;
                }
                return len;
            };
            var __embind_register_std_wstring = (rawType, charSize, name)=>{
                name = readLatin1String(name);
                var decodeString, encodeString, readCharAt, lengthBytesUTF;
                if (charSize === 2) {
                    decodeString = UTF16ToString;
                    encodeString = stringToUTF16;
                    lengthBytesUTF = lengthBytesUTF16;
                    readCharAt = (pointer)=>HEAPU16[pointer >> 1];
                } else if (charSize === 4) {
                    decodeString = UTF32ToString;
                    encodeString = stringToUTF32;
                    lengthBytesUTF = lengthBytesUTF32;
                    readCharAt = (pointer)=>HEAPU32[pointer >> 2];
                }
                registerType(rawType, {
                    name: name,
                    "fromWireType": (value)=>{
                        var length = HEAPU32[value >> 2];
                        var str;
                        var decodeStartPtr = value + 4;
                        for(var i = 0; i <= length; ++i){
                            var currentBytePtr = value + 4 + i * charSize;
                            if (i == length || readCharAt(currentBytePtr) == 0) {
                                var maxReadBytes = currentBytePtr - decodeStartPtr;
                                var stringSegment = decodeString(decodeStartPtr, maxReadBytes);
                                if (str === undefined) {
                                    str = stringSegment;
                                } else {
                                    str += String.fromCharCode(0);
                                    str += stringSegment;
                                }
                                decodeStartPtr = currentBytePtr + charSize;
                            }
                        }
                        _free(value);
                        return str;
                    },
                    "toWireType": (destructors, value)=>{
                        if (!(typeof value == "string")) {
                            throwBindingError(`Cannot pass non-string to C++ string type ${name}`);
                        }
                        var length = lengthBytesUTF(value);
                        var ptr = _malloc(4 + length + charSize);
                        HEAPU32[ptr >> 2] = length / charSize;
                        encodeString(value, ptr + 4, length + charSize);
                        if (destructors !== null) {
                            destructors.push(_free, ptr);
                        }
                        return ptr;
                    },
                    "argPackAdvance": GenericWireTypeSize,
                    "readValueFromPointer": readPointer,
                    destructorFunction (ptr) {
                        _free(ptr);
                    }
                });
            };
            var __embind_register_void = (rawType, name)=>{
                name = readLatin1String(name);
                registerType(rawType, {
                    isVoid: true,
                    name: name,
                    "argPackAdvance": 0,
                    "fromWireType": ()=>undefined,
                    "toWireType": (destructors, o)=>undefined
                });
            };
            var __emscripten_memcpy_js = (dest, src, num)=>HEAPU8.copyWithin(dest, src, src + num);
            var emval_methodCallers = [];
            var __emval_call = (caller, handle, destructorsRef, args)=>{
                caller = emval_methodCallers[caller];
                handle = Emval.toValue(handle);
                return caller(null, handle, destructorsRef, args);
            };
            var emval_symbols = {};
            var getStringOrSymbol = (address)=>{
                var symbol = emval_symbols[address];
                if (symbol === undefined) {
                    return readLatin1String(address);
                }
                return symbol;
            };
            var emval_get_global = ()=>{
                if (typeof globalThis == "object") {
                    return globalThis;
                }
                function testGlobal(obj) {
                    obj["$$$embind_global$$$"] = obj;
                    var success = typeof $$$embind_global$$$ == "object" && obj["$$$embind_global$$$"] == obj;
                    if (!success) {
                        delete obj["$$$embind_global$$$"];
                    }
                    return success;
                }
                if (typeof $$$embind_global$$$ == "object") {
                    return $$$embind_global$$$;
                }
                if (typeof global == "object" && testGlobal(global)) {
                    $$$embind_global$$$ = global;
                } else if (typeof self == "object" && testGlobal(self)) {
                    $$$embind_global$$$ = self;
                }
                if (typeof $$$embind_global$$$ == "object") {
                    return $$$embind_global$$$;
                }
                throw Error("unable to get global object.");
            };
            var __emval_get_global = (name)=>{
                if (name === 0) {
                    return Emval.toHandle(emval_get_global());
                } else {
                    name = getStringOrSymbol(name);
                    return Emval.toHandle(emval_get_global()[name]);
                }
            };
            var emval_addMethodCaller = (caller)=>{
                var id = emval_methodCallers.length;
                emval_methodCallers.push(caller);
                return id;
            };
            var requireRegisteredType = (rawType, humanName)=>{
                var impl = registeredTypes[rawType];
                if (undefined === impl) {
                    throwBindingError(`${humanName} has unknown type ${getTypeName(rawType)}`);
                }
                return impl;
            };
            var emval_lookupTypes = (argCount, argTypes)=>{
                var a = new Array(argCount);
                for(var i = 0; i < argCount; ++i){
                    a[i] = requireRegisteredType(HEAPU32[argTypes + i * 4 >> 2], "parameter " + i);
                }
                return a;
            };
            var reflectConstruct = Reflect.construct;
            var emval_returnValue = (returnType, destructorsRef, handle)=>{
                var destructors = [];
                var result = returnType["toWireType"](destructors, handle);
                if (destructors.length) {
                    HEAPU32[destructorsRef >> 2] = Emval.toHandle(destructors);
                }
                return result;
            };
            var __emval_get_method_caller = (argCount, argTypes, kind)=>{
                var types = emval_lookupTypes(argCount, argTypes);
                var retType = types.shift();
                argCount--;
                var argN = new Array(argCount);
                var invokerFunction = (obj, func, destructorsRef, args)=>{
                    var offset = 0;
                    for(var i = 0; i < argCount; ++i){
                        argN[i] = types[i]["readValueFromPointer"](args + offset);
                        offset += types[i]["argPackAdvance"];
                    }
                    var rv = kind === 1 ? reflectConstruct(func, argN) : func.apply(obj, argN);
                    return emval_returnValue(retType, destructorsRef, rv);
                };
                var functionName = `methodCaller<(${types.map((t)=>t.name).join(", ")}) => ${retType.name}>`;
                return emval_addMethodCaller(createNamedFunction(functionName, invokerFunction));
            };
            var __emval_incref = (handle)=>{
                if (handle > 9) {
                    emval_handles[handle + 1] += 1;
                }
            };
            var __emval_run_destructors = (handle)=>{
                var destructors = Emval.toValue(handle);
                runDestructors(destructors);
                __emval_decref(handle);
            };
            var _abort = ()=>{
                abort("");
            };
            var getHeapMax = ()=>2147483648;
            var growMemory = (size)=>{
                var b = wasmMemory.buffer;
                var pages = (size - b.byteLength + 65535) / 65536;
                try {
                    wasmMemory.grow(pages);
                    updateMemoryViews();
                    return 1;
                } catch (e) {}
            };
            var _emscripten_resize_heap = (requestedSize)=>{
                var oldSize = HEAPU8.length;
                requestedSize >>>= 0;
                var maxHeapSize = getHeapMax();
                if (requestedSize > maxHeapSize) {
                    return false;
                }
                var alignUp = (x, multiple)=>x + (multiple - x % multiple) % multiple;
                for(var cutDown = 1; cutDown <= 4; cutDown *= 2){
                    var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
                    overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
                    var newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
                    var replacement = growMemory(newSize);
                    if (replacement) {
                        return true;
                    }
                }
                return false;
            };
            var ENV = {};
            var getExecutableName = ()=>thisProgram || "./this.program";
            var getEnvStrings = ()=>{
                if (!getEnvStrings.strings) {
                    var lang = (typeof navigator == "object" && navigator.languages && navigator.languages[0] || "C").replace("-", "_") + ".UTF-8";
                    var env = {
                        "USER": "web_user",
                        "LOGNAME": "web_user",
                        "PATH": "/",
                        "PWD": "/",
                        "HOME": "/home/web_user",
                        "LANG": lang,
                        "_": getExecutableName()
                    };
                    for(var x in ENV){
                        if (ENV[x] === undefined) delete env[x];
                        else env[x] = ENV[x];
                    }
                    var strings = [];
                    for(var x in env){
                        strings.push(`${x}=${env[x]}`);
                    }
                    getEnvStrings.strings = strings;
                }
                return getEnvStrings.strings;
            };
            var stringToAscii = (str, buffer)=>{
                for(var i = 0; i < str.length; ++i){
                    HEAP8[buffer++] = str.charCodeAt(i);
                }
                HEAP8[buffer] = 0;
            };
            var _environ_get = (__environ, environ_buf)=>{
                var bufSize = 0;
                getEnvStrings().forEach((string, i)=>{
                    var ptr = environ_buf + bufSize;
                    HEAPU32[__environ + i * 4 >> 2] = ptr;
                    stringToAscii(string, ptr);
                    bufSize += string.length + 1;
                });
                return 0;
            };
            var _environ_sizes_get = (penviron_count, penviron_buf_size)=>{
                var strings = getEnvStrings();
                HEAPU32[penviron_count >> 2] = strings.length;
                var bufSize = 0;
                strings.forEach((string)=>bufSize += string.length + 1);
                HEAPU32[penviron_buf_size >> 2] = bufSize;
                return 0;
            };
            var _proc_exit = (code)=>{
                quit_(code, new ExitStatus(code));
            };
            var exitJS = (status, implicit)=>{
                _proc_exit(status);
            };
            var _exit = exitJS;
            var _fd_close = (fd)=>52;
            function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
                return 70;
            }
            var printCharBuffers = [
                null,
                [],
                []
            ];
            var printChar = (stream, curr)=>{
                var buffer = printCharBuffers[stream];
                if (curr === 0 || curr === 10) {
                    (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
                    buffer.length = 0;
                } else {
                    buffer.push(curr);
                }
            };
            var _fd_write = (fd, iov, iovcnt, pnum)=>{
                var num = 0;
                for(var i = 0; i < iovcnt; i++){
                    var ptr = HEAPU32[iov >> 2];
                    var len = HEAPU32[iov + 4 >> 2];
                    iov += 8;
                    for(var j = 0; j < len; j++){
                        printChar(fd, HEAPU8[ptr + j]);
                    }
                    num += len;
                }
                HEAPU32[pnum >> 2] = num;
                return 0;
            };
            embind_init_charCodes();
            BindingError = Module["BindingError"] = class BindingError extends Error {
                constructor(message){
                    super(message);
                    this.name = "BindingError";
                }
            };
            InternalError = Module["InternalError"] = class InternalError extends Error {
                constructor(message){
                    super(message);
                    this.name = "InternalError";
                }
            };
            init_emval();
            UnboundTypeError = Module["UnboundTypeError"] = extendError(Error, "UnboundTypeError");
            var wasmImports = {
                o: ___cxa_throw,
                q: __embind_register_bigint,
                m: __embind_register_bool,
                l: __embind_register_emval,
                j: __embind_register_float,
                f: __embind_register_function,
                b: __embind_register_integer,
                a: __embind_register_memory_view,
                e: __embind_register_std_string,
                c: __embind_register_std_wstring,
                n: __embind_register_void,
                v: __emscripten_memcpy_js,
                i: __emval_call,
                d: __emval_decref,
                k: __emval_get_global,
                h: __emval_get_method_caller,
                y: __emval_incref,
                g: __emval_run_destructors,
                r: _abort,
                s: _emscripten_resize_heap,
                t: _environ_get,
                u: _environ_sizes_get,
                z: _exit,
                w: _fd_close,
                p: _fd_seek,
                x: _fd_write
            };
            var wasmExports = createWasm();
            var ___getTypeName = (a0)=>(___getTypeName = wasmExports["C"])(a0);
            var _malloc = (a0)=>(_malloc = wasmExports["D"])(a0);
            var _free = (a0)=>(_free = wasmExports["E"])(a0);
            var ___cxa_is_pointer_type = (a0)=>(___cxa_is_pointer_type = wasmExports["G"])(a0);
            Module["dynCall_jiji"] = (a0, a1, a2, a3, a4)=>(Module["dynCall_jiji"] = wasmExports["H"])(a0, a1, a2, a3, a4);
            var calledRun;
            dependenciesFulfilled = function runCaller() {
                if (!calledRun) run();
                if (!calledRun) dependenciesFulfilled = runCaller;
            };
            function run() {
                if (runDependencies > 0) {
                    return;
                }
                preRun();
                if (runDependencies > 0) {
                    return;
                }
                function doRun() {
                    if (calledRun) return;
                    calledRun = true;
                    Module["calledRun"] = true;
                    if (ABORT) return;
                    initRuntime();
                    readyPromiseResolve(Module);
                    if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
                    postRun();
                }
                if (Module["setStatus"]) {
                    Module["setStatus"]("Running...");
                    setTimeout(function() {
                        setTimeout(function() {
                            Module["setStatus"]("");
                        }, 1);
                        doRun();
                    }, 1);
                } else {
                    doRun();
                }
            }
            if (Module["preInit"]) {
                if (typeof Module["preInit"] == "function") Module["preInit"] = [
                    Module["preInit"]
                ];
                while(Module["preInit"].length > 0){
                    Module["preInit"].pop()();
                }
            }
            run();
            return readyPromise;
        });
    })();
    const defaultDecodeOptions = {
        preserveOrientation: false
    };
    let emscriptenModule;
    async function init(module, moduleOptionOverrides) {
        let actualModule = module;
        let actualOptions = moduleOptionOverrides;
        if (arguments.length === 1 && !(module instanceof WebAssembly.Module)) {
            actualModule = undefined;
            actualOptions = module;
        }
        emscriptenModule = initEmscriptenModule(Module, actualModule, actualOptions);
    }
    async function decode(buffer, options = {}) {
        if (!emscriptenModule) init();
        const _options = {
            ...defaultDecodeOptions,
            ...options
        };
        const module = await emscriptenModule;
        const result = module.decode(buffer, _options.preserveOrientation);
        if (!result) throw new Error('Decoding error');
        return result;
    }
    let A, I = null;
    function g() {
        return null !== I && I.buffer === A.memory.buffer || (I = new Uint8Array(A.memory.buffer)), I;
    }
    let B = 0;
    let Q = null;
    function C() {
        return null !== Q && Q.buffer === A.memory.buffer || (Q = new Int32Array(A.memory.buffer)), Q;
    }
    async function E(I) {
        void 0 === I && (I = "".replace(/\.js$/, "_bg.wasm"));
        ("string" == typeof I || "function" == typeof Request && I instanceof Request || "function" == typeof URL && I instanceof URL) && (I = fetch(I));
        const { instance: g, module: B } = await async function(A, I) {
            if ("function" == typeof Response && A instanceof Response) {
                if ("function" == typeof WebAssembly.instantiateStreaming) try {
                    return await WebAssembly.instantiateStreaming(A, I);
                } catch (I) {
                    if ("application/wasm" == A.headers.get("Content-Type")) throw I;
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", I);
                }
                const g = await A.arrayBuffer();
                return await WebAssembly.instantiate(g, I);
            }
            {
                const g = await WebAssembly.instantiate(A, I);
                return g instanceof WebAssembly.Instance ? {
                    instance: g,
                    module: A
                } : g;
            }
        }(await I, {});
        return A = g.exports, E.__wbindgen_wasm_module = B, A;
    }
    var D = Object.freeze({
        __proto__: null,
        decompress: function(I, Q) {
            try {
                const F = A.__wbindgen_add_to_stack_pointer(-16);
                var E = function(A, I) {
                    const Q = I(1 * A.length);
                    return g().set(A, Q / 1), B = A.length, Q;
                }(I, A.__wbindgen_malloc), D = B;
                A.decompress(F, E, D, Q);
                var i = C()[F / 4 + 0], w = C()[F / 4 + 1], G = (o = i, N = w, g().subarray(o / 1, o / 1 + N)).slice();
                return A.__wbindgen_free(i, 1 * w), G;
            } finally{
                A.__wbindgen_add_to_stack_pointer(16);
            }
            var o, N;
        },
        default: E
    });
    const i = [
        62,
        0,
        0,
        0,
        63,
        52,
        53,
        54,
        55,
        56,
        57,
        58,
        59,
        60,
        61,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        0,
        0,
        0,
        0,
        0,
        0,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        46,
        47,
        48,
        49,
        50,
        51
    ];
    function w(A) {
        return i[A - 43];
    }
    const G = function(A) {
        let I, g = A.endsWith("==") ? 2 : A.endsWith("=") ? 1 : 0, B = A.length, Q = new Uint8Array(B / 4 * 3);
        for(let g = 0, C = 0; g < B; g += 4, C += 3)I = w(A.charCodeAt(g)) << 18 | w(A.charCodeAt(g + 1)) << 12 | w(A.charCodeAt(g + 2)) << 6 | w(A.charCodeAt(g + 3)), Q[C] = I >> 16, Q[C + 1] = I >> 8 & 255, Q[C + 2] = 255 & I;
        return Q.subarray(0, Q.length - g);
    }("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NwMAIANBEGokAA8LIARBCEHYhcAAEDcACyACQQhByIXAABA3AAuqAgEDfyMAQYABayIEJAACQAJAAn8CQCABKAIAIgNBEHFFBEAgACgCACECIANBIHENASACrSABEBUMAgsgACgCACECQQAhAANAIAAgBGpB/wBqIAJBD3EiA0EwciADQdcAaiADQQpJGzoAACAAQX9qIQAgAkEEdiICDQALIABBgAFqIgJBgQFPDQIgAUGkjsAAQQIgACAEakGAAWpBACAAaxAIDAELQQAhAANAIAAgBGpB/wBqIAJBD3EiA0EwciADQTdqIANBCkkbOgAAIABBf2ohACACQQR2IgINAAsgAEGAAWoiAkGBAU8NAiABQaSOwABBAiAAIARqQYABakEAIABrEAgLIARBgAFqJAAPCyACQYABQZSOwAAQOQALIAJBgAFBlI7AABA5AAuxAgEEfyMAQUBqIgIkACABKAIEIgNFBEAgAUEEaiEDIAEoAgAhBCACQQA2AiAgAkIBNwMYIAIgAkEYajYCJCACQThqIARBEGopAgA3AwAgAkEwaiAEQQhqKQIANwMAIAIgBCkCADcDKCACQSRqQdiJwAAgAkEoahAJGiACQRBqIgQgAigCIDYCACACIAIpAxg3AwgCQCABKAIEIgVFDQAgAUEIaigCAEUNACAFEAQLIAMgAikDCDcCACADQQhqIAQoAgA2AgAgAygCACEDCyABQQE2AgQgAUEMaigCACEEIAFBCGoiASgCACEFIAFCADcCAEEMQQQQWSIBRQRAQQxBBBBjAAsgASAENgIIIAEgBTYCBCABIAM2AgAgAEGQi8AANgIEIAAgATYCACACQUBrJAAL/AEBAn8jAEEQayICJAAgACgCACACQQA2AgwCfwJAAkAgAUGAAU8EQCABQYAQSQ0BIAJBDGohACABQYCABE8NAiACIAFBP3FBgAFyOgAOIAIgAUEMdkHgAXI6AAwgAiABQQZ2QT9xQYABcjoADUEDDAMLIAIgAToADCACQQxqIQBBAQwCCyACIAFBP3FBgAFyOgANIAIgAUEGdkHAAXI6AAwgAkEMaiEAQQIMAQsgAiABQT9xQYABcjoADyACIAFBEnZB8AFyOgAMIAIgAUEGdkE/cUGAAXI6AA4gAiABQQx2QT9xQYABcjoADUEECyEBIAAgARALIAJBEGokAAv5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QSxqQQI2AgAgAUE8akEhNgIAIAFCAjcCHCABQayMwAA2AhggAUEdNgI0IAEgAUEwajYCKCABIAFBEGo2AjggASABQQhqNgIwIAFBGGpB8IDAABBRAAtxAQN/IwBBIGsiAiQAAkAgACABEBkNACABQRxqKAIAIQMgASgCGCACQRxqQQA2AgAgAkHwi8AANgIYIAJCATcCDCACQfSLwAA2AgggAyACQQhqEAkNACAAQQRqIAEQGSACQSBqJAAPCyACQSBqJABBAQswAQF/AkACQEGAwABBAhBZIgENAQwAC0GAwABBAhBjAAsgACABNgIAIABBgCA2AgQLewECfwJAAkAgACgCBCIBBEAgACgCDCICIAFPDQEgACgCACIBIAJqIAEtAAA6AAAgAEEANgIIIAAgACgCDEEBajYCDCAAKAIERQ0CIAAoAgAtAAAPC0EAQQBBiIbAABA2AAsgAiABQZiGwAAQNgALQQBBAEGohsAAEDYAC2gBAn8gACAALQBGIgFBAWoiAjoACiAAQQEgAUEPcXRBAmoiATsBQCAAQX8gAkEPcXRBf3M7AQggAEEYaigCACABQf//A3EiAU8EQCAAIAE2AhgLIABBJGooAgAgAU8EQCAAIAE2AiQLC1ABAX8gAEEUaigCACIBRSABQQJ0RXJFBEAgACgCEBAECyAAQSBqKAIAIgFFIAFBAXRFckUEQCAAKAIcEAQLIABBLGooAgAEQCAAKAIoEAQLC2wBAX8jAEEwayIDJAAgAyABNgIEIAMgADYCACADQRxqQQI2AgAgA0EsakEcNgIAIANCAjcCDCADQYCNwAA2AgggA0EcNgIkIAMgA0EgajYCGCADIAM2AiggAyADQQRqNgIgIANBCGogAhBRAAtsAQF/IwBBMGsiAyQAIAMgATYCBCADIAA2AgAgA0EcakECNgIAIANBLGpBHDYCACADQgI3AgwgA0HMkcAANgIIIANBHDYCJCADIANBIGo2AhggAyADQQRqNgIoIAMgAzYCICADQQhqIAIQUQALbAEBfyMAQTBrIgMkACADIAE2AgQgAyAANgIAIANBHGpBAjYCACADQSxqQRw2AgAgA0ICNwIMIANBgJLAADYCCCADQRw2AiQgAyADQSBqNgIYIAMgA0EEajYCKCADIAM2AiAgA0EIaiACEFEAC2wBAX8jAEEwayIDJAAgAyABNgIEIAMgADYCACADQRxqQQI2AgAgA0EsakEcNgIAIANCAjcCDCADQayRwAA2AgggA0EcNgIkIAMgA0EgajYCGCADIANBBGo2AiggAyADNgIgIANBCGogAhBRAAtcAQF/IwBBEGsiAyQAAkAgACgCBCABayACTwRAIANBADYCAAwBCyADIAAgASACEBYgAygCAEEBRw0AIANBCGooAgAiAARAIAMoAgQgABBjAAsQXQALIANBEGokAAtaAQF/IwBBEGsiAiQAAkAgACgCBCABa0EBTwRAIAJBADYCAAwBCyACIAAgARAeIAIoAgBBAUcNACACQQhqKAIAIgAEQCACKAIEIAAQYwALEF0ACyACQRBqJAALWgEBfyMAQRBrIgIkAAJAIAAoAgQgAWtBAU8EQCACQQA2AgAMAQsgAiAAIAEQHSACKAIAQQFHDQAgAkEIaigCACIABEAgAigCBCAAEGMACxBdAAsgAkEQaiQAC1kBAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB2InAACACQQhqEAkgAkEgaiQAC0YAAkBBCCACSQRAAn9BCCACSQRAIAIgAxAQDAELIAMQAAsiAg0BQQAPCyAAIAMQCg8LIAIgACADIAEgASADSxsQSyAAEAQLWQEBfyMAQSBrIgIkACACIAAoAgA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakHwj8AAIAJBCGoQCSACQSBqJAALWQACQAJAAkAgAUF/SgRAAkAgAgRAIAENAQwECyABRQ0DIAFBARBZIgINBAwCCyABEEciAkUNAQwDCxBdAAsgAUEBEGMAC0EBIQILIAAgATYCBCAAIAI2AgALVgEBfyMAQSBrIgIkACACIAA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakHwj8AAIAJBCGoQCSACQSBqJAALWQEDfwJAIAEoAgwiAiABKAIIIgNPBEAgASgCBCIEIAJJDQEgASgCACEBIAAgAiADazYCBCAAIAEgA2o2AgAPCyADIAJB2IbAABA4AAsgAiAEQdiGwAAQNwALVQEBfyAAQRBqIAAt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");
    let o;
    async function N(A, I) {
        o || (o = await (async ()=>(await E(G), D))());
        const g = o.decompress(A, I);
        if (0 === g.length) throw Error("Failed to decode with LZW decoder.");
        return g;
    }
    function samplesPerTile(fileDirectory) {
        const bits = fileDirectory.BitsPerSample;
        const samples = fileDirectory.PlanarConfiguration === 2 ? 1 : fileDirectory.SamplesPerPixel ?? (typeof bits === "number" ? 1 : bits?.length ?? 1);
        return Math.max(1, samples);
    }
    class LZWDecoder extends BaseDecoder {
        maxUncompressedSize;
        constructor(fileDirectory){
            super();
            const width = fileDirectory.TileWidth || fileDirectory.ImageWidth;
            const height = fileDirectory.TileLength || fileDirectory.ImageLength;
            const bits = fileDirectory.BitsPerSample;
            const bits0 = typeof bits === "number" ? bits : bits?.[0] ?? 8;
            this.maxUncompressedSize = Math.ceil(width * height * (bits0 / 8) * samplesPerTile(fileDirectory));
        }
        async decodeBlock(buffer) {
            const bytes = new Uint8Array(buffer);
            const decoded = await N(bytes, this.maxUncompressedSize);
            return decoded.buffer;
        }
    }
    if (typeof globalThis.ImageData === "undefined") {
        globalThis.ImageData = class {
            constructor(data, width, height){
                this.data = data;
                this.width = width;
                this.height = height;
            }
        };
    }
    let geotiffJpegDecoder;
    class MozJpegDecoder extends BaseDecoder {
        fileDirectory;
        tablesPrefix;
        samples;
        ycbcr;
        constructor(fileDirectory){
            super();
            this.fileDirectory = fileDirectory;
            const tables = fileDirectory.JPEGTables;
            const n = tables?.length ?? 0;
            this.tablesPrefix = tables && n > 4 && tables[n - 2] === 255 && tables[n - 1] === 217 ? Uint8Array.from(tables).subarray(0, n - 2) : null;
            this.samples = Math.min(4, samplesPerTile(fileDirectory));
            this.ycbcr = fileDirectory.PhotometricInterpretation === 6 && this.samples === 3;
        }
        withTables(buffer) {
            const tile = new Uint8Array(buffer);
            const prefix = this.tablesPrefix;
            if (!prefix || tile[0] !== 255 || tile[1] !== 216) return buffer;
            const out = new Uint8Array(prefix.length + tile.length - 2);
            out.set(prefix);
            out.set(tile.subarray(2), prefix.length);
            return out.buffer;
        }
        async decodeBlock(buffer) {
            let decoded;
            try {
                decoded = await decode(this.withTables(buffer));
            } catch  {
                const Fallback = await geotiffJpegDecoder;
                return new Fallback(this.fileDirectory).decode(this.fileDirectory, buffer);
            }
            const { data, width, height } = decoded;
            const outW = this.fileDirectory.TileWidth ?? width;
            const outH = this.fileDirectory.TileLength ?? height;
            const rows = Math.min(height, outH);
            const cols = Math.min(width, outW);
            const { samples, ycbcr } = this;
            const out = new (ycbcr ? Uint8ClampedArray : Uint8Array)(outW * outH * samples);
            for(let y = 0; y < rows; y++){
                for(let x = 0; x < cols; x++){
                    const s = (y * width + x) * 4;
                    const o = (y * outW + x) * samples;
                    if (ycbcr) {
                        const r = data[s];
                        const g = data[s + 1];
                        const b = data[s + 2];
                        out[o] = 0.299 * r + 0.587 * g + 0.114 * b;
                        out[o + 1] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
                        out[o + 2] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
                    } else {
                        for(let c = 0; c < samples; c++)out[o + c] = data[s + c];
                    }
                }
            }
            return out.buffer;
        }
    }
    let pakoDeflateDecoder;
    class NativeDeflateDecoder extends BaseDecoder {
        fileDirectory;
        constructor(fileDirectory){
            super();
            this.fileDirectory = fileDirectory;
        }
        async decodeBlock(buffer) {
            try {
                const inflated = new Blob([
                    buffer
                ]).stream().pipeThrough(new DecompressionStream("deflate"));
                return await new Response(inflated).arrayBuffer();
            } catch  {
                const Fallback = await pakoDeflateDecoder;
                return new Fallback(this.fileDirectory).decodeBlock(buffer);
            }
        }
    }
    function registerLzwDecoder() {
        addDecoder(5, ()=>Promise.resolve(LZWDecoder));
    }
    function registerJpegDecoder() {
        geotiffJpegDecoder = getDecoder({
            Compression: 7
        }).then((decoder)=>decoder.constructor);
        addDecoder(7, ()=>Promise.resolve(MozJpegDecoder));
    }
    function registerDeflateDecoder() {
        if (typeof DecompressionStream === "undefined") return;
        pakoDeflateDecoder = getDecoder({
            Compression: 8
        }).then((decoder)=>decoder.constructor);
        addDecoder([
            8,
            32946
        ], ()=>Promise.resolve(NativeDeflateDecoder));
    }
    registerLzwDecoder();
    registerJpegDecoder();
    registerDeflateDecoder();
    const worker = self;
    worker.addEventListener("message", async (e)=>{
        const { jobId, fileDirectory, buffer } = e.data;
        try {
            const decoder = await getDecoder(fileDirectory);
            const raw = await decoder.decode(fileDirectory, buffer);
            const lut = fileDirectory.MinervaWidenLut;
            const decoded = lut ? expandThroughLut(new Uint8Array(raw), lut).buffer : raw;
            worker.postMessage({
                decoded,
                jobId
            }, [
                decoded
            ]);
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            worker.postMessage({
                error,
                jobId
            });
        }
    });
})();
export { BaseDecoder as B, __tla };
