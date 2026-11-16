import type { Item } from '@tuckly/contracts';

import { ItemActions } from '../../components/ItemActions';
import { ItemCard } from '../../components/ItemCard';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';

import type { BulkActions } from './useBulkActions';
import type { Catalogue } from './useCatalogue';

export function LibraryHeading({
  data,
}: {
  data: Pick<Catalogue, 'collection' | 'collections' | 'items' | 'cursor'>;
}) {
  const { collection, collections, items, cursor } = data;
  return (
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
  >;
  grid: boolean;
  selection: BulkActions;
  onAdd: () => void;
  onOpen: (item: Item) => void;
  onTag: (tag: string) => void;
  onCopy: (item: Item) => void;
}) {
  const { loading, error, items, query, type, tag, canEdit, statuses, cursor, loadingMore, more } =
    data;
  return (
    <>
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
          <Button
            variant={'primary'}
            disabled={!canEdit || loading || !statuses.length}
            onClick={() => onAdd()}
          >
            ＋ Сохранить находку
          </Button>
        </div>
      ) : (
        <div className={grid ? 'cards' : 'cards list'}>
          {items.map(item => (
            <div className={'card-wrap'} key={item.id}>
              <div className={'card-actions'}>
                <ItemActions onCopy={() => onCopy(item)} />
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
              <ItemCard item={item} onOpen={onOpen} onTag={onTag} />
            </div>
          ))}
        </div>
      )}
      {cursor && (
        <Button className={'load-more'} disabled={loadingMore} onClick={more}>
          Показать ещё
        </Button>
      )}
    </>
  );
}
