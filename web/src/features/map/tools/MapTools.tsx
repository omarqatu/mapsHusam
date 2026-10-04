import { useEffect } from 'react';
import EditTool from '../edit/EditTool';
import { useSearchUi } from '../search/store';
import { useMapUi } from '../store';
import MeasureTool from './MeasureTool';
import ShareTool from './ShareTool';

/**
 * Mounts the measure, share and (admin) edit tools (their layers and panels) and keeps the end-side panels exclusive: opening a
 * tool closes the layer and search panels, and opening either of those closes the tool.
 */
export default function MapTools() {
  useEffect(() => {
    const offUi = useMapUi.subscribe((s, prev) => {
      if (s.activeTool && s.activeTool !== prev.activeTool) {
        s.setLayersOpen(false);
        useSearchUi.getState().closePanel(); // also ends "pick a point" for nearby search
        if (window.innerWidth < 640) s.setSelected(null); // phones: one bottom sheet at a time
      }
      if (s.layersOpen && !prev.layersOpen && s.activeTool) s.setActiveTool(null);
    });
    const offSearch = useSearchUi.subscribe((s, prev) => {
      if (s.panelOpen && !prev.panelOpen) useMapUi.getState().setActiveTool(null);
    });
    return () => {
      offUi();
      offSearch();
    };
  }, []);

  return (
    <>
      <MeasureTool />
      <ShareTool />
      <EditTool />
    </>
  );
}
