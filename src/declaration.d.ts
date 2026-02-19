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
  namespace Handle {
    type File = FileSystemFileHandle;
    type Dir = FileSystemDirectoryHandle;
  }
}
