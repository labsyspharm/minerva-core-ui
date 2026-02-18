const EditModeSwitcher = (props) => {
  const [noEdit, yesEdit] = props.editSwitch;
  const [Plain, plainProps] = noEdit;
  const [Edit, editProps] = yesEdit;
  if (props.editable) {
    return <Edit {...editProps} />;
  }
  return <Plain {...plainProps} />;
};

export { EditModeSwitcher };
