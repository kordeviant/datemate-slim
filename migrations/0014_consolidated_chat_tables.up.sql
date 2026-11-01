-- Migration 0014: Consolidated Chat Tables (Migrating Cassandra to PostgreSQL)
DROP TABLE IF EXISTS "message_attachments" CASCADE;
DROP TABLE IF EXISTS "messages" CASCADE;
DROP TABLE IF EXISTS "conversations" CASCADE;

CREATE TABLE IF NOT EXISTS "conversations" (
    "conversation_id" UUID PRIMARY KEY,
    "conversation_type" TEXT NOT NULL,
    "created_by" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT,
    "last_message_at" TIMESTAMPTZ,
    "last_message_id" UUID,
    "last_message_sender_id" BIGINT,
    "last_message_preview" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "conversation_members" (
    "conversation_id" UUID NOT NULL REFERENCES "conversations"("conversation_id") ON DELETE CASCADE,
    "user_id" BIGINT NOT NULL,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    PRIMARY KEY ("conversation_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "messages_by_conversation" (
    "conversation_id" UUID NOT NULL,
    "bucket" VARCHAR(8) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message_id" UUID NOT NULL,
    "sender_id" BIGINT NOT NULL,
    "content" TEXT,
    "client_message_id" TEXT,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "media_url" TEXT,
    "duration" DOUBLE PRECISION,
    "attachment_name" TEXT,
    "attachment_size" BIGINT,
    "mime_type" TEXT,
    PRIMARY KEY ("conversation_id", "bucket", "created_at", "message_id")
);

CREATE TABLE IF NOT EXISTS "conversations_by_user" (
    "user_id" BIGINT NOT NULL,
    "last_message_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversation_id" UUID NOT NULL,
    "conversation_type" TEXT NOT NULL,
    "last_message_preview" TEXT,
    "last_message_sender_id" BIGINT,
    "title" TEXT,
    PRIMARY KEY ("user_id", "last_message_at", "conversation_id")
);

CREATE TABLE IF NOT EXISTS "direct_conversations_by_pair" (
    "canonical_pair_key" TEXT PRIMARY KEY,
    "conversation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "message_idempotency" (
    "conversation_id" UUID NOT NULL,
    "sender_id" BIGINT NOT NULL,
    "client_message_id" TEXT NOT NULL,
    "message_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("conversation_id", "sender_id", "client_message_id")
);

CREATE TABLE IF NOT EXISTS "group_profiles_by_id" (
    "conversation_id" UUID PRIMARY KEY,
    "owner_id" BIGINT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT,
    "bio" TEXT,
    "gender" TEXT,
    "minimum_age" INT,
    "maximum_age" INT,
    "subject_id" BIGINT,
    "city_id" BIGINT,
    "avatar" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "group_relationships_by_user" (
    "conversation_id" UUID NOT NULL,
    "user_id" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'JOINED',
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requested_at" TIMESTAMPTZ,
    "invited_at" TIMESTAMPTZ,
    "joined_at" TIMESTAMPTZ,
    "banned_at" TIMESTAMPTZ,
    "banned_by_user_id" BIGINT,
    "ban_reason" TEXT,
    PRIMARY KEY ("conversation_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "group_relationships_by_group" (
    "conversation_id" UUID NOT NULL,
    "shard" SMALLINT NOT NULL DEFAULT 0,
    "user_id" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'JOINED',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("conversation_id", "shard", "user_id")
);

CREATE TABLE IF NOT EXISTS "group_relationships_by_group_and_status" (
    "conversation_id" UUID NOT NULL,
    "shard" SMALLINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'JOINED',
    "user_id" BIGINT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requested_at" TIMESTAMPTZ,
    "invited_at" TIMESTAMPTZ,
    "joined_at" TIMESTAMPTZ,
    "banned_at" TIMESTAMPTZ,
    "banned_by_user_id" BIGINT,
    "ban_reason" TEXT,
    PRIMARY KEY ("conversation_id", "shard", "status", "user_id")
);

CREATE TABLE IF NOT EXISTS "user_presence" (
    "user_id" BIGINT PRIMARY KEY,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_messages_timeline" ON "messages_by_conversation" ("conversation_id", "bucket", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_user_conv_timeline" ON "conversations_by_user" ("user_id", "last_message_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_conv_members_user" ON "conversation_members" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_group_rel_group_status" ON "group_relationships_by_group_and_status" ("conversation_id", "status");
