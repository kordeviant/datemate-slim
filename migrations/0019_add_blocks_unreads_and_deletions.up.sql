-- Migration 0019: Add Blocked Users, Conversation Unreads, and Message Deletions

-- 1. Blocked Users
CREATE TABLE IF NOT EXISTS "blocked_users" (
    "blocker_id" BIGINT NOT NULL,
    "blocked_id" BIGINT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("blocker_id", "blocked_id")
);
CREATE INDEX IF NOT EXISTS "idx_blocked_users_blocked" ON "blocked_users" ("blocked_id");

-- 2. Server-side Conversation Unread State
CREATE TABLE IF NOT EXISTS "conversation_reads" (
    "conversation_id" UUID NOT NULL REFERENCES "conversations"("conversation_id") ON DELETE CASCADE,
    "user_id" BIGINT NOT NULL,
    "last_read_message_id" UUID,
    "last_read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unread_count" INT NOT NULL DEFAULT 0,
    PRIMARY KEY ("conversation_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "idx_conversation_reads_user" ON "conversation_reads" ("user_id");

-- 3. Message Deletion
ALTER TABLE "messages_by_conversation" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;
ALTER TABLE "messages_by_conversation" ADD COLUMN IF NOT EXISTS "deleted_by" BIGINT;

CREATE TABLE IF NOT EXISTS "message_deletions_for_user" (
    "conversation_id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "user_id" BIGINT NOT NULL,
    "deleted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("message_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "idx_msg_del_user_conv" ON "message_deletions_for_user" ("conversation_id", "user_id");
