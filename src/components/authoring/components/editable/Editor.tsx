import * as React from "react";
import styled from "styled-components";
import { Icon } from "src/components/shared/components/common/Icons";

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
