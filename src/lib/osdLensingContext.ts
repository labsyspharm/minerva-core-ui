import * as lensing from 'lensing';
import * as OSD from "openseadragon";
import {
    Reset,
    Opts,
    readViewport,
    makeImage,
    addChannels,
    toContext,
    setViewport,
    Handler
} from './openseadragon';
import LensingFilters from './osdLensingFilters';
import Demo from "../../demo/index";
import {hash} from "typescript-plugin-styled-components/dist/hash";

import type { Group, ConfigGroup } from "./exhibit";
import type { Update } from "./openseadragon"

interface ToConfigGroup {
  (group: Group): ConfigGroup
}

const toConfigGroup = (group) => {
  const colors = group.channels.map(c => c.color);
  const channels = group.channels.map(c => c.name);
  return {
    Name: group.name,
    Path: group.path,
    Channels: channels,
    Colors: colors
  }
}

const noUpdateLens: Update = () => null;
export class OsdLensingContext {

    // Class vars
    lensingContext = null as any;
    lensingViewer = null as any;
    viewerContext = null as any;
    handler = null as any;
    updateLens = noUpdateLens;
    groups = [] as Group[];
    settings = {
        configs: {}
    }
    lg = -1;

    constructor(viewerContext: any, viewerOptions: any) {

        // Contexts
        this.viewerContext = viewerContext;
        this.handler = new Handler(() => {
          return { l: this.lg, redraw: true };
        });
        this.reset(viewerOptions);

    }

    /** 1.
     * reset
     */
    reset(opts): any {
        if (this.lensingContext) {
            opts.v = readViewport(this.lensingContext);
            this.lensingContext.destroy();
        }
        const reset = this.reset.bind(this);
        const context = this.newContext(opts, reset);
        this.lensingContext = context;
        return context;
    }

    /** 2.
     * newContext
     */
    newContext(opts: Opts, reset: Reset): any {

        const {v, config, props, lensingConfig} = opts;
        const { updateLens, update } = opts;
        const { groups, images } = props;
        const { metadata } = images[0];
        this.updateLens = updateLens;
        this.lg = lensingConfig.g;
        this.groups = groups;

        // LENSING - viewer
        const viewerConfigs = {
            immediateRender: true,
            maxZoomPixelRatio: 10,
            visibilityRatio: 0.9,
            showHomeControl: false,
            showFullPageControl: false,
            ...(config as any),
        }
        const filters = LensingFilters;
        this.lensingViewer = new lensing.create(
            OSD,
            this.viewerContext.viewport.viewer,
            Object.assign(viewerConfigs, {id: viewerConfigs.element.id}),
            {
                compassOn: true,
                compassUnitConversion: {
                    inputUnit: 'px',
                    outputUnit: 'mm',
                    inputOutputRatio: [1, 1]
                },
                imageMetadata: metadata 
            },
            filters
        );
        filters.forEach((f: any) => {

            f.variables.referenceClass = this.lensingViewer;
            f.variables.sourceClass = this;
        });
        const viewer = this.lensingViewer.viewerAux;

        // Refactored from original reset
        const img = makeImage(props, this.lg);

        addChannels(viewer, img);
        viewer.world.addHandler("add-item", (e) => {
            e.item.setWidth(img.width / img.height);
        });

        const event = "animation-finish";
        const context = toContext(viewer, reset, event);
        viewer.addHandler(event, () => {
            setViewport(viewer, v, true);
        });
        setViewport(viewer, v, true);

        return context;
    }

    /**
     * getChannelGroups
     */
    getChannelGroups(): ConfigGroup[] {
        return this.groups.map(toConfigGroup);
    }

    getCurrentChannelGroup(): ConfigGroup {
        const { groups, lg } = this;
        const group = groups[lg] || groups[0];
        return toConfigGroup(group);
    }

    loadNewChannelGroup() {
        const { lg, updateLens } = this;
        const max_lg = this.groups.length - 1;
        const new_lg = [lg + 1, 0][+(lg === max_lg)];
        this.lg = new_lg;
        this.handler.handle(updateLens);
    }
}
