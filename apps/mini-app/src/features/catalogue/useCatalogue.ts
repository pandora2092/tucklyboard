import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  CATALOGUE_LIMITS,
  COPY,
  type BookmarkStatus,
  type Collection,
  type Item,
  type ItemQuery,
  type Space,
  type SpaceTheme,
} from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { loadCatalogueWindow } from '../../api/catalogue-window';
import { errorMessage } from '../../api/client';
import { statusesApi } from '../../api/statuses';
import { UI_TIMING_MS } from '../../constants/timing';
import { captureCatalogueScroll, type CatalogueScrollAnchor } from '../../lib/catalogue-scroll';
import { useSpaceTheme } from '../../lib/space-theme';

export function useCatalogue() {
  const [items, setItems] = useState<Item[]>([]),
    [collections, setCollections] = useState<Collection[]>([]),
    [collection, setCollection] = useState(''),
    [type, setType] = useState<ItemQuery['type'] | ''>(''),
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
    [searchEngine, setSearchEngine] = useState('text'),
    [sources, setSources] = useState<{ source: string; count: number }[]>([]);
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
    setSpaces(await catalogueApi.spaces());
  }, []);
  useEffect(() => {
    void loadSpaces().catch(e => setError(errorMessage(e)));
  }, [loadSpaces]);
  const activeSpace = spaces.find(s => s.id === spaceId) || spaces.find(s => s.personal);
  useSpaceTheme(activeSpace?.theme || 'sage');
  const activeSpaceId = activeSpace?.id;
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
    setSources([]);
    setCursor(null);
    setLoading(true);
    setLoadingMore(false);
    setError('');
    setQuery('');
    setType('');
    setSpaceId(id);
    setCollection('');
    setSource('');
    setTag('');
    setStatus('');
  }
  function updateSpaceTheme(id: string, theme: SpaceTheme) {
    setSpaces(rows => rows.map(space => (space.id === id ? { ...space, theme } : space)));
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
  useEffect(() => {
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
    const timer = setTimeout(() => {
      Promise.all([
        loadCatalogueWindow(filters, targetCount, controller.signal),
        catalogueApi.collections(controller.signal, spaceId || undefined),
        catalogueApi.me(controller.signal),
        catalogueApi.sources(spaceId || undefined),
        activeSpaceId ? statusesApi.list(activeSpaceId, controller.signal) : Promise.resolve([]),
      ])
        .then(([data, folders, me, origins, states]) => {
          if (controller.signal.aborted || requestGeneration !== generation.current) {
            return;
          }
          setStatuses(states);
          if (states.length) {
            setStatus(value => (states.some(row => row.key === value) ? value : ''));
          }
          setSearchEngine(data.searchEngine || 'text');
          setSources(origins);
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
    }, UI_TIMING_MS.catalogueDebounce);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, revision, spaceId, activeSpaceId]);
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
  };
}

export type Catalogue = ReturnType<typeof useCatalogue>;
