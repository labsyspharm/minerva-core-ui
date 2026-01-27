import * as React from "react";
import { Icon, RefIcon, WrapIcons } from "src/components/shared/common/Icons";
import {
  faChevronLeft as faHide,
  faChevronRight as faShow,
  faSearchMinus as faMinus,
  faSearchPlus as faPlus,
  faLocationArrow as faArrow,
  faBullseye as faPolygon,
  faCrosshairs as faOverlay,
  faInfo,
} from "@fortawesome/free-solid-svg-icons";

export type WaypointToolbarProps = {
  onZoomInEl: (el: HTMLElement | null) => void;
  onZoomOutEl: (el: HTMLElement | null) => void;
  hide: boolean;
  togglePanel: () => void;
  toggleInfo: () => void;
};

export const WaypointToolbar = (props: WaypointToolbarProps) => {
  const { onZoomInEl, onZoomOutEl } = props;
  const { hide, togglePanel, toggleInfo } = props;

  const faToggle = hide ? faShow : faHide;
  const toggleProps = {
    size: "1.5em",
    icon: faToggle,
    onClick: togglePanel,
  };
  const zoomInProps = {
    ref: React.useCallback(onZoomInEl, []),
    icon: faPlus,
  };
  const zoomOutProps = {
    ref: React.useCallback(onZoomOutEl, []),
    icon: faMinus,
  };
  const infoProps = {
    icon: faInfo,
    onClick: toggleInfo
  }

  return (
    <>
      <WrapIcons justify="center">
        <Icon {...toggleProps} />
        <RefIcon {...zoomInProps} />
        <RefIcon {...zoomOutProps} />
        <Icon icon={faArrow} />
        <Icon icon={faPolygon} />
        <Icon icon={faOverlay} />
        <Icon {...infoProps} />
      </WrapIcons>
    </>
  );
};
