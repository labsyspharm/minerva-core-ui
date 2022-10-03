import * as d3 from 'd3';

const filters = [
    // Channel groups
    {
        data: [],
        name: 'fil_channel_groups',
        display: 'Channel groups',
        settings: {
            active: 1,
            async: false,
            default: 1,
            loading: false,
            max: 1,
            min: 0,
            step: 1,
            vf: true,
            iter: 'px'
        },
        variables: {
            referenceClass: null as any,
            sourceClass: null as any,
        },
        set_pixel: function (lensing: any, lenses: any): void {

            // Trigger update
            lensing.viewfinder.setup.wrangle()
            lensing.viewfinder.setup.render();

        },
        update: (i, index, lensing, lenses: any) => {

            // Magnify (simply pass through after filter)
            lensing.lenses.selections.magnifier.update(i, index, lensing);
        },
        fill: 'rgba(255, 255, 255, 0)',
        stroke: 'rgba(0, 0, 0, 1)',
        vfSetup: function (): any {

            // Access
            const filter = this;

            return {
                init: function (): void {

                    //
                    const vis = this;

                    // Viewfinder
                    const viewfinder = filter.variables.referenceClass.viewfinder;

                    // Resize blackboard  viewfinder
                    viewfinder.configs.boxW = 350;
                    viewfinder.configs.boxH = 250;
                    viewfinder.els.blackboardRect.attr('width', viewfinder.configs.boxW);
                    viewfinder.els.blackboardRect.attr('height', viewfinder.configs.boxH);

                    // Add extensions (to later remove)
                    const radialGExt = viewfinder.els.radialG.append('g')
                        .attr('class', 'vfRadial');
                    const boxGExt = viewfinder.els.boxG.append('g')
                        .attr('class', 'vfBox');

                    // Title
                    boxGExt.append('text')
                        .attr('class', 'filterTitle')
                        .attr('x', 10)
                        .attr('y', 10)
                        .attr('fill', 'white')
                        .attr('font-size', 13)
                        .attr('font-weight', 600)
                        .attr('dominant-baseline', 'hanging')
                        .html(filter.display);

                    // Action
                    boxGExt.append('text')
                        .attr('class', 'filterAction')
                        .attr('x', viewfinder.configs.boxW - 10)
                        .attr('y', 10)
                        .attr('fill', 'white')
                        .attr('font-size', 11)
                        .attr('font-weight', 400)
                        .attr('font-style', 'italic')
                        .attr('dominant-baseline', 'hanging')
                        .attr('text-anchor', 'end')
                        .html(`Press "C" to toggle.`);

                    // Title
                    let counterY = 15;
                    boxGExt.selectAll('.channelGroupG')
                        .data(filter.variables.sourceClass.getChannelGroups())
                        .join('g')
                        .attr('class', 'channelGroupG')
                        .each(function (d: any, i: number): void {

                            //
                            const channelGroupG = d3.select(this);

                            // Add label
                            counterY += 20;
                            channelGroupG.selectAll('.label')
                                .data([d])
                                .join('text')
                                .attr('x', 20)
                                .attr('y', counterY)
                                .attr('opacity', 0.5)
                                .attr('class', 'label')
                                .attr('fill', 'white')
                                .attr('font-size', 11)
                                .attr('dominant-baseline', 'hanging')
                                .html(d.Name)

                            // Add text report (inc. channels and colors)
                            counterY += 20;
                            let channelText = '';
                            d.Channels.forEach((c: string, iI: number) => {
                                channelText += `<tspan fill="#${d.Colors[iI]}">&#11044;</tspan> ${c}&nbsp;&nbsp;`;
                            })
                            channelGroupG.selectAll('.channels')
                                .data([d])
                                .join('text')
                                .attr('x', 25)
                                .attr('y', counterY)
                                .attr('class', 'channels')
                                .attr('fill', 'white')
                                .attr('font-size', 11)
                                .attr('dominant-baseline', 'hanging')
                                .attr('opacity', 0.5)
                                .html(channelText);

                        })
                    // .on('keydown', (e: any, d: any) => {
                    //
                    //     console.log(d)
                    //     if (e.key === 'C') {
                    //
                    //         // Increment
                    //         filter.variables.sourceClass.loadNewChannelGroup();
                    //     }
                    //
                    // });
                    document.addEventListener('keydown', (e: any) => {

                        if (e.key === 'C') {

                            // Increment
                            filter.variables.sourceClass.loadNewChannelGroup();
                            vis.wrangle();
                            vis.render();
                        }

                    });

                },
                wrangle: () => {

                },
                render: () => {

                    // Viewfinder
                    const viewfinder = filter.variables.referenceClass.viewfinder;

                    // Get idx
                    const current = filter.variables.sourceClass.getCurrentChannelGroup();

                    // Highlight current channel group
                    const channelGroups = viewfinder.els.radialG.selectAll('.channelGroupG');
                    channelGroups
                        .selectAll('text')
                        .attr('opacity', 0.5);
                    channelGroups
                        .filter((d: any) => d.Name === current.Name)
                        .selectAll('text')
                        .attr('opacity', 1);

                },
                destroy: () => {

                    // Viewfinder
                    const viewfinder = filter.variables.referenceClass.viewfinder;

                    // ...
                    viewfinder.els.radialG.select('.vfRadial').remove();
                    viewfinder.els.boxG.select('.vfBox').remove();

                }
            };
        },
    },
    // Split Screen
    {
        data: [],
        name: 'fil_split_screen',
        display: 'Split screen',
        settings: {
            active: 1,
            async: false,
            default: 1,
            loading: false,
            max: 1,
            min: 0,
            step: 1,
            vf: true,
            iter: 'px'
        },
        variables: {
            referenceClass: null as any,
            sourceClass: null as any,
        },
        set_pixel: function (lensing: any, lenses: any): void {

            // Trigger update
            lensing.viewfinder.setup.wrangle()
            lensing.viewfinder.setup.render();

        },
        update: (i, index, lensing, lenses: any) => {

            // Magnify (simply pass through after filter)
            lensing.lenses.selections.magnifier.update(i, index, lensing);
        },
        fill: 'rgba(255, 255, 255, 0)',
        stroke: 'rgba(0, 0, 0, 1)',
        vfSetup: function (): any {

            // Access
            const filter = this;

            return {
                init: function (): void {

                    //
                    const vis = this;

                    // Viewfinder
                    const viewfinder = filter.variables.referenceClass.viewfinder;

                    // Add extensions (to later remove)
                    const radialGExt = viewfinder.els.radialG.append('g')
                        .attr('class', 'vfRadial');
                    const boxGExt = viewfinder.els.boxG.append('g')
                        .attr('class', 'vfBox');

                    // Add faux lens
                    radialGExt.append('circle')
                        .attr('fill', 'none')
                        .attr('stroke', 'white')

                    // Get lens and viewfinder wls
                    const lensContainer = d3.select('.overlay_container_lens');

                    // Add div (remove on destroy)
                    const viewfinderDiv = lensContainer.append('div')
                        .attr('class', 'vfDiv')
                        .style('position', 'absolute')
                        .style('transform', 'translate3d(0, 0, 0,)');
                    viewfinderDiv.append('canvas');

                },
                wrangle: () => {

                },
                render: () => {

                    // Viewfinder
                    const viewfinder = filter.variables.referenceClass.viewfinder;

                    // Elements
                    const viewfinderDiv = d3.select('.vfDiv');
                    const viewfinderBoxG = d3.select('.viewfinder_box_g');
                    const lensContainer = d3.select('.overlay_container_lens');

                    // Update vf box size
                    const styleW = lensContainer.select('canvas').style('width');
                    const styleH = lensContainer.select('canvas').style('height');
                    const attrW = lensContainer.select('canvas').attr('width');
                    const attrH = lensContainer.select('canvas').attr('height');
                    viewfinder.els.blackboardRect.attr('width', 0);
                    viewfinder.els.blackboardRect.attr('height', 0);
                    viewfinder.configs.boxW = +styleW.replace('px', '');
                    viewfinder.configs.boxH = +styleH.replace('px', '');

                    // Place a faux lens
                    d3.select('.vfRadial circle')
                        .attr('r', viewfinder.configs.boxW / 2);

                    // Move viewfinderDiv (that holds lens)
                    const vfBoxGTransform = viewfinderBoxG.style('transform')
                        .split('(')[1].split(')')[0].split(', ');
                    const vfBoxGLeft = +vfBoxGTransform[0].replace('px', '');
                    const vfBoxGTop = +vfBoxGTransform[1].replace('px', '');
                    const vfBoxGOffsetW = viewfinder.configs.boxW / 2;
                    const vfBoxGOffsetH = viewfinder.configs.boxH / 2;
                    viewfinderDiv.style('left', `${vfBoxGLeft + vfBoxGOffsetW}px`);
                    viewfinderDiv.style('top', `${vfBoxGTop + vfBoxGOffsetH}px`);


                    // Hide lens canvas (Fix on destroy)
                    const lensCanvas = lensContainer.select('canvas');
                    // lensCanvas.style('visibility', 'hidden');

                    // Size and draw new canvas
                    const vfCanvas = viewfinderDiv.select('canvas');
                    vfCanvas.style('width', styleW);
                    vfCanvas.style('height', styleH);
                    vfCanvas.style('border', '1px solid blue');
                    vfCanvas.attr('width', attrW);
                    vfCanvas.attr('height', attrH);
                    const vfContext = vfCanvas.node().getContext('2d');
                    vfContext.drawImage(lensCanvas.node(), 0, 0);

                },
                destroy: () => {

                    // Viewfinder
                    const viewfinder = filter.variables.referenceClass.viewfinder;

                    // ...
                    viewfinder.els.radialG.select('.vfRadial').remove();
                    viewfinder.els.boxG.select('.vfBox').remove();

                    // Return visibility
                    const lensContainer = d3.select('.overlay_container_lens');
                    lensContainer.select('canvas').style('visibility', 'visible');

                    // Remove
                    d3.select('.vfDiv').remove();

                }
            };
        },
    },

];

export default filters;