import type { Item, Prisma } from '@prisma/client';

import type { SmartRules } from '@tuckly/contracts';

export type SmartCollectionDefinition = { id: string; name: string; rules: SmartRules };

export function tagWhere(tag: string): Prisma.ItemWhereInput {
  return {
    OR: [
      { tags: { has: tag } },
      { autoTags: { has: tag }, NOT: { dismissedAutoTags: { has: tag } } },
    ],
  };
}
export function smartWhere(rules: SmartRules): Prisma.ItemWhereInput {
  const AND: Prisma.ItemWhereInput[] = [];
  if (rules.type) {
    AND.push({ type: rules.type });
  }
  if (rules.source) {
    AND.push({ source: rules.source });
  }
  if (rules.status) {
    AND.push({ status: rules.status });
  }
  if (rules.addedBy) {
    AND.push({ userId: rules.addedBy });
  }
  if (rules.days) {
    AND.push({ createdAt: { gte: new Date(Date.now() - rules.days * 86400000) } });
  }
  for (const tag of rules.tags || []) {
    AND.push(tagWhere(tag));
  }
  return { AND };
}
// Keep the card labels aligned with the SQL collection filter, including raw
// manual/automatic tags and the user's dismissed automatic tags.
export function matchesSmartRules(item: Item, rules: SmartRules, now = Date.now()): boolean {
  return (
    (!rules.type || item.type === rules.type) &&
    (!rules.source || item.source === rules.source) &&
    (!rules.status || item.status === rules.status) &&
    (!rules.addedBy || item.userId === rules.addedBy) &&
    (!rules.days || item.createdAt.getTime() >= now - rules.days * 86400000) &&
    (rules.tags || []).every(
      tag =>
        item.tags.includes(tag) ||
        (item.autoTags.includes(tag) && !item.dismissedAutoTags.includes(tag)),
    )
  );
}
