-- Migration 0020: Add reply_to_message_id to messages_by_conversation
ALTER TABLE "messages_by_conversation" ADD COLUMN IF NOT EXISTS "reply_to_message_id" UUID;
CREATE INDEX IF NOT EXISTS "idx_messages_reply_to" ON "messages_by_conversation" ("conversation_id", "reply_to_message_id");
