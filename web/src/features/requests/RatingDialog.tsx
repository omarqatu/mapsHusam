import { useState } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSubmitRating, REQUEST_LIMITS } from '@/api/requests';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import StarRating from '@/components/ui/StarRating';
import TextareaInput from '@/components/ui/TextareaInput';
import { toast } from '@/components/ui/toastStore';
import { errorText } from './errors';
import { useRequestsUi } from './store';

/** Stars (required) + comment (optional) for a completed request. Skipping keeps it in "pending ratings". */
type Target = NonNullable<ReturnType<typeof useRequestsUi.getState>['ratingFor']>;

function RatingForm({ target }: { target: Target }) {
  const { t } = useTranslation();
  const close = useRequestsUi((s) => s.closeRating);
  const submit = useSubmitRating();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [missing, setMissing] = useState(false);


  const send = () => {
    if (!stars) return setMissing(true);
    const text = comment.trim();
    submit.mutate(
      { id: target.requestId, rating: stars, comment: text },
      {
        onSuccess: () => {
          toast.success(t(text ? 'requests.rating.doneWithComment' : 'requests.rating.done'));
          close();
        },
        onError: (e) => toast.error(errorText(e, t('requests.rating.failed'))),
      },
    );
  };

  return (
    <Modal
      open
      onClose={close}
      title={t('requests.rating.title')}
      widthClass="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={submit.isPending}>
            {t('requests.rating.skip')}
          </Button>
          <Button onClick={send} loading={submit.isPending}>
            {t('requests.rating.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-lg border border-info-line bg-info-soft p-3 text-xs leading-relaxed text-info">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('requests.rating.info')}
        </p>
        <p className="text-sm text-muted">
          {t('requests.rating.question', { provider: target.providerName, service: target.serviceType })}
        </p>
        <div>
          <p className="mb-1 text-sm font-bold text-fg">{t('requests.rating.stars')}</p>
          <StarRating
            size="lg"
            value={stars}
            label={t('requests.rating.stars')}
            onChange={(n) => {
              setStars(n);
              setMissing(false);
            }}
          />
          <p className={missing ? 'mt-1 text-sm font-semibold text-danger' : 'mt-1 text-sm text-muted'} role={missing ? 'alert' : undefined}>
            {missing ? t('requests.rating.pickStars') : stars ? t(`requests.rating.labels.${stars}`) : t('requests.rating.pick')}
          </p>
        </div>
        <div>
          <label htmlFor="rating-comment" className="text-sm font-bold text-fg">
            {t('requests.rating.commentLabel')}
          </label>
          <p className="mb-1.5 text-xs text-muted">{t('requests.rating.commentHint')}</p>
          <TextareaInput
            id="rating-comment"
            rows={3}
            value={comment}
            maxLength={REQUEST_LIMITS.comment}
            placeholder={t('requests.rating.commentPlaceholder')}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}

export default function RatingDialog() {
  const target = useRequestsUi((s) => s.ratingFor);
  // Keyed, so the next dialog never inherits the previous one's text.
  return target ? <RatingForm key={target.requestId} target={target} /> : null;
}
