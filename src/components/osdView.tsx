import * as React from "react";
import {findDOMNode} from "react-dom";
import {useEffect, useRef, useState} from "react";
import {OpenSeadragonContext, readViewport} from "../lib/openseadragon";
import styled from "styled-components";
import {getWaypoint} from "../lib/waypoint";
import {OsdLensingContext} from "../lib/osdLensingContext";

// Types
import type {Config} from "../lib/openseadragon";
import type {Group, Story} from "../lib/exhibit";
import type {HashContext} from "../lib/hashUtil";

export type Props = {
    groups: Group[];
    stories: Story[];
    viewerConfig: Config;
} & HashContext;

// Lensing var
let lensingContext = null as any;

const Main = styled.div`
  height: 100%;
`;

const useSetV = (setHash) => {
    return (context) => {
        setHash({
            v: readViewport(context),
        });
    };
};

const useUpdate = ({setV, setCache}) => {
    return (c) => {
        if (c?.context?.viewport) {
            setV(c.context);

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

const OsdView = (props: Props) => {
    const rootRef = useRef();
    const {groups, stories, hash, setHash} = props;
    const {v, g, s, w} = hash;
    const waypoint = getWaypoint(stories, s, w);
    const setV = useSetV(setHash);

    const [cache, setCache] = useState({
        context: null,
        redraw: false,
        g,
    });
    const [el, setEl] = useState(useEl(rootRef));
    const config = {
        ...props.viewerConfig,
        element: el,
    };

    // LENSING  :: {{'Global' var}} ~
    const {context} = cache;
    const update = useUpdate({setV, setCache});
    const opts = {config, update, v, g, groups, lensingConfig: waypoint.lensing};
    const firstDraw = !context?.viewport;

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
            const next = context.reset(opts);
            update({redraw: false, context: next});

            // LENSING  :: {{On image channel update}} ~ Create new lensing instance
            lensingContext = new OsdLensingContext(next, opts);

        }
    }, [cache.redraw, el]);

    const {zoomInButton, zoomOutButton} = config;
    const els = [el, zoomInButton, zoomOutButton];
    const ready = els.every((el) => el !== null);

    // First draw
    useEffect(() => {
        if (ready && firstDraw) {

            // LENSING :: {{Initial draw}} ~ Append id to OSD el
            (opts.config.element as HTMLElement).setAttribute('id', 'minervaAnalysisOSD');

            const next = OpenSeadragonContext(opts);
            update({context: next});

            // LENSING  :: {{Initial draw}} ~ Build Lensing instance (w. hidden viewer)
            lensingContext = new OsdLensingContext(next, opts);

        }
    }, [ready, firstDraw]);

    return <Main ref={rootRef}/>;
};

export {OsdView};
