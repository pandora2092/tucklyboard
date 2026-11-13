import { useCallback, useEffect, useState } from 'react';

import type { Member, Space } from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';

export function SpacePanel({
  space,
  onClose,
  onChanged,
}: {
  space: Space;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]),
    [invites, setInvites] = useState<Awaited<ReturnType<typeof catalogueApi.invites>>>([]),
    [error, setError] = useState(''),
    [link, setLink] = useState(''),
    [role, setRole] = useState('viewer'),
    [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    setMembers(await catalogueApi.members(space.id));
    if (space.role === 'owner' && !space.personal) {
      setInvites(await catalogueApi.invites(space.id));
    }
  }, [space.id, space.role, space.personal]);
  useEffect(() => {
    void reload().catch(e => setError(errorMessage(e)));
  }, [reload]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await reload();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={'overlay'}>
      <section
        className={'dialog'}
        role={'dialog'}
        aria-modal={'true'}
        aria-label={'Участники пространства'}
      >
        <div className={'dialog-top'}>
          <h2>{space.name}</h2>
          <button onClick={onClose}>×</button>
        </div>
        <p>
          Роль:{' '}
          {space.role === 'owner' ? 'владелец' : space.role === 'editor' ? 'редактор' : 'читатель'}.
          Личные сохранения остаются в вашем пространстве.
        </p>
        {members.map(member => (
          <div className={'member-row'} key={member.userId}>
            <span>{member.name}</span>
            {space.role === 'owner' && member.role !== 'owner' ? (
              <>
                <select
                  disabled={busy}
                  value={member.role}
                  onChange={e =>
                    void run(() => catalogueApi.role(space.id, member.userId, e.target.value))
                  }
                >
                  <option value={'viewer'}>Читатель</option>
                  <option value={'editor'}>Редактор</option>
                </select>
                <button
                  disabled={busy}
                  onClick={() => void run(() => catalogueApi.kick(space.id, member.userId))}
                >
                  Убрать
                </button>
              </>
            ) : (
              <span>
                {member.role === 'owner'
                  ? 'Владелец'
                  : member.role === 'editor'
                    ? 'Редактор'
                    : 'Читатель'}
              </span>
            )}
          </div>
        ))}
        {space.role === 'owner' && !space.personal && (
          <>
            <h3>Приглашение на 7 дней</h3>
            <select value={role} onChange={e => setRole(e.target.value)}>
              <option value={'viewer'}>Чтение</option>
              <option value={'editor'}>Редактирование</option>
            </select>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const invite = await catalogueApi.invite(space.id, role);
                  const url = new URL(window.location.href);
                  url.search = '';
                  url.searchParams.set('invite', invite.token);
                  setLink(invite.telegramUrl || url.toString());
                })
              }
            >
              Создать ссылку
            </button>
            {link && (
              <label>
                Ссылка для приглашения
                <input readOnly value={link} onFocus={e => e.target.select()} />
                <small>Любой с этой ссылкой сможет вступить. До 20 использований.</small>
              </label>
            )}
            {invites.map(invite => (
              <div className={'member-row'} key={invite.id}>
                <span>
                  {invite.role === 'viewer' ? 'Читатель' : 'Редактор'} · до{' '}
                  {new Date(invite.expiresAt).toLocaleDateString('ru')} · {invite.uses} вступлений
                </span>
                <button
                  disabled={busy || invite.revoked}
                  onClick={() => void run(() => catalogueApi.revoke(space.id, invite.id))}
                >
                  {invite.revoked ? 'Отозвано' : 'Отозвать'}
                </button>
              </div>
            ))}
          </>
        )}
        {error && (
          <p role={'alert'} className={'error'}>
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

export function InvitePanel({ onJoined }: { onJoined: (id: string) => void }) {
  const [token, setToken] = useState(
      () =>
        new URLSearchParams(location.search).get('invite') ||
        new URLSearchParams(window.Telegram?.WebApp?.initData || '')
          .get('start_param')
          ?.replace(/^join_/, '') ||
        '',
    ),
    [info, setInfo] = useState<{ spaceName: string; role: string } | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    if (token) {
      void catalogueApi
        .inviteInfo(token)
        .then(setInfo)
        .catch(e => setError(errorMessage(e)));
    }
  }, [token]);
  if (!token) {
    return null;
  }
  return (
    <div className={'invite-banner'}>
      {info ? (
        <>
          <span>
            Приглашение в «{info.spaceName}» ({info.role === 'viewer' ? 'чтение' : 'редактирование'}
            )
          </span>
          <button
            onClick={() => {
              void catalogueApi
                .join(token)
                .then(result => {
                  setToken('');
                  history.replaceState(null, '', location.pathname);
                  onJoined(result.spaceId);
                })
                .catch(e => setError(errorMessage(e)));
            }}
          >
            Вступить
          </button>
        </>
      ) : (
        <span>Проверяем приглашение…</span>
      )}
      <button
        onClick={() => {
          setToken('');
          history.replaceState(null, '', location.pathname);
        }}
      >
        Закрыть
      </button>
      {error && <p role={'alert'}>{error}</p>}
    </div>
  );
}
