/// <reference types="vite/client" />

declare module "*.module.css";
declare module "use-hash-history";
declare module "deck.gl" {
  export namespace DeckTypings {}
}
import "wicg-file-system-access";
declare var showOpenFilePicker: ShowOpenFilePicker;
declare global {
  /** Set in `vite.config.js` via `define` on each bundle (dev restart / `vite build`). */
  const __BUILD_TIME_ISO__: string;
  /** Full sha from `VITE_APP_GIT_SHA` in CI, otherwise local `HEAD`. Empty when neither is available. */
  const __BUILD_GIT_SHA__: string;
  namespace Handle {
    type File = FileSystemFileHandle;
    type Dir = FileSystemDirectoryHandle;
  }
}
