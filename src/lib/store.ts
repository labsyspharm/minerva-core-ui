import { create } from 'zustand';

interface OverlayState {
  activeTool: string;
  setActiveTool: (tool: string) => void;
}

const useOverlayStore = create<OverlayState>((set) => ({
  activeTool: 'move',
  setActiveTool: (tool) => set({ activeTool: tool }),
}));

export const useActiveTool = () => useOverlayStore((state) => state.activeTool);
export const useSetActiveTool = () => useOverlayStore((state) => state.setActiveTool);
