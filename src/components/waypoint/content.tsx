import * as React from "react";
import { getWaypoint, getWaypoints, handleWaypoint } from "../../lib/waypoint";
import { PopUpdateWaypoint, PushWaypoint } from "../editable/waypoints";
import { Status } from "../editable/status";
import { Editor } from "../editable/common";
import { Header } from "../common/header";
import { Icon } from "../common/icon";
import { Audio } from "./audio";
import { Nav } from "./nav";
import styles from "./content.module.css";
import {
  faEye as faView,
  faPen as faEdit,
  faList as faHome,
  faArrowLeft as faPrev,
  faArrowRight as faNext,
} from "@fortawesome/free-solid-svg-icons";

// Types
import type { Group, Story, Waypoint } from "../../lib/exhibit";
import type { HashContext } from "../../lib/hashUtil";

export type OptSW = { s: number; w: number };

export type ExternalProps = HashContext & {
  pushWaypoint: (w: Waypoint, opt: OptSW) => void;
  updateWaypoint: (w: Waypoint, opt: OptSW) => void;
  popWaypoint: (opt: OptSW) => void;
  toggleEditor: () => void;
  toggleViewer: () => void;
  editable: boolean;
  groups: Group[];
  stories: Story[];
};

type Props = ExternalProps & {
  children: any;
};

const defaultWaypoint: Waypoint = {
  v: [0.5, 0.5, 0.5],
  markdown: "",
  name: "",
  g: 0,
};

const useWaypoint = ({ stories, hash }: Props) => {
  const { s, w } = hash;
  const waypoint = getWaypoint(stories, s, w) || {};
  return { ...defaultWaypoint, ...waypoint };
};

const useIcons = (props: Props) => {
  const { stories, hash, setHash } = props;
  const { s, w } = hash;
  const handler = handleWaypoint(stories, { s, w });
  const onClick = (diff) => setHash(handler(diff));
  const pathname = "/";
  const size = 1.2;
  return {
    homeProps: {
      size: `${size}em`,
      icon: faHome,
      onClick: () => {
        // TODO
        //navigate.push({ pathname });
      }
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

const countWaypoints = ({ stories, hash }) => {
  const { s, w } = hash;

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

const Count = (props) => {
  const { idx, sum } = countWaypoints(props);
  const { pushWaypoint, hash } = props;
  const { s } = hash;
  const onPush = () => {
    const w = getWaypoints(props.stories, s).length;
    pushWaypoint(
      { name: `WP ${w}`, markdown: "", g: 0, v: [-1, -1, -1] },
      { s }
    );
    props.setHash({ w });
  };

  const editSwitch = [
    ["div", {}],
    [PushWaypoint, { onPush }],
  ];
  const extraUI = <Editor {...{ ...props, editSwitch }} />;

  return (
    <div className={styles.count}>
      <span>
        {idx}/{sum}
      </span>
      <span>{extraUI}</span>
    </div>
  );
};

const Content = (props: Props) => {
  const { children } = props;
  const icons = useIcons(props);
  const waypoint = useWaypoint(props);
  const { markdown, name } = waypoint;
  const { prevProps, nextProps, homeProps } = icons;
  const { updateWaypoint } = props;
  const onPop = () => {
    const { s, w } = props.hash;
    props.popWaypoint({ s, w });
    if (w > 0) {
      props.setHash({ w: w - 1 });
    } else {
      const newS = (s - 1) % props.stories.length;
      const waypoints = getWaypoints(props.stories, newS);
      const diff = newS === s ? 2 : 1;
      const newW = waypoints.length - diff;
      props.setHash({ s: newS, w: newW });
    }
  };
  const toggleProps = {
    onClick: () => props.toggleViewer(),
    size: "1.5em",
    icon: faView,
  };
  const toggleEditorProps = {
    onClick: () => props.toggleEditor(),
    size: "1.5em",
    icon: faEdit,
  };

  const setNameInput = (t) => {
    const { s, w } = props.hash;
    props.updateWaypoint({ ...waypoint, name: t }, { s, w });
  };

  const uuidName = `waypoint/name/${props.hash.w}`;
  const nameStatusProps = {
    ...props,
    md: false,
    setInput: setNameInput,
    updateCache: () => null,
    cache: new Map(),
    uuid: uuidName,
  };

  const coreUI = (
    <Header h={3}>
      <Status {...nameStatusProps}>{name}</Status>
    </Header>
  );
  const editSwitch = [
    ["div", { children: coreUI }],
    [PopUpdateWaypoint, { children: coreUI, onPop }],
  ];
  const waypoints = getWaypoints(props.stories, props.hash.s);
  const isSoloWaypoint = waypoints.length <= 1;
  const canPop = props.editable && !isSoloWaypoint;
  const extraUI = <Editor {...{ ...props, editable: canPop, editSwitch }} />;

  const editStatus = [
    ["div", { children: "Editor is off" }],
    ["div", { children: "Editor is on" }],
  ];
  const editStatusUI = <Editor {...{ ...props, editSwitch: editStatus }} />;

  const uuid = `waypoint/markdown/${props.hash.s}/${props.hash.w}`;
  const setInput = (t) => {
    const { s, w } = props.hash;
    props.updateWaypoint({ ...waypoint, markdown: t }, { s, w });
  };
  const statusProps = {
    ...props,
    md: true,
    setInput,
    updateCache: () => null,
    cache: new Map(),
    uuid,
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.core}>
        <div className={styles.header}>
          <div>{extraUI}</div>
          <Icon {...homeProps} />
        </div>
        <Nav>
          {isSoloWaypoint ? "" : <Icon {...prevProps} />}
          {isSoloWaypoint ? "" : <Icon {...nextProps} />}
        </Nav>
        <Nav>
          <div className={styles.navSpan}>
            {editStatusUI}
            <Icon {...toggleEditorProps} />
          </div>
        </Nav>
        {<Count {...props} />}
        <Status {...statusProps}>{markdown}</Status>
      </div>
      <div className={styles.toolbar}>{children}</div>
    </div>
  );
};

export { Content };
