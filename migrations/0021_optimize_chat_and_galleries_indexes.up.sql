-- Migration 0021: Optimize chat timeline and user galleries indexes
-- Provides B-tree index for fast cursor-based chat message pagination across dates
CREATE INDEX IF NOT EXISTS "idx_messages_conversation_created"
ON "messages_by_conversation" ("conversation_id", "created_at" DESC);

-- Provides B-tree index for batch gallery lookups across candidate user IDs
CREATE INDEX IF NOT EXISTS "idx_user_galleries_user_id"
ON "user_galleries" ("user_id", "id" ASC);
