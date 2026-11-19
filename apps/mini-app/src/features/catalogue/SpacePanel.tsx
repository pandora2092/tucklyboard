import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import {
  COPY,
  createWebInviteUrl,
  parseInviteStartParameter,
  type Member,
  type Space,
} from '@tuckly/contracts';

import { catalogueApi } from '../../api/catalogue';
import { errorMessage } from '../../api/client';
import { Select } from '../../components/Select';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { TextInput } from '../../components/ui/Field';

import './space-panel.css';

export function SpacePanel({
  space,
  onClose,
  onChanged,
}: {
  space: Space;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Awaited<ReturnType<typeof catalogueApi.invites>>>([]);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [generated, setGenerated] = useState<{ id: string; url: string } | null>(null);
  const [role, setRole] = useState('viewer'),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const linkInput = useRef<HTMLInputElement>(null);
  const owner = space.role === 'owner';
  const canInvite = owner && !space.personal;
  const reload = useCallback(async () => {
    const [people, links] = await Promise.all([
      catalogueApi.members(space.id),
      canInvite ? catalogueApi.invites(space.id) : Promise.resolve([]),
    ]);
    setMembers(people);
    setInvites(links);
  }, [space.id, canInvite]);
  useEffect(() => {
    void reload()
      .catch(e => setError(errorMessage(e)))
      .finally(() => setLoading(false));
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
  function createInvite(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const invite = await catalogueApi.invite(space.id, role);
      setGenerated({
        id: invite.id,
        url: invite.telegramUrl || createWebInviteUrl(window.location.href, invite.token),
      });
      setNotice('');
    });
  }
  async function copyLink() {
    if (!generated) {
      return;
    }
    try {
      await navigator.clipboard.writeText(generated.url);
      setNotice('Ссылка скопирована');
    } catch {
      linkInput.current?.focus();
      linkInput.current?.select();
      setNotice('Ссылка выделена — скопируйте её вручную');
    }
  }
  const labels = { owner: 'Владелец', editor: 'Редактор', viewer: 'Читатель' };
  return (
    <Dialog
      title={space.name}
      className={'space-panel'}
      busy={busy}
      onClose={onClose}
      closeLabel={'Закрыть участников'}
      eyebrow={<p className={'space-panel-eyebrow'}>УЧАСТНИКИ И ДОСТУП</p>}
    >
      <span className={'space-role-badge'}>Ваша роль: {labels[space.role].toLowerCase()}</span>
      {error && (
        <p className={'error'} role={'alert'}>
          {error}
        </p>
      )}
      <section className={'space-panel-section'} aria-labelledby={'members-title'}>
        <h3 id={'members-title'}>
          Участники{!loading && <span className={'space-section-count'}>{members.length}</span>}
        </h3>
        {loading ? (
          <p className={'share-hint'} role={'status'}>
            Загружаем участников…
          </p>
        ) : (
          <ul className={'space-members'}>
            {members.map(member => (
              <li className={'space-member'} key={member.userId}>
                <span className={'member-initial'} aria-hidden={'true'}>
                  {member.name.trim().charAt(0).toUpperCase() || '?'}
                </span>
                <strong className={'member-name'}>{member.name}</strong>
                {owner && member.role !== 'owner' ? (
                  <div className={'member-controls'}>
                    <Select
                      aria-label={`Роль участника ${member.name}`}
                      disabled={busy}
                      value={member.role}
                      onChange={e =>
                        void run(() => catalogueApi.role(space.id, member.userId, e.target.value))
                      }
                    >
                      <option value={'viewer'}>Читатель</option>
                      <option value={'editor'}>Редактор</option>
                    </Select>
                    <Button
                      className={'share-danger'}
                      disabled={busy}
                      aria-label={`Удалить участника ${member.name}`}
                      onClick={() => void run(() => catalogueApi.kick(space.id, member.userId))}
                    >
                      Убрать
                    </Button>
                  </div>
                ) : (
                  <span className={'member-role'}>{labels[member.role]}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {space.personal && (
          <p className={'share-hint'}>
            Это ваше личное пространство. Для приглашений создайте отдельное через «＋
            Пространство».
          </p>
        )}
      </section>
      {canInvite && (
        <>
          <section className={'space-panel-section'} aria-labelledby={'create-invite-title'}>
            <h3 id={'create-invite-title'}>Пригласить в пространство</h3>
            <form onSubmit={createInvite}>
              <div className={'share-controls'}>
                <div className={'invite-permissions'}>
                  <span id={'invite-permissions-label'}>Права по ссылке</span>
                  <div
                    className={'invite-role-switch'}
                    role={'group'}
                    aria-labelledby={'invite-permissions-label'}
                  >
                    {(
                      [
                        ['viewer', 'Чтение'],
                        ['editor', 'Редактирование'],
                      ] as const
                    ).map(([value, label]) => (
                      <Button
                        key={value}
                        type={'button'}
                        aria-pressed={role === value}
                        disabled={busy}
                        onClick={() => setRole(value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                <Button type={'submit'} className={'primary share-create'} disabled={busy}>
                  {busy ? 'Подождите…' : 'Создать ссылку'}
                </Button>
              </div>
              <p className={'share-hint'}>
                {role === 'viewer'
                  ? 'Можно просматривать закладки.'
                  : 'Можно добавлять, изменять и удалять закладки.'}{' '}
                Ссылка действует 7 дней, до 20 вступлений.
              </p>
            </form>
            {generated && (
              <div className={'generated-invite'}>
                <label htmlFor={'space-invite-link'}>Ссылка готова — отправьте её участнику</label>
                <div className={'share-link-row'}>
                  <TextInput
                    id={'space-invite-link'}
                    ref={linkInput}
                    aria-label={'Ссылка приглашения'}
                    readOnly
                    value={generated.url}
                    onFocus={e => e.target.select()}
                  />
                  <Button className={'share-secondary'} onClick={() => void copyLink()}>
                    {COPY.actions.copy}
                  </Button>
                </div>
                <p className={'share-hint'} role={'status'}>
                  {notice || 'Вступить сможет любой, у кого есть эта ссылка.'}
                </p>
              </div>
            )}
          </section>
          <section className={'space-panel-section'} aria-labelledby={'invites-title'}>
            <h3 id={'invites-title'}>Приглашения</h3>
            {invites.length > 0 && (
              <p className={'share-hint'}>
                Удаление ссылки сразу запрещает новые вступления по ней.
              </p>
            )}
            {!invites.length ? (
              <p className={'share-hint'}>Созданные ссылки появятся здесь.</p>
            ) : (
              <ul className={'space-invites'}>
                {invites.map((invite, index) => {
                  const title = `Приглашение №${index + 1}`;
                  const expired = new Date(invite.expiresAt).getTime() <= Date.now();
                  const active = !invite.revoked && !expired && invite.uses < 20;
                  const state = invite.revoked
                    ? 'Отозвана'
                    : expired
                      ? 'Истекла'
                      : invite.uses >= 20
                        ? 'Лимит исчерпан'
                        : 'Активна';
                  return (
                    <li className={'space-invite-card'} key={invite.id}>
                      <div className={'invite-details'}>
                        <strong>{title}</strong>
                        <small>{invite.role === 'viewer' ? 'Чтение' : 'Редактирование'}</small>
                        <small>
                          До{' '}
                          {new Date(invite.expiresAt).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'short',
                          })}{' '}
                          · Вступлений: {invite.uses} из 20
                        </small>
                      </div>
                      <div className={'invite-actions'}>
                        <span className={active ? 'invite-state active' : 'invite-state'}>
                          {state}
                        </span>
                        <div className={'invite-buttons'}>
                          {active && (
                            <Button
                              className={'share-danger'}
                              disabled={busy}
                              aria-label={`Отозвать ${title.toLowerCase()}`}
                              onClick={() =>
                                void run(async () => {
                                  await catalogueApi.revoke(space.id, invite.id);
                                  if (generated?.id === invite.id) {
                                    setGenerated(null);
                                    setNotice('');
                                  }
                                })
                              }
                            >
                              Отозвать
                            </Button>
                          )}
                          <Button
                            className={'share-danger'}
                            disabled={busy}
                            aria-label={`Удалить ${title.toLowerCase()}`}
                            title={'Удалить ссылку и запретить новые вступления по ней'}
                            onClick={() =>
                              void run(async () => {
                                await catalogueApi.deleteInvite(space.id, invite.id);
                                if (generated?.id === invite.id) {
                                  setGenerated(null);
                                  setNotice('');
                                }
                              })
                            }
                          >
                            {COPY.actions.delete}
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </Dialog>
  );
}

export function InvitePanel({ onJoined }: { onJoined: (id: string) => void }) {
  const [token, setToken] = useState(() => {
    const start = new URLSearchParams(window.Telegram?.WebApp?.initData || '').get('start_param');
    return new URLSearchParams(location.search).get('invite') || parseInviteStartParameter(start);
  });
  const [info, setInfo] = useState<Awaited<ReturnType<typeof catalogueApi.inviteInfo>> | null>(
    null,
  );
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const onJoinedRef = useRef(onJoined);
  useEffect(() => {
    onJoinedRef.current = onJoined;
  }, [onJoined]);
  const dismiss = useCallback(() => {
    setToken('');
    const url = new URL(location.href);
    url.searchParams.delete('invite');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  }, []);
  useEffect(() => {
    if (!token) {
      return;
    }
    let active = true;
    void catalogueApi
      .inviteInfo(token)
      .then(result => {
        if (!active) {
          return;
        }
        if (result.alreadyMember) {
          dismiss();
          onJoinedRef.current(result.spaceId);
        } else {
          setInfo(result);
        }
      })
      .catch(e => {
        if (active) {
          setError(errorMessage(e));
        }
      });
    return () => {
      active = false;
    };
  }, [token, dismiss]);
  if (!token) {
    return null;
  }
  return (
    <section className={'invite-banner'} aria-label={'Приглашение в пространство'}>
      <div className={'invite-banner-heading'}>
        <p className={'invite-banner-label'}>Приглашение в пространство</p>
        {info && <h2 className={'invite-banner-name'}>{info.spaceName}</h2>}
      </div>
      {info ? (
        <div className={'invite-banner-actions'}>
          <Button
            variant={'primary'}
            disabled={joining}
            onClick={() => {
              setJoining(true);
              setError('');
              void catalogueApi
                .join(token)
                .then(result => {
                  dismiss();
                  onJoinedRef.current(result.spaceId);
                })
                .catch(e => setError(errorMessage(e)))
                .finally(() => setJoining(false));
            }}
          >
            {joining ? 'Вступаем…' : 'Вступить'}
          </Button>
          <Button variant={'secondary'} onClick={dismiss}>
            {COPY.actions.close}
          </Button>
        </div>
      ) : !error ? (
        <p className={'invite-banner-status'} role={'status'}>
          Проверяем приглашение…
        </p>
      ) : null}
      {error && (
        <p className={'invite-banner-error'} role={'alert'}>
          {error}
        </p>
      )}
      {!info && (
        <Button variant={'secondary'} onClick={dismiss}>
          {COPY.actions.close}
        </Button>
      )}
    </section>
  );
}
