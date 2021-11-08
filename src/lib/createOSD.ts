import * as OpenSeadragon from 'openseadragon'

const makeTileSource = ({img}) => {
  const { url, group, ext } = img;

  const getTileName = (x, y, level) => {
    return `${group}/${level}_${x}_${y}.${ext}`;
  }

  const getTileUrl = function(l, x, y) {
    const level = img.maxLevel - l;

    const name = getTileName(x, y, level);
    return `${url}/${name}`;
  }

  return {
    // Custom functions
    getTileUrl: getTileUrl,
    // Standard parameters
    tileHeight: img.tilesize,
    tileWidth: img.tilesize,
    width: img.width,
    height: img.height,
    maxLevel: img.maxLevel,
    minLevel: 0
  }
}

const addChannels = ({viewer, img}) => {
  viewer.addTiledImage({
    tileSource: makeTileSource({img}),
    width: img.width / img.height,
  });
}

//const createOSD = ({osdID, img, handleViewport, channels, interactor}) => {
const createOSD = ({osdID, img, channels, viewportToV}) => {

  const prefixUrl = 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/2.3.1/images/'
  console.log('Creating new OpenSeadragon');
  // Set up openseadragon viewer
  const viewer = OpenSeadragon({
    immediateRender: true,
    navigatorPosition: 'BOTTOM_RIGHT',
    //zoomOutButton: options.id + '-zoom-out',
    //zoomInButton: options.id + '-zoom-in',
    id: osdID,
    prefixUrl: prefixUrl,
    maxZoomPixelRatio: 10,
    visibilityRatio: 0.9
  });
  //viewer.uuid = img.uuid;
  //interactor(viewer);

  addChannels({viewer, img});
  const {world} = viewer;
  world.addHandler('add-item', (e) => {
    e.item.setWidth(img.width / img.height);
  });

  viewer.addHandler('animation-finish', () => {
    viewportToV(viewer.viewport);
  });
  return viewer
}

export {
  createOSD
}

