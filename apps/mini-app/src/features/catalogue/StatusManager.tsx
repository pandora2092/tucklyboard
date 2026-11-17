import { useEffect, useRef, useState, type FormEvent } from 'react';

import { COPY, SPACE_THEMES, type BookmarkStatus, type Space } from '@tuckly/contracts';

import { errorMessage } from '../../api/client';
import { statusesApi } from '../../api/statuses';
import { Select } from '../../components/Select';
import { Button } from '../../components/ui/Button';
import { Field, TextInput } from '../../components/ui/Field';
import { SETTINGS_LIST_PAGE_SIZE } from '../../constants/settings-list';

import { SettingsSection } from './SettingsSection';

export function StatusManager({
  space,
  busy,
  onBusyChange,
  onChanged,
}: {
  space: Space;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onChanged: () => void;
}) {
  const [statuses, setStatuses] = useState<BookmarkStatus[]>([]);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(SETTINGS_LIST_PAGE_SIZE);
  const filtered = statuses
    .map((row, index) => ({ row, index }))
    .filter(({ row }) =>
      row.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')),
    );
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState(''),
    [editColor, setEditColor] = useState<string>(SPACE_THEMES[space.theme].accent);
  const [name, setName] = useState(''),
    [color, setColor] = useState<string>(SPACE_THEMES[space.theme].accent);
  const previousDefaultColor = useRef<string>(SPACE_THEMES[space.theme].accent);
  useEffect(() => {
    const previous = previousDefaultColor.current;
    const next = SPACE_THEMES[space.theme].accent;
    setColor(value => (value === previous ? next : value));
    previousDefaultColor.current = next;
  }, [space.theme]);
  const [deleting, setDeleting] = useState<BookmarkStatus | null>(null),
    [replacement, setReplacement] = useState('');
  const editInput = useRef<HTMLInputElement>(null);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const previousEditing = useRef<string | null>(null);
  const owner = space.role === 'owner';
  useEffect(() => {
    if (editing) {
      editInput.current?.focus();
      editInput.current?.select();
      editInput.current?.scrollIntoView({ block: 'nearest' });
    } else if (previousEditing.current) {
      editButtons.current.get(previousEditing.current)?.focus();
    }
    previousEditing.current = editing;
  }, [editing]);
  useEffect(() => {
    const controller = new AbortController();
    void statusesApi
      .list(space.id, controller.signal)
      .then(setStatuses)
      .catch(e => {
        if (!controller.signal.aborted) {
          setError(errorMessage(e));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [space.id]);
  function reset() {
    setName('');
    setColor(SPACE_THEMES[space.theme].accent);
  }
  async function perform(work: () => Promise<unknown>, after?: () => void) {
    onBusyChange(true);
    setError('');
    try {
      await work();
      setStatuses(await statusesApi.list(space.id));
      after?.();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      onBusyChange(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const body = { name: name.trim(), color };
    void perform(() => statusesApi.create(space.id, body), reset);
  }
  function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) {
      return;
    }
    void perform(
      () => statusesApi.update(space.id, editing, { name: editName.trim(), color: editColor }),
      () => setEditing(null),
    );
  }
  function move(index: number, offset: number) {
    const keys = statuses.map(row => row.key);
    [keys[index], keys[index + offset]] = [keys[index + offset], keys[index]];
    if (!query.trim() && index + offset >= visibleCount) {
      setVisibleCount(count => count + SETTINGS_LIST_PAGE_SIZE);
    }
    void perform(() => statusesApi.reorder(space.id, keys));
  }
  return (
    <SettingsSection
      title={'Статусы'}
      count={loading ? '…' : statuses.length}
      label={'Статусы закладок'}
      disabled={busy || Boolean(editing) || Boolean(deleting)}
      onCollapse={() => {
        setVisibleCount(SETTINGS_LIST_PAGE_SIZE);
        setQuery('');
      }}
      onKeyDown={event => {
        if (event.key === 'Escape' && !busy && (editing || deleting)) {
          event.preventDefault();
          event.stopPropagation();
          if (editing) {
            setEditing(null);
          } else {
            setDeleting(null);
          }
        }
      }}
    >
      <p className={'settings-description'}>
        Создавайте свои статусы и выбирайте порядок. Статус по умолчанию получают новые закладки.
      </p>
      {!owner && (
        <p className={'storage-note'}>Менять статусы общего пространства может только владелец.</p>
      )}
      {error && !editing && (
        <p className={'error'} role={'alert'}>
          {error}
        </p>
      )}
      {!loading && statuses.length > 0 && (
        <TextInput
          type={'search'}
          aria-label={'Найти статус в настройках'}
          placeholder={'Найти статус'}
          value={query}
          disabled={busy || Boolean(editing) || Boolean(deleting)}
          onChange={event => {
            setQuery(event.target.value);
            setVisibleCount(SETTINGS_LIST_PAGE_SIZE);
          }}
        />
      )}
      {loading ? (
        <p role={'status'}>Загружаем статусы…</p>
      ) : (
        <ol className={'status-list'} aria-label={'Статусы пространства'}>
          {filtered.slice(0, visibleCount).map(({ row, index }) => (
            <li key={row.key} className={editing === row.key ? 'status-row-editing' : undefined}>
              <span
                className={'status-dot'}
                style={{ backgroundColor: row.color }}
                aria-hidden={'true'}
              />
              <div className={'status-summary'}>
                <strong>{row.name}</strong>
                <small>
                  Закладок: {row.itemCount ?? 0}
                  {row.isDefault ? ' · По умолчанию' : ''}
                </small>
              </div>
              {owner && editing !== row.key && (
                <div className={'status-actions'}>
                  <Button
                    disabled={busy || index === 0}
                    aria-label={`Поднять ${row.name}`}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    disabled={busy || index === statuses.length - 1}
                    aria-label={`Опустить ${row.name}`}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    disabled={busy}
                    aria-label={`Изменить ${row.name}`}
                    ref={button => {
                      if (button) {
                        editButtons.current.set(row.key, button);
                      } else {
                        editButtons.current.delete(row.key);
                      }
                    }}
                    onClick={() => {
                      setEditing(row.key);
                      setEditName(row.name);
                      setEditColor(row.color);
                      setDeleting(null);
                      setError('');
                    }}
                  >
                    Изменить
                  </Button>
                  {!row.isDefault && (
                    <Button
                      disabled={busy}
                      aria-label={`По умолчанию: ${row.name}`}
                      onClick={() =>
                        void perform(() =>
                          statusesApi.update(space.id, row.key, { isDefault: true }),
                        )
                      }
                    >
                      По умолчанию
                    </Button>
                  )}
                  <Button
                    className={'status-delete'}
                    disabled={busy || statuses.length === 1}
                    aria-label={`Удалить ${row.name}`}
                    onClick={() => {
                      setEditing(null);
                      setError('');
                      setDeleting(row);
                      setReplacement(
                        statuses.find(other => other.key !== row.key && other.isDefault)?.key ||
                          statuses.find(other => other.key !== row.key)?.key ||
                          '',
                      );
                    }}
                  >
                    {COPY.actions.delete}
                  </Button>
                </div>
              )}
              {owner && editing === row.key && (
                <form
                  className={'status-inline-editor'}
                  aria-label={`Редактирование статуса ${row.name}`}
                  onSubmit={submitEdit}
                >
                  <div className={'status-form-fields'}>
                    <Field label={'Название статуса'}>
                      <TextInput
                        ref={editInput}
                        required
                        maxLength={40}
                        disabled={busy}
                        value={editName}
                        onChange={event => setEditName(event.target.value)}
                      />
                    </Field>
                    <Field label={'Цвет статуса'}>
                      <TextInput
                        type={'color'}
                        disabled={busy}
                        value={editColor}
                        onChange={event => setEditColor(event.target.value)}
                      />
                    </Field>
                  </div>
                  {error && (
                    <p className={'error'} role={'alert'}>
                      {error}
                    </p>
                  )}
                  <div className={'dialog-actions'}>
                    <Button
                      type={'button'}
                      disabled={busy}
                      onClick={() => {
                        setEditing(null);
                        setError('');
                      }}
                    >
                      {COPY.actions.cancel}
                    </Button>
                    <Button type={'submit'} variant={'primary'} disabled={busy || !editName.trim()}>
                      {busy ? COPY.actions.saving : COPY.actions.saveChanges}
                    </Button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ol>
      )}
      {!loading && !filtered.length && <p className={'settings-description'}>Статусы не найдены</p>}
      {filtered.length > visibleCount && (
        <Button
          className={'settings-show-more'}
          disabled={busy || Boolean(editing) || Boolean(deleting)}
          onClick={() => setVisibleCount(count => count + SETTINGS_LIST_PAGE_SIZE)}
        >
          Показать ещё {Math.min(SETTINGS_LIST_PAGE_SIZE, filtered.length - visibleCount)}
        </Button>
      )}
      {owner && deleting && (
        <section className={'status-delete-panel'} aria-label={'Удаление статуса'}>
          <h3>Удалить «{deleting.name}»?</h3>
          <p>
            Закладки и правила умных коллекций будут перенесены в выбранный статус. Если удаляется
            статус по умолчанию, выбранный станет новым.
          </p>
          <Field label={'Перенести в'}>
            <Select
              disabled={busy}
              value={replacement}
              onChange={e => setReplacement(e.target.value)}
            >
              {statuses
                .filter(row => row.key !== deleting.key)
                .map(row => (
                  <option key={row.key} value={row.key}>
                    {row.name}
                  </option>
                ))}
            </Select>
          </Field>
          <div className={'dialog-actions'}>
            <Button disabled={busy} onClick={() => setDeleting(null)}>
              {COPY.actions.cancel}
            </Button>
            <Button
              variant={'primary'}
              disabled={busy || !replacement}
              onClick={() =>
                void perform(
                  () => statusesApi.remove(space.id, deleting.key, replacement),
                  () => {
                    setDeleting(null);
                  },
                )
              }
            >
              Перенести и удалить
            </Button>
          </div>
        </section>
      )}
      {owner && !loading && !deleting && !editing && (
        <form className={'status-form'} onSubmit={submit}>
          <h3>Новый статус</h3>
          <div className={'status-form-fields'}>
            <Field label={'Название'}>
              <TextInput
                required
                maxLength={40}
                disabled={busy}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={'Например, Читаю'}
              />
            </Field>
            <Field label={'Цвет'}>
              <TextInput
                type={'color'}
                disabled={busy}
                value={color}
                onChange={e => setColor(e.target.value)}
              />
            </Field>
            <Button
              className={'status-add-button'}
              type={'submit'}
              variant={'primary'}
              aria-label={busy ? COPY.actions.saving : 'Добавить статус'}
              title={'Добавить статус'}
              disabled={busy || !name.trim() || statuses.length >= 30}
            >
              {busy ? '…' : '＋'}
            </Button>
          </div>
        </form>
      )}
    </SettingsSection>
  );
}
