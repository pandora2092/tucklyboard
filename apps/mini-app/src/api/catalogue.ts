import { z } from 'zod';

import {
  CollectionSchema,
  CollectionsSchema,
  CreateCollectionSchema,
  CreateItemSchema,
  InviteInfoSchema,
  InviteSchema,
  ItemDetailsSchema,
  ItemListSchema,
  ItemQuerySchema,
  ItemSchema,
  JoinResultSchema,
  MembersSchema,
  MeSchema,
  NewInviteSchema,
  OkSchema,
  SourcesSchema,
  SpaceSchema,
  SpacesSchema,
  UpdateCollectionSchema,
  UpdateItemSchema,
  UpdateSpaceSchema,
  type BulkAction,
  type CreateItem,
  type ItemDetails,
  type ItemQuery,
  type SmartRules,
  type SpaceBackground,
  type SpaceTheme,
  type UpdateCollection,
  type UpdateItem,
} from '@tuckly/contracts';

import { request } from './client';

export const catalogueApi = {
  spaces() {
    return request('spaces', SpacesSchema);
  },
  createSpace(name: string) {
    return request('spaces', SpaceSchema, { method: 'POST', body: { name } });
  },
  updateSpaceTheme(id: string, theme: SpaceTheme, background: SpaceBackground) {
    return request(`spaces/${encodeURIComponent(id)}`, OkSchema, {
      method: 'PATCH',
      body: UpdateSpaceSchema.parse({ theme, background }),
    });
  },
  renameSpace(id: string, name: string) {
    return request(`spaces/${encodeURIComponent(id)}`, OkSchema, {
      method: 'PATCH',
      body: UpdateSpaceSchema.parse({ name }),
    });
  },
  deleteSpace(id: string) {
    return request(`spaces/${encodeURIComponent(id)}`, OkSchema, { method: 'DELETE' });
  },
  members(id: string) {
    return request(`spaces/${id}/members`, MembersSchema);
  },
  role(id: string, userId: string, role: string) {
    return request(`spaces/${id}/members/${userId}`, OkSchema, { method: 'PATCH', body: { role } });
  },
  kick(id: string, userId: string) {
    return request(`spaces/${id}/members/${userId}`, OkSchema, { method: 'DELETE' });
  },
  invite(id: string, role: string) {
    return request(`spaces/${id}/invites`, NewInviteSchema, {
      method: 'POST',
      body: { role, days: 7 },
    });
  },
  invites(id: string) {
    return request(`spaces/${id}/invites`, z.array(InviteSchema));
  },
  revoke(id: string, inviteId: string) {
    return request(`spaces/${id}/invites/${inviteId}/revoke`, OkSchema, { method: 'POST' });
  },
  deleteInvite(id: string, inviteId: string) {
    return request(`spaces/${id}/invites/${inviteId}`, OkSchema, { method: 'DELETE' });
  },
  inviteInfo(token: string) {
    return request(`invites/${encodeURIComponent(token)}`, InviteInfoSchema);
  },
  join(token: string) {
    return request(`invites/${encodeURIComponent(token)}/join`, JoinResultSchema, {
      method: 'POST',
    });
  },
  sources(spaceId?: string) {
    return request(
      `sources${spaceId ? '?spaceId=' + encodeURIComponent(spaceId) : ''}`,
      SourcesSchema,
    );
  },
  bulk(body: BulkAction) {
    return request('items/bulk', OkSchema, { method: 'POST', body });
  },
  retry(id: string) {
    return request(`items/${id}/enrich`, OkSchema, { method: 'POST' });
  },
  copy(id: string, spaceId: string, includeNote: boolean) {
    return request(`items/${id}/copy`, ItemSchema, {
      method: 'POST',
      body: { spaceId, includeNote },
    });
  },

  list(query: ItemQuery, signal?: AbortSignal) {
    const parsed = ItemQuerySchema.parse(query);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(parsed)) {
      if (value !== undefined) {
        params.set(key, value);
      }
    }
    return request(`items?${params}`, ItemListSchema, { signal });
  },
  collections(signal?: AbortSignal, spaceId?: string) {
    return request(
      `collections${spaceId ? '?spaceId=' + encodeURIComponent(spaceId) : ''}`,
      CollectionsSchema,
      { signal },
    );
  },
  me(signal?: AbortSignal) {
    return request('me', MeSchema, { signal });
  },
  createCollection(name: string, spaceId?: string, rules?: SmartRules) {
    return request('collections', CollectionSchema, {
      method: 'POST',
      body: CreateCollectionSchema.parse({ name, spaceId, rules }),
    });
  },
  updateCollection(id: string, data: UpdateCollection) {
    return request(`collections/${encodeURIComponent(id)}`, OkSchema, {
      method: 'PATCH',
      body: UpdateCollectionSchema.parse(data),
    });
  },
  deleteCollection(id: string) {
    return request(`collections/${encodeURIComponent(id)}`, OkSchema, { method: 'DELETE' });
  },
  create(data: CreateItem) {
    return request('items', ItemSchema, {
      method: 'POST',
      body: CreateItemSchema.parse(data),
    });
  },
  update(id: string, data: UpdateItem) {
    return request(`items/${encodeURIComponent(id)}`, OkSchema, {
      method: 'PATCH',
      body: UpdateItemSchema.parse(data),
    });
  },
  upload(file: File, data: ItemDetails) {
    const form = new FormData();
    form.append('metadata', JSON.stringify(ItemDetailsSchema.parse(data)));
    form.append('file', file);
    return request('items/media', ItemSchema, { method: 'POST', body: form });
  },
  remove(id: string) {
    return request(`items/${encodeURIComponent(id)}`, OkSchema, {
      method: 'DELETE',
    });
  },
  send(id: string) {
    return request(`items/${encodeURIComponent(id)}/send`, OkSchema, {
      method: 'POST',
    });
  },
};
