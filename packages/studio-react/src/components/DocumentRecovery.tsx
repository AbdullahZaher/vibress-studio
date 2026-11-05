import { useEffect, useId, useRef, useState } from 'react';

const messages = {
  en: {
    title: 'Studio Document Recovery', paused: 'Editing paused', retained: 'Content Preserved',
    unsaved: 'Document not saved', unsavedBody: 'The current draft remains in the editor. Review the error before trying to save again.',
    initial: 'This document cannot be edited safely. The original input remains available for recovery in this editor.',
    active: 'The incoming document could not be loaded safely. The current draft remains in the editor.',
    details: 'Technical details', export: 'Export recovery data', pending: 'Preparing recovery data…',
    failed: 'Recovery data could not be exported. Try again.',
  },
  ar: {
    title: 'استرداد مستند الاستوديو', paused: 'تم إيقاف التحرير مؤقتًا', retained: 'تم الاحتفاظ بالمحتوى',
    unsaved: 'لم يتم حفظ المستند', unsavedBody: 'تظل المسودة الحالية داخل المحرر. راجع الخطأ قبل محاولة الحفظ مجددًا.',
    initial: 'لا يمكن تحرير هذا المستند بأمان. يظل المحتوى الأصلي متاحًا للاسترداد داخل المحرر.',
    active: 'تعذر تحميل المستند الوارد بأمان. تظل المسودة الحالية داخل المحرر.',
    details: 'تفاصيل تقنية', export: 'تصدير بيانات الاسترداد', pending: 'جارٍ تجهيز بيانات الاسترداد…',
    failed: 'تعذر تصدير بيانات الاسترداد. حاول مرة أخرى.',
  },
};

export function DocumentRecovery({ error, hasDraft, locale = 'en', kind = 'input', onRequestRecovery }: {
  error: Error;
  hasDraft: boolean;
  locale?: 'en' | 'ar';
  kind?: 'input' | 'snapshot';
  onRequestRecovery?: () => void | Promise<void>;
}) {
  const copy = messages[locale];
  const titleId = useId();
  const [phase, setPhase] = useState<'idle' | 'pending' | 'failed'>('idle');
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setPhase('idle');
    return () => { generation.current++; };
  }, [error]);

  const requestRecovery = () => {
    if (!onRequestRecovery || phase === 'pending') return;
    const request = ++generation.current;
    setPhase('pending');
    Promise.resolve().then(() => {
      if (request === generation.current) return onRequestRecovery();
    }).then(() => {
      if (request === generation.current) setPhase('idle');
    }).catch(() => {
      if (request === generation.current) setPhase('failed');
    });
  };

  return (
    <section role="alert" aria-live="assertive" aria-labelledby={titleId}
      className="studio-recovery" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div className="studio-recovery-heading">
        <strong id={titleId}>{kind === 'snapshot' ? copy.unsaved : hasDraft ? copy.paused : copy.title}</strong>
        {!hasDraft && <span className="studio-recovery-retained">{copy.retained}</span>}
      </div>
      <p>{kind === 'snapshot' ? copy.unsavedBody : hasDraft ? copy.active : copy.initial}</p>
      <details>
        <summary>{copy.details}</summary>
        <pre dir="ltr">{error.message}</pre>
      </details>
      {onRequestRecovery && (
        <button type="button" tabIndex={0} className="studio-recovery-export" disabled={phase === 'pending'}
          onClick={requestRecovery}>{phase === 'pending' ? copy.pending : copy.export}</button>
      )}
      {phase === 'failed' && <p>{copy.failed}</p>}
    </section>
  );
}
