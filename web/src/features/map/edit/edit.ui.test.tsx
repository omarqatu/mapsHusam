import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OlMap from 'ol/Map';
import View from 'ol/View';
import Draw from 'ol/interaction/Draw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types/auth';
import { MapContext } from '../MapContext';
import { useMapUi } from '../store';
import ToolButtons from '../tools/ToolButtons';
import AttributeDialog from './AttributeDialog';
import CredentialsDialog from './CredentialsDialog';
import EditTool from './EditTool';
import { initialValues } from './attributes';
import { serviceTarget } from './schema';

const asRole = (role: AuthUser['role'] | null) =>
  useAuthStore.setState({ user: role ? ({ user_id: 1, role, token: 't' } as AuthUser) : null });

describe('who gets the editing tools', () => {
  beforeEach(() => useMapUi.setState({ activeTool: null }));

  it('the button is in the tool column for admins only', () => {
    asRole('user');
    const view = render(<ToolButtons />);
    expect(screen.queryByRole('button', { name: 'تحرير بيانات الخريطة' })).toBeNull();
    asRole('provider');
    view.rerender(<ToolButtons />);
    expect(screen.queryByRole('button', { name: 'تحرير بيانات الخريطة' })).toBeNull();
    act(() => asRole('admin'));
    expect(screen.getByRole('button', { name: 'تحرير بيانات الخريطة' })).toBeInTheDocument();
  });

  describe('the panel (real ol/Map in jsdom)', () => {
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
    });
    afterEach(() => map.setTarget(undefined));

    const mount = () =>
      render(
        <MapContext value={map}>
          <EditTool />
        </MapContext>,
      );

    it('opens for an admin and adds its layers only while open', async () => {
      asRole('admin');
      const view = mount();
      const before = map.getLayers().getLength();
      act(() => useMapUi.getState().setActiveTool('edit'));
      expect(screen.getByRole('complementary', { name: 'تحرير الخريطة' })).toBeInTheDocument();
      expect(map.getLayers().getLength()).toBe(before + 3); // regions, roads, overlay
      const drawing = () =>
        map
          .getInteractions()
          .getArray()
          .some((i) => i instanceof Draw);
      expect(drawing()).toBe(false);

      act(() => useMapUi.getState().setActiveTool(null));
      expect(map.getLayers().getLength()).toBe(before);
      view.unmount();
    });

    it('does not open for a non-admin, even if the tool is switched on', () => {
      asRole('user');
      mount();
      act(() => useMapUi.getState().setActiveTool('edit'));
      expect(screen.queryByRole('complementary')).toBeNull();
      expect(useMapUi.getState().activeTool).toBeNull();
    });

    it('closes when the session is lost while it is open', () => {
      asRole('admin');
      mount();
      act(() => useMapUi.getState().setActiveTool('edit'));
      expect(screen.getByRole('complementary')).toBeInTheDocument();
      act(() => asRole(null));
      expect(screen.queryByRole('complementary')).toBeNull();
    });
  });
});

describe('CredentialsDialog', () => {
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('hands the login to the one call, empties the password, and stores it nowhere', async () => {
    localStorage.setItem('keep', '1');
    const onSubmit = vi.fn().mockResolvedValue({ ok: false, reason: 'auth' });
    render(<CredentialsDialog confirmLabel="حفظ التعديلات" onSubmit={onSubmit} onCancel={() => undefined} />);
    const password = screen.getByLabelText('كلمة المرور') as HTMLInputElement;
    const user = screen.getByLabelText('اسم المستخدم') as HTMLInputElement;
    expect(password.type).toBe('password');
    expect(password.autocomplete).toBe('new-password');

    await userEvent.type(user, ' admin ');
    await userEvent.type(password, 'S3cret!');
    await userEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));

    expect(onSubmit).toHaveBeenCalledWith({ username: 'admin', password: 'S3cret!' });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('اسم المستخدم أو كلمة المرور غير صحيحة'),
    );
    expect(password.value).toBe(''); // gone from the field after the request was handed over
    expect(document.documentElement.textContent).not.toContain('S3cret!');
    // nothing was written to any storage or the address
    expect(Object.keys(localStorage)).toEqual(['keep']);
    expect(sessionStorage.length).toBe(0);
    expect(location.href).not.toContain('S3cret');
  });

  it('shows why a write was refused, as text', async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValue({ ok: false, reason: 'rejected', message: '<img src=x onerror=alert(1)>' });
    render(<CredentialsDialog confirmLabel="حذف" onSubmit={onSubmit} onCancel={() => undefined} />);
    await userEvent.type(screen.getByLabelText('اسم المستخدم'), 'u');
    await userEvent.type(screen.getByLabelText('كلمة المرور'), 'p');
    await userEvent.click(screen.getByRole('button', { name: 'حذف' }));
    await screen.findByText('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
  });

  it('the confirm button waits for both fields', async () => {
    render(<CredentialsDialog confirmLabel="حذف" onSubmit={vi.fn()} onCancel={() => undefined} />);
    expect(screen.getByRole('button', { name: 'حذف' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('اسم المستخدم'), 'u');
    expect(screen.getByRole('button', { name: 'حذف' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('كلمة المرور'), 'p');
    expect(screen.getByRole('button', { name: 'حذف' })).toBeEnabled();
  });
});

describe('AttributeDialog', () => {
  const target = serviceTarget('fuel_stations');
  const setup = (initial = {}) => {
    const onSave = vi.fn();
    const onEditShape = vi.fn();
    render(
      <AttributeDialog
        target={target}
        mode="update"
        initial={initialValues(target, initial)}
        position={[169463.41, 145767.99]}
        onSave={onSave}
        onEditShape={onEditShape}
        onCancel={() => undefined}
      />,
    );
    return { onSave, onEditShape };
  };

  it('shows the fields of the layer, including the fuel columns, and the position', () => {
    setup({ name: 'محطة' });
    expect(screen.getByLabelText('اسم مزود الخدمة')).toHaveValue('محطة');
    expect(screen.getByRole('combobox', { name: 'ديزل (سولار)' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'بنزين 98' })).toBeInTheDocument();
    expect(screen.getByText(/E: 169463.41/)).toBeInTheDocument();
  });

  it('a bad rating blocks saving and says why', async () => {
    const { onSave } = setup();
    await userEvent.type(screen.getByLabelText('الرتبة (0-10)'), '11');
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('أدخل رقماً بين 0 و 10')).toBeInTheDocument();
  });

  it('save and "move on the map" both hand over the typed values', async () => {
    const { onSave, onEditShape } = setup();
    await userEvent.type(screen.getByLabelText('اسم مزود الخدمة'), 'س');
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'س', diesel: '0' }));
    await userEvent.click(screen.getByRole('button', { name: 'تحريك على الخريطة' }));
    expect(onEditShape).toHaveBeenCalledWith(expect.objectContaining({ name: 'س' }));
  });

  it('markup stored in a field stays text', () => {
    setup({ name: '<img src=x onerror=alert(1)>' });
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByLabelText('اسم مزود الخدمة')).toHaveValue('<img src=x onerror=alert(1)>');
  });
});
