import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '@/i18n';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
}

/** Last line of defence: a render error shows a message + reload instead of a blank screen. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error boundary caught:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto mt-16 max-w-md space-y-4 p-4 text-center">
        <AlertMessage type="error" message={i18n.t('errors.boundaryTitle')} />
        <Button onClick={() => window.location.reload()}>{i18n.t('common.retry')}</Button>
      </div>
    );
  }
}
