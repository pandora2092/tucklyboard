import { useState, type FormEvent } from 'react';

import {
  MEDIA_MIMES,
  UPLOAD_LIMIT,
  type Collection,
  type Item,
  type Space,
} from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';
import { MediaPreview } from '../../components/MediaPreview';

export function ItemDialog({
  item,
  spaceId,
  spaces,
  collections,
  telegramEnabled,
  onClose,
  onSaved,
}: {
  item: Item | null;
  spaceId?: string;
  spaces: Space[];
  collections: Collection[];
  telegramEnabled: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item?.title || ''),
    [url, setUrl] = useState(item?.url || ''),
    [text, setText] = useState(item?.text || ''),
    [tags, setTags] = useState(item?.tags.join(', ') || ''),
    [folders, setFolders] = useState<string[]>(item?.collections.map(c => c.id) || []),
    [dismissed, setDismissed] = useState<string[]>(item?.dismissedAutoTags || []),
    [status, setStatus] = useState<'saved' | 'done'>(item?.status || 'saved'),
    [target, setTarget] = useState(''),
    [includeNote, setIncludeNote] = useState(false),
    [file, setFile] = useState<File | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const readOnly = Boolean(item && !item.canEdit);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (readOnly) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const common = {
        title: (title.trim() || file?.name || url || text.slice(0, 80)).slice(0, 300),
        text,
        tags: [
          ...new Set(
            tags
              .split(',')
              .map(t => t.trim().replace(/^#/, ''))
              .filter(Boolean),
          ),
        ],
        collectionIds: folders,
        spaceId,
      };
      if (file && !item) {
        await catalogueApi.upload(file, common);
      } else if (item) {
        const { spaceId: _space, ...changes } = common;
        await catalogueApi.update(item.id, { ...changes, dismissedAutoTags: dismissed, status });
      } else {
        const created = await catalogueApi.create({
          ...common,
          title: title.trim() || undefined,
          type: url ? 'link' : 'text',
          ...(url ? { url } : {}),
        });
        if (created.wasDuplicate) {
          setNotice('Такая ссылка уже сохранена. Коллекции и теги объединены.');
          setBusy(false);
          return;
        }
      }
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function sendToChat() {
    if (!item) {
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await catalogueApi.send(item.id);
      setNotice('Файл отправлен в ваш чат с ботом.');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!item) {
      return;
    }
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    setBusy(true);
    try {
      await catalogueApi.remove(item.id);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={'overlay'} onClick={() => !busy && onClose()}>
      <section
        className={'dialog'}
        role={'dialog'}
        aria-modal={'true'}
        aria-label={'Сохранённое'}
        onClick={e => e.stopPropagation()}
      >
        <div className={'dialog-top'}>
          <h2>{item ? 'Ваша находка' : 'Новая находка'}</h2>
          <button disabled={busy} aria-label={'Закрыть'} onClick={() => onClose()}>
            ×
          </button>
        </div>
        <form onSubmit={save}>
          {!item && (
            <>
              <label>
                Ссылка
                <input
                  type={'url'}
                  disabled={Boolean(file)}
                  placeholder={'https://…'}
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                />
              </label>
              {telegramEnabled ? (
                <label className={'upload'}>
                  ＋ Фото или видео до 20 МБ
                  <input
                    type={'file'}
                    disabled={busy || Boolean(url)}
                    accept={MEDIA_MIMES.join(',')}
                    onChange={e => {
                      const chosen = e.target.files?.[0] || null;
                      if (chosen && chosen.size > UPLOAD_LIMIT) {
                        setError(
                          'Для загрузки здесь выберите файл до 20 МБ. Большое видео можно отправить прямо боту.',
                        );
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
                    Файл будет отправлен в ваш чат с ботом и останется в Telegram. Для ссылки и
                    файла создавайте отдельные карточки.
                  </small>
                </label>
              ) : (
                <p className={'storage-note'}>
                  Загрузка медиа пока недоступна. Ссылки и заметки можно сохранять.
                </p>
              )}
            </>
          )}
          {item && (item.previewUrl || item.mediaUrl || ['photo', 'video'].includes(item.type)) && (
            <MediaPreview item={item} detail />
          )}
          {item?.storage === 'telegram' && (
            <div className={'telegram-info'}>
              <p>Оригинал хранится в Telegram. Удаление карточки не удаляет файл из переписки.</p>
              <button
                type={'button'}
                className={'primary'}
                disabled={busy || !item.canSendToChat}
                onClick={sendToChat}
              >
                Получить в Telegram ↗
              </button>
            </div>
          )}
          {item?.storage === 'legacy-s3' && (
            <p className={'storage-note'}>
              Этот файл сохранён в прежнем хранилище. Чтобы перенести его в Telegram, отправьте или
              перешлите его боту.
            </p>
          )}
          {notice && (
            <p className={'success'} role={'status'}>
              {notice}
            </p>
          )}
          {item?.url && (
            <a className={'original'} href={item.url} target={'_blank'} rel={'noopener noreferrer'}>
              Открыть оригинал ↗
            </a>
          )}
          <label>
            Название
            <input
              placeholder={item ? 'Название' : 'Необязательно — подставим из ссылки'}
              disabled={readOnly}
              value={title}
              maxLength={300}
              onChange={e => setTitle(e.target.value)}
            />
          </label>
          <label>
            Заметка
            <textarea
              disabled={readOnly}
              rows={3}
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </label>
          <fieldset disabled={readOnly}>
            <legend>Коллекции</legend>
            {collections
              .filter(c => !c.rules)
              .map(c => (
                <label className={'inline-option'} key={c.id}>
                  <input
                    type={'checkbox'}
                    checked={folders.includes(c.id)}
                    onChange={e =>
                      setFolders(ids =>
                        e.target.checked ? [...ids, c.id] : ids.filter(id => id !== c.id),
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            {!collections.some(c => !c.rules) && <small>Без коллекций — во входящих</small>}
          </fieldset>
          <label>
            Статус
            <select
              disabled={readOnly}
              value={status}
              onChange={e => setStatus(e.target.value as 'saved' | 'done')}
            >
              <option value={'saved'}>На потом</option>
              <option value={'done'}>Просмотрено</option>
            </select>
          </label>
          {item?.metadataStatus === 'unavailable' && (
            <p className={'storage-note'}>
              Сайт не отдал данные. Ссылка сохранена; можно повторить получение метаданных.
            </p>
          )}
          {(item?.metadataStatus === 'pending' || item?.metadataStatus === 'processing') && (
            <p className={'storage-note'}>Получаем название и данные источника…</p>
          )}
          {item?.sourceTitle && item.sourceTitle !== item.title && (
            <p className={'storage-note'}>Название источника: {item.sourceTitle}</p>
          )}
          {item?.sourceDescription && <p className={'storage-note'}>{item.sourceDescription}</p>}
          {item?.author && <small>Автор: {item.author}</small>}
          {item?.autoTags
            .filter(
              t =>
                !dismissed.includes(t) &&
                !tags
                  .split(',')
                  .map(v => v.trim())
                  .includes(t),
            )
            .map(t => (
              <div className={'inline-option'} key={t}>
                <span>Предложенный тег: #{t}</span>
                {!readOnly && (
                  <>
                    <button type={'button'} onClick={() => setTags(v => (v ? v + ', ' + t : t))}>
                      Принять
                    </button>
                    <button type={'button'} onClick={() => setDismissed(v => [...v, t])}>
                      Скрыть
                    </button>
                  </>
                )}
              </div>
            ))}
          {item?.url && !readOnly && (
            <button
              type={'button'}
              disabled={busy}
              onClick={() => {
                void catalogueApi
                  .retry(item.id)
                  .then(() =>
                    setNotice(
                      'Обновление запланировано. Откройте карточку через несколько секунд.',
                    ),
                  )
                  .catch(e => setError(errorMessage(e)));
              }}
            >
              Обновить данные ссылки
            </button>
          )}
          {item && (
            <fieldset>
              <legend>Копировать в пространство</legend>
              <select value={target} onChange={e => setTarget(e.target.value)}>
                <option value={''}>Выберите пространство</option>
                {spaces
                  .filter(s => s.id !== item.spaceId && s.role !== 'viewer')
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
              <label className={'inline-option'}>
                <input
                  type={'checkbox'}
                  checked={includeNote}
                  onChange={e => setIncludeNote(e.target.checked)}
                />
                Включить мою заметку
              </label>
              <button
                type={'button'}
                disabled={!target || busy}
                onClick={() => {
                  setBusy(true);
                  void catalogueApi
                    .copy(item.id, target, includeNote)
                    .then(() => setNotice('Скопировано в выбранное пространство'))
                    .catch(e => setError(errorMessage(e)))
                    .finally(() => setBusy(false));
                }}
              >
                Копировать
              </button>
            </fieldset>
          )}
          <label>
            Теги через запятую
            <input
              disabled={readOnly}
              placeholder={'вдохновение, почитать'}
              value={tags}
              onChange={e => setTags(e.target.value)}
            />
          </label>
          {error && (
            <p role={'alert'} className={'error'}>
              {error}
            </p>
          )}
          {confirmRemove && (
            <p className={'storage-note'}>
              Карточка будет удалена. Оригинал файла останется в Telegram.{' '}
              <button type={'button'} onClick={() => setConfirmRemove(false)}>
                Отмена
              </button>
            </p>
          )}
          <div className={'dialog-actions'}>
            {item && !readOnly && (
              <button type={'button'} className={'danger'} disabled={busy} onClick={remove}>
                {confirmRemove ? 'Подтвердить удаление' : 'Удалить'}
              </button>
            )}
            <button
              className={'primary'}
              disabled={readOnly || busy || (!title.trim() && !url && !text && !file)}
            >
              {busy ? 'Сохраняем…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
