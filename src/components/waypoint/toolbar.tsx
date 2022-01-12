import * as React from "react";
import { Icon, RefIcon } from "../common/icon";
import { WrapIcons } from "../common/icons";
import {
  faChevronLeft as faHide,
  faChevronRight as faShow,
  faSearchMinus as faMinus,
  faSearchPlus as faPlus,
  faLocationArrow as faArrow,
  faBullseye as faPolygon,
  faCrosshairs as faOverlay,
  faClone,
} from "@fortawesome/free-solid-svg-icons";

const Toolbar = (props) => {
  const { onZoomInEl, onZoomOutEl } = props;
  const { hide, togglePanel } = props;

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

  return (
    <>
      <WrapIcons justify="center">
        <Icon {...toggleProps} />
        <RefIcon {...zoomInProps} />
        <RefIcon {...zoomOutProps} />
        <Icon icon={faArrow} />
        <Icon icon={faPolygon} />
        <Icon icon={faOverlay} />
        <Icon icon={faClone} />
      </WrapIcons>
    </>
  );
};

export { Toolbar };
