import UAParser from "ua-parser-js";

/**
 * Phones and tablets. iPadOS Safari sends a Mac user agent by default, so a
 * Mac with a touch screen counts as an iPad.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const { device, os } = UAParser(navigator.userAgent);
  if (device.type === "mobile" || device.type === "tablet") return true;
  return os.name === "Mac OS" && navigator.maxTouchPoints > 1;
}
