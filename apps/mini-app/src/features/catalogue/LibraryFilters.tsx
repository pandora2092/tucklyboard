import './library-filters.css';

import { useId, useRef, useState } from 'react';

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
}: {
  data: Pick<
    Catalogue,
    | 'source'
    | 'setSource'
    | 'sources'
    | 'sourcesLoading'
    | 'sourcesError'
    | 'status'
    | 'setStatus'
    | 'statuses'
    | 'searchMode'
    | 'setSearchMode'
    | 'searchEngine'
    | 'collections'
    | 'collection'
    | 'setCollection'
    | 'query'
    | 'setQuery'
    | 'tag'
    | 'setTag'
    | 'tags'
    | 'tagsLoading'
    | 'tagsError'
  >;
  grid: boolean;
  onToggleGrid: () => void;
}) {
  const {
    source,
    setSource,
    sources,
    sourcesLoading,
    sourcesError,
    status,
    setStatus,
    statuses,
    searchMode,
    setSearchMode,
    searchEngine,
    collections,
    collection,
    setCollection,
    query,
    setQuery,
    tag,
    setTag,
    tags,
    tagsLoading,
    tagsError,
  } = data;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const activeCount = [source, status, collection, tag].filter(Boolean).length;
  const summary = [
    source,
    status ? statuses.find(row => row.key === status)?.name || COPY.filters.status : '',
    collection === 'inbox'
      ? COPY.filters.inbox
      : collection
        ? collections.find(row => row.id === collection)?.name || COPY.filters.collection
        : '',
    tag ? `#${tag}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  function reset() {
    setSource('');
    setStatus('');
    setCollection('');
    setTag('');
    toggle.current?.focus({ preventScroll: true });
  }
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
      <section className={'filters'} aria-label={COPY.filters.heading}>
        <div className={'filters-heading'}>
          <Button
            ref={toggle}
            className={'filters-toggle'}
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={() => setOpen(value => !value)}
          >
            <span className={'filters-toggle-copy'}>
              <span className={'filters-title'}>
                {COPY.filters.heading}
                {activeCount > 0 && <span className={'filters-count'}>{activeCount}</span>}
              </span>
              <span className={'filters-summary'}>{summary || COPY.filters.noneSelected}</span>
            </span>
          </Button>
          <div className={'filters-actions'}>
            <Button
              className={'filters-icon-button'}
              aria-label={COPY.filters.resetLabel}
              title={COPY.filters.resetLabel}
              disabled={!activeCount}
              onClick={reset}
            >
              <Icon name={'reset'} size={18} />
            </Button>
            <Button
              className={'filters-icon-button filters-collapse'}
              aria-label={open ? COPY.filters.collapse : COPY.filters.expand}
              title={open ? COPY.filters.collapse : COPY.filters.expand}
              aria-expanded={open}
              aria-controls={open ? panelId : undefined}
              onClick={() => setOpen(value => !value)}
            >
              <Icon name={'chevron'} size={18} />
            </Button>
          </div>
        </div>
        {open && (
          <div id={panelId} className={'filters-content'}>
            <div className={'filter-fields'}>
              <Field label={COPY.filters.source} className={'filter-field'}>
                <Select
                  value={source}
                  disabled={sourcesLoading}
                  onChange={e => setSource(e.target.value)}
                >
                  <option value={''}>{COPY.filters.allSources}</option>
                  {sources.map(s => (
                    <option key={s.source} value={s.source}>
                      {s.source} ({s.count})
                    </option>
                  ))}
                </Select>
                {sourcesError && <small role={'alert'}>{sourcesError}</small>}
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
              <Field label={COPY.filters.tag} className={'filter-field'}>
                <Select
                  aria-label={COPY.filters.tag}
                  value={tag}
                  disabled={tagsLoading}
                  onChange={event => setTag(event.target.value)}
                >
                  <option value={''}>{COPY.filters.allTags}</option>
                  {tag && !tags.some(row => row.tag === tag) && <option value={tag}>#{tag}</option>}
                  {tags.map(row => (
                    <option key={row.tag} value={row.tag}>
                      #{row.tag} ({row.count})
                    </option>
                  ))}
                </Select>
                {tagsError && <small role={'alert'}>{tagsError}</small>}
              </Field>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
