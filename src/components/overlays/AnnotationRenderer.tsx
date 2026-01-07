import { useAnnotationLayers } from "./AnnotationLayers";

/**
 * AnnotationRenderer - A minimal component that renders annotations as deck.gl layers
 * without any UI (no toolbar, no drawing tools). This is used in presenter mode
 * where we want to display annotations but not allow editing.
 */
const AnnotationRenderer: React.FC = () => {
  // Use the shared hook to create and sync annotation layers
  useAnnotationLayers();

  // This component renders nothing - it only manages layers in the store
  return null;
};

export { AnnotationRenderer };
