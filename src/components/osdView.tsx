import * as React from "react";
import {findDOMNode} from "react-dom";
import {useEffect, useRef, useState} from "react";
import {OpenSeadragonContext} from "../lib/openseadragon";
import { Handler } from "../lib/openseadragon";
import styled from "styled-components";
import {getWaypoint} from "../lib/waypoint";
import {OsdLensingContext} from "../lib/osdLensingContext";

// Types
import type { SetStateAction, Dispatch } from "react";
import type { Update, V } from "../lib/openseadragon";
import type {Config, Cache} from "../lib/openseadragon";
import type {Image, Group, Story, Waypoint} from "../lib/exhibit";
import type {HashContext} from "../lib/hashUtil";

export type Props = {
    images: Image[];
    groups: Group[];
    stories: Story[];
    viewerConfig: Config;
} & HashContext;

type HasWaypointGroups = {
    groups: Group[],
    waypoint: Waypoint
}
type LensingConfig = {
    g: number,
    group: string
}
interface ToLensingConfig {
  (gw: HasWaypointGroups, l: number): LensingConfig
}
type UpdateOptions = {
  setV?: (v: V) => void,
  setL?: (l: number) => void,
  setCache: Dispatch<SetStateAction<Cache>> 
}
interface UseUpdate {
  (args: UpdateOptions): Update;
}

const Main = styled.div`
  height: 100%;
`;

const useSetL = (setHash) => {
    return (l) => {
        setHash({l});
    };
}

const useSetV = (setHash) => {
    return (v) => {
        setHash({v});
    };
};

const useUpdateLens = ({setL, setCache}) => {
    return (c) => {
        console.log(c);
        setL(c.l);
        setCache((_c) => {
            const keys = [...Object.keys(_c)];
            const entries = keys.map((k) => {
                return [k, k in c ? c[k] : _c[k]];
            });
            return Object.fromEntries(entries);
        });
    };
}

const useUpdate: UseUpdate = (args) => {
    const {setV, setL, setCache} = args;
    return (c) => {
        if ("v" in c && setV) {
            setV(c.v);
        }
        if ("l" in c && setL) {
            setL(c.l);
        }
        setCache((_c) => {
            const keys = [...Object.keys(_c)];
            const entries = keys.map((k) => {
                return [k, k in c ? c[k] : _c[k]];
            });
            return Object.fromEntries(entries);
        });
    };
};

const useEl = ({current}) => {
    return findDOMNode(current);
};

const toLensingConfig: ToLensingConfig = (gw, l) => {
  const { groups, waypoint } = gw;
  const ok_l = l > -1 && l < groups.length;
  if (ok_l) {
    const group = groups[l].name;
    return { group, g: l };
  }
  return waypoint.lensing;
}

const OsdView = (props: Props) => {
    const rootRef = useRef();
    const { groups, stories, hash, setHash} = props;
    const { v, g, s, w, l } = hash;
    const waypoint = getWaypoint(stories, s, w);
    const setV = useSetV(setHash);
    const setL = useSetL(setHash);

    const [cache, setCache] = useState({
        contexts: [],
        redraw: false,
        v,
        l,
        g,
    } as Cache);
    const [el, setEl] = useState(useEl(rootRef));
    const config = {
        ...props.viewerConfig,
        element: el,
    };

    // LENSING  :: {{'Global' var}} ~
    const { contexts } = cache;
    const gw = { groups, waypoint };
    const lensingConfig = toLensingConfig(gw, l);
    const update = useUpdate({setV, setCache});
    const updateLens = useUpdate({setL, setCache});
    const opts = {
      config, update, updateLens,
      v, g, props, lensingConfig
    };
    const firstDraw = !contexts.length;

    useEffect(() => {
        setEl(useEl(rootRef))
    }, [rootRef.current]);

    useEffect(() => {
        if (g !== cache.g) {
            update({g, redraw: true});
        }
    }, [g]);

    // Called on re-draw - TODO :: integrate later
    useEffect(() => {
        if (waypoint.g !== g) {
            update({g: waypoint.g});
        }
    }, [waypoint.g]);

    useEffect(() => {
        if (cache.redraw && el) {
          const main = contexts[0].reset(opts as any);
          const lens = new OsdLensingContext(main, opts);
          const next = [ main, lens ];
          update({redraw: false, contexts: next});
        }
    }, [cache.redraw, el]);

    const {zoomInButton, zoomOutButton} = config;
    const els = [el, zoomInButton, zoomOutButton];
    const ready = els.every((el) => el !== null);

    // First draw
    useEffect(() => {
        if (ready && firstDraw) {
            const main = OpenSeadragonContext(opts);
            const lens = new OsdLensingContext(main, opts);
            const next = [ main, lens ];
            update({ contexts: next });
        }
    }, [ready, firstDraw]);

    return <Main id="minervaAnalysisOSD" ref={rootRef}/>;
};

export {OsdView};
