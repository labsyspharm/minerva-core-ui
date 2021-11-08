import type {
  UnaryFn
} from './util.js'
import type {
  Viewer
} from 'openseadragon'

const updateOSD: UnaryFn<{
  viewer: Viewer 
}, void> = ({viewer}) => {
  //componentDidUpdate
}

export {
  updateOSD
}

