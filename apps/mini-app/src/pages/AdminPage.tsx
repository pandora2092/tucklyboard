import { useEffect, useRef, useState } from 'react';

import {
  BRAND,
  COPY,
  type AdminOverview,
  type AdminUserDetail,
  type AdminUsers,
} from '@tuckly/contracts';

import { adminApi } from '../api/admin';
import { ApiError, errorMessage } from '../api/client';
import { BrandLogo } from '../components/BrandLogo';
import { Select } from '../components/Select';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';

import '../admin.css';

function date(value: string | null, time = false) {
  return value
    ? new Date(value).toLocaleString('ru-RU', {
        timeZone: 'UTC',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : 'Нет данных';
}

function UserDetail({
  id,
  onClose,
  onUnauthorized,
}: {
  id: string;
  onClose: () => void;
  onUnauthorized: (error: unknown) => void;
}) {
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void adminApi
      .user(id, controller.signal)
      .then(setData)
      .catch(e => {
        if (!controller.signal.aborted) {
          setError(errorMessage(e));
          if (e instanceof ApiError && [401, 403].includes(e.status)) {
            onUnauthorized(e);
          }
        }
      });
    return () => controller.abort();
  }, [id, onUnauthorized]);
  return (
    <Dialog
      title={data?.user.name || 'Пользователь'}
      className={'admin-detail'}
      scrollBody
      onClose={onClose}
    >
      {error ? (
        <p className={'error'} role={'alert'}>
          {error}
        </p>
      ) : !data ? (
        <p role={'status'}>Загружаем статистику…</p>
      ) : (
        <>
          <p>
            {data.user.username ? `@${data.user.username} · ` : ''}ID {data.user.telegramId}
          </p>
          <dl className={'admin-facts'}>
            <div>
              <dt>Регистрация</dt>
              <dd>{date(data.user.createdAt, true)}</dd>
            </div>
            <div>
              <dt>Последняя активность</dt>
              <dd>{date(data.user.lastSeenAt, true)}</dd>
            </div>
            <div>
              <dt>Карточки сейчас</dt>
              <dd>{data.user._count.items}</dd>
            </div>
            <div>
              <dt>Коллекции сейчас</dt>
              <dd>{data.user._count.collections}</dd>
            </div>
          </dl>
          <h3>Сохранённые материалы</h3>
          <div className={'admin-types'}>
            {data.itemTypes.map(row => (
              <span className={'counter'} key={row.type}>
                {(
                  { link: 'Ссылки', photo: 'Фото', video: 'Видео', text: 'Заметки' } as Record<
                    string,
                    string
                  >
                )[row.type] || row.type}
                : {row.count}
              </span>
            ))}
            {!data.itemTypes.length && <p>Пока нет карточек.</p>}
          </div>
          <h3>Активность за последние 30 дней</h3>
          <p className={'admin-note'}>
            Запросы приложения и входящие сообщения боту. Это не число сессий. Время — UTC.
          </p>
          {!data.activity.length ? (
            <p>За этот период активности не зафиксировано.</p>
          ) : (
            <table className={'admin-table'}>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Запросы</th>
                  <th>Сообщения</th>
                </tr>
              </thead>
              <tbody>
                {data.activity.map(row => (
                  <tr key={row.day}>
                    <td>{date(row.day)}</td>
                    <td>{row.apiRequests}</td>
                    <td>{row.botMessages}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </Dialog>
  );
}

export function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUsers | null>(null);
  const [query, setQuery] = useState(''),
    [search, setSearch] = useState('');
  const [activeDays, setActiveDays] = useState(''),
    [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(''),
    [denied, setDenied] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // Stable callback so details do not refetch when the parent renders.
  const unauthorized = useRef((e: unknown) => {
    setOverview(null);
    setUsers(null);
    setSelected(null);
    setError(errorMessage(e));
    setDenied(e instanceof ApiError ? e.status : null);
  }).current;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setDenied(null);
    setUsers(null);
    void Promise.all([
      adminApi.overview(controller.signal),
      adminApi.users(search, page, activeDays, controller.signal),
    ])
      .then(([stats, list]) => {
        if (!controller.signal.aborted) {
          setOverview(stats);
          setUsers(list);
        }
      })
      .catch(e => {
        if (!controller.signal.aborted) {
          unauthorized(e);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [search, activeDays, page, revision, unauthorized]);
  const metrics = overview
    ? ([
        ['Всего пользователей', overview.users],
        ['Новые за 7 дней', overview.newUsers7d],
        ['Активны сегодня', overview.activeToday],
        ['Активны за 7 дней', overview.active7d],
        ['Активны за 30 дней', overview.active30d],
        ['Карточки', overview.items],
        ['Коллекции', overview.collections],
        ['Общие пространства', overview.spaces],
      ] as const)
    : [];
  return (
    <div className={'admin-shell'}>
      <main className={'admin-main'}>
        <header className={'admin-header'}>
          <a className={'admin-brand'} href={'/'} aria-label={`${BRAND.name} — ${COPY.backToApp}`}>
            <BrandLogo />
          </a>
          <span className={'counter'}>Администратор</span>
          <a className={'ui-button secondary admin-back'} href={'/'}>
            ← {COPY.backToApp}
          </a>
        </header>
        <section className={'heading'}>
          <div>
            <p className={'eyebrow'}>{COPY.adminHeading}</p>
            <h1>Пользователи и активность</h1>
            <p>Регистрации, использование приложения и сохранённые материалы.</p>
          </div>
          {overview && (
            <Button
              variant={'secondary'}
              disabled={loading}
              onClick={() => setRevision(v => v + 1)}
            >
              Обновить
            </Button>
          )}
        </section>
        {loading && (
          <p role={'status'}>{overview ? 'Обновляем данные…' : 'Проверяем вход через Telegram…'}</p>
        )}
        {error && (
          <section className={'admin-access'}>
            <h2>
              {denied === 401
                ? 'Вход через Telegram'
                : denied === 403
                  ? 'Нет доступа к админке'
                  : 'Не удалось загрузить данные'}
            </h2>
            <p role={'alert'}>{error}</p>
            {denied === 401 ? (
              <p>
                {COPY.openBot} <b>/admin</b> и нажмите «Открыть админку». Если вход истёк, откройте
                админку этой кнопкой заново.
              </p>
            ) : denied === 403 ? (
              <p>Ваш Telegram ID отсутствует в списке администраторов.</p>
            ) : null}
            <Button variant={'primary'} onClick={() => setRevision(v => v + 1)}>
              Проверить вход ещё раз
            </Button>
          </section>
        )}
        {overview && (
          <>
            <section className={'admin-metrics'} aria-label={'Общая статистика'}>
              {metrics.map(([label, value]) => (
                <article key={label}>
                  <p>{label}</p>
                  <strong>{value.toLocaleString('ru-RU')}</strong>
                </article>
              ))}
            </section>
            <p className={'admin-note'}>
              Активность — хотя бы один авторизованный запрос приложения или сообщение боту.
              Просмотр админки не учитывается. Дни считаются по UTC.
              {overview.trackingSince
                ? ` Первые данные активности: ${date(overview.trackingSince)}.`
                : ' Сбор активности только начинается.'}{' '}
              У старых пользователей дата регистрации может быть неизвестна. Количество материалов
              отражает текущее состояние.
            </p>
            <section className={'admin-users'}>
              <h2>Пользователи</h2>
              <form
                className={'admin-filters'}
                onSubmit={e => {
                  e.preventDefault();
                  setPage(1);
                  setSearch(query.trim());
                }}
              >
                <label className={'search'}>
                  <span>⌕</span>
                  <input
                    aria-label={'Имя, username или Telegram ID'}
                    maxLength={100}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={'Имя, @username или Telegram ID'}
                  />
                </label>
                <Button variant={'primary'} type={'submit'}>
                  Найти
                </Button>
                <Select
                  aria-label={'Период активности'}
                  value={activeDays}
                  onChange={e => {
                    setPage(1);
                    setActiveDays(e.target.value);
                  }}
                >
                  <option value={''}>Все пользователи</option>
                  <option value={'1'}>Активны сегодня</option>
                  <option value={'7'}>Активны за 7 дней</option>
                  <option value={'30'}>Активны за 30 дней</option>
                </Select>
              </form>
              {users && (
                <>
                  <p className={'admin-note'}>
                    Найдено: {users.total}. Обновлено: {date(overview.generatedAt, true)} UTC
                  </p>
                  {users.users.length ? (
                    <div className={'admin-table-scroll'}>
                      <table className={'admin-table'}>
                        <thead>
                          <tr>
                            <th>Пользователь</th>
                            <th>Регистрация</th>
                            <th>Последняя активность, UTC</th>
                            <th>Карточки</th>
                            <th>Коллекции</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.users.map(user => (
                            <tr key={user.id}>
                              <td>
                                <Button
                                  className={'admin-user-link'}
                                  onClick={() => setSelected(user.id)}
                                >
                                  {user.name || 'Без имени'}
                                </Button>
                                <small>
                                  {user.username ? `@${user.username} · ` : ''}
                                  {user.telegramId}
                                </small>
                              </td>
                              <td>{date(user.createdAt)}</td>
                              <td>{date(user.lastSeenAt, true)}</td>
                              <td>{user._count.items}</td>
                              <td>{user._count.collections}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className={'empty'}>Пользователи не найдены.</p>
                  )}
                  <nav className={'admin-pagination'} aria-label={'Страницы пользователей'}>
                    <Button
                      variant={'secondary'}
                      disabled={page === 1 || loading}
                      onClick={() => setPage(p => p - 1)}
                    >
                      Назад
                    </Button>
                    <span>
                      Страница {page} из {Math.max(1, Math.ceil(users.total / users.pageSize))}
                    </span>
                    <Button
                      variant={'secondary'}
                      disabled={page * users.pageSize >= users.total || loading}
                      onClick={() => setPage(p => p + 1)}
                    >
                      Далее
                    </Button>
                  </nav>
                </>
              )}
            </section>
          </>
        )}
      </main>
      {selected && (
        <UserDetail
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
          onUnauthorized={unauthorized}
        />
      )}
    </div>
  );
}
