import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import ReasonDialog from './ReasonDialog';

describe('ReasonDialog rejection reason', () => {
  beforeEach(() => {
    i18n.changeLanguage('ar');
  });

  it('requires and submits a reason when declining a request', async () => {
    const onSubmit = vi.fn();
    render(<ReasonDialog open intent="reject" onSubmit={onSubmit} onClose={() => undefined} />);

    await userEvent.click(screen.getByRole('button', { name: i18n.t('requests.rejectDialog.submit') }));
    expect(screen.getByRole('alert')).toHaveTextContent(i18n.t('requests.rejectDialog.required'));
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(i18n.t('requests.rejectDialog.label')), 'الخدمة غير متاحة');
    await userEvent.click(screen.getByRole('button', { name: i18n.t('requests.rejectDialog.submit') }));
    expect(onSubmit).toHaveBeenCalledWith('الخدمة غير متاحة');
  });
});
