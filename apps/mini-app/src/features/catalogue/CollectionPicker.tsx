import type { Collection } from '@tuckly/contracts';

import { Checkbox } from '../../components/ui/Checkbox';

export function CollectionPicker({
  collections,
  selected,
  onChange,
  disabled = false,
}: {
  collections: Collection[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className={'collection-picker'} disabled={disabled}>
      <legend>Коллекции</legend>
      {collections
        .filter(c => !c.rules)
        .map(c => (
          <label className={'collection-option'} key={c.id}>
            <Checkbox
              checked={selected.includes(c.id)}
              onChange={event =>
                onChange(
                  event.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id),
                )
              }
            />
            <span className={'collection-option-name'}>{c.name}</span>
          </label>
        ))}
      {!collections.some(c => !c.rules) && <small>Без коллекций — во входящих</small>}
    </fieldset>
  );
}
