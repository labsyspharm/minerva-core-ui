import React from "react";
import styles from "./EditableText.module.css";

const parseEvent = (e) => e.target.value;

const handleText = ({ setInput }) => {
  return (e) => setInput(parseEvent(e));
};

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
    <input className={styles.input} {...inputProps} title={text} />
  ) : (
    <El>{text}</El>
  );

  return <div className={styles.fieldWrap}>{content}</div>;
};

export { EditableText };
