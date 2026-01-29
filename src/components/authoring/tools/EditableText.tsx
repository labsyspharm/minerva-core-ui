import React from "react";
import styled from "styled-components";
import TextareaAutosize from "react-textarea-autosize";

const parseEvent = (e) => e.target.value;

const handleText = ({ setInput }) => {
  return (e) => setInput(parseEvent(e));
};

const Mono = styled.div`
  textarea {
    resize: none;
    display: grid;
    width: 100%;
    padding: 0.333em;
    font-size: 1em;
    align-items: center;
    word-spacing: -0.333em;
    font-family: monospace;
    border-radius: 0.333em;
    color: rgb(244, 255, 244);
    background-color: rgb(0, 0, 0, 0);
    border-bottom: 0.5em ridge rgba(244, 255, 244, 0.5);
  }
`;

const EditableText = (props) => {
  const { uuid, editable = true } = props;
  const { setInput, md = false } = props;
  const { cache, updateCache } = props;

  const cached = cache.has(uuid);
  const setText = (t) => updateCache(uuid, t);
  const text = cached ? cache.get(uuid) : props.children;

  const onChange = handleText({ setInput });

  const inputProps = {
    value: text,
    minRows: 1,
    onChange,
  };

  const El = React.Fragment;
  const content = editable ? (
    <Mono>
      <TextareaAutosize {...inputProps} />
    </Mono>
  ) : (
    <El>{text}</El>
  );

  return <div>{content}</div>;
};

export { EditableText };
