import {
  loadOmeTiff,
} from "@hms-dbmi/viv";

const hasFileSystemAccess = () => {
  return !!window || !!(window as any).showOpenFilePicker;
}

const toLoader = async () => {
  const dir_opts = { mode: "readwrite" };
  const dir = await (window as any).showDirectoryPicker(dir_opts);
  const in_f = "LUNG-3-PR_40X.ome.tif";
  const in_fh = await dir.getFileHandle(in_f);
  const in_file = await in_fh.getFile();
  const in_tiff = await loadOmeTiff(in_file);
  console.log(in_tiff);
  /*
  for (const f of files) {
    dir.getFileHandle(f, { create: true })
  }
  */
  return in_tiff;
}

export {
  hasFileSystemAccess,
  toLoader
}
