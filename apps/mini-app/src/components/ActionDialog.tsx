import { useState, type FormEvent } from 'react';

import { errorMessage } from '../api/client';

import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Field, TextInput } from './ui/Field';

export function ActionDialog({
  title,
  label,
  submit,
  onClose,
  onSubmit,
}: {
  title: string;
  label?: string;
  submit: string;
  onClose: () => void;
  onSubmit: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit(value);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={title} busy={busy} onClose={onClose}>
      <form onSubmit={save}>
        {label && (
          <Field label={label}>
            <TextInput
              autoFocus
              required
              maxLength={300}
              value={value}
              onChange={e => setValue(e.target.value)}
            />
          </Field>
        )}
        {error && (
          <p className={'error'} role={'alert'}>
            {error}
          </p>
        )}
        <Button
          type={'submit'}
          variant={'primary'}
          disabled={busy || Boolean(label && !value.trim())}
        >
          {submit}
        </Button>
      </form>
    </Dialog>
  );
}
