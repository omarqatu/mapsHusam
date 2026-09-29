/** Soft-tinted square behind an icon; the tint tells the kind of thing at a glance. */
export const CHIP_TONE = {
  brand: 'bg-brand-light text-brand-fg',
  info: 'bg-info-soft text-info',
  ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
} as const;
export type ChipTone = keyof typeof CHIP_TONE;
