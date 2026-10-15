import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import QRCode from 'qrcode';
import i18n from '@/i18n';
import QrSticker from './QrSticker';

beforeAll(async () => {
  await i18n.changeLanguage('en');
});
afterAll(async () => {
  await i18n.changeLanguage('ar');
});

describe('the QR sticker', () => {
  it("encodes the listing's own page and draws every dark module as a square", () => {
    const create = vi.spyOn(QRCode, 'create');
    render(
      <QrSticker
        target={{ kind: 'service', discriminator: 'plumber' }}
        id="7"
        name="Abu Sami"
        onClose={() => {}}
      />,
    );
    const url = `${window.location.origin}/l/plumber/7`;
    expect(create).toHaveBeenCalledWith(url, { errorCorrectionLevel: 'M' });
    const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' });
    const dark = Array.from(modules.data).filter(Boolean).length;
    const code = screen.getByRole('img', { name: "QR code of Abu Sami's listing" });
    expect(code.querySelectorAll('rect')).toHaveLength(dark + 1); // + the white background
    expect(screen.getByText('Find me on the services map')).toBeInTheDocument();
    expect(screen.getByText('Abu Sami')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
  });
});
