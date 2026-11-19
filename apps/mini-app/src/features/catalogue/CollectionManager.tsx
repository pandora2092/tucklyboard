import { useEffect, useRef, useState } from 'react';

import type { BookmarkStatus, Collection, Space } from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/Field';
import { SETTINGS_LIST_PAGE_SIZE } from '../../constants/settings-list';

import { CollectionDialog } from './CollectionDialog';
import { SettingsSection } from './SettingsSection';

export function CollectionManager({
  space,
  collections,
  statuses,
  busy,
  onBusyChange,
  onChanged,
  onDeleted,
}: {
  space: Space;
  collections: Collection[];
  statuses: BookmarkStatus[];
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onChanged: () => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState<Collection | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Collection | null>(null);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(SETTINGS_LIST_PAGE_SIZE);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const canEdit = space.role !== 'viewer';
  useEffect(() => {
    if (deleting) {
      cancelDelete.current?.focus();
      cancelDelete.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [deleting]);
  async function remove() {
    if (!deleting || !canEdit || busy) {
      return;
    }
    onBusyChange(true);
    setError('');
    try {
      await catalogueApi.deleteCollection(deleting.id);
      onDeleted(deleting.id);
      setDeleting(null);
      setNotice('Коллекция удалена. Закладки остались в библиотеке.');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      onBusyChange(false);
    }
  }
  const visible = collections.filter(collection =>
    collection.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')),
  );
  return (
    <SettingsSection
      title={'Коллекции'}
      count={collections.length}
      label={'Управление коллекциями'}
      disabled={busy || editing !== undefined || Boolean(deleting)}
      onCollapse={() => {
        setVisibleCount(SETTINGS_LIST_PAGE_SIZE);
        setQuery('');
      }}
    >
      {editing !== undefined ? (
        <>
          <p className={'settings-description'}>
            {editing ? 'Редактирование коллекции' : 'Новая коллекция'}
          </p>
          <CollectionDialog
            key={editing?.id || 'new'}
            embedded
            collection={editing}
            spaceId={space.id}
            statuses={statuses}
            disabled={busy}
            onBusyChange={onBusyChange}
            onClose={() => setEditing(undefined)}
            onSaved={() => {
              setEditing(undefined);
              onChanged();
            }}
          />
        </>
      ) : (
        <>
          <p className={'settings-description'}>
            Название и условия умных коллекций можно изменить. Удаление коллекции не удаляет
            закладки.
          </p>
          {collections.length > 0 && (
            <TextInput
              type={'search'}
              aria-label={'Найти коллекцию в настройках'}
              placeholder={'Найти коллекцию'}
              value={query}
              disabled={busy}
              onChange={event => {
                setQuery(event.target.value);
                setVisibleCount(SETTINGS_LIST_PAGE_SIZE);
              }}
            />
          )}
          <ul className={'settings-collection-list'} aria-label={'Коллекции пространства'}>
            {visible.slice(0, visibleCount).map(collection => (
              <li key={collection.id}>
                <div className={'settings-collection-summary'}>
                  <b>{collection.name}</b>
                  <small>
                    {collection.rules ? 'Умная' : 'Обычная'} · Закладок: {collection._count.items}
                  </small>
                </div>
                {canEdit && (
                  <div className={'settings-management-actions'}>
                    <Button
                      disabled={busy || Boolean(deleting)}
                      aria-label={`Редактировать коллекцию «${collection.name}»`}
                      onClick={() => {
                        setNotice('');
                        setError('');
                        setEditing(collection);
                      }}
                    >
                      Редактировать
                    </Button>
                    <Button
                      className={'settings-danger'}
                      disabled={busy || Boolean(deleting)}
                      aria-label={`Удалить коллекцию «${collection.name}»`}
                      onClick={() => {
                        setNotice('');
                        setError('');
                        setDeleting(collection);
                      }}
                    >
                      Удалить
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {visible.length > visibleCount && (
            <Button
              className={'settings-show-more'}
              disabled={busy || Boolean(deleting)}
              onClick={() => setVisibleCount(count => count + SETTINGS_LIST_PAGE_SIZE)}
            >
              Показать ещё {Math.min(SETTINGS_LIST_PAGE_SIZE, visible.length - visibleCount)}
            </Button>
          )}
          {!visible.length && (
            <p className={'settings-description'}>
              {collections.length ? 'Коллекции не найдены' : 'Коллекций пока нет'}
            </p>
          )}
          {canEdit && (
            <Button
              variant={'secondary'}
              disabled={busy || Boolean(deleting)}
              onClick={() => {
                setNotice('');
                setError('');
                setEditing(null);
              }}
            >
              ＋ Создать коллекцию
            </Button>
          )}
          {!canEdit && (
            <p className={'settings-description'}>
              Управлять коллекциями могут владелец и редакторы пространства.
            </p>
          )}
        </>
      )}
      {deleting && (
        <div className={'settings-delete-panel'}>
          <h4>Удалить коллекцию «{deleting.name}»?</h4>
          <p>
            Все закладки останутся в библиотеке и других коллекциях. Во входящих будут закладки без
            обычных и подходящих умных коллекций.
          </p>
          <div className={'settings-management-actions'}>
            <Button
              ref={cancelDelete}
              disabled={busy}
              onClick={() => {
                setDeleting(null);
                setError('');
              }}
            >
              Отмена
            </Button>
            <Button
              className={'settings-delete-confirm'}
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? 'Удаляем…' : 'Удалить коллекцию'}
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p className={'error'} role={'alert'}>
          {error}
        </p>
      )}
      {notice && (
        <p className={'success'} role={'status'}>
          {notice}
        </p>
      )}
    </SettingsSection>
  );
}
