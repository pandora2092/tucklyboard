import { useState, type FormEvent } from 'react';

import { COPY, type BookmarkStatus, type Collection, type Item } from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';
import { ItemActions } from '../../components/ItemActions';
import { MediaPreview } from '../../components/MediaPreview';
import { Select } from '../../components/Select';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Field, TextArea, TextInput } from '../../components/ui/Field';

import { CollectionPicker } from './CollectionPicker';
import { NewItemAttachments } from './NewItemAttachments';

import './item-dialog.css';

export function ItemDialog({
  item,
  spaceId,
  collections,
  statuses,
  telegramEnabled,
  onClose,
  onSaved,
  onCopy,
}: {
  item: Item | null;
  spaceId?: string;
  collections: Collection[];
  statuses: BookmarkStatus[];
  telegramEnabled: boolean;
  onClose: () => void;
  onSaved: () => void;
  onCopy: (item: Item) => void;
}) {
  const [title, setTitle] = useState(item?.title || ''),
    [url, setUrl] = useState(item?.url || ''),
    [text, setText] = useState(item?.text || ''),
    [tags, setTags] = useState(item?.tags.join(', ') || ''),
    [folders, setFolders] = useState<string[]>(item?.collections.map(c => c.id) || []),
    [dismissed, setDismissed] = useState<string[]>(item?.dismissedAutoTags || []),
    [status, setStatus] = useState(item?.status || statuses.find(row => row.isDefault)?.key || ''),
    [file, setFile] = useState<File | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const readOnly = Boolean(item && !item.canEdit);
  const linkUrl = url.trim();
  const draftType = file
    ? file.type.startsWith('image/')
      ? 'photo'
      : 'video'
    : linkUrl
      ? 'link'
      : 'text';
  const draftCopy = COPY.newItem.types[draftType];
  const changed = Boolean(
    item &&
    (title !== item.title ||
      text !== item.text ||
      tags !== item.tags.join(', ') ||
      status !== item.status ||
      folders.length !== item.collections.length ||
      item.collections.some(c => !folders.includes(c.id)) ||
      dismissed.length !== item.dismissedAutoTags.length ||
      item.dismissedAutoTags.some(tag => !dismissed.includes(tag))),
  );
  function requestCopy() {
    if (!item) {
      return;
    }
    if (!readOnly && changed) {
      setError('');
      setConfirmCopy(true);
    } else {
      onCopy(item);
    }
  }
  async function save(e: FormEvent, copyAfter = false) {
    e.preventDefault();
    if (readOnly) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const common = {
        title: (title.trim() || file?.name || linkUrl || text.slice(0, 80)).slice(0, 300),
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
        status: status || undefined,
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
          type: linkUrl ? 'link' : 'text',
          ...(linkUrl ? { url: linkUrl } : {}),
        });
        if (created.wasDuplicate) {
          setNotice('Такая ссылка уже сохранена. Коллекции и теги объединены.');
          setBusy(false);
          return;
        }
      }
      if (copyAfter && item) {
        onCopy({ ...item, title: common.title, text, tags: common.tags });
      } else {
        onSaved();
      }
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
    <Dialog
      title={confirmCopy ? COPY.copyItem.saveHeading : item ? 'Ваша находка' : 'Новая находка'}
      label={'Сохранённое'}
      busy={busy}
      onClose={onClose}
      closeOnBackdrop
      headerActions={
        item && !confirmCopy ? <ItemActions disabled={busy} onCopy={requestCopy} /> : undefined
      }
    >
      {confirmCopy ? (
        <form onSubmit={event => save(event, true)}>
          <p className={'copy-dialog-description'}>{COPY.copyItem.saveDescription}</p>
          {error && (
            <p className={'error'} role={'alert'}>
              {error}
            </p>
          )}
          <div className={'dialog-actions copy-dialog-actions'}>
            <Button type={'button'} disabled={busy} onClick={() => setConfirmCopy(false)}>
              {COPY.actions.cancel}
            </Button>
            <Button type={'submit'} variant={'primary'} disabled={busy || !title.trim()}>
              {busy ? COPY.actions.saving : COPY.copyItem.saveAndContinue}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={event => save(event)}>
          {!item && (
            <div className={'new-item-type'} role={'status'}>
              <div className={'new-item-type-heading'}>
                <span>{COPY.newItem.typeLabel}</span>
                <strong>{draftCopy.label}</strong>
              </div>
              <p>{draftCopy.hint}</p>
              <small>{COPY.newItem.automatic}</small>
            </div>
          )}
          {item && (item.previewUrl || item.mediaUrl || ['photo', 'video'].includes(item.type)) && (
            <MediaPreview item={item} detail />
          )}
          {item?.storage === 'telegram' && (
            <div className={'telegram-info'}>
              <p>Оригинал хранится в Telegram. Удаление карточки не удаляет файл из переписки.</p>
              <Button
                type={'button'}
                variant={'primary'}
                disabled={busy || !item.canSendToChat}
                onClick={sendToChat}
              >
                Получить в Telegram ↗
              </Button>
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
          <Field label={item ? 'Название' : COPY.newItem.title}>
            <TextInput
              placeholder={item ? 'Название' : draftCopy.titlePlaceholder}
              disabled={readOnly}
              value={title}
              maxLength={300}
              onChange={e => setTitle(e.target.value)}
            />
          </Field>
          <Field label={item ? 'Заметка' : draftCopy.textLabel}>
            <TextArea
              disabled={readOnly}
              rows={!item && draftType === 'text' ? 5 : 3}
              placeholder={item ? undefined : draftCopy.textPlaceholder}
              value={text}
              onChange={e => setText(e.target.value)}
            />
          </Field>
          {!item && (
            <NewItemAttachments
              url={url}
              setUrl={setUrl}
              file={file}
              setFile={setFile}
              busy={busy}
              telegramEnabled={telegramEnabled}
              setError={setError}
            />
          )}
          <CollectionPicker
            collections={collections}
            selected={folders}
            onChange={setFolders}
            disabled={readOnly}
          />
          <Field label={'Статус'}>
            <Select disabled={readOnly} value={status} onChange={e => setStatus(e.target.value)}>
              {statuses.map(row => (
                <option key={row.key} value={row.key}>
                  {row.name}
                </option>
              ))}
            </Select>
          </Field>
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
                    <Button type={'button'} onClick={() => setTags(v => (v ? v + ', ' + t : t))}>
                      Принять
                    </Button>
                    <Button type={'button'} onClick={() => setDismissed(v => [...v, t])}>
                      Скрыть
                    </Button>
                  </>
                )}
              </div>
            ))}
          <Field label={'Теги через запятую'}>
            <TextInput
              disabled={readOnly}
              placeholder={'вдохновение, почитать'}
              value={tags}
              onChange={e => setTags(e.target.value)}
            />
          </Field>
          {error && (
            <p role={'alert'} className={'error'}>
              {error}
            </p>
          )}
          {confirmRemove && (
            <p className={'storage-note'}>
              Карточка будет удалена. Оригинал файла останется в Telegram.{' '}
              <Button type={'button'} onClick={() => setConfirmRemove(false)}>
                {COPY.actions.cancel}
              </Button>
            </p>
          )}
          <div className={'dialog-actions'}>
            {item && !readOnly && (
              <Button type={'button'} variant={'danger'} disabled={busy} onClick={remove}>
                {confirmRemove ? 'Подтвердить удаление' : COPY.actions.delete}
              </Button>
            )}
            <Button
              type={'submit'}
              variant={'primary'}
              disabled={readOnly || busy || (!title.trim() && !url && !text && !file)}
            >
              {busy ? COPY.actions.saving : item ? COPY.actions.saveChanges : draftCopy.save}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
