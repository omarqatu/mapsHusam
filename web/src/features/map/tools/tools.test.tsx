import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import '@/i18n';
import { useSearchUi } from '../search/store';
import { useMapUi } from '../store';
import MapTools from './MapTools';

const reset = () => {
  useMapUi.setState({ activeTool: null, layersOpen: false, selected: null });
  useSearchUi.setState({ panelOpen: false, picking: false });
};

describe('MapTools panels', () => {
  beforeEach(reset);

  it('shows the panel of the active tool only', () => {
    render(<MapTools />);
    expect(screen.queryByRole('complementary')).toBeNull();
    act(() => useMapUi.getState().setActiveTool('measure'));
    expect(screen.getByRole('complementary', { name: 'أدوات القياس والرسم' })).toBeInTheDocument();
    act(() => useMapUi.getState().setActiveTool('share'));
    expect(screen.getByRole('complementary', { name: 'مشاركة الموقع' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'أدوات القياس والرسم' })).toBeNull();
    act(() => useMapUi.getState().setActiveTool(null));
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('opening a tool closes the layer panel and the search panel (and ends point picking)', () => {
    useMapUi.setState({ layersOpen: true });
    useSearchUi.setState({ panelOpen: true, picking: true });
    render(<MapTools />);
    act(() => useMapUi.getState().setActiveTool('share'));
    expect(useMapUi.getState().layersOpen).toBe(false);
    expect(useSearchUi.getState().panelOpen).toBe(false);
    expect(useSearchUi.getState().picking).toBe(false);
  });

  it('opening the layer panel or the search panel closes the tool', () => {
    render(<MapTools />);
    act(() => useMapUi.getState().setActiveTool('measure'));
    act(() => useMapUi.getState().setLayersOpen(true));
    expect(useMapUi.getState().activeTool).toBeNull();

    act(() => useMapUi.getState().setActiveTool('share'));
    expect(useMapUi.getState().layersOpen).toBe(false);
    act(() => useSearchUi.getState().openPanel());
    expect(useMapUi.getState().activeTool).toBeNull();
  });

  it('share panel starts empty with everything that needs a location disabled', () => {
    render(<MapTools />);
    act(() => useMapUi.getState().setActiveTool('share'));
    expect(screen.getByText('انقر على الخريطة لتحديد موقع ومشاركته.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إلغاء التحديد' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Google Maps' })).toBeDisabled();
  });
});
