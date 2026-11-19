import { COPY, type Item } from '@tuckly/contracts';

import { BrandMark } from '../../components/BrandMark';
import { ItemActions } from '../../components/ItemActions';
import { ItemCard } from '../../components/ItemCard';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Icon } from '../../components/ui/Icon';
import { BOOKMARK_TYPES } from '../../constants/bookmark-types';

import type { BulkActions } from './useBulkActions';
import type { Catalogue } from './useCatalogue';
import { VirtualItemList } from './VirtualItemList';

import './library-types.css';

export function LibraryHeading({ data }: { data: Pick<Catalogue, 'type' | 'setType' | 'total'> }) {
  const { type, setType, total } = data;
  const selected = BOOKMARK_TYPES.find(option => option.value === type) || BOOKMARK_TYPES[0];
  const plural = new Intl.PluralRules('ru').select(total || 0);
  const unit = plural === 'one' ? 'находка' : plural === 'few' ? 'находки' : 'находок';
  return (
    <>
      <section className={'heading'}>
        <div className={'heading-title'}>
          <span className={'bookmark-type-icon'} aria-hidden={'true'}>
            <Icon name={selected.icon} />
          </span>
          <div>
            <p className={'eyebrow'}>ВАША МАЛЕНЬКАЯ КОЛЛЕКЦИЯ МИРА</p>
            <h1 aria-live={'polite'}>{selected.title}</h1>
            <p>Идеи, к которым хочется вернуться.</p>
          </div>
        </div>
        <span className={'counter'}>
          {total === null ? '…' : `${total.toLocaleString('ru')} ${unit}`}
        </span>
      </section>
      <div className={'library-types'} role={'group'} aria-label={COPY.bookmarkTypes.label}>
        {BOOKMARK_TYPES.map(option => (
          <Button
            key={option.value}
            className={type === option.value ? 'library-type chosen' : 'library-type'}
            aria-pressed={type === option.value}
            onClick={() => setType(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </>
  );
}

export function LibraryResults({
  data,
  grid,
  selection,
  onAdd: _onAdd,
  onOpen,
  onTag,
  onCopy,
  onMove,
  onDelete,
  onCopyLink,
  onReady,
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
  onReady?: (ready: boolean) => void;
  grid: boolean;
  selection: BulkActions;
  onAdd: () => void;
  onOpen: (item: Item) => void;
  onTag: (tag: string) => void;
  onCopy: (item: Item) => void;
  onMove: (item: Item) => void;
  onDelete: (item: Item) => void;
  onCopyLink: (url: string) => void;
}) {
  const { loading, error, items, query, type, tag, canEdit, cursor, loadingMore, more } = data;
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
          {/* Ручное добавление временно скрыто; код оставлен для возврата.
          <Button
            variant={'primary'}
            disabled={!canEdit || loading || !data.statuses.length}
            onClick={() => _onAdd()}
          >
            ＋ Сохранить находку
          </Button>
          */}
        </div>
      ) : (
        <VirtualItemList
          onReady={onReady}
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
                  onMove={canEdit && item.canEdit ? () => onMove(item) : undefined}
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
