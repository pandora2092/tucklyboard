import { COPY, MEDIA_MIMES, UPLOAD_LIMIT } from '@tuckly/contracts';

import { Field, TextInput } from '../../components/ui/Field';

export function NewItemAttachments({
  url,
  setUrl,
  file,
  setFile,
  busy,
  telegramEnabled,
  setError,
}: {
  url: string;
  setUrl: (url: string) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  busy: boolean;
  telegramEnabled: boolean;
  setError: (error: string) => void;
}) {
  const linkUrl = url.trim();
  return (
    <section className={'new-item-attachments'}>
      <h3>{COPY.newItem.attachments}</h3>
      <Field label={COPY.newItem.link}>
        <TextInput
          type={'url'}
          disabled={Boolean(file)}
          placeholder={COPY.newItem.linkPlaceholder}
          value={url}
          onChange={e => setUrl(e.target.value)}
        />
      </Field>
      {telegramEnabled ? (
        <Field label={COPY.newItem.upload} className={'upload'}>
          <TextInput
            type={'file'}
            disabled={busy || Boolean(linkUrl)}
            accept={MEDIA_MIMES.join(',')}
            onChange={e => {
              const chosen = e.target.files?.[0] || null;
              if (chosen && chosen.size > UPLOAD_LIMIT) {
                setError(COPY.newItem.uploadTooLarge);
                setFile(null);
                e.target.value = '';
                return;
              }
              setError('');
              setFile(chosen);
            }}
          />
          {file && <small>{file.name}</small>}
          <small>
            Файл будет отправлен в ваш чат с ботом и останется в Telegram. Для ссылки и файла
            создавайте отдельные карточки.
          </small>
        </Field>
      ) : (
        <p className={'storage-note'}>
          Загрузка медиа пока недоступна. Ссылки и заметки можно сохранять.
        </p>
      )}
    </section>
  );
}
