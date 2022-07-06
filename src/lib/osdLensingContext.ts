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

export class OsdLensingContext {

    // Class vars
    lensingContext = null as any;
    viewerContext = null as any;

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

        const {g, v, groups, config, update} = opts;

        // LENSING - viewer
        const viewerConfigs = {
            immediateRender: true,
            maxZoomPixelRatio: 10,
            visibilityRatio: 0.9,
            showHomeControl: false,
            showFullPageControl: false,
            ...(config as any),
        }
        const lensingViewer = new lensing.construct(
            OSD,
            this.viewerContext.viewport.viewer,
            Object.assign(viewerConfigs, {id: viewerConfigs.element.id}),
            {},
            []
        );
        const viewer = lensingViewer.viewerAux;

        // Refactored from original reset
        const img = makeImage({g: g, groups});

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

}