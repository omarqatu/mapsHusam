import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSubmitComment, REQUEST_LIMITS } from '@/api/requests';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import TextareaInput from '@/components/ui/TextareaInput';
import { toast } from '@/components/ui/toastStore';
import { errorText } from './errors';
import { useRequestsUi } from './store';

/** Adds the comment to a rating that was given without one. */
type Target = NonNullable<ReturnType<typeof useRequestsUi.getState>['commentFor']>;

function CommentForm({ target }: { target: Target }) {
  const { t } = useTranslation();
  const close = useRequestsUi((s) => s.closeComment);
  const submit = useSubmitComment();
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState(false);
  const empty = comment.trim() === '';

  const send = () => {
    if (empty) return setTouched(true);
    submit.mutate(
      { ratingId: target.ratingId, comment: comment.trim() },
      {
        onSuccess: () => {
          toast.success(t('requests.comment.done'));
          close();
        },
        onError: (e) => toast.error(errorText(e, t('requests.comment.failed'))),
      },
    );
  };

  return (
    <Modal
      open
      onClose={close}
      title={t('requests.comment.title')}
      widthClass="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submit.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={send} loading={submit.isPending}>
            {t('requests.comment.submit')}
          </Button>
        </>
      }
    >
      <p className="mb-1 text-sm text-muted">
        {t('requests.rating.question', { provider: target.providerName, service: target.serviceType })}
      </p>
      <p className="mb-3 text-xs text-muted">{t('requests.comment.intro')}</p>
      <label htmlFor="comment-text" className="mb-1.5 block text-sm font-bold text-fg">
        {t('requests.comment.label')}
      </label>
      <TextareaInput
        id="comment-text"
        rows={4}
        value={comment}
        maxLength={REQUEST_LIMITS.comment}
        hasError={touched && empty}
        placeholder={t('requests.comment.placeholder')}
        onChange={(e) => setComment(e.target.value)}
      />
      {touched && empty && (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-danger">
          {t('requests.comment.required')}
        </p>
      )}
    </Modal>
  );
}

export default function CommentDialog() {
  const target = useRequestsUi((s) => s.commentFor);
  // Keyed, so the next dialog never inherits the previous one's text.
  return target ? <CommentForm key={target.ratingId} target={target} /> : null;
}
