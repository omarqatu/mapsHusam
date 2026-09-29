import { act, fireEvent, render, screen } from '@testing-library/react';
import OlMap from 'ol/Map';
import View from 'ol/View';
import Draw from 'ol/interaction/Draw';
import DoubleClickZoom from 'ol/interaction/DoubleClickZoom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { MapContext } from '../MapContext';
import { useMapUi } from '../store';
import MapTools from './MapTools';

// Every layer / interaction / listener a tool adds must be gone when it closes.
describe('tools clean up after themselves', () => {
  let map: OlMap;
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    map = new OlMap({ target: document.createElement('div'), view: new View({ center: [0, 0], zoom: 1 }) });
    useMapUi.setState({ activeTool: null });
  });
  afterEach(() => map.setTarget(undefined));

  const dblActive = () =>
    map
      .getInteractions()
      .getArray()
      .find((i) => i instanceof DoubleClickZoom)!
      .getActive();
  const drawing = () =>
    map
      .getInteractions()
      .getArray()
      .some((i) => i instanceof Draw);

  it('measure: a Draw interaction exists only while a mode is on, double-click zoom returns after', () => {
    vi.useFakeTimers();
    const view = render(
      <MapContext value={map}>
        <MapTools />
      </MapContext>,
    );
    const layersBefore = map.getLayers().getLength();
    expect(layersBefore).toBe(2); // measure + share layers

    act(() => useMapUi.getState().setActiveTool('measure'));
    fireEvent.click(screen.getByRole('button', { name: 'قياس مسافة (متر)' }));
    expect(drawing()).toBe(true);
    expect(dblActive()).toBe(false);

    act(() => useMapUi.getState().setActiveTool(null)); // close the panel mid-draw
    expect(drawing()).toBe(false);
    act(() => void vi.runAllTimers());
    expect(dblActive()).toBe(true);

    view.unmount();
    expect(map.getLayers().getLength()).toBe(0);
    vi.useRealTimers();
  });

  it('share: the tap listener exists only while the panel is open', () => {
    render(
      <MapContext value={map}>
        <MapTools />
      </MapContext>,
    );
    const count = () => map.getListeners('singleclick')?.length ?? 0;
    expect(count()).toBe(0);
    act(() => useMapUi.getState().setActiveTool('share'));
    expect(count()).toBe(1);
    expect(map.getTargetElement().style.cursor).toBe('crosshair');
    act(() => useMapUi.getState().setActiveTool(null));
    expect(count()).toBe(0);
    expect(map.getTargetElement().style.cursor).toBe('');
  });
});
