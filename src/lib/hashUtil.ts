import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useVars, useSetVars } from "path-vars";
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

const VEC = (len) => {
  return {
    checkValue: (a) => !a.some(isNaN) && a.length === len,
    encode: (a) => a.map((n) => n.toPrecision(4)).join("_"),
    decode: (s) => s.split("_").map(parseFloat),
    checkText: (s) => true,
  };
};

const OPTS = {
  formats: [
    {
      keys: ["s", "w", "g", "m"],
      encode: (x) => `${x}`,
      decode: parseInt,
      empty: 0,
    },
    {
      ...VEC(2),
      keys: ["a"],
      empty: [-100, -100],
    },
    {
      ...VEC(3),
      keys: ["v"],
      empty: [-1, -1, -1],
    },
    {
      ...VEC(4),
      keys: ["o"],
      empty: [-100, -100, 1, 1],
    },
    {
      keys: ["p"],
      empty: "Q",
    },
  ].map((f) => {
    const join = (kv) => kv.join("=");
    return { ...f, join };
  }),
};

const useHashPath = (hash) => {
  return ((out: { pathname: string }) => {
    useSetVars((to) => (out = to), OPTS)(hash);
    return out.pathname;
  })(null);
};

const useHash = () => {
  return useVars(useParams(), OPTS) as HashState;
};

const useSetHash = () => {
  const nav = useNavigate();
  const oldHash = useHash();
  const setVars = useSetVars(nav, OPTS);
  return useMemo(() => {
    return (hash: Partial<HashState>) => {
      return setVars({ ...oldHash, ...hash });
    };
  }, [oldHash, setVars]);
};

const toRoutePath = (..._: string[]) => {
  return _.map((c) => c + "=:" + c).join("/");
};

const useRedirects = (stories: Story[], toElement) => {
  const defaultHash = {
    s: 0,
    w: 0,
    g: 0,
    m: -1,
    a: [-100, -100],
    v: [-1, -1, -1],
    o: [-100, -100, 1, 1],
    p: "Q",
  };
  const { s, w } = defaultHash;
  const waypoint = getWaypoint(stories, s, w);
  const { g, v } = waypoint;
  const noHash = { ...defaultHash, g, v };
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
