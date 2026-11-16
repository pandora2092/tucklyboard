import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  COPY,
  type BookmarkStatus,
  type Collection,
  type Item,
  type ItemQuery,
  type Space,
  type SpaceTheme,
} from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';
import { statusesApi } from '../../api/statuses';
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
    const timer = setTimeout(() => setSpaceSwitchNotice(''), 6000);
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
    setLoading(true);
    setLoadingMore(false);
    setError('');
    const timer = setTimeout(() => {
      Promise.all([
        catalogueApi.list(filters, controller.signal),
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
          setItems(data.items);
          setCursor(data.nextCursor);
          setCollections(folders);
          setTelegramEnabled(me.telegramMediaEnabled);
          setIsAdmin(me.isAdmin);
        })
        .catch(error => {
          if (!controller.signal.aborted && requestGeneration === generation.current) {
            setError(errorMessage(error));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted && requestGeneration === generation.current) {
            setLoading(false);
          }
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, revision, spaceId, activeSpaceId]);
  async function more() {
    if (!cursor || loadingMore || loading) {
      return;
    }
    const current = generation.current;
    setLoadingMore(true);
    try {
      const data = await catalogueApi.list({ ...filters, cursor });
      if (current === generation.current) {
        setItems(items => [...items, ...data.items]);
        setCursor(data.nextCursor);
      }
    } catch (error) {
      if (current === generation.current) {
        setError(errorMessage(error));
      }
    } finally {
      if (current === generation.current) {
        setLoadingMore(false);
      }
    }
  }
  useEffect(() => {
    if (!items.some(i => i.metadataStatus === 'pending' || i.metadataStatus === 'processing')) {
      return;
    }
    const timer = setTimeout(refresh, 5000);
    return () => clearTimeout(timer);
  }, [items, refresh]);
  return {
    isAdmin,
    statuses,
    spaces,
    spaceId,
    changeSpace,
    spaceSwitchNotice,
    dismissSpaceSwitch: () => setSpaceSwitchNotice(''),
    updateSpaceTheme,
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
