import * as React from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import { useHash, useSetHash } from "../../lib/hashUtil";
import { getWaypoint, handleWaypoint } from "../../lib/waypoint";
import { Header } from "../common/header";
import { Icon } from "../common/icon";
import { Audio, Sample } from "./audio";
import { Nav } from "./nav";
import styles from "./content.module.css";
import {
  faList as faHome,
  faArrowLeft as faPrev,
  faArrowRight as faNext,
} from "@fortawesome/free-solid-svg-icons";

// Types
import type { Story, Waypoint } from "../../lib/exhibit";

type Props = {
  stories: Story[];
  children: any;
};

const defaultWaypoint: Waypoint = {
  audio: Sample,
  v: [0.5, 0.5, 0.5],
  markdown: "",
  name: "",
  g: 0,
};

const useWaypoint = ({ stories }: Props) => {
  const { s, w } = useHash();
  const waypoint = getWaypoint(stories, s, w) || {};
  return { ...defaultWaypoint, ...waypoint };
};

const useIcons = ({ stories }: Props) => {
  const { s, w } = useHash();
  const setHash = useSetHash();
  const navigate = useNavigate();
  const handler = handleWaypoint(stories, { s, w });
  const onClick = (diff) => setHash(handler(diff));
  const pathname = "/";
  const size = 1.2;
  return {
    homeProps: {
      size: `${size}em`,
      icon: faHome,
      onClick: () => navigate({ pathname }),
    },
    prevProps: {
      size: `${1.5 * size}em`,
      icon: faPrev,
      onClick: () => onClick(-1),
    },
    nextProps: {
      size: `${1.5 * size}em`,
      icon: faNext,
      onClick: () => onClick(+1),
    },
  };
};

const countWaypoints = ({ stories }) => {
  const { s, w } = useHash();

  return stories.reduce(
    (out, story, _s) => {
      const wCount = story.waypoints.length;
      const idx1 = out.idx + wCount;
      const idx2 = out.idx + (w + 1);
      const idx3 = out.idx;
      const diff = 1 + Math.sign(s - _s);

      return {
        sum: out.sum + wCount,
        idx: [idx1, idx2, idx3][diff],
      };
    },
    { idx: 0, sum: 0 }
  );
};

const Content = (props: Props) => {
  const { children } = props;
  const icons = useIcons(props);
  const { idx, sum } = countWaypoints(props);
  const { markdown, name, audio } = useWaypoint(props);
  const { prevProps, nextProps, homeProps } = icons;
  const audioProps = { audio };
  return (
    <div className={styles.wrap}>
      <div className={styles.core}>
        <div className={styles.header}>
          <Header h={3}>{name}</Header>
          <Icon {...homeProps} />
        </div>
        <Nav>
          <Icon {...prevProps} />
          <Audio {...audioProps} />
          <Icon {...nextProps} />
        </Nav>
        <div className={styles.count}>
          <div>
            {idx}/{sum}
          </div>
        </div>
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
      <div className={styles.toolbar}>{children}</div>
    </div>
  );
};

export { Content };
