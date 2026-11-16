import './bulk-actions.css';

import { COPY, type BookmarkStatus, type Collection, type Item } from '@tuckly/contracts';

import { ActionDialog } from '../../components/ActionDialog';
import { Select } from '../../components/Select';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Field } from '../../components/ui/Field';

import type { BulkActions, BulkKind } from './useBulkActions';

export function BulkActionsBar({
  selection,
  items,
  collections,
  statuses,
}: {
  selection: BulkActions;
  items: Item[];
  collections: Collection[];
  statuses: BookmarkStatus[];
}) {
  return (
    <>
      {selection.selectedIds.length > 0 && (
        <section className={'bulk-tools'} aria-label={COPY.bulk.action}>
          <div className={'bulk-selection'}>
            <label>
              <Checkbox
                disabled={selection.busy || !items.length}
                indeterminate={
                  selection.selectedIds.length > 0 && selection.selectedIds.length < items.length
                }
                checked={items.length > 0 && items.every(i => selection.selectedIds.includes(i.id))}
                onChange={e => selection.selectAll(e.target.checked)}
              />
              {COPY.bulk.selectAll}
            </label>
            {selection.selectedIds.length > 0 && (
              <>
                <strong>{COPY.bulk.selected(selection.selectedIds.length)}</strong>
                <Button
                  type={'button'}
                  className={'bulk-clear'}
                  disabled={selection.busy}
                  onClick={selection.clear}
                >
                  {COPY.bulk.clear}
                </Button>
              </>
            )}
          </div>
          {selection.selectedIds.length > 0 ? (
            <div className={'bulk-action-form'}>
              <Field label={COPY.bulk.action} className={'filter-field'}>
                <Select
                  aria-label={COPY.bulk.action}
                  value={selection.kind}
                  disabled={selection.busy}
                  onChange={e => selection.chooseKind(e.target.value as BulkKind | '')}
                >
                  <option value={''}>{COPY.bulk.chooseAction}</option>
                  <option value={'addCollections'}>{COPY.bulk.addCollections}</option>
                  <option value={'removeCollections'}>{COPY.bulk.removeCollections}</option>
                  <option value={'addTags'}>{COPY.bulk.addTags}</option>
                  <option value={'setStatus'}>{COPY.bulk.setStatus}</option>
                  <option value={'delete'}>{COPY.bulk.delete}</option>
                </Select>
              </Field>
              {(selection.kind === 'addCollections' || selection.kind === 'removeCollections') && (
                <Field
                  label={
                    selection.kind === 'removeCollections'
                      ? COPY.bulk.removeFromCollection
                      : COPY.bulk.collection
                  }
                  className={'filter-field'}
                >
                  <Select
                    aria-label={
                      selection.kind === 'removeCollections'
                        ? COPY.bulk.removeFromCollection
                        : COPY.bulk.collection
                    }
                    value={selection.folder}
                    disabled={selection.busy}
                    onChange={e => selection.setFolder(e.target.value)}
                  >
                    <option value={''}>{COPY.bulk.chooseCollection}</option>
                    {collections
                      .filter(c => !c.rules)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </Select>
                </Field>
              )}
              {selection.kind === 'setStatus' && (
                <Field label={COPY.bulk.status} className={'filter-field'}>
                  <Select
                    aria-label={COPY.bulk.status}
                    value={selection.status}
                    disabled={selection.busy}
                    onChange={e => selection.setStatus(e.target.value)}
                  >
                    <option value={''}>{COPY.bulk.chooseStatus}</option>
                    {statuses.map(row => (
                      <option key={row.key} value={row.key}>
                        {row.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {selection.kind && (
                <Button
                  type={'button'}
                  className={
                    selection.kind === 'delete' ? 'danger bulk-apply' : 'primary bulk-apply'
                  }
                  disabled={
                    selection.busy ||
                    ((selection.kind === 'addCollections' ||
                      selection.kind === 'removeCollections') &&
                      !collections.some(c => c.id === selection.folder && !c.rules)) ||
                    (selection.kind === 'setStatus' &&
                      !statuses.some(row => row.key === selection.status))
                  }
                  onClick={() => void selection.execute()}
                >
                  {selection.busy
                    ? COPY.bulk.applying
                    : selection.kind === 'addTags' || selection.kind === 'delete'
                      ? COPY.bulk.continue
                      : COPY.bulk[selection.kind]}
                </Button>
              )}
              {(selection.kind === 'addCollections' || selection.kind === 'removeCollections') &&
                !collections.some(c => !c.rules) && (
                  <p className={'bulk-hint'}>{COPY.bulk.noCollections}</p>
                )}
              {selection.kind === 'removeCollections' && (
                <p className={'bulk-hint'}>{COPY.bulk.removeHint}</p>
              )}
            </div>
          ) : (
            <p className={'bulk-hint'}>{COPY.bulk.selectionHint}</p>
          )}
          {selection.error && (
            <p className={'error'} role={'alert'}>
              {selection.error}
            </p>
          )}
        </section>
      )}
      {selection.notice && (
        <p className={'bulk-hint'} role={'status'}>
          {selection.notice}
        </p>
      )}
      {selection.confirmation && (
        <ActionDialog
          title={
            selection.confirmation === 'tags' ? COPY.bulk.tagsHeading : COPY.bulk.deleteHeading
          }
          label={selection.confirmation === 'tags' ? 'Теги через запятую' : undefined}
          submit={selection.confirmation === 'tags' ? COPY.actions.save : COPY.actions.delete}
          onClose={selection.dismissConfirmation}
          onSubmit={selection.confirm}
        />
      )}
    </>
  );
}
