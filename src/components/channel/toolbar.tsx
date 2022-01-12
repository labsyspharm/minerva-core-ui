import * as React from "react";
import { Icon } from "../common/icon";
import { WrapIcons } from "../common/icons";
import {
  faChevronLeft as faShow,
  faChevronRight as faHide,
} from "@fortawesome/free-solid-svg-icons";

const Toolbar = (props) => {
  const { hide, togglePanel } = props;

  const faToggle = hide ? faShow : faHide;

  const icon = {
    size: "1.5em",
    color: "#007bff",
    icon: faToggle,
    onClick: togglePanel,
  };
  return (
    <WrapIcons justify="start">
      <Icon {...icon} />
    </WrapIcons>
  );
};

export { Toolbar };
