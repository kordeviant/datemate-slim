-- Migration 0020 Down
DROP INDEX IF EXISTS "idx_messages_reply_to";
ALTER TABLE "messages_by_conversation" DROP COLUMN IF EXISTS "reply_to_message_id";
