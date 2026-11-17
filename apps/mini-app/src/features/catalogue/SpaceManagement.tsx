import { useState, type FormEvent } from 'react';

import type { Space } from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Field, TextInput } from '../../components/ui/Field';

type ManagementProps = { space: Space; busy: boolean; onBusyChange: (busy: boolean) => void };

export function SpaceNameSettings({
  space,
  busy,
  onBusyChange,
  onRenamed,
}: ManagementProps & { onRenamed: (name: string) => void }) {
  const [name, setName] = useState(space.name);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const owner = space.role === 'owner';
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!owner || busy || !name.trim()) {
      return;
    }
    onBusyChange(true);
    setError('');
    setNotice('');
    try {
      await catalogueApi.renameSpace(space.id, name.trim());
      onRenamed(name.trim());
      setNotice('Название пространства сохранено');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      onBusyChange(false);
    }
  }
  return (
    <form className={'settings-space-form'} onSubmit={save}>
      <h3 className={'settings-heading'}>Пространство</h3>
      <Field label={'Название пространства'}>
        <TextInput
          required
          maxLength={80}
          value={name}
          disabled={!owner || busy}
          onChange={event => {
            setName(event.target.value);
            setNotice('');
          }}
        />
      </Field>
      {owner ? (
        <Button
          type={'submit'}
          variant={'secondary'}
          disabled={busy || !name.trim() || name.trim() === space.name}
        >
          Сохранить название
        </Button>
      ) : (
        <p className={'settings-description'}>
          Менять название может только владелец пространства.
        </p>
      )}
      {error && (
        <p className={'error'} role={'alert'}>
          {error}
        </p>
      )}
      {notice && (
        <p className={'success'} role={'status'}>
          {notice}
        </p>
      )}
    </form>
  );
}

export function SpaceDeleteSettings({
  space,
  busy,
  onBusyChange,
  onDeleted,
}: ManagementProps & { onDeleted: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  if (space.role !== 'owner') {
    return null;
  }
  async function remove() {
    if (space.personal || busy || confirmation !== space.name) {
      return;
    }
    onBusyChange(true);
    setError('');
    try {
      await catalogueApi.deleteSpace(space.id);
      await onDeleted();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      onBusyChange(false);
    }
  }
  return (
    <section className={'settings-space-delete'} aria-label={'Удаление пространства'}>
      {space.personal ? (
        <p className={'settings-description'}>
          Личное пространство нельзя удалить: в него попадают находки из бота. Название можно
          изменить.
        </p>
      ) : confirming ? (
        <div className={'settings-delete-panel'}>
          <h4>Удалить пространство «{space.name}»?</h4>
          <p>
            Пространство, все его коллекции и закладки будут удалены для всех участников. Исходные
            сообщения и файлы в Telegram останутся. Это действие нельзя отменить.
          </p>
          <Field label={'Введите название пространства для подтверждения'}>
            <TextInput
              autoFocus
              value={confirmation}
              disabled={busy}
              onChange={event => setConfirmation(event.target.value)}
            />
          </Field>
          <div className={'settings-management-actions'}>
            <Button
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setConfirmation('');
                setError('');
              }}
            >
              Отмена
            </Button>
            <Button
              className={'settings-delete-confirm'}
              disabled={busy || confirmation !== space.name}
              onClick={() => void remove()}
            >
              {busy ? 'Удаляем…' : 'Удалить пространство навсегда'}
            </Button>
          </div>
        </div>
      ) : (
        <Button className={'settings-danger'} disabled={busy} onClick={() => setConfirming(true)}>
          Удалить пространство
        </Button>
      )}
      {error && (
        <p className={'error'} role={'alert'}>
          {error}
        </p>
      )}
    </section>
  );
}
