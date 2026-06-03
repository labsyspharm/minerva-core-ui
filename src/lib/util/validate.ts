import type { ValidObj } from "@/components/shared/Upload";
import { findDicomWeb } from "@/lib/imaging/dicom.js";
import { findFile } from "@/lib/imaging/filesystem";

type FormOutDicom = {
  url: string;
  name: string;
};
type FormOutAny = {
  name: string;
  path: string;
};
type FormOutOmeTiffUrl = {
  ome_tiff_url: string;
};
type Format = "DICOM-WEB" | "OME-TIFF" | "OME-TIFF-URL";
type DicomKey = keyof Required<FormOutDicom>;
type ValidateIn<T> = {
  formOut: T;
  handles: Handle.File[];
  onStart: (imagePropList: [string, string, Format][]) => void;
};
type FormAnyOpts = ValidateIn<FormOutAny>;
type FormDicomOpts = ValidateIn<FormOutDicom>;
type FormOmeTiffUrlOpts = ValidateIn<FormOutOmeTiffUrl>;
type FormOpts = FormAnyOpts | FormDicomOpts | FormOmeTiffUrlOpts;
type MaybeOpts = Partial<FormOpts>;
type Validate<I> = (i: I) => Promise<ValidObj>;
type ToValid = (n: string[], k: string[]) => ValidObj;
export function isOpts(o: MaybeOpts) {
  if ("onStart" in o && typeof o.onStart === "function") {
    const h = FileSystemFileHandle;
    if ("formOut" in o) {
      if ("handles" in o && o.handles instanceof h) {
        return typeof o.formOut === "object";
      }
      if ("url" in o.formOut) {
        return true;
      }
      if ("ome_tiff_url" in o.formOut) {
        return true;
      }
    }
  }
  return false;
}

function isDicomOpts(o: MaybeOpts): o is FormDicomOpts {
  if (!("formOut" in o)) return false;
  return "url" in (o.formOut as Record<string, unknown>);
}

function isAnyOpts(o: MaybeOpts): o is FormAnyOpts {
  if (!("onStart" in o) || typeof o.onStart !== "function") return false;
  if (!("handles" in o) || !Array.isArray(o.handles)) return false;
  if (!("formOut" in o)) return false;
  const fo = o.formOut as Record<string, unknown>;
  return !("url" in fo) && !("ome_tiff_url" in fo);
}

function isOmeTiffUrlOpts(o: MaybeOpts): o is FormOmeTiffUrlOpts {
  if (!("formOut" in o)) return false;
  return "ome_tiff_url" in (o.formOut as Record<string, unknown>);
}

function isFormOpts(o: MaybeOpts): o is FormOpts {
  return isAnyOpts(o) || isOmeTiffUrlOpts(o) || isDicomOpts(o);
}

const toValid: ToValid = (need_keys, keys) => {
  return need_keys.reduce((o: ValidObj, k: string) => {
    o[k] = keys.includes(k);
    return o;
  }, {} as ValidObj);
};

const validateDicom: Validate<FormDicomOpts> = async (opts) => {
  const { formOut, onStart } = opts;
  const need_keys = ["url", "name"];
  const all = [...need_keys];
  const valid_keys = await all.reduce(
    async (memo, k) => {
      const v = k in formOut ? formOut[k as DicomKey] : "";
      const out = await memo;
      if (typeof v !== "string") return out;
      switch (k) {
        case "name":
          if (v.length === 0) return out;
          return [...out, k];
        case "url":
          if (v.length === 0) return out;
          try {
            await findDicomWeb(v);
            return [...out, k];
          } catch {
            return out;
          }
      }
      return out;
    },
    Promise.resolve([] as string[]),
  );
  const validated = need_keys.every((k) => {
    return valid_keys.includes(k as DicomKey);
  });
  if (validated && "url" in formOut) {
    onStart([[formOut.url, "Colorimetric", "DICOM-WEB"]]);
  }
  return toValid(need_keys, valid_keys);
};

const validateAny: Validate<FormAnyOpts> = async (opts) => {
  const { handles, onStart } = opts;
  if (handles.length === 0) {
    return toValid(["path"], []);
  }
  const handle = handles[0];
  const found = await findFile({ handle });
  if (!found) {
    return toValid(["path"], []);
  }
  const path = handle.name;
  onStart([[path, "Colorimetric", "OME-TIFF"]]);
  return toValid(["path"], ["path"]);
};

const validateOmeTiffUrl: Validate<FormOmeTiffUrlOpts> = async (opts) => {
  const { formOut, onStart } = opts;
  const need_keys = ["ome_tiff_url"];
  const url = formOut.ome_tiff_url || "";
  const valid_keys: string[] = [];
  if (/^https?:\/\/.+/.test(url)) {
    valid_keys.push("ome_tiff_url");
  }
  const validated = need_keys.every((k) => valid_keys.includes(k));
  if (validated) {
    onStart([[url, "Colorimetric", "OME-TIFF-URL"]]);
  }
  return toValid(need_keys, valid_keys);
};

const validate: Validate<MaybeOpts> = async (opts: MaybeOpts) => {
  if (!isFormOpts(opts)) {
    return toValid(["path"], []);
  }
  if (isOmeTiffUrlOpts(opts)) {
    return await validateOmeTiffUrl(opts);
  }
  if (isAnyOpts(opts)) {
    return await validateAny(opts);
  }
  return await validateDicom(opts);
};
export { validate };
