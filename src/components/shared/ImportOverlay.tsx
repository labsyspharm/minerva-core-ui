import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import minervaTheme from "@/components/shared/minervaTheme.module.css";
import { PanelActionButton } from "@/components/shared/panel/PanelButtons";
import styles from "./Upload.module.css";

export function ImportOverlay(props: {
  title: string;
  titleId: string;
  children?: ReactNode;
  error?: string | null;
  busy?: boolean;
  busyLabel?: string;
  cancelDisabled?: boolean;
  importDisabled?: boolean;
  onCancel: () => void;
  onImport: () => void;
}) {
  const busy = props.busy === true;
  return createPortal(
    <div
      className={styles.typeOverlay}
      role="dialog"
      aria-modal="true"
      aria-busy={busy}
      aria-labelledby={props.titleId}
    >
      <div className={styles.typeOverlayBackdrop} aria-hidden="true" />
      <div className={`${minervaTheme.surface} ${styles.typeOverlayCard}`}>
        <div
          id={props.titleId}
          className={styles.typeOverlayFile}
          title={props.title}
        >
          {props.title}
        </div>
        {props.children != null ? (
          <fieldset
            disabled={props.importDisabled || busy}
            className={styles.typeOverlayFields}
          >
            {props.children}
          </fieldset>
        ) : null}
        {props.error ? (
          <div className={styles.importError} role="alert">
            {props.error}
          </div>
        ) : null}
        <div className={styles.typeFooter}>
          <PanelActionButton
            type="button"
            onClick={props.onCancel}
            disabled={props.cancelDisabled}
          >
            Cancel
          </PanelActionButton>
          <PanelActionButton
            type="button"
            className={styles.typeImport}
            disabled={props.importDisabled}
            onClick={props.onImport}
          >
            {busy ? (
              <>
                <span className={minervaTheme.spinnerSm} aria-hidden="true" />
                {props.busyLabel ?? "Importing…"}
              </>
            ) : (
              "Import"
            )}
          </PanelActionButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
