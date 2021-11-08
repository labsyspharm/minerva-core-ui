import * as React from "react";
import {useEffect} from "react";

import {ImageView} from './imageView';
import styles from "./repo.module.css";

import type {
  Hash
} from '../lib/hashUtil';

type Props = {
  hash?: Hash
}

const Repo = (props:Props) => {
  const img = {
    "name": "i0",
    "description": "Primary Lung Cancer [M-003]",
    "url": "https://s3.amazonaws.com/www.cycif.org/Nature-protocol-2019/LUNG_3",
    "group": "Structural-Components_0__DAPI--14__KERATIN--34__ASMA--22__CD45--33__IBA1",
    "width": 14448,
    "height": 11101,
    "tilesize": 1024,
    "ext": "jpg",
    "maxLevel": 4
  } 
  const {hash} = props;

  const repoClass = [
    'h100',
    'bg-dark'
  ].map(k=>styles[k]).join(' ')
  return (
    <div className={repoClass}>
      <ImageView {...{
        hash,
        img: img,
        channels: []
      }}/>
    </div>
  );
}

export {
  Repo
}
