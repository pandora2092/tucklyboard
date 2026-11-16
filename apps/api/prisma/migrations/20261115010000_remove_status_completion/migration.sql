BEGIN;

-- Completion is no longer a separate property of a bookmark status.
-- Keep statuses, their names/colors/defaults and all assigned bookmarks.
ALTER TABLE "BookmarkStatus" DROP COLUMN "isCompleted";

-- Remove the retired predicate while preserving the other collection rules.
UPDATE "Collection"
SET "rules" = "rules" - 'completed'
WHERE jsonb_typeof("rules") = 'object' AND "rules" ? 'completed';

COMMIT;
