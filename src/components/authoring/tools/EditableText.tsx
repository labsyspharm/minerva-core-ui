import React from "react";
import styled from "styled-components";

const parseEvent = (e) => e.target.value;

const handleText = ({ setInput }) => {
  return (e) => setInput(parseEvent(e));
};

const FieldWrap = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
`;

const StyledInput = styled.input`
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
  outline: none;
  font: inherit;
  line-height: 1.2;
  color: inherit;
  background: transparent;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:focus {
    text-decoration: underline;
    text-underline-offset: 2px;
    text-decoration-color: color-mix(in srgb, currentColor 45%, transparent);
  }
`;

const EditableText = (props) => {
  const { uuid, editable = true } = props;
  const { setInput } = props;
  const { cache } = props;

  const cached = cache.has(uuid);
  const text = cached ? cache.get(uuid) : props.children;

  const onChange = handleText({ setInput });

  const inputProps = {
    type: "text",
    value: text,
    onChange,
  };

  const El = React.Fragment;
  const content = editable ? (
    <StyledInput {...inputProps} title={text} />
  ) : (
    <El>{text}</El>
  );

  return <FieldWrap>{content}</FieldWrap>;
};

export { EditableText };
