import AlertMessage from './AlertMessage';
import { useToastStore } from './toastStore';

/** Mount once, in the app shell. */
export default function Toaster() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-4 end-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {items.map((i) => (
        <AlertMessage
          key={i.id}
          type={i.type}
          message={i.message}
          onDismiss={() => dismiss(i.id)}
          className="pointer-events-auto shadow-lg"
        />
      ))}
    </div>
  );
}
