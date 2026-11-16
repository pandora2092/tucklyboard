import './library-filters.css';

import { COPY } from '@tuckly/contracts';

import { Select } from '../../components/Select';
import { Button } from '../../components/ui/Button';
import { Field, TextInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';

import type { Catalogue } from './useCatalogue';

export function LibraryFilters({
  data,
  grid,
  onToggleGrid,
  onCreateCollection,
}: {
  data: Pick<
    Catalogue,
    | 'source'
    | 'setSource'
    | 'sources'
    | 'status'
    | 'setStatus'
    | 'statuses'
    | 'searchMode'
    | 'setSearchMode'
    | 'searchEngine'
    | 'collections'
    | 'collection'
    | 'setCollection'
    | 'type'
    | 'setType'
    | 'query'
    | 'setQuery'
    | 'tag'
    | 'setTag'
    | 'canEdit'
  >;
  grid: boolean;
  onToggleGrid: () => void;
  onCreateCollection: () => void;
}) {
  const {
    source,
    setSource,
    sources,
    status,
    setStatus,
    statuses,
    searchMode,
    setSearchMode,
    searchEngine,
    collections,
    collection,
    setCollection,
    type,
    setType,
    query,
    setQuery,
    tag,
    setTag,
    canEdit,
  } = data;
  return (
    <>
      <div className={'tools'}>
        <label className={'search'}>
          <span>⌕</span>
          <TextInput
            aria-label={'Поиск'}
            placeholder={'Найти что-то своё…'}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </label>
        <Button
          type={'button'}
          className={'view-toggle'}
          onClick={() => onToggleGrid()}
          aria-label={grid ? COPY.view.showList : COPY.view.showGrid}
          title={grid ? COPY.view.showList : COPY.view.showGrid}
        >
          <Icon name={grid ? 'list' : 'grid'} strokeWidth={1.5} />
        </Button>
      </div>
      <div className={'search-options'}>
        <Field label={'Искать'} className={'search-mode'}>
          <Select
            aria-label={'Режим поиска'}
            value={searchMode}
            onChange={e => setSearchMode(e.target.value as 'text' | 'semantic')}
          >
            <option value={'text'}>По словам</option>
            <option value={'semantic'}>По смыслу</option>
          </Select>
        </Field>
        {query && searchMode === 'semantic' && (
          <small className={'filter-hint'}>
            {searchEngine === 'embeddings' ? 'Учитываем смысл запроса' : 'По темам и синонимам'}
          </small>
        )}
      </div>
      <div className={'filters'}>
        <div className={'filter-types'} role={'group'} aria-label={'Тип находки'}>
          {(
            [
              ['', 'Всё'],
              ['link', 'Ссылки'],
              ['photo', 'Фото'],
              ['video', 'Видео'],
              ['text', 'Заметки'],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              className={type === value ? 'filter-type chosen' : 'filter-type'}
              aria-pressed={type === value}
              onClick={() => setType(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className={'filter-fields'}>
          <Field label={COPY.filters.source} className={'filter-field'}>
            <Select value={source} onChange={e => setSource(e.target.value)}>
              <option value={''}>{COPY.filters.allSources}</option>
              {sources.map(s => (
                <option key={s.source} value={s.source}>
                  {s.source} ({s.count})
                </option>
              ))}
            </Select>
          </Field>
          <Field label={COPY.filters.status} className={'filter-field'}>
            <Select value={status} onChange={e => setStatus(e.target.value)}>
              <option value={''}>{COPY.filters.anyStatus}</option>
              {statuses.map(row => (
                <option key={row.key} value={row.key}>
                  {row.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={COPY.filters.collection} className={'filter-field'}>
            <Select
              aria-label={COPY.filters.collection}
              value={collection}
              onChange={e => setCollection(e.target.value)}
            >
              <option value={''}>{COPY.filters.allCollections}</option>
              <option value={'inbox'}>{COPY.filters.inbox}</option>
              {collections.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          {canEdit && (
            <Button
              className={'filter-create'}
              title={COPY.filters.createCollection}
              onClick={() => onCreateCollection()}
            >
              <span aria-hidden={'true'}>＋</span> {COPY.filters.collection}
            </Button>
          )}
        </div>
        {tag && (
          <Button className={'chip chosen filter-tag'} onClick={() => setTag('')}>
            #{tag} ×
          </Button>
        )}
      </div>
    </>
  );
}
