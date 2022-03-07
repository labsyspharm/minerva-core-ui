import * as React from "react";
import styled from "styled-components";
import { Icon } from "../common/icon";

const Editor = (props) => {
  const [noEdit, yesEdit] = props.editSwitch;
  const [Plain, plainProps] = noEdit;
  const [Edit, editProps] = yesEdit;
  if (props.editable) {
    return <Edit {...editProps} />;
  }
  return <Plain {...plainProps} />;
};

export { Editor };
