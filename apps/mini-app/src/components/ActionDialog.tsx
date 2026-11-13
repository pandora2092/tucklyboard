import { useState, type FormEvent } from 'react';

import { errorMessage } from '../api/client';

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
    <div className={'overlay'}>
      <section className={'dialog'} role={'dialog'} aria-modal={'true'} aria-label={title}>
        <div className={'dialog-top'}>
          <h2>{title}</h2>
          <button disabled={busy} onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={save}>
          {label && (
            <label>
              {label}
              <input
                autoFocus
                required
                maxLength={300}
                value={value}
                onChange={e => setValue(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p className={'error'} role={'alert'}>
              {error}
            </p>
          )}
          <button className={'primary'} disabled={busy || Boolean(label && !value.trim())}>
            {submit}
          </button>
        </form>
      </section>
    </div>
  );
}
