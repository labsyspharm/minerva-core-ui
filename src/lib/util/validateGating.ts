import type { ValidObj } from "@/components/shared/Upload";
import { csvHeadersFromText } from "@/lib/gating/cellTable";
import { findFile } from "@/lib/imaging/filesystem";

export type FormOutGating = {
  name: string;
  path: string;
  mask: string;
  csv: string;
};

type ValidateGatingOpts = {
  handles: Handle.File[];
  formOut: FormOutGating;
  onStart: (payload: FormOutGating) => void;
};

const toValid = (need_keys: string[], keys: string[]): ValidObj =>
  need_keys.reduce((o: ValidObj, k) => {
    o[k] = keys.includes(k);
    return o;
  }, {} as ValidObj);

export async function validateGating(
  opts: ValidateGatingOpts,
): Promise<ValidObj> {
  const { handles, formOut, onStart } = opts;
  const need_keys = ["name", "path", "mask", "csv"];
  const valid_keys: string[] = [];

  if (formOut.name?.length > 0) valid_keys.push("name");

  if (handles.length > 0 && formOut.path) {
    const biomarker = handles.find((h) => h.name === formOut.path);
    if (biomarker && (await findFile({ handle: biomarker }))) {
      valid_keys.push("path");
    }
  }

  if (handles.length > 0 && formOut.mask) {
    const mask = handles.find((h) => h.name === formOut.mask);
    if (mask && (await findFile({ handle: mask }))) {
      valid_keys.push("mask");
    }
  }

  if (handles.length > 0 && formOut.csv) {
    const csv = handles.find((h) => h.name === formOut.csv);
    if (csv) {
      try {
        const text = await (await csv.getFile()).text();
        const headers = csvHeadersFromText(text);
        if (headers.length > 0) valid_keys.push("csv");
      } catch {
        /* invalid csv */
      }
    }
  }

  const validated = need_keys.every((k) => valid_keys.includes(k));
  if (validated) {
    onStart(formOut);
  }
  return toValid(need_keys, valid_keys);
}
