import type { ReactNode } from "react";
import { AuthorView } from "@/components/authoring/AuthorSidebar";
import { ImageExporter } from "@/components/playback/ImageExporter";
import {
  PresentationFrame,
  PresentationNav,
  PresentationRibbon,
  usePresentationNavHidden,
} from "@/components/playback/Presentation";
import { ChannelPanel } from "@/components/shared/channel/ChannelPanel";
import type { DicomIndex } from "@/lib/imaging/dicomIndex";
import type { OmeLoaderEntry } from "@/lib/imaging/loaderEntries";
import type { Image } from "@/lib/stores/documentStore";
import type { StoryExportMode } from "@/lib/storyExport/storyBundle";
import styles from "./PlaybackModeView.module.css";

export type PlaybackModeViewProps = {
  viewer: ReactNode;
  imagesPanel: ReactNode;
  hiddenChannel: boolean;
  noLoader: boolean;
  ensureChannelHistograms?: (channelIds: string[]) => Promise<void>;
  contrastEditable?: boolean;
  ioState: null | string;
  stopExport: () => void;
  presenting: boolean;
  /** Images the viewer paints (export colors for ungrouped channels while presenting). */
  viewerImages: Image[];
  directory_handle: FileSystemDirectoryHandle;
  exitPlaybackPreview?: () => void;
  dicomIndexList: DicomIndex[];
  omeLoaderEntries: OmeLoaderEntry[];
  exportMode?: StoryExportMode;
  /** When set, JPEG confirm UI can write document.json without re-encoding. */
  onDocumentOnlyUpdate?: () => Promise<void>;
  /** When set, ask where to write before starting the exporter. */
  exportFolderPrompt?: {
    folderName: string;
    onUpdateExisting: () => void;
    onChooseDifferent: () => void;
    onCancel: () => void;
  } | null;
};

/**
 * Authoring and Story preview share one tree so the viewer's Deck is never
 * unmounted: a remount would re-init already-finalized deck.gl layers.
 */
export const PlaybackModeView = (props: PlaybackModeViewProps) => {
  const { presenting } = props;
  const hideNavPane = usePresentationNavHidden();
  const exporting = props.ioState === "EXPORTING";
  const folderPrompt = props.exportFolderPrompt;
  const overlayOpen = exporting || !!folderPrompt;
  const exporterProps = {
    stopExport: props.stopExport,
    dicomIndexList: props.dicomIndexList,
    omeLoaderEntries: props.omeLoaderEntries,
    directory_handle: props.directory_handle,
    exportMode: props.exportMode,
    onDocumentOnlyUpdate: props.onDocumentOnlyUpdate,
  };

  return (
    <div
      className={styles.modeViewport}
      data-mode={
        presenting
          ? "presenting"
          : exporting
            ? "exporting"
            : folderPrompt
              ? "export-dest"
              : "author"
      }
    >
      <div
        className={[
          styles.authorViewport,
          overlayOpen ? styles.authorViewportHidden : null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <PresentationFrame active={presenting}>
          {presenting ? (
            <PresentationRibbon
              exitPlaybackPreview={props.exitPlaybackPreview}
            />
          ) : null}
          <AuthorView
            imagesPanel={props.imagesPanel}
            noLoader={props.noLoader}
            ensureChannelHistograms={props.ensureChannelHistograms}
            contrastEditable={props.contrastEditable}
            previewNav={
              presenting ? <PresentationNav showStoryName={false} /> : undefined
            }
            previewNavHidden={hideNavPane}
            viewer={
              <ChannelPanel
                hiddenChannel={!presenting && props.hiddenChannel}
                noLoader={props.noLoader}
                images={props.viewerImages}
              >
                {props.viewer}
              </ChannelPanel>
            }
          />
        </PresentationFrame>
      </div>
      {folderPrompt ? (
        <div className={styles.exportOverlay}>
          <div className={styles.folderPrompt} role="dialog" aria-modal="true">
            <div className={styles.folderPromptTitle}>Export story</div>
            <div className={styles.folderPromptBody}>
              Update the existing folder “{folderPrompt.folderName}”, or pick a
              different one?
            </div>
            <div className={styles.folderPromptActions}>
              <button
                type="button"
                className={styles.folderPromptPrimary}
                onClick={folderPrompt.onUpdateExisting}
              >
                Update “{folderPrompt.folderName}”
              </button>
              <button type="button" onClick={folderPrompt.onChooseDifferent}>
                Choose different folder…
              </button>
              <button type="button" onClick={folderPrompt.onCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : exporting ? (
        <div className={styles.exportOverlay}>
          <ImageExporter {...exporterProps} />
        </div>
      ) : null}
    </div>
  );
};
