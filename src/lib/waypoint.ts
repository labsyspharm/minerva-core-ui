// Types
import type { Story } from "./exhibit";
import type { HashState } from "./hashUtil";

type WS = {
  s: HashState["s"];
  w: HashState["w"];
};

const modulo = (i, n) => ((i % n) + n) % n;

const getWaypoints = (list: Story[], s: number) => {
  return list[s]?.waypoints || [];
};

const getWaypoint = (list: Story[], s: number, w: number) => {
  const waypoints = getWaypoints(list, s) || [];
  return waypoints[modulo(w, waypoints.length)];
};

const handleWaypoint = (list: Story[], { w, s }: WS) => {
  const sLen = list.length;
  const sPrev = modulo(s - 1, sLen);
  const sNext = modulo(s + 1, sLen);
  const wLenNow = getWaypoints(list, s).length;
  const wLenPrev = getWaypoints(list, sPrev).length;
  return (diff) => {
    const wDiff = w + diff;
    const wLen = diff < 0 ? wLenPrev : wLenNow;
    const wNew = modulo(wDiff, wLen);
    const sNew = wNew === wDiff ? s : diff < 0 ? sPrev : sNext;
    const { g } = getWaypoint(list, sNew, wNew);
    return { g, w: wNew, s: sNew };
  };
};

export { getWaypoint, getWaypoints, handleWaypoint };
