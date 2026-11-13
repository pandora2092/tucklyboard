import { useState } from 'react';

import type { BulkAction, Item } from '@tuckly/contracts';

import { catalogueApi } from '../api/catalogue';
import { errorMessage } from '../api/client';
import { ActionDialog } from '../components/ActionDialog';
import { ItemCard } from '../components/ItemCard';
import { Sidebar } from '../components/Sidebar';
import { CollectionDialog } from '../features/catalogue/CollectionDialog';
import { ItemDialog } from '../features/catalogue/ItemDialog';
import { InvitePanel, SpacePanel } from '../features/catalogue/SpacePanel';
import { useCatalogue } from '../features/catalogue/useCatalogue';

export function LibraryPage() {
  const {
    isAdmin,
    spaces,
    spaceId,
    changeSpace,
    activeSpace,
    canEdit,
    loadSpaces,
    source,
    setSource,
    sources,
    status,
    setStatus,
    searchMode,
    setSearchMode,
    searchEngine,
    items,
    collections,
    collection,
    setCollection,
    type,
    setType,
    query,
    setQuery,
    tag,
    setTag,
    cursor,
    loading,
    loadingMore,
    error,
    telegramEnabled,
    refresh,
    more,
  } = useCatalogue();
  const [grid, setGrid] = useState(true),
    [selected, setSelected] = useState<Item | null | undefined>(undefined);
  const [operation, setOperation] = useState<'space' | 'tags' | 'delete' | null>(null);
  const [collectionDialog, setCollectionDialog] = useState(false);
  const [managing, setManaging] = useState(false),
    [checked, setChecked] = useState<string[]>([]),
    [actionError, setActionError] = useState(''),
    [bulkFolder, setBulkFolder] = useState('');
  async function action(work: () => Promise<unknown>) {
    setActionError('');
    try {
      await work();
      refresh();
    } catch (e) {
      setActionError(errorMessage(e));
    }
  }
  async function bulk(kind: BulkAction['action'], value?: string) {
    const ids = checked.filter(id => items.some(i => i.id === id));
    if (!ids.length) {
      return;
    }
    if (kind === 'delete' && value !== 'confirmed') {
      setOperation('delete');
      return;
    }
    if (kind === 'addTags' && !value) {
      setOperation('tags');
      return;
    }
    const tags = kind === 'addTags' ? value : undefined;
    await action(async () => {
      await catalogueApi.bulk({
        spaceId: spaceId || undefined,
        ids,
        action: kind,
        collectionIds: bulkFolder ? [bulkFolder] : [],
        tags: tags
          ?.split(',')
          .map(t => t.trim())
          .filter(Boolean),
      });
      setChecked([]);
    });
  }
  const open = (item?: Item) => setSelected(item || null);
  return (
    <div className={'app'}>
      <Sidebar
        spaceName={activeSpace?.name || 'Моё пространство'}
        canEdit={canEdit}
        collections={collections}
        collection={collection}
        setCollection={setCollection}
        addCollection={() => setCollectionDialog(true)}
      />
      <main>
        <header>
          <span className={'breadcrumb'}>
            <select
              aria-label={'Пространство'}
              value={activeSpace?.id || ''}
              onChange={e => {
                changeSpace(e.target.value);
                setChecked([]);
              }}
            >
              {spaces.map(space => (
                <option key={space.id} value={space.id}>
                  {space.name}
                  {space.personal ? '' : ' · общее'}
                </option>
              ))}
            </select>
            <button onClick={() => setOperation('space')}>＋ Пространство</button>
            {activeSpace && <button onClick={() => setManaging(true)}>Участники</button>}
            {isAdmin && <a href={'/admin'}>Админка</a>}
          </span>
          <button className={'primary'} disabled={!canEdit} onClick={() => open()}>
            ＋ Добавить
          </button>
        </header>
        <InvitePanel
          onJoined={id => {
            void loadSpaces();
            changeSpace(id);
          }}
        />
        {managing && activeSpace && (
          <SpacePanel
            space={activeSpace}
            onClose={() => setManaging(false)}
            onChanged={() => void loadSpaces()}
          />
        )}
        {actionError && (
          <p className={'error'} role={'alert'}>
            {actionError}
          </p>
        )}
        <section className={'heading'}>
          <div>
            <p className={'eyebrow'}>ВАША МАЛЕНЬКАЯ КОЛЛЕКЦИЯ МИРА</p>
            <h1>
              {collection === 'inbox'
                ? 'Входящие'
                : collections.find(c => c.id === collection)?.name || 'Всё сохранённое'}
              <span>✳</span>
            </h1>
            <p>Идеи, к которым хочется вернуться.</p>
          </div>
          <span className={'counter'}>
            {items.length}
            {cursor ? '+' : ''} находок
          </span>
        </section>
        <div className={'tools'}>
          <label className={'search'}>
            <span>⌕</span>
            <input
              aria-label={'Поиск'}
              placeholder={'Найти что-то своё…'}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </label>
          <button
            className={'view-toggle'}
            onClick={() => setGrid(!grid)}
            aria-label={'Переключить вид'}
          >
            {grid ? '☷' : '▦'}
          </button>
        </div>
        <div className={'filters'}>
          <select aria-label={'Источник'} value={source} onChange={e => setSource(e.target.value)}>
            <option value={''}>Все источники</option>
            {sources.map(s => (
              <option key={s.source} value={s.source}>
                {s.source} ({s.count})
              </option>
            ))}
          </select>
          <select
            aria-label={'Статус'}
            value={status}
            onChange={e => setStatus(e.target.value as '' | 'saved' | 'done')}
          >
            <option value={''}>Любой статус</option>
            <option value={'saved'}>На потом</option>
            <option value={'done'}>Просмотрено</option>
          </select>
          <select
            aria-label={'Режим поиска'}
            value={searchMode}
            onChange={e => setSearchMode(e.target.value as 'text' | 'semantic')}
          >
            <option value={'text'}>По словам</option>
            <option value={'semantic'}>По смыслу</option>
          </select>
          {query && searchMode === 'semantic' && (
            <small>
              {searchEngine === 'embeddings' ? 'Поиск с embeddings' : 'По темам и синонимам'}
            </small>
          )}
          {canEdit && (
            <button className={'chip'} onClick={() => setCollectionDialog(true)}>
              ＋ Коллекция / умная коллекция
            </button>
          )}
          {(
            [
              ['', 'Всё'],
              ['link', '↗ Ссылки'],
              ['photo', '▧ Фото'],
              ['video', '▷ Видео'],
              ['text', '≡ Заметки'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={type === value ? 'chip chosen' : 'chip'}
              onClick={() => setType(value)}
            >
              {label}
            </button>
          ))}
          {tag && (
            <button className={'chip chosen'} onClick={() => setTag('')}>
              #{tag} ×
            </button>
          )}
        </div>
        {error && (
          <div role={'alert'} className={'error'}>
            {error}
            <button onClick={() => refresh()}>Повторить</button>
          </div>
        )}
        {canEdit && (
          <div className={'bulk-tools'}>
            <label>
              <input
                type={'checkbox'}
                checked={items.length > 0 && items.every(i => checked.includes(i.id))}
                onChange={e => setChecked(e.target.checked ? items.map(i => i.id) : [])}
              />{' '}
              Выбрать все на странице
            </label>
            {checked.some(id => items.some(i => i.id === id)) && (
              <>
                <span>Выбрано: {checked.filter(id => items.some(i => i.id === id)).length}</span>
                <select
                  aria-label={'Коллекция для выбранных'}
                  value={bulkFolder}
                  onChange={e => setBulkFolder(e.target.value)}
                >
                  <option value={''}>Коллекция…</option>
                  {collections
                    .filter(c => !c.rules)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <button disabled={!bulkFolder} onClick={() => void bulk('addCollections')}>
                  Добавить в коллекцию
                </button>
                <button disabled={!bulkFolder} onClick={() => void bulk('removeCollections')}>
                  Убрать из коллекции
                </button>
                <button onClick={() => void bulk('addTags')}>Теги</button>
                <button onClick={() => void bulk('markDone')}>Просмотрено</button>
                <button onClick={() => void bulk('markSaved')}>На потом</button>
                <button onClick={() => void bulk('delete')}>Удалить</button>
              </>
            )}
          </div>
        )}
        {loading ? (
          <div className={'empty'}>Собираем ваши находки…</div>
        ) : error ? null : items.length === 0 ? (
          <div className={'empty'}>
            <div className={'empty-icon'}>✳</div>
            <h2>
              {query || type || tag ? 'Пока ничего не найдено' : 'Здесь начинается ваша коллекция'}
            </h2>
            <p>
              {query || type || tag
                ? 'Попробуйте другой запрос или фильтр.'
                : 'Сохраните ссылку, фотографию или мысль. Всё будет под рукой.'}
            </p>
            <button className={'primary'} disabled={!canEdit} onClick={() => open()}>
              ＋ Сохранить находку
            </button>
          </div>
        ) : (
          <div className={grid ? 'cards' : 'cards list'}>
            {items.map(item => (
              <div className={'card-wrap'} key={item.id}>
                {canEdit && (
                  <label className={'card-select'}>
                    <input
                      aria-label={`Выбрать ${item.title}`}
                      type={'checkbox'}
                      checked={checked.includes(item.id)}
                      onChange={e =>
                        setChecked(ids =>
                          e.target.checked ? [...ids, item.id] : ids.filter(id => id !== item.id),
                        )
                      }
                    />
                  </label>
                )}
                <ItemCard item={item} onOpen={open} onTag={setTag} />
              </div>
            ))}
          </div>
        )}
        {cursor && (
          <button className={'load-more'} disabled={loadingMore} onClick={more}>
            Показать ещё
          </button>
        )}
        <div className={'mobile-collections'}>
          <select
            aria-label={'Коллекция'}
            value={collection}
            onChange={e => setCollection(e.target.value)}
          >
            <option value={''}>Все сохранённое</option>
            <option value={'inbox'}>Входящие</option>
            {collections.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button disabled={!canEdit} onClick={() => setCollectionDialog(true)}>
            ＋ Коллекция
          </button>
        </div>
      </main>
      {operation && (
        <ActionDialog
          title={
            operation === 'space'
              ? 'Новое общее пространство'
              : operation === 'tags'
                ? 'Теги для выбранных карточек'
                : 'Удалить выбранные карточки?'
          }
          label={
            operation === 'space'
              ? 'Название'
              : operation === 'tags'
                ? 'Теги через запятую'
                : undefined
          }
          submit={operation === 'delete' ? 'Удалить' : 'Сохранить'}
          onClose={() => setOperation(null)}
          onSubmit={async value => {
            if (operation === 'space') {
              const space = await catalogueApi.createSpace(value);
              await loadSpaces();
              changeSpace(space.id);
              setChecked([]);
            } else {
              await bulk(
                operation === 'tags' ? 'addTags' : 'delete',
                operation === 'tags' ? value : 'confirmed',
              );
            }
          }}
        />
      )}
      {collectionDialog && (
        <CollectionDialog
          spaceId={activeSpace?.id}
          onClose={() => setCollectionDialog(false)}
          onSaved={() => {
            setCollectionDialog(false);
            refresh();
          }}
        />
      )}
      {selected !== undefined && (
        <ItemDialog
          key={selected?.id || 'new'}
          item={selected}
          spaceId={activeSpace?.id}
          spaces={spaces}
          collections={collections}
          telegramEnabled={telegramEnabled}
          onClose={() => setSelected(undefined)}
          onSaved={() => {
            setSelected(undefined);
            refresh();
          }}
        />
      )}
    </div>
  );
}
