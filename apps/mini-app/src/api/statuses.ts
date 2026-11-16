import {
  OkSchema,
  StatusesSchema,
  StatusSchema,
  type CreateStatus,
  type UpdateStatus,
} from '@tuckly/contracts';

import { request } from './client';

const path = (spaceId: string) => `spaces/${encodeURIComponent(spaceId)}/statuses`;
export const statusesApi = {
  list(spaceId: string, signal?: AbortSignal) {
    return request(path(spaceId), StatusesSchema, { signal });
  },
  create(spaceId: string, body: CreateStatus) {
    return request(path(spaceId), StatusSchema, { method: 'POST', body });
  },
  update(spaceId: string, key: string, body: UpdateStatus) {
    return request(`${path(spaceId)}/${encodeURIComponent(key)}`, StatusSchema, {
      method: 'PATCH',
      body,
    });
  },
  reorder(spaceId: string, keys: string[]) {
    return request(`${path(spaceId)}/order`, OkSchema, { method: 'PATCH', body: { keys } });
  },
  remove(spaceId: string, key: string, replacementKey?: string) {
    return request(`${path(spaceId)}/${encodeURIComponent(key)}`, OkSchema, {
      method: 'DELETE',
      body: { replacementKey },
    });
  },
};
