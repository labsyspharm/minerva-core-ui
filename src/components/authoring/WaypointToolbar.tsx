import {
  faLocationArrow as faArrow,
  faChevronLeft as faHide,
  faInfo,
  faSearchMinus as faMinus,
  faCrosshairs as faOverlay,
  faSearchPlus as faPlus,
  faBullseye as faPolygon,
  faChevronRight as faShow,
} from "@fortawesome/free-solid-svg-icons";
import * as React from "react";
import { Icon, RefIcon, WrapIcons } from "@/components/shared/common/Icon";

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
    ref: React.useCallback(onZoomInEl, [onZoomInEl]),
    icon: faPlus,
  };
  const zoomOutProps = {
    ref: React.useCallback(onZoomOutEl, [onZoomOutEl]),
    icon: faMinus,
  };
  const infoProps = {
    icon: faInfo,
    onClick: toggleInfo,
  };

  return (
    <WrapIcons justify="center">
      <Icon {...toggleProps} />
      <RefIcon {...zoomInProps} />
      <RefIcon {...zoomOutProps} />
      <Icon icon={faArrow} />
      <Icon icon={faPolygon} />
      <Icon icon={faOverlay} />
      <Icon {...infoProps} />
    </WrapIcons>
  );
};
