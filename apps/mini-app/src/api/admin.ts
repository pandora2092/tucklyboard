import { AdminOverviewSchema, AdminUserDetailSchema, AdminUsersSchema } from '@tuckly/contracts';

import { request } from './client';

export const adminApi = {
  overview(signal: AbortSignal) {
    return request('admin/overview', AdminOverviewSchema, { signal });
  },
  users(q: string, page: number, activeDays: string, signal: AbortSignal) {
    const params = new URLSearchParams({ page: String(page) });
    if (q) {
      params.set('q', q);
    }
    if (activeDays) {
      params.set('activeDays', activeDays);
    }
    return request(`admin/users?${params}`, AdminUsersSchema, { signal });
  },
  user(id: string, signal: AbortSignal) {
    return request(`admin/users/${encodeURIComponent(id)}`, AdminUserDetailSchema, { signal });
  },
};
