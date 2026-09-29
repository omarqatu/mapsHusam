import clsx from 'clsx';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type AlertType = 'error' | 'success' | 'warning' | 'info';

const styles: Record<AlertType, { box: string; icon: typeof Info }> = {
  error: { box: 'bg-red-50 border-red-200 text-red-700', icon: AlertCircle },
  success: { box: 'bg-green-50 border-green-200 text-green-700', icon: CheckCircle2 },
  warning: { box: 'bg-amber-50 border-amber-200 text-amber-700', icon: AlertCircle },
  info: { box: 'bg-blue-50 border-blue-200 text-blue-700', icon: Info },
};

interface AlertMessageProps {
  type: AlertType;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export default function AlertMessage({ type, message, onDismiss, className }: AlertMessageProps) {
  if (!message) return null;
  const { box, icon: Icon } = styles[type];
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className={clsx('flex items-center gap-2 rounded-lg border p-3 text-sm', box, className)}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="close"
          className="rounded p-0.5 hover:bg-black/5"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
