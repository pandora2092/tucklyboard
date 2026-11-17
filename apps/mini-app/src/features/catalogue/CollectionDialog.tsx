import { useState, type FormEvent } from 'react';

import type { BookmarkStatus, Collection, SmartRules } from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';
import { Select } from '../../components/Select';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Dialog } from '../../components/ui/Dialog';
import { Field, TextInput } from '../../components/ui/Field';

import './management-settings.css';

export function CollectionDialog({
  spaceId,
  collection,
  embedded = false,
  disabled = false,
  onBusyChange,
  statuses,
  onClose,
  onSaved,
}: {
  spaceId?: string;
  collection?: Collection | null;
  embedded?: boolean;
  disabled?: boolean;
  onBusyChange?: (busy: boolean) => void;
  statuses: BookmarkStatus[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(collection?.name || ''),
    [smart, setSmart] = useState(Boolean(collection?.rules)),
    [type, setType] = useState(collection?.rules?.type || ''),
    [source, setSource] = useState(collection?.rules?.source || ''),
    [tags, setTags] = useState(collection?.rules?.tags?.join(', ') || ''),
    [status, setStatus] = useState(collection?.rules?.status || ''),
    [days, setDays] = useState(collection?.rules?.days?.toString() || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || disabled) {
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    try {
      const rules: SmartRules = {
        ...(collection?.rules?.addedBy ? { addedBy: collection.rules.addedBy } : {}),
        ...(type ? { type: type as SmartRules['type'] } : {}),
        ...(source.trim() ? { source: source.trim() } : {}),
        ...(tags.trim()
          ? {
              tags: tags
                .split(',')
                .map(t => t.trim().replace(/^#/, ''))
                .filter(Boolean),
            }
          : {}),
        ...(status ? { status: status as SmartRules['status'] } : {}),
        ...(days ? { days: Number(days) } : {}),
      };
      if (collection) {
        await catalogueApi.updateCollection(collection.id, { name, ...(smart ? { rules } : {}) });
      } else {
        await catalogueApi.createCollection(name, spaceId, smart ? rules : undefined);
      }
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  const form = (
    <form onSubmit={save}>
      <fieldset className={'collection-editor-fields'} disabled={busy || disabled}>
        <Field label={'Название'}>
          <TextInput
            autoFocus
            required
            maxLength={80}
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </Field>
        <label className={'inline-option'}>
          <Checkbox
            disabled={Boolean(collection)}
            checked={smart}
            onChange={e => setSmart(e.target.checked)}
          />
          Умная коллекция
        </label>
        {smart && (
          <>
            <p>
              Карточки попадут сюда автоматически, когда выполняются все условия. Удаление из
              обычной коллекции не меняет эти правила.
            </p>
            <Field label={'Тип'}>
              <Select value={type} onChange={e => setType(e.target.value)}>
                <option value={''}>Любой</option>
                <option value={'link'}>Ссылка</option>
                <option value={'text'}>Заметка</option>
                <option value={'photo'}>Фото</option>
                <option value={'video'}>Видео</option>
              </Select>
            </Field>
            <Field label={'Источник'}>
              <TextInput
                placeholder={'youtube.com'}
                value={source}
                onChange={e => setSource(e.target.value)}
              />
            </Field>
            <Field label={'Все теги через запятую'}>
              <TextInput value={tags} onChange={e => setTags(e.target.value)} />
            </Field>
            <Field label={'Статус'}>
              <Select value={status} onChange={e => setStatus(e.target.value)}>
                <option value={''}>Любой</option>
                {statuses.map(row => (
                  <option key={row.key} value={row.key}>
                    {row.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={'За последние N дней'}>
              <TextInput
                type={'number'}
                min={1}
                max={365}
                value={days}
                onChange={e => setDays(e.target.value)}
              />
            </Field>
          </>
        )}
        {error && (
          <p className={'error'} role={'alert'}>
            {error}
          </p>
        )}
        <div className={'settings-management-actions'}>
          <Button type={'button'} onClick={onClose}>
            Отмена
          </Button>
          <Button type={'submit'} variant={'primary'} disabled={busy || !name.trim()}>
            {busy ? 'Сохраняем…' : collection ? 'Сохранить изменения' : 'Создать'}
          </Button>
        </div>
      </fieldset>
    </form>
  );
  return embedded ? (
    form
  ) : (
    <Dialog
      title={collection ? 'Редактировать коллекцию' : 'Новая коллекция'}
      busy={busy}
      onClose={onClose}
    >
      {form}
    </Dialog>
  );
}
