import { useId, useState } from 'react';

import { COPY, type Collection } from '@tuckly/contracts';

import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { TextInput } from '../../components/ui/Field';

import './collection-picker.css';

export function CollectionPicker({
  collections,
  selected,
  onChange,
  disabled = false,
  smartCollections = [],
}: {
  collections: Collection[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  smartCollections?: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const panelId = useId();
  const available = collections.filter(collection => !collection.rules);
  const chosen = available.filter(collection => selected.includes(collection.id));
  const count = chosen.length + smartCollections.length;
  const summary =
    [...chosen, ...smartCollections].map(collection => collection.name).join(', ') ||
    COPY.collectionPicker.inbox;
  const search = query.trim().toLocaleLowerCase('ru');
  const visible = available.filter(collection =>
    collection.name.toLocaleLowerCase('ru').includes(search),
  );
  return (
    <div className={'collection-picker'}>
      <Button
        type={'button'}
        className={'collection-picker-summary'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
      >
        <span className={'collection-picker-heading'}>
          <span className={'collection-picker-label'}>
            {COPY.collectionPicker.title}
            {count > 0 && <span className={'collection-picker-count'}>{count}</span>}
          </span>
          <span className={'collection-picker-value'} title={summary}>
            {summary}
          </span>
        </span>
        <span className={'collection-picker-chevron'} aria-hidden={'true'} />
      </Button>
      <div id={panelId} className={'collection-picker-panel'} hidden={!open}>
        {available.length > 0 ? (
          <>
            <TextInput
              type={'search'}
              aria-label={COPY.collectionPicker.search}
              placeholder={COPY.collectionPicker.search}
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
            <fieldset
              className={'collection-picker-options'}
              disabled={disabled}
              aria-label={COPY.collectionPicker.title}
            >
              {visible.map(collection => (
                <label className={'collection-option'} key={collection.id}>
                  <Checkbox
                    checked={selected.includes(collection.id)}
                    onChange={event =>
                      onChange(
                        event.target.checked
                          ? [...new Set([...selected, collection.id])]
                          : selected.filter(id => id !== collection.id),
                      )
                    }
                  />
                  <span className={'collection-option-name'}>{collection.name}</span>
                </label>
              ))}
              {!visible.length && (
                <p className={'collection-picker-hint'} role={'status'}>
                  {COPY.collectionPicker.noResults}
                </p>
              )}
            </fieldset>
          </>
        ) : (
          <p className={'collection-picker-hint'}>{COPY.collectionPicker.empty}</p>
        )}
        {smartCollections.length > 0 && (
          <p className={'collection-picker-hint'}>
            {COPY.collectionPicker.smartLabel}{' '}
            {smartCollections.map(collection => collection.name).join(', ')}.{' '}
            {COPY.collectionPicker.smartHint}
          </p>
        )}
      </div>
    </div>
  );
}
