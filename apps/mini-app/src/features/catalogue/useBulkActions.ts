import { useState } from 'react';

import { COPY, type BulkAction, type Item } from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';

export type BulkKind = Exclude<BulkAction['action'], 'markDone' | 'markSaved'>;

export function useBulkActions({
  items,
  spaceId,
  onChanged,
}: {
  items: Item[];
  spaceId?: string;
  onChanged: () => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [kind, setKind] = useState<BulkKind | ''>('');
  const [folder, setFolder] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState<'tags' | 'delete' | null>(null);
  const selectedIds = checked.filter(id => items.some(item => item.id === id));
  function clear() {
    setChecked([]);
    setKind('');
    setFolder('');
    setStatus('');
    setNotice('');
    setError('');
    setConfirmation(null);
  }
  async function apply(action: BulkKind, value?: string) {
    if (!selectedIds.length || busy) {
      return;
    }
    if (action === 'delete' && value !== 'confirmed') {
      setConfirmation('delete');
      return;
    }
    if (action === 'addTags' && !value) {
      setConfirmation('tags');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await catalogueApi.bulk({
        spaceId: spaceId || undefined,
        ids: selectedIds,
        action,
        ...(action === 'setStatus' ? { status: value } : {}),
        collectionIds:
          (action === 'addCollections' || action === 'removeCollections') && folder ? [folder] : [],
        tags:
          action === 'addTags'
            ? value
                ?.split(',')
                .map(tag => tag.trim())
                .filter(Boolean)
            : undefined,
      });
      clear();
      setNotice(COPY.bulk.success(selectedIds.length));
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  return {
    selectedIds,
    kind,
    folder,
    status,
    busy,
    error,
    notice,
    confirmation,
    clear,
    setFolder,
    setStatus,
    selectAll(checked: boolean) {
      setChecked(checked ? items.map(item => item.id) : []);
      setNotice('');
      setError('');
    },
    toggle(id: string, checked: boolean) {
      setChecked(ids => (checked ? [...new Set([...ids, id])] : ids.filter(value => value !== id)));
      setNotice('');
      setError('');
    },
    chooseKind(value: BulkKind | '') {
      setKind(value);
      setFolder('');
      setStatus('');
      setNotice('');
      setError('');
    },
    async execute() {
      if (!kind) {
        return;
      }
      try {
        await apply(kind, kind === 'setStatus' ? status : undefined);
      } catch (error) {
        setError(errorMessage(error));
      }
    },
    dismissConfirmation: () => setConfirmation(null),
    confirm: (value: string) =>
      apply(
        confirmation === 'tags' ? 'addTags' : 'delete',
        confirmation === 'tags' ? value : 'confirmed',
      ),
  };
}

export type BulkActions = ReturnType<typeof useBulkActions>;
