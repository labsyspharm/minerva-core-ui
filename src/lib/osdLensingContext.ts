import * as lensing from 'lensing';
import * as OSD from "openseadragon";
import {
    Reset,
    Opts,
    readViewport,
    makeImage,
    addChannels,
    toContext,
    handle,
    setViewport
} from './openseadragon';
import LensingFilters from './osdLensingFilters';
import DemoConfig from '../../demo/index'
import Demo from "../../demo/index";
import {hash} from "typescript-plugin-styled-components/dist/hash";

export class OsdLensingContext {

    // Class vars
    lensingContext = null as any;
    lensingViewer = null as any;
    viewerContext = null as any
    settings = {
        configs: {},
        selects: {
            currentChannelGroupIndex: 0,
        }
    }

    constructor(viewerContext: any, viewerOptions: any) {

        // Contexts
        this.viewerContext = viewerContext;
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

        const {g, v, groups, config, update, props, lensingConfig} = opts;

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
        console.log(config)
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
                imageMetadata: {
                    physical_size_x: 25.485,
                    physical_size_x_unit: 'mm',
                    physical_size_y: 18.642,
                    physical_size_y_unit: ',,',
                    size_x: 78417,
                    size_y: 57360,
                }
            },
            filters
        );
        filters.forEach((f: any) => {

            f.variables.referenceClass = this.lensingViewer;
            f.variables.sourceClass = this;
        });
        const viewer = this.lensingViewer.viewerAux;

        // Refactored from original reset
        this.settings.selects.currentChannelGroupIndex = lensingConfig.g;
        const img = makeImage({g: lensingConfig.g, groups});

        addChannels(viewer, img);
        viewer.world.addHandler("add-item", (e) => {
            e.item.setWidth(img.width / img.height);
        });

        const event = "animation-finish";
        const context = toContext(viewer, reset, event);
        viewer.addHandler(event, () => {
            handle(context, update);
            setViewport(viewer, v, true);
        });
        setViewport(viewer, v, true);

        return context;
    }

    /**
     * getChannelGroups
     */
    getChannelGroups(): any[] {
        return DemoConfig.Groups;
    }

    getCurrentChannelGroup(): any {
        return DemoConfig.Groups[this.settings.selects.currentChannelGroupIndex];
    }

    loadNewChannelGroup(): void {

        // Update index position
        this.settings.selects.currentChannelGroupIndex++;
        if (this.settings.selects.currentChannelGroupIndex > DemoConfig.Groups.length - 1) {
            this.settings.selects.currentChannelGroupIndex = 0;
        }

        // Change images
        const img = makeImage({g: this.settings.selects.currentChannelGroupIndex, groups: DemoConfig.Groups});

        addChannels(this.lensingViewer.viewerAux, img);
        // this.lensingViewer.viewerAux.world.addHandler("add-item", (e) => {
        //     e.item.setWidth(img.width / img.height);
        // });

    }

}