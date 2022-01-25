import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getWaypoint } from "./waypoint";

import type { Story } from "./exhibit";

type StrKey = "p";
type NumsKey = "o" | "v" | "a";
type NumKey = "s" | "w" | "g" | "m";
type Key = StrKey | NumKey | NumsKey;

export type HashState = Record<StrKey, string> &
  Record<NumKey, number> &
  Record<NumsKey, number[]>;

const K_ALL = [..."swgmavop"] as Key[];
const K_NUM = [..."swgm"] as Key[];
const K_NUMS = [..."avo"] as Key[];

type ParamInput = {
  noHash: HashState;
  params: Partial<Record<Key, string>>;
};

const NO_HASH: HashState = {
  s: 0,
  w: 0,
  g: 0,
  m: -1,
  a: [-100, -100],
  v: [-1, -1, -1],
  o: [-100, -100, 1, 1],
  p: "Q",
};

function isKey(k): k is Key {
  return K_ALL.includes(k);
}

function isNumKey(k): k is NumsKey {
  return K_NUM.includes(k);
}

function isNumsKey(k): k is NumsKey {
  return K_NUMS.includes(k);
}

function handleKey(forNums, forNum, forStr) {
  return (k: Key) => {
    if (isNumsKey(k)) return forNums;
    else if (isNumKey(k)) return forNum;
    else return forStr;
  };
}

function invalidator(k) {
  const okLength = ({ length }) => length === NO_HASH[k].length;
  return handleKey(
    (a) => !okLength(a) || a.some(isNaN),
    isNaN,
    (s) => !s
  )(k);
}

function encoder(k: Key, p: number) {
  const toString = (precision?) => {
    return (n) => n.toPrecision(precision);
  };
  return handleKey(
    (a) => a.map(toString(p)).join("_"),
    toString(),
    (s) => s
  )(k);
}

function decoder(k: Key) {
  return handleKey(
    (s) => s.split("_").map(parseFloat),
    parseFloat,
    (s) => s
  )(k);
}

const toHashState = ({ noHash, params }: ParamInput) => {
  const paramKV = Object.entries(params);
  const hashKV = paramKV
    .map(([k, v]) => {
      if (isKey(k)) {
        const value = decoder(k)(v);
        if (!invalidator(k)(value)) {
          return [k, value];
        }
      }
    })
    .filter((kv) => !!kv);
  return {
    ...noHash,
    ...Object.fromEntries(hashKV),
  };
};

const serialize = (hash) => {
  const precision = 4;
  const hashKVs = K_ALL.map((k) => {
    const encode = encoder(k, precision);
    return [k, encode(hash[k])].join("=");
  });
  return "/" + hashKVs.join("/");
};

const useHash = (noHash = NO_HASH) => {
  const params = useParams();
  return toHashState({ noHash, params });
};

const _useSetHash = (navigate, oldHash) => {
  return (newState: Partial<HashState>) => {
    const hash = serialize({
      ...oldHash,
      ...newState,
    });
    navigate({ pathname: hash });
  };
};

const useSetHash = () => {
  const oldHash = useHash(NO_HASH);
  const navigate = useNavigate();
  return useMemo(() => {
    return _useSetHash(navigate, oldHash);
  }, [oldHash, navigate]);
};

const useHashPath = (noHash = NO_HASH) => {
  return serialize(useHash(noHash));
};

const toRoutePath = (..._: string[]) => {
  return _.map((c) => c + "=:" + c).join("/");
};

const useRedirects = (stories: Story[], toElement) => {
  const { s, w } = NO_HASH;
  const waypoint = getWaypoint(stories, s, w);
  const { g, v } = waypoint;
  const noHash = { ...NO_HASH, g, v };
  const makeRoutes = (all: Key[]) => {
    const path = toRoutePath(all[0]);
    const children = all.length > 1 ? makeRoutes(all.slice(1)) : undefined;
    return [
      toElement({ path, noHash, children }),
      toElement({ path: "*", noHash, children }),
    ];
  };
  const children = makeRoutes(K_ALL);
  return toElement({ path: "/", noHash, children });
};

export { useHash, useSetHash, useHashPath, useRedirects, toRoutePath };
