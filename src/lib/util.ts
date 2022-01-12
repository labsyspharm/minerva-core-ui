const getStyler = (styles) => {
  return (..._) => _.map((k) => styles[k]).join(" ");
};

export { getStyler };
