import * as React from "react";
import {useEffect, useState} from "react";
import {createOSD} from '../lib/createOSD';
import styles from "./imageView.module.css";
import {
  toV, fromV  
} from '../lib/hashUtil';
import type {
  Hash
} from '../lib/hashUtil';

type Props = {
  hash?: Hash,
  img: object,
  channels: any[]
}

const setViewport = ({viewport}, {v}) => {
  const {scale, pan} = fromV(v)
  viewport.panTo(pan);
  viewport.zoomTo(scale);
  viewport.applyConstraints(true);
}

const ImageView = (props:Props) => {

  const osdID = 'ImageView'
  const {hash, img, channels} = props
  const [viewer, setViewer] = useState(null)

  const viewportToV = (viewport) => {
    const v = toV(viewport)
    hash.set({...hash.state, v})
  }

  useEffect(() => {
    setViewer(createOSD({
      osdID,
      viewportToV,
      img, channels
    }))
  }, [])

  useEffect(() => {
    if (viewer !== null) {
      setViewport(viewer, hash.state)
    }
  }, [viewer, hash.state.v])


  return (
    <div className={styles.h100}>
      <div className={styles.h100} id={osdID}>
      </div>
    </div>
  );
}

export {
  ImageView
};
