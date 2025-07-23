import * as dcmjs from 'dcmjs'
import { load } from '@loaders.gl/core';
import { ImageLoader } from '@loaders.gl/images';

const temp = () => {
  // Create canvas and context
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // Set dimensions (small example)
  canvas.width = 1024;
  canvas.height = 1024;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Get base64 PNG data
  const base64Data = canvas.toDataURL('image/png');

  // Convert base64 to Uint8Array
  const uint8Array = Uint8Array.from(
    atob(base64Data.split(',')[1]), c => c.charCodeAt(0)
  );
  return uint8Array;
}

const fetchFrame = async ({ series, subpath }) => {
  const url = `${series}/instances/${subpath}`;
  const headers = {
    Accept: 'multipart/related; type=application/octet-stream; transfer-syntax=1.2.840.10008.1.2.1'
  }
  const response = await fetch(
    url, { headers }
  );
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer(); 
  const array_buffers = await (
    dcmjs.utilities.message.multipartDecode(buffer)
  );
  return new DataView(array_buffers[0]);
}

export { fetchFrame };
