import { useState, type FormEvent } from 'react';

import { COPY, type Item, type Space } from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';
import { Select } from '../../components/Select';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Dialog } from '../../components/ui/Dialog';
import { Field } from '../../components/ui/Field';

export function CopyItemDialog({
  item,
  spaces,
  onClose,
  onOpen,
}: {
  item: Item;
  spaces: Space[];
  onClose: () => void;
  onOpen: (item: Item) => void;
}) {
  const destinations = spaces.filter(space => space.id !== item.spaceId && space.role !== 'viewer');
  const [target, setTarget] = useState('');
  const [includeNote, setIncludeNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ item: Item; spaceName: string } | null>(null);
  async function copy(event: FormEvent) {
    event.preventDefault();
    const destination = destinations.find(space => space.id === target);
    if (!destination || busy) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      const copied = await catalogueApi.copy(item.id, target, includeNote);
      setResult({ item: copied, spaceName: destination.name });
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={result ? COPY.actions.done : COPY.copyItem.heading}
      label={COPY.itemActions.copyToSpace}
      busy={busy}
      onClose={onClose}
      closeOnBackdrop
    >
      {result ? (
        <>
          <p role={'status'}>
            {result.item.wasDuplicate
              ? COPY.copyItem.duplicate(result.spaceName)
              : COPY.copyItem.success(result.spaceName)}
          </p>
          {result.item.wasDuplicate && (
            <p className={'copy-dialog-description'}>{COPY.copyItem.duplicateDescription}</p>
          )}
          <div className={'dialog-actions copy-dialog-actions'}>
            <Button type={'button'} onClick={onClose}>
              {COPY.actions.close}
            </Button>
            <Button type={'button'} variant={'primary'} onClick={() => onOpen(result.item)}>
              {result.item.wasDuplicate ? COPY.actions.openItem : COPY.copyItem.openCopy}
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={copy}>
          <p className={'copy-dialog-description'}>{COPY.copyItem.description(item.title)}</p>
          {destinations.length ? (
            <>
              <Field label={COPY.copyItem.destination}>
                <Select
                  aria-label={COPY.copyItem.destination}
                  value={target}
                  disabled={busy}
                  onChange={event => setTarget(event.target.value)}
                >
                  <option value={''}>{COPY.copyItem.selectSpace}</option>
                  {destinations.map(space => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <label className={'inline-option'}>
                <Checkbox
                  checked={includeNote}
                  disabled={busy}
                  onChange={event => setIncludeNote(event.target.checked)}
                />
                {COPY.copyItem.includeNote}
              </label>
              <p className={'copy-dialog-description'}>{COPY.copyItem.defaults}</p>
            </>
          ) : (
            <p className={'copy-dialog-description'}>{COPY.copyItem.noDestinations}</p>
          )}
          {error && (
            <p className={'error'} role={'alert'}>
              {error}
            </p>
          )}
          <div className={'dialog-actions copy-dialog-actions'}>
            <Button type={'button'} disabled={busy} onClick={onClose}>
              {COPY.actions.cancel}
            </Button>
            <Button
              type={'submit'}
              variant={'primary'}
              disabled={busy || !destinations.some(space => space.id === target)}
            >
              {busy ? COPY.copyItem.creating : COPY.copyItem.create}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
