import { useState, type FormEvent } from 'react';

import type { BookmarkStatus, SmartRules } from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';
import { Select } from '../../components/Select';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Dialog } from '../../components/ui/Dialog';
import { Field, TextInput } from '../../components/ui/Field';

export function CollectionDialog({
  spaceId,
  statuses,
  onClose,
  onSaved,
}: {
  spaceId?: string;
  statuses: BookmarkStatus[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(''),
    [smart, setSmart] = useState(false),
    [type, setType] = useState(''),
    [source, setSource] = useState(''),
    [tags, setTags] = useState(''),
    [status, setStatus] = useState(''),
    [days, setDays] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const rules: SmartRules = {
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
      await catalogueApi.createCollection(name, spaceId, smart ? rules : undefined);
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={'Новая коллекция'} busy={busy} onClose={onClose}>
      <form onSubmit={save}>
        <Field label={'Название'}>
          <TextInput required maxLength={80} value={name} onChange={e => setName(e.target.value)} />
        </Field>
        <label className={'inline-option'}>
          <Checkbox checked={smart} onChange={e => setSmart(e.target.checked)} />
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
        <Button type={'submit'} variant={'primary'} disabled={busy || !name.trim()}>
          Создать
        </Button>
      </form>
    </Dialog>
  );
}
