import type { ReactNode } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDraggablePanel } from '@/hooks/useDraggablePanel';

interface MapSheetProps {
  title: ReactNode;
  onClose: () => void;
  /** Desktop edge. Phones always get a bottom sheet. */
  side: 'start' | 'end';
  label: string;
  children: ReactNode;
  /** Extra classes, e.g. to shift a start-side card next to another start-side panel. */
  className?: string;
  /** Storage key of the dragged position; defaults to `label`. Give it when the label changes per content. */
  dragId?: string;
}

/** Floating panel over the map: side card on desktop, bottom sheet on phones. */
export default function MapSheet({ title, onClose, side, label, children, className, dragId }: MapSheetProps) {
  const { t } = useTranslation();
  const { panelRef, panelStyle, handleProps } = useDraggablePanel(dragId ?? label);
  return (
    <aside
      ref={panelRef}
      style={panelStyle}
      aria-label={label}
      className={clsx(
        'absolute z-20 flex flex-col bg-white shadow-xl',
        'inset-x-0 bottom-0 max-h-[70%] rounded-t-2xl',
        'sm:inset-x-auto sm:bottom-3 sm:max-h-none sm:w-[22rem] sm:rounded-2xl sm:[transform:translate(var(--dx),var(--dy))]',
        // end side leaves room for the tool buttons; start side leaves room for the search box on top
        side === 'start' ? 'sm:start-3 sm:top-16' : 'sm:end-16 sm:top-3',
        className,
      )}
    >
      <header
        {...handleProps}
        title={undefined}
        className="flex touch-none select-none items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:cursor-grab sm:active:cursor-grabbing"
      >
        <div className="min-w-0 text-base font-bold text-slate-900">{title}</div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('common.close')}
          className="shrink-0 rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </aside>
  );
}
