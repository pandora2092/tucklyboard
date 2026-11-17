import { z } from 'zod';

import { ITEM_TAG_LIMIT } from './item-tags.js';
import { SpaceThemeSchema } from './space-themes.js';
import { StatusKeySchema, StatusSchema } from './statuses.js';

export * from './statuses.js';
export * from './space-themes.js';

export { effectiveItemTags, editedTagDismissals, ITEM_TAG_LIMIT } from './item-tags.js';
export { CATALOGUE_LIMITS } from './catalogue-limits.js';
export { BRAND_ARTWORK } from './brand-artwork.js';
export { BRAND, COPY } from './brand.js';
export { createWebInviteUrl } from './invites.js';

export const UPLOAD_LIMIT = 20 * 1024 * 1024;
export const MEDIA_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
export const ItemTypeSchema = z.enum(['link', 'text', 'photo', 'video']);
const title = z.string().trim().min(1).max(300);
const id = z.string().min(1);
export const SpaceRoleSchema = z.enum(['owner', 'editor', 'viewer']);
export const SmartRulesSchema = z
  .object({
    type: ItemTypeSchema.optional(),
    source: z.string().max(200).optional(),
    tags: z.array(z.string().min(1).max(40)).max(20).optional(),
    status: StatusKeySchema.optional(),
    addedBy: id.optional(),
    days: z.number().int().min(1).max(365).optional(),
  })
  .strict();
export type SmartRules = z.infer<typeof SmartRulesSchema>;
const text = z.string().max(20000);
const tags = z.array(z.string().trim().min(1).max(40)).max(ITEM_TAG_LIMIT);
const collectionId = z.string().min(1).nullable().optional();
export const ItemDetailsSchema = z
  .object({
    title,
    text: text.default(''),
    tags: tags.default([]),
    collectionId,
    collectionIds: z.array(id).max(30).optional(),
    spaceId: id.optional(),
    status: StatusKeySchema.optional(),
  })
  .strict();
export const CreateItemSchema = ItemDetailsSchema.extend({
  title: z.string().trim().max(300).optional(),
  type: z.enum(['link', 'text']),
  url: z
    .string()
    .url()
    .max(2000)
    .optional()
    .refine(v => !v || /^https?:\/\//i.test(v), 'Нужна HTTP или HTTPS ссылка'),
})
  .strict()
  .superRefine((value, ctx) => {
    if (value.type === 'link' && !value.url) {
      ctx.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'Укажите ссылку',
      });
    }
  });
// PATCH deliberately has no defaults: omitted fields must remain unchanged.
export const UpdateItemSchema = z
  .object({
    title: title.optional(),
    text: text.optional(),
    tags: tags.optional(),
    collectionId,
    collectionIds: z.array(id).max(30).optional(),
    dismissedAutoTags: z.array(z.string().max(40)).max(30).optional(),
    status: StatusKeySchema.optional(),
  })
  .strict();
export const CreateCollectionSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    spaceId: id.optional(),
    rules: SmartRulesSchema.optional(),
  })
  .strict();
export const UpdateCollectionSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    rules: SmartRulesSchema.optional(),
  })
  .strict()
  .refine(
    value => value.name !== undefined || value.rules !== undefined,
    'Укажите изменения коллекции',
  );
export type UpdateCollection = z.infer<typeof UpdateCollectionSchema>;
export const ItemQuerySchema = z
  .object({
    type: ItemTypeSchema.optional(),
    collection: z.string().min(1).optional(),
    tag: z.string().max(40).optional(),
    q: z.string().max(300).optional(),
    cursor: z.string().min(1).optional(),
    spaceId: id.optional(),
    source: z.string().max(200).optional(),
    status: StatusKeySchema.optional(),
    searchMode: z.enum(['text', 'semantic']).optional(),
  })
  .strict();
export const CollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  _count: z.object({ items: z.number().int().nonnegative() }),
  spaceId: z.string().nullable().optional(),
  rules: SmartRulesSchema.nullable().optional(),
});
export const CollectionsSchema = z.array(CollectionSchema);
export const ItemSchema = z.object({
  id: z.string(),
  type: ItemTypeSchema,
  title: z.string(),
  sourceTitle: z.string().nullable().optional(),
  sourceDescription: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  metadataStatus: z.enum(['pending', 'processing', 'ready', 'unavailable']).optional(),
  autoTags: z.array(z.string()).default([]),
  dismissedAutoTags: z.array(z.string()).default([]),
  status: StatusKeySchema.default('saved'),
  statusInfo: StatusSchema.nullable().optional(),
  spaceId: z.string().nullable().optional(),
  collections: z.array(z.object({ id: z.string(), name: z.string() })).default([]),
  addedBy: z.object({ id: z.string(), name: z.string() }).optional(),
  canEdit: z.boolean().default(true),
  wasDuplicate: z.boolean().optional(),
  text: z.string(),
  url: z.string().nullable(),
  source: z.string(),
  tags: z.array(z.string()),
  collectionId: z.string().nullable(),
  collection: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  mime: z.string().nullable(),
  createdAt: z.iso.datetime(),
  storage: z.enum(['telegram', 'legacy-s3']).nullable(),
  fileSize: z.number().int().nonnegative().nullable(),
  previewUrl: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  canSendToChat: z.boolean(),
});
export const ItemListSchema = z.object({
  items: z.array(ItemSchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative(),
  searchScopeLimit: z.number().int().positive().nullable().optional(),
  searchEngine: z.enum(['text', 'topics', 'embeddings']).optional(),
});
export const MeSchema = z.object({
  id: z.string(),
  telegramId: z.string(),
  name: z.string(),
  telegramMediaEnabled: z.boolean(),
  isAdmin: z.boolean().default(false),
});
export const OkSchema = z.object({ ok: z.literal(true) });
export type Item = z.infer<typeof ItemSchema>;
export type Collection = z.infer<typeof CollectionSchema>;
export type ItemDetails = z.infer<typeof ItemDetailsSchema>;
export type CreateItem = z.infer<typeof CreateItemSchema>;
export type UpdateItem = z.infer<typeof UpdateItemSchema>;
export type ItemQuery = z.infer<typeof ItemQuerySchema>;
export type ItemList = z.infer<typeof ItemListSchema>;
export type Me = z.infer<typeof MeSchema>;

export const SpaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  theme: SpaceThemeSchema.default('sage'),
  personal: z.boolean(),
  role: SpaceRoleSchema,
  memberCount: z.number().int(),
});
export const SpacesSchema = z.array(SpaceSchema);
export const CreateSpaceSchema = z.object({ name: z.string().trim().min(1).max(80) }).strict();
export const MemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  role: SpaceRoleSchema,
});
export const MembersSchema = z.array(MemberSchema);
export const InviteSchema = z.object({
  id: z.string(),
  role: z.enum(['editor', 'viewer']),
  expiresAt: z.iso.datetime(),
  revoked: z.boolean(),
  uses: z.number().int(),
});
export const CreateInviteSchema = z
  .object({
    role: z.enum(['editor', 'viewer']).default('viewer'),
    days: z.number().int().min(1).max(30).default(7),
  })
  .strict();
export const NewInviteSchema = InviteSchema.extend({
  token: z.string(),
  telegramUrl: z.string().nullable(),
});
export const InviteInfoSchema = z.object({
  spaceName: z.string(),
  role: z.enum(['editor', 'viewer']),
});
export const JoinResultSchema = z.object({ spaceId: z.string() });
export const SourcesSchema = z.array(z.object({ source: z.string(), count: z.number().int() }));
export const BulkSchema = z
  .object({
    spaceId: id.optional(),
    ids: z.array(id).min(1).max(100),
    action: z.enum([
      'addCollections',
      'removeCollections',
      'addTags',
      'markDone',
      'markSaved',
      'setStatus',
      'delete',
    ]),
    collectionIds: z.array(id).max(30).optional(),
    status: StatusKeySchema.optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  })
  .strict();
export const CopyItemSchema = z
  .object({
    spaceId: id,
    collectionIds: z.array(id).max(30).optional(),
    includeNote: z.boolean().default(false),
  })
  .strict();
export type Space = z.infer<typeof SpaceSchema>;
export type SpaceRole = z.infer<typeof SpaceRoleSchema>;
export type BulkAction = z.infer<typeof BulkSchema>;
export type Member = z.infer<typeof MemberSchema>;

export const AdminQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    activeDays: z.coerce
      .number()
      .pipe(z.union([z.literal(1), z.literal(7), z.literal(30)]))
      .optional(),
  })
  .strict();
export type AdminQuery = z.infer<typeof AdminQuerySchema>;
export const AdminOverviewSchema = z.object({
  users: z.number().int(),
  newUsers7d: z.number().int(),
  activeToday: z.number().int(),
  active7d: z.number().int(),
  active30d: z.number().int(),
  items: z.number().int(),
  collections: z.number().int(),
  spaces: z.number().int(),
  trackingSince: z.iso.datetime().nullable(),
  generatedAt: z.iso.datetime(),
});
export const AdminUserSchema = z.object({
  id: z.string(),
  telegramId: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  createdAt: z.iso.datetime().nullable(),
  lastSeenAt: z.iso.datetime().nullable(),
  _count: z.object({
    items: z.number().int(),
    collections: z.number().int(),
    ownedSpaces: z.number().int(),
  }),
});
export const AdminUsersSchema = z.object({
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  users: z.array(AdminUserSchema),
});
export const AdminUserDetailSchema = z.object({
  user: AdminUserSchema,
  activity: z.array(
    z.object({
      day: z.iso.datetime(),
      apiRequests: z.number().int(),
      botMessages: z.number().int(),
    }),
  ),
  itemTypes: z.array(z.object({ type: z.string(), count: z.number().int() })),
});
export type AdminOverview = z.infer<typeof AdminOverviewSchema>;
export type AdminUsers = z.infer<typeof AdminUsersSchema>;
export type AdminUserDetail = z.infer<typeof AdminUserDetailSchema>;
