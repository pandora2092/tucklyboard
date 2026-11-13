import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Collection, Item, ItemQuery, Space } from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';

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
    [status, setStatus] = useState<'' | 'saved' | 'done'>(''),
    [searchMode, setSearchMode] = useState<'text' | 'semantic'>('text'),
    [searchEngine, setSearchEngine] = useState('text'),
    [sources, setSources] = useState<{ source: string; count: number }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const loadSpaces = useCallback(async () => {
    setSpaces(await catalogueApi.spaces());
  }, []);
  useEffect(() => {
    void loadSpaces().catch(e => setError(errorMessage(e)));
  }, [loadSpaces]);
  const activeSpace = spaces.find(s => s.id === spaceId) || spaces.find(s => s.personal);
  const canEdit = activeSpace?.role !== 'viewer';
  function changeSpace(id: string) {
    setSpaceId(id);
    setCollection('');
    setSource('');
    setTag('');
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
    ++generation.current;
    setLoading(true);
    setLoadingMore(false);
    setError('');
    const timer = setTimeout(() => {
      Promise.all([
        catalogueApi.list(filters, controller.signal),
        catalogueApi.collections(controller.signal, spaceId || undefined),
        catalogueApi.me(controller.signal),
        catalogueApi.sources(spaceId || undefined),
      ])
        .then(([data, folders, me, origins]) => {
          if (controller.signal.aborted) {
            return;
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
          if (!controller.signal.aborted) {
            setError(errorMessage(error));
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, revision, spaceId]);
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
  };
}
