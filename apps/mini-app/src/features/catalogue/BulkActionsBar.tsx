import './bulk-actions.css';

import { useEffect, useState, type FormEvent } from 'react';

import {
  COPY,
  type BookmarkStatus,
  type Collection,
  type Item,
  type Space,
} from '@tuckly/contracts';

import { Select } from '../../components/Select';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Dialog } from '../../components/ui/Dialog';
import { Field, TextInput } from '../../components/ui/Field';

import type { BulkActions, BulkKind } from './useBulkActions';

const actions: BulkKind[] = [
  'addCollections',
  'removeCollections',
  'addTags',
  'setStatus',
  'copyToSpace',
  'moveToSpace',
  'delete',
];

export function BulkActionsBar({
  selection,
  items,
  collections,
  statuses,
  spaces,
  spaceId,
}: {
  selection: BulkActions;
  items: Item[];
  collections: Collection[];
  statuses: BookmarkStatus[];
  spaces: Space[];
  spaceId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState('');
  const count = selection.selectedIds.length;
  const isOpen = open && count > 0;
  const manualCollections = collections.filter(collection => !collection.rules);
  const transferAction = selection.kind === 'copyToSpace' || selection.kind === 'moveToSpace';
  const destinations = spaces.filter(space => space.id !== spaceId && space.role !== 'viewer');
  const collectionAction =
    selection.kind === 'addCollections' || selection.kind === 'removeCollections';
  useEffect(() => {
    if (!count) {
      setOpen(false);
      setTags('');
    }
  }, [count]);
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);
  function close() {
    setOpen(false);
    selection.chooseKind('');
    setTags('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await selection.execute(tags)) {
      setOpen(false);
      setTags('');
    }
  }
  return (
    <>
      {count > 0 && (
        <section className={'bulk-tools'} aria-label={COPY.bulk.action}>
          <strong role={'status'} aria-live={'polite'}>
            Выбрано: {count}
          </strong>
          <Button
            variant={'primary'}
            className={'bulk-open'}
            disabled={selection.busy}
            aria-haspopup={'dialog'}
            aria-expanded={isOpen}
            onClick={() => setOpen(true)}
          >
            Действия
          </Button>
          <Button
            className={'bulk-clear'}
            disabled={selection.busy}
            aria-label={COPY.bulk.clear}
            title={COPY.bulk.clear}
            onClick={selection.clear}
          >
            ×
          </Button>
        </section>
      )}
      {selection.notice && (
        <div className={'bulk-notice'} role={'status'}>
          <span>{selection.notice}</span>
          <Button aria-label={'Скрыть уведомление'} onClick={selection.clear}>
            ×
          </Button>
        </div>
      )}
      {isOpen && (
        <Dialog
          className={'bulk-sheet'}
          title={selection.kind ? COPY.bulk[selection.kind] : 'Действия с карточками'}
          subtitle={COPY.bulk.selected(count)}
          busy={selection.busy}
          scrollBody
          closeOnBackdrop
          onClose={close}
          onEscape={selection.kind ? () => selection.chooseKind('') : close}
          eyebrow={
            selection.kind ? (
              <Button
                className={'bulk-back'}
                disabled={selection.busy}
                onClick={() => selection.chooseKind('')}
              >
                ← К действиям
              </Button>
            ) : undefined
          }
        >
          {!selection.kind ? (
            <>
              <label className={'bulk-select-all'}>
                <Checkbox
                  indeterminate={count > 0 && count < items.length}
                  checked={
                    items.length > 0 && items.every(item => selection.selectedIds.includes(item.id))
                  }
                  onChange={event => selection.selectAll(event.target.checked)}
                />
                <span>
                  {COPY.bulk.selectAll} ({items.length})
                </span>
              </label>
              <div className={'bulk-action-list'}>
                {actions.map(action => (
                  <Button
                    key={action}
                    className={
                      action === 'delete' ? 'bulk-action bulk-action-delete' : 'bulk-action'
                    }
                    onClick={() => selection.chooseKind(action)}
                  >
                    <span>{COPY.bulk[action]}</span>
                    <span aria-hidden={'true'}>›</span>
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <form className={'bulk-action-form'} onSubmit={submit}>
              {transferAction && (
                <>
                  <Field
                    label={
                      selection.kind === 'moveToSpace'
                        ? COPY.moveItem.destination
                        : COPY.copyItem.destination
                    }
                  >
                    <Select
                      value={selection.destinationSpaceId}
                      disabled={selection.busy}
                      onChange={event => selection.setDestinationSpaceId(event.target.value)}
                    >
                      <option value={''}>{COPY.copyItem.selectSpace}</option>
                      {destinations.map(space => (
                        <option key={space.id} value={space.id}>
                          {space.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {selection.kind === 'copyToSpace' && (
                    <label className={'inline-option'}>
                      <Checkbox
                        checked={selection.includeNote}
                        disabled={selection.busy}
                        onChange={event => selection.setIncludeNote(event.target.checked)}
                      />
                      {COPY.copyItem.includeNote}
                    </label>
                  )}
                  <p className={'bulk-hint'}>
                    {selection.kind === 'moveToSpace'
                      ? COPY.moveItem.bulkHint
                      : COPY.copyItem.defaults}
                  </p>
                  {!destinations.length && (
                    <p className={'bulk-hint'}>{COPY.copyItem.noDestinations}</p>
                  )}
                </>
              )}
              {collectionAction && (
                <Field
                  label={
                    selection.kind === 'removeCollections'
                      ? COPY.bulk.removeFromCollection
                      : COPY.bulk.collection
                  }
                >
                  <Select
                    value={selection.folder}
                    disabled={selection.busy}
                    onChange={event => selection.setFolder(event.target.value)}
                  >
                    <option value={''}>{COPY.bulk.chooseCollection}</option>
                    {manualCollections.map(collection => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {selection.kind === 'setStatus' && (
                <Field label={COPY.bulk.status}>
                  <Select
                    value={selection.status}
                    disabled={selection.busy}
                    onChange={event => selection.setStatus(event.target.value)}
                  >
                    <option value={''}>{COPY.bulk.chooseStatus}</option>
                    {statuses.map(status => (
                      <option key={status.key} value={status.key}>
                        {status.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {selection.kind === 'addTags' && (
                <Field label={'Теги через запятую'}>
                  <TextInput
                    required
                    maxLength={300}
                    disabled={selection.busy}
                    value={tags}
                    onChange={event => setTags(event.target.value)}
                    placeholder={'Идеи, прочитать'}
                  />
                </Field>
              )}
              {selection.kind === 'delete' && (
                <p className={'bulk-delete-warning'}>
                  Удалить выбранные карточки ({count})? Они исчезнут из всех коллекций этого
                  пространства. Отменить удаление нельзя.
                </p>
              )}
              {collectionAction && !manualCollections.length && (
                <p className={'bulk-hint'}>{COPY.bulk.noCollections}</p>
              )}
              {selection.kind === 'removeCollections' && (
                <p className={'bulk-hint'}>{COPY.bulk.removeHint}</p>
              )}
              {selection.error && (
                <p className={'error'} role={'alert'}>
                  {selection.error}
                </p>
              )}
              <Button
                type={'submit'}
                variant={selection.kind === 'delete' ? 'danger' : 'primary'}
                className={'bulk-apply'}
                disabled={
                  selection.busy ||
                  (transferAction &&
                    !destinations.some(space => space.id === selection.destinationSpaceId)) ||
                  (collectionAction &&
                    !manualCollections.some(collection => collection.id === selection.folder)) ||
                  (selection.kind === 'setStatus' &&
                    !statuses.some(status => status.key === selection.status)) ||
                  (selection.kind === 'addTags' && !tags.split(',').some(tag => tag.trim()))
                }
              >
                {selection.busy
                  ? COPY.bulk.applying
                  : selection.kind === 'delete'
                    ? `Удалить карточки (${count})`
                    : 'Применить'}
              </Button>
            </form>
          )}
        </Dialog>
      )}
    </>
  );
}
