import * as React from "react";
import { useAnnotationLayers } from "@/lib/annotationLayers";

/**
 * AnnotationRenderer
 *
 * Minimal component that syncs annotation deck.gl layers into the overlay store
 * without rendering UI. Intended for presenter mode (non-interactive).
 */
export const AnnotationRenderer: React.FC = () => {
	useAnnotationLayers(false);
	return null;
};

