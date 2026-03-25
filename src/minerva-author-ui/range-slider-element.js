import UI5Slider from "@ui5/webcomponents/dist/RangeSlider.js";

const toRangeSlider = () => {
  class RangeSlider extends UI5Slider {
  }
  return RangeSlider;
}

export { toRangeSlider };
