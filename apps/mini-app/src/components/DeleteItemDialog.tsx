import { useState } from 'react';

import { COPY, type Item } from '@tuckly/contracts';

import { catalogueApi } from '../api/catalogue';
import { errorMessage } from '../api/client';

import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';

export function DeleteItemDialog({
  item,
  onClose,
  onDeleted,
}: {
  item: Item;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await catalogueApi.remove(item.id);
      onDeleted();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={COPY.itemActions.deleteHeading} busy={busy} onClose={onClose}>
      <p className={'copy-dialog-description'}>«{item.title}»</p>
      <p className={'copy-dialog-description'}>{COPY.itemActions.deleteDescription}</p>
      {error && (
        <p className={'error'} role={'alert'}>
          {error}
        </p>
      )}
      <div className={'delete-dialog-actions'}>
        <Button disabled={busy} onClick={onClose}>
          {COPY.actions.cancel}
        </Button>
        <Button className={'delete-confirm'} disabled={busy} onClick={() => void remove()}>
          {busy ? COPY.itemActions.deleting : COPY.actions.delete}
        </Button>
      </div>
    </Dialog>
  );
}
