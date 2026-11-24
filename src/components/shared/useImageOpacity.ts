import { useEffect, useRef, useState } from "react";
import { clampImageOpacity } from "@/lib/imaging/imageOpacity";
import { useAppStore } from "@/lib/stores/appStore";
import { type Image, useDocumentStore } from "@/lib/stores/documentStore";
import { setImageOpacity } from "@/lib/stores/storeUtils";

function clearPreview(imageId: string) {
  const app = useAppStore.getState();
  if (app.imageOpacityPreview?.imageId === imageId) {
    app.setImageOpacityPreview(null);
  }
}

/**
 * An image's opacity in whole percent for a range input: `show` previews a
 * value in the viewer, `commit` saves the last shown one (one undo step),
 * `cancel` drops the preview.
 */
export function useImageOpacity(image: Image) {
  const committed = Math.round(clampImageOpacity(image.opacity) * 100);
  const [pct, setPct] = useState(committed);
  const pctRef = useRef(committed);
  const last = useRef(committed);

  useEffect(() => {
    pctRef.current = committed;
    last.current = committed;
    setPct(committed);
  }, [committed]);
  useEffect(() => () => clearPreview(image.id), [image.id]);

  const show = (next: number) => {
    pctRef.current = next;
    setPct(next);
    useAppStore
      .getState()
      .setImageOpacityPreview({ imageId: image.id, opacity: next / 100 });
  };
  const commit = () => {
    const next = pctRef.current;
    if (next !== last.current) {
      last.current = next;
      const doc = useDocumentStore.getState();
      doc.setImages(setImageOpacity(doc.images, image.id, next / 100));
    }
    clearPreview(image.id);
  };
  const cancel = () => {
    pctRef.current = last.current;
    setPct(last.current);
    clearPreview(image.id);
  };
  return { pct, show, commit, cancel };
}
