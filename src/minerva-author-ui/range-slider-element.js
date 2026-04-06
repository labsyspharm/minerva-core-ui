import UI5Slider from "@ui5/webcomponents/dist/RangeSlider.js";

/**
 * UI5 keeps the inner handle (or progress bar) focused after pointer release.
 * Horizon styles use the same token for :focus and active drag, so the grip
 * looks stuck until another handle takes focus. Blur once the interaction ends.
 */
class MinervaRangeSlider extends UI5Slider {
  _handleUp() {
    super._handleUp();
    queueMicrotask(() => {
      const root = this.shadowRoot;
      if (!root) {
        return;
      }
      const active = root.activeElement;
      if (
        active &&
        (active.classList.contains("ui5-slider-handle") ||
          active.classList.contains("ui5-slider-progress"))
      ) {
        active.blur();
      }
    });
  }
}

const toRangeSlider = () => {
  class RangeSlider extends MinervaRangeSlider {}
  return RangeSlider;
};

export { toRangeSlider, MinervaRangeSlider };
