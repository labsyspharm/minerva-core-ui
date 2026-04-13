/** Pixel width/height of saved waypoint preview images (`ThumbnailDataUrl` / story `thumbnail`). */
export const WAYPOINT_THUMBNAIL_PIXEL_SIZE = 64;

/**
 * JPEG quality (0–1) for `canvas.toDataURL("image/jpeg", …)` thumbnails.
 * Lower = smaller payload, more compression artifacts (try 0.75–0.92).
 */
export const WAYPOINT_THUMBNAIL_JPEG_QUALITY = 0.85;
