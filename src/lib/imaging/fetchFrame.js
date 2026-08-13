import * as dcmjs from "dcmjs";

const fetchFrame = async ({ series, subpath, signal }) => {
  const url = `${series}/instances/${subpath}`;
  const headers = {
    Accept:
      "multipart/related; type=application/octet-stream; transfer-syntax=1.2.840.10008.1.2.1",
  };
  const response = await fetch(url, { headers, signal });
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  const array_buffers = await dcmjs.utilities.message.multipartDecode(buffer);
  return new DataView(array_buffers[0]);
};

export { fetchFrame };
