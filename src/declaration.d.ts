/// <reference types="vite/client" />

declare module "*.module.css";
declare module "use-hash-history";
declare module "minerva-author-ui";
declare module "deck.gl" {
  export namespace DeckTypings {}
}
import "wicg-file-system-access";
declare var showOpenFilePicker: ShowOpenFilePicker;
declare global {
  /** Set in `vite.config.js` via `define` on each bundle (dev restart / `vite build`). */
  const __BUILD_TIME_ISO__: string;
  /** `package.json` version; used for CDN URLs in exported story `index.html`. */
  const __MINERVA_PACKAGE_VERSION__: string;
  namespace Handle {
    type File = FileSystemFileHandle;
    type Dir = FileSystemDirectoryHandle;
  }
}
