import { z } from 'zod';

export const StatusKeySchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const StatusFieldsSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Выберите цвет'),
});
export const CreateStatusSchema = StatusFieldsSchema.strict();
export const UpdateStatusSchema = StatusFieldsSchema.partial()
  .extend({ isDefault: z.boolean().optional() })
  .strict();
export const StatusSchema = StatusFieldsSchema.extend({
  key: StatusKeySchema,
  position: z.number().int(),
  isDefault: z.boolean(),
  itemCount: z.number().int().nonnegative().optional(),
});
export const StatusesSchema = z.array(StatusSchema);
export const ReorderStatusesSchema = z
  .object({ keys: z.array(StatusKeySchema).min(1).max(30) })
  .strict();
export const DeleteStatusSchema = z.object({ replacementKey: StatusKeySchema.optional() }).strict();
export type BookmarkStatus = z.infer<typeof StatusSchema>;
export type CreateStatus = z.infer<typeof CreateStatusSchema>;
export type UpdateStatus = z.infer<typeof UpdateStatusSchema>;

export const DEFAULT_STATUSES = [
  {
    key: 'saved',
    name: 'На потом',
    color: '#879b6e',
    position: 0,
    isDefault: true,
  },
  {
    key: 'done',
    name: 'Просмотрено',
    color: '#587c75',
    position: 1,
    isDefault: false,
  },
] as const;
