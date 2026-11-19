DROP TABLE IF EXISTS "message_deletions_for_user";
ALTER TABLE "messages_by_conversation" DROP COLUMN IF EXISTS "deleted_by";
ALTER TABLE "messages_by_conversation" DROP COLUMN IF EXISTS "deleted_at";
DROP TABLE IF EXISTS "conversation_reads";
DROP TABLE IF EXISTS "blocked_users";
