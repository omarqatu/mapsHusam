import { useEffect } from 'react';
import { useOlMap } from '../MapContext';
import { useMapUi } from '../store';
import EditPanel from './EditPanel';
import { useIsAdmin } from './useIsAdmin';

/**
 * Admin map editing (legacy edit-core / editLines / editPolygons): mounts the panel while the edit tool is open.
 * The panel exists only for admins (UI gate; the write itself needs a GeoServer login, see transport.ts).
 */
export default function EditTool() {
  const map = useOlMap();
  const isAdmin = useIsAdmin();
  const open = useMapUi((s) => s.activeTool === 'edit');
  const setActiveTool = useMapUi((s) => s.setActiveTool);

  // Logged out / demoted while the tool is open.
  useEffect(() => {
    if (open && !isAdmin) setActiveTool(null);
  }, [open, isAdmin, setActiveTool]);

  if (!map || !open || !isAdmin) return null;
  return <EditPanel onClose={() => setActiveTool(null)} />;
}
