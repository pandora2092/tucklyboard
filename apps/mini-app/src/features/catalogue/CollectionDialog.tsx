import { useState, type FormEvent } from 'react';

import type { SmartRules } from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';

export function CollectionDialog({
  spaceId,
  onClose,
  onSaved,
}: {
  spaceId?: string;
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
    <div className={'overlay'}>
      <section
        className={'dialog'}
        role={'dialog'}
        aria-modal={'true'}
        aria-label={'Новая коллекция'}
      >
        <div className={'dialog-top'}>
          <h2>Новая коллекция</h2>
          <button disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={save}>
          <label>
            Название
            <input required maxLength={80} value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label className={'inline-option'}>
            <input type={'checkbox'} checked={smart} onChange={e => setSmart(e.target.checked)} />
            Умная коллекция
          </label>
          {smart && (
            <>
              <p>
                Карточки попадут сюда автоматически, когда выполняются все условия. Удаление из
                обычной коллекции не меняет эти правила.
              </p>
              <label>
                Тип
                <select value={type} onChange={e => setType(e.target.value)}>
                  <option value={''}>Любой</option>
                  <option value={'link'}>Ссылка</option>
                  <option value={'text'}>Заметка</option>
                  <option value={'photo'}>Фото</option>
                  <option value={'video'}>Видео</option>
                </select>
              </label>
              <label>
                Источник
                <input
                  placeholder={'youtube.com'}
                  value={source}
                  onChange={e => setSource(e.target.value)}
                />
              </label>
              <label>
                Все теги через запятую
                <input value={tags} onChange={e => setTags(e.target.value)} />
              </label>
              <label>
                Статус
                <select value={status} onChange={e => setStatus(e.target.value)}>
                  <option value={''}>Любой</option>
                  <option value={'saved'}>На потом</option>
                  <option value={'done'}>Просмотрено</option>
                </select>
              </label>
              <label>
                За последние N дней
                <input
                  type={'number'}
                  min={1}
                  max={365}
                  value={days}
                  onChange={e => setDays(e.target.value)}
                />
              </label>
            </>
          )}
          {error && (
            <p className={'error'} role={'alert'}>
              {error}
            </p>
          )}
          <button className={'primary'} disabled={busy || !name.trim()}>
            Создать
          </button>
        </form>
      </section>
    </div>
  );
}
