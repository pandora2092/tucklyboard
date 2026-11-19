import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CATALOGUE_LIMITS,
  COPY,
  type BookmarkStatus,
  type Collection,
  type Item,
  type ItemQuery,
  type Space,
  type SpaceBackground,
  type SpaceTheme,
} from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { loadCatalogueWindow } from '../../api/catalogue-window';
import { errorMessage } from '../../api/client';
import { statusesApi } from '../../api/statuses';
import { UI_TIMING_MS } from '../../constants/timing';
import { captureCatalogueScroll, type CatalogueScrollAnchor } from '../../lib/catalogue-scroll';
import { chooseSpace, readLastSpace, writeLastSpace } from '../../lib/last-space';
import { useSpaceTheme } from '../../lib/space-theme';

export function useCatalogue() {
  const [items, setItems] = useState<Item[]>([]),
    [collections, setCollections] = useState<Collection[]>([]),
    [collection, setCollection] = useState(''),
    [type, setType] = useState<NonNullable<ItemQuery['type']> | ''>(''),
    [query, setQuery] = useState(''),
    [tag, setTag] = useState(''),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [loadingMore, setLoadingMore] = useState(false),
    [error, setError] = useState(''),
    [revision, setRevision] = useState(0),
    [telegramEnabled, setTelegramEnabled] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [searchScopeLimit, setSearchScopeLimit] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [moreError, setMoreError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [scrollAnchor, setScrollAnchor] = useState<CatalogueScrollAnchor | null>(null);
  const loadedCount = useRef(0);
  const loadedKey = useRef('');
  const moreRequest = useRef<AbortController | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]),
    [spaceId, setSpaceId] = useState(''),
    [source, setSource] = useState(''),
    [status, setStatus] = useState(''),
    [searchMode, setSearchMode] = useState<'text' | 'semantic'>('text'),
    [searchEngine, setSearchEngine] = useState('text');
  const [sourceOptions, setSourceOptions] = useState<{
    spaceId: string;
    type: string;
    rows: { source: string; count: number }[];
    error: string;
  } | null>(null);
  const [tagOptions, setTagOptions] = useState<{
    spaceId: string;
    type: string;
    rows: { tag: string; count: number }[];
    error: string;
  } | null>(null);
  const [statuses, setStatuses] = useState<BookmarkStatus[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [spaceSwitchNotice, setSpaceSwitchNotice] = useState('');
  useEffect(() => {
    if (!spaceSwitchNotice) {
      return;
    }
    const timer = setTimeout(() => setSpaceSwitchNotice(''), UI_TIMING_MS.spaceSwitchNotice);
    return () => clearTimeout(timer);
  }, [spaceSwitchNotice, spaceId]);
  const loadSpaces = useCallback(async () => {
    const available = await catalogueApi.spaces();
    const personalId = available.find(space => space.personal)?.id;
    const remembered = personalId ? readLastSpace(personalId) : '';
    setSpaces(available);
    setSpaceId(current => chooseSpace(available, current, remembered));
  }, []);
  useEffect(() => {
    void loadSpaces().catch(e => {
      setError(errorMessage(e));
      setLoading(false);
    });
  }, [loadSpaces]);
  const activeSpace = spaces.find(s => s.id === spaceId) || spaces.find(s => s.personal);
  useSpaceTheme(activeSpace?.theme || 'sage', activeSpace?.background);
  const activeSpaceId = activeSpace?.id;
  const personalSpaceId = spaces.find(space => space.personal)?.id;
  useEffect(() => {
    if (personalSpaceId && activeSpaceId) {
      writeLastSpace(personalSpaceId, activeSpaceId);
    }
  }, [personalSpaceId, activeSpaceId]);
  const previousSpaceId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (activeSpaceId && previousSpaceId.current && previousSpaceId.current !== activeSpaceId) {
      setSpaceSwitchNotice(COPY.space.switched(activeSpace.name));
    }
    previousSpaceId.current = activeSpaceId;
  }, [activeSpaceId, activeSpace?.name]);
  const canEdit = Boolean(activeSpace && activeSpace.role !== 'viewer');
  function changeSpace(id: string) {
    const destination =
      spaces.find(s => s.id === id) || (!id ? spaces.find(s => s.personal) : undefined);
    if ((destination?.id || id) === activeSpaceId) {
      return;
    }
    ++generation.current;
    setItems([]);
    loadedCount.current = 0;
    loadedKey.current = '';
    setTotal(null);
    setScrollAnchor(null);
    setCollections([]);
    setStatuses([]);
    setCursor(null);
    setLoading(true);
    setLoadingMore(false);
    setError('');
    setQuery('');
    setType('');
    setSpaceId(destination?.id || id);
    setCollection('');
    setSource('');
    setTag('');
    setStatus('');
  }
  function updateSpaceTheme(id: string, theme: SpaceTheme, background: SpaceBackground) {
    setSpaces(rows =>
      rows.map(space => (space.id === id ? { ...space, theme, background } : space)),
    );
  }
  function updateSpaceName(id: string, name: string) {
    setSpaces(rows => rows.map(space => (space.id === id ? { ...space, name } : space)));
  }
  function removeSpaceLocally(id: string) {
    changeSpace('');
    setSpaces(rows => rows.filter(space => space.id !== id));
  }
  const generation = useRef(0);
  const filters = useMemo(
    () => ({
      ...(spaceId ? { spaceId } : {}),
      ...(source ? { source } : {}),
      ...(status ? { status } : {}),
      searchMode,
      ...(collection ? { collection } : {}),
      ...(type ? { type } : {}),
      ...(query ? { q: query } : {}),
      ...(tag ? { tag } : {}),
    }),
    [collection, type, query, tag, spaceId, source, status, searchMode],
  );
  const refresh = useCallback(() => setRevision(v => v + 1), []);
  const sourcesMatch =
    sourceOptions !== null &&
    sourceOptions.spaceId === activeSpaceId &&
    sourceOptions.type === type;
  const sources = sourcesMatch ? sourceOptions.rows : [];
  const sourcesLoading = Boolean(activeSpaceId && !sourcesMatch);
  const sourcesError = sourcesMatch ? sourceOptions.error : '';
  const sourceReady = !source || sourcesMatch;
  const tagsMatch =
    tagOptions !== null && tagOptions.spaceId === activeSpaceId && tagOptions.type === type;
  const tags = tagsMatch ? tagOptions.rows : [];
  const tagsLoading = Boolean(activeSpaceId && !tagsMatch);
  const tagsError = tagsMatch ? tagOptions.error : '';
  const tagReady = !tag || tagsMatch;
  useEffect(() => {
    if (!activeSpaceId) {
      return;
    }
    const controller = new AbortController();
    void catalogueApi
      .tags(activeSpaceId, type || undefined, controller.signal)
      .then(rows => {
        if (controller.signal.aborted) {
          return;
        }
        setTagOptions({ spaceId: activeSpaceId, type, rows, error: '' });
        setTag(value => (rows.some(row => row.tag === value) ? value : ''));
      })
      .catch(error => {
        if (controller.signal.aborted) {
          return;
        }
        setTagOptions({ spaceId: activeSpaceId, type, rows: [], error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [activeSpaceId, type, revision]);

  useEffect(() => {
    if (!activeSpaceId) {
      return;
    }
    const controller = new AbortController();
    void catalogueApi
      .sources(activeSpaceId, type || undefined, controller.signal)
      .then(rows => {
        if (controller.signal.aborted) {
          return;
        }
        setSourceOptions({ spaceId: activeSpaceId, type, rows, error: '' });
        setSource(value => (rows.some(row => row.source === value) ? value : ''));
      })
      .catch(error => {
        if (controller.signal.aborted) {
          return;
        }
        setSourceOptions({ spaceId: activeSpaceId, type, rows: [], error: errorMessage(error) });
        setSource('');
      });
    return () => controller.abort();
  }, [activeSpaceId, type, revision]);

  useEffect(() => {
    // Resolve the active space first, instead of starting and then aborting a
    // second set of identical initial requests when spaces arrive.
    if (!activeSpaceId) {
      return;
    }
    if (!sourceReady || !tagReady) {
      setLoading(true);
      return;
    }
    const controller = new AbortController();
    const requestGeneration = ++generation.current;
    const key = JSON.stringify([filters, activeSpaceId]);
    const preserve = loadedKey.current === key;
    const targetCount = preserve ? loadedCount.current : CATALOGUE_LIMITS.pageSize;
    moreRequest.current?.abort();
    moreRequest.current = null;
    setLoading(!preserve);
    setRefreshing(preserve);
    setRefreshError('');
    setMoreError('');
    if (!preserve) {
      loadedCount.current = 0;
      setItems([]);
      setTotal(null);
      setSearchScopeLimit(null);
      setScrollAnchor(null);
    }
    setLoadingMore(false);
    setError('');
    const timer = setTimeout(
      () => {
        Promise.all([
          loadCatalogueWindow(filters, targetCount, controller.signal),
          catalogueApi.collections(controller.signal, spaceId || undefined),
          catalogueApi.me(controller.signal),
          activeSpaceId ? statusesApi.list(activeSpaceId, controller.signal) : Promise.resolve([]),
        ])
          .then(([data, folders, me, states]) => {
            if (controller.signal.aborted || requestGeneration !== generation.current) {
              return;
            }
            setStatuses(states);
            if (states.length) {
              setStatus(value => (states.some(row => row.key === value) ? value : ''));
            }
            setSearchEngine(data.searchEngine || 'text');
            if (preserve) {
              setScrollAnchor(captureCatalogueScroll());
            }
            loadedCount.current = data.items.length;
            loadedKey.current = key;
            setTotal(data.total);
            setSearchScopeLimit(data.searchScopeLimit || null);
            setItems(data.items);
            setCursor(data.nextCursor);
            setCollections(folders);
            setTelegramEnabled(me.telegramMediaEnabled);
            setIsAdmin(me.isAdmin);
          })
          .catch(error => {
            if (!controller.signal.aborted && requestGeneration === generation.current) {
              if (preserve) {
                setRefreshError(errorMessage(error));
              } else {
                setError(errorMessage(error));
              }
            }
          })
          .finally(() => {
            if (!controller.signal.aborted && requestGeneration === generation.current) {
              setLoading(false);
              setRefreshing(false);
            }
          });
      },
      filters.q?.trim() ? UI_TIMING_MS.catalogueDebounce : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, revision, spaceId, activeSpaceId, sourceReady, tagReady]);
  async function more() {
    if (!cursor || loadingMore || loading || refreshing || moreRequest.current) {
      return;
    }
    const current = generation.current;
    const controller = new AbortController();
    moreRequest.current = controller;
    setLoadingMore(true);
    setMoreError('');
    try {
      const data = await catalogueApi.list({ ...filters, cursor }, controller.signal);
      if (!controller.signal.aborted && current === generation.current) {
        setScrollAnchor(captureCatalogueScroll());
        setItems(items => {
          const merged = [
            ...new Map([...items, ...data.items].map(item => [item.id, item])).values(),
          ];
          loadedCount.current = merged.length;
          return merged;
        });
        setTotal(data.total);
        setCursor(data.nextCursor);
      }
    } catch (error) {
      if (!controller.signal.aborted && current === generation.current) {
        setMoreError(errorMessage(error));
      }
    } finally {
      if (moreRequest.current === controller) {
        moreRequest.current = null;
      }
      if (current === generation.current) {
        setLoadingMore(false);
      }
    }
  }
  useEffect(() => () => moreRequest.current?.abort(), []);
  useEffect(() => {
    if (!items.some(i => i.metadataStatus === 'pending' || i.metadataStatus === 'processing')) {
      return;
    }
    const timer = setTimeout(refresh, UI_TIMING_MS.metadataRefresh);
    return () => clearTimeout(timer);
  }, [items, refresh]);
  return {
    total,
    searchScopeLimit,
    refreshing,
    moreError,
    refreshError,
    scrollAnchor,
    isAdmin,
    statuses,
    spaces,
    spaceId,
    changeSpace,
    spaceSwitchNotice,
    dismissSpaceSwitch: () => setSpaceSwitchNotice(''),
    updateSpaceTheme,
    updateSpaceName,
    removeSpaceLocally,
    activeSpace,
    canEdit,
    loadSpaces,
    source,
    setSource,
    sources,
    sourcesLoading,
    sourcesError,
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
    tags,
    tagsLoading,
    tagsError,
    cursor,
    loading,
    loadingMore,
    error,
    telegramEnabled,
    refresh,
    more,
  };
}

export type Catalogue = ReturnType<typeof useCatalogue>;
