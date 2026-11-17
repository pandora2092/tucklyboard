import type { Item } from '@tuckly/contracts';

import { BrandMark } from '../../components/BrandMark';
import { CollectionCover } from '../../components/CollectionCover';
import { ItemActions } from '../../components/ItemActions';
import { ItemCard } from '../../components/ItemCard';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';

import type { BulkActions } from './useBulkActions';
import type { Catalogue } from './useCatalogue';
import { VirtualItemList } from './VirtualItemList';

export function LibraryHeading({
  data,
}: {
  data: Pick<Catalogue, 'collection' | 'collections' | 'total'>;
}) {
  const { collection, collections, total } = data;
  const title =
    collection === 'inbox'
      ? 'Входящие'
      : collections.find(c => c.id === collection)?.name || 'Всё сохранённое';
  const plural = new Intl.PluralRules('ru').select(total || 0);
  const unit = plural === 'one' ? 'находка' : plural === 'few' ? 'находки' : 'находок';
  return (
    <section className={'heading'}>
      <div className={'heading-title'}>
        {collection && collection !== 'inbox' && <CollectionCover name={title} />}
        <div>
          <p className={'eyebrow'}>ВАША МАЛЕНЬКАЯ КОЛЛЕКЦИЯ МИРА</p>
          <h1>{title}</h1>
          <p>Идеи, к которым хочется вернуться.</p>
        </div>
      </div>
      <span className={'counter'}>
        {total === null ? '…' : `${total.toLocaleString('ru')} ${unit}`}
      </span>
    </section>
  );
}

export function LibraryResults({
  data,
  grid,
  selection,
  onAdd,
  onOpen,
  onTag,
  onCopy,
  onDelete,
  onCopyLink,
}: {
  data: Pick<
    Catalogue,
    | 'loading'
    | 'error'
    | 'items'
    | 'query'
    | 'type'
    | 'tag'
    | 'canEdit'
    | 'statuses'
    | 'cursor'
    | 'loadingMore'
    | 'more'
    | 'moreError'
    | 'refreshError'
    | 'refresh'
    | 'refreshing'
    | 'scrollAnchor'
    | 'searchScopeLimit'
  >;
  grid: boolean;
  selection: BulkActions;
  onAdd: () => void;
  onOpen: (item: Item) => void;
  onTag: (tag: string) => void;
  onCopy: (item: Item) => void;
  onDelete: (item: Item) => void;
  onCopyLink: (url: string) => void;
}) {
  const { loading, error, items, query, type, tag, canEdit, statuses, cursor, loadingMore, more } =
    data;
  return (
    <>
      {data.searchScopeLimit && (
        <p className={'catalogue-search-note'}>
          Поиск по смыслу: проверены последние {data.searchScopeLimit.toLocaleString('ru')}{' '}
          закладок.
        </p>
      )}
      {loading ? (
        <div className={'empty'}>Собираем ваши находки…</div>
      ) : error && !items.length ? null : items.length === 0 ? (
        <div className={'empty'}>
          <div className={'empty-icon'}>
            <BrandMark />
          </div>
          <h2>
            {query || type || tag ? 'Пока ничего не найдено' : 'Здесь начинается ваша коллекция'}
          </h2>
          <p>
            {query || type || tag
              ? 'Попробуйте другой запрос или фильтр.'
              : 'Сохраните ссылку, фотографию или мысль. Всё будет под рукой.'}
          </p>
          <Button
            variant={'primary'}
            disabled={!canEdit || loading || !statuses.length}
            onClick={() => onAdd()}
          >
            ＋ Сохранить находку
          </Button>
        </div>
      ) : (
        <VirtualItemList
          items={items}
          grid={grid}
          scrollAnchor={data.scrollAnchor}
          renderMeasurement={item => (
            <ItemCard
              item={item}
              measurementOnly
              onOpen={onOpen}
              onTag={onTag}
              onCopyLink={onCopyLink}
            />
          )}
          renderItem={item => (
            <>
              <div className={'card-actions'}>
                <ItemActions
                  onCopy={() => onCopy(item)}
                  onDelete={canEdit && item.canEdit ? () => onDelete(item) : undefined}
                  disabled={selection.busy}
                />
              </div>
              {canEdit && (
                <label className={'card-select'}>
                  <Checkbox
                    aria-label={`Выбрать ${item.title}`}
                    disabled={selection.busy}
                    checked={selection.selectedIds.includes(item.id)}
                    onChange={e => selection.toggle(item.id, e.target.checked)}
                  />
                </label>
              )}
              <ItemCard item={item} onOpen={onOpen} onTag={onTag} onCopyLink={onCopyLink} />
            </>
          )}
        />
      )}
      {data.refreshError && (
        <div className={'catalogue-more-error'} role={'alert'}>
          {data.refreshError} <Button onClick={data.refresh}>Повторить обновление</Button>
        </div>
      )}
      {data.moreError && (
        <p className={'catalogue-more-error'} role={'alert'}>
          {data.moreError}
        </p>
      )}
      {cursor && (
        <Button className={'load-more'} disabled={loadingMore || data.refreshing} onClick={more}>
          {loadingMore ? 'Загружаем…' : data.moreError ? 'Повторить загрузку' : 'Показать ещё'}
        </Button>
      )}
    </>
  );
}
