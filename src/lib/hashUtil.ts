import {Point} from 'openseadragon'

import type {
  ReadWrite, UnaryFn
} from './util'
import type {Viewport} from 'openseadragon';

export type KV = [string, string[]]
export type Vec3Num = [number, number, number]
export type Vec3 = [string, string, string]
export type Vec1 = [string]
export type HashState = {
  s: Vec1,
  w: Vec1, 
  g: Vec1, 
  v: Vec3 
}

export type Hash = ReadWrite<HashState>

const toVec1 = (n: number): Vec1 => [`${n}`];
const toVec3 = (v: Vec3Num, p: number): Vec3 => {
  return v.map(n => n.toPrecision(p)) as Vec3;
}

const emptyHash: HashState = {
  v: ['0.5', '0.5', '0.5'],
  w: toVec1(0),
  s: toVec1(0),
  g: toVec1(0)
}

type ParseViewport = UnaryFn<Viewport, Vec3>

const toV:ParseViewport = (viewport) => {
  const {x, y} = viewport.getCenter();
  return toVec3([viewport.getZoom(), x, y], 4);
}

const fromV = (v) => {
  const floatV = v.map(parseFloat)
  return {
    scale: floatV[0],
    pan: new Point(floatV[1], floatV[2])
  };
}

export {
  emptyHash,
  toVec3,
  toVec1,
  fromV,
  toV
}
