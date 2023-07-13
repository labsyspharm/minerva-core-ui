import { useMemo } from "react";
import { useVars, useSetVars } from "path-vars";
import { getWaypoint } from "./waypoint";

import type { Story } from "./exhibit";

type StrKey = "p";
type NumsKey = "o" | "v" | "a";
type NumKey = "i" | "s" | "w" | "g" | "m";
type Key = StrKey | NumKey | NumsKey;

export type HashState = Record<StrKey, string> &
  Record<NumKey, number> &
  Record<NumsKey, number[]>;

export type HashContext = {
  setHash: (h: Partial<HashState>) => void;
  hash: HashState;
};

const K_ALL = [..."iswgmavop"] as Key[];
const K_NUM = [..."iswgm"] as Key[];
const K_NUMS = [..."avo"] as Key[];

type ParamInput = {
  noHash: HashState;
  params: Partial<Record<Key, string>>;
};

const VEC = (len) => {
  return {
    checkValue: (a) => !a.some(isNaN) && a.length === len,
    encode: (a) => a.map((n) => n.toPrecision(4)).join("_"),
    decode: (s) => s.split("_").map(parseFloat),
    checkText: (s) => true,
  };
};

const toOpts = (noHash) => {
  const asInt = {
    encode: (x) => `${x}`,
    decode: parseInt,
  };
  return {
    root: '#',
    slash: '#',
    formats: [
      { ...asInt, keys: ["i"], empty: noHash.i },
      { ...asInt, keys: ["s"], empty: noHash.s },
      { ...asInt, keys: ["w"], empty: noHash.w },
      { ...asInt, keys: ["g"], empty: noHash.g },
      { ...asInt, keys: ["m"], empty: noHash.m },
      { ...VEC(2), keys: ["a"], empty: noHash.a },
      { ...VEC(3), keys: ["v"], empty: noHash.v },
      { ...VEC(4), keys: ["o"], empty: noHash.o },
      { keys: ["p"], empty: noHash.p }
    ].map((f) => {
      const join = (kv) => kv.join("=");
      return { ...f, join };
    }),
    }
};

const toHashMemo = (url, opts) => {
  return useMemo(() => {
    const urlHash = window.location.hash.split('#');
    const urlParams = urlHash.reduce((obj, str) => {
      const [ k, v ] = str.split('=');
      obj[k] = v;
      return obj;
    }, {});
    return useVars(urlParams, opts) as HashState;
  }, [url]);
};

const useHash = (url, stories: Story[]) => {
  const opts = toOpts(toEmptyHash(stories));
  const hash = toHashMemo(url, opts);
  const setVars = useSetVars((to) => {
    location.hash = to.pathname;
  }, opts);
  const setHash = useMemo(() => {
    return (newHash: Partial<HashState>) => {
      return setVars({ 
        ...hash, ...newHash
      });
    };
  }, [hash]);
  return { hash, setHash };
};

const toEmptyHash = (stories: Story[]) => {
  const defaultHash = {
    s: 0,
    w: 0,
    g: 0,
    m: -1,
    i: -1,
    a: [-100, -100],
    v: [-1, -1, -1],
    o: [-100, -100, 1, 1],
    p: "Q",
  };
  const { s, w } = defaultHash;
  const { g, v } = getWaypoint(stories, s, w);
  return { ...defaultHash, s, w, g, v };
};

export { useHash, toEmptyHash };
