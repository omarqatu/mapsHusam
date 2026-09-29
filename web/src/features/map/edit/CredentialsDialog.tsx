import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AlertMessage from '@/components/ui/AlertMessage';
import Button from '@/components/ui/Button';
import FormField from '@/components/ui/FormField';
import Modal from '@/components/ui/Modal';
import TextInput from '@/components/ui/TextInput';
import type { SaveResult } from './tx';

interface Props {
  /** What is about to happen, e.g. "Save the new feature" — the confirm button's label. */
  confirmLabel: string;
  /**
   * Runs the write with the typed login. The login exists only in this dialog's state and in this one call: it is not
   * put in a store, storage, URL or log, and the fields are emptied as soon as the request has been handed over.
   */
  onSubmit: (credentials: { username: string; password: string }) => Promise<SaveResult>;
  onCancel: () => void;
}

/**
 * Asks for the GeoServer login of the write (legacy: two SweetAlert prompts). Stays open with the reason when the
 * write fails, so a typo in the password does not lose the edit (legacy closed the tool and dropped everything).
 */
export default function CredentialsDialog({ confirmLabel, onSubmit, onCancel }: Props) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Extract<SaveResult, { ok: false }> | null>(null);

  const submit = async () => {
    if (busy || !username.trim() || !password) return;
    setBusy(true);
    setFailure(null);
    const login = { username: username.trim(), password };
    setPassword(''); // gone from state before the request even starts
    const result = await onSubmit(login);
    setBusy(false);
    if (!result.ok) setFailure(result);
    // On success the parent unmounts this dialog.
  };

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onCancel}
      title={t('edit.credentials.title')}
      widthClass="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} loading={busy} disabled={!username.trim() || !password}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        autoComplete="off"
      >
        <p className="mb-4 flex items-start gap-2 text-sm text-slate-700">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('edit.credentials.intro')}
        </p>
        <FormField name="edit-gs-user" label={t('edit.credentials.username')}>
          <TextInput
            id="edit-gs-user"
            name="geoserver-user"
            autoFocus
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </FormField>
        <FormField name="edit-gs-password" label={t('edit.credentials.password')}>
          <TextInput
            id="edit-gs-password"
            name="geoserver-password"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        {failure && (
          <>
            <AlertMessage type="error" message={t(`edit.credentials.failed.${failure.reason}`)} />
            {failure.message && (
              <p dir="ltr" className="mt-2 text-start text-sm break-words text-slate-700">
                {failure.message}
              </p>
            )}
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
