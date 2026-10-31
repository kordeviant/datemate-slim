import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Client } from "cassandra-driver";

@Injectable()
export class CassandraMigrationService {
  private readonly logger = new Logger(CassandraMigrationService.name);

  constructor(private readonly configService: ConfigService) {}

  public async runMigrations(): Promise<void> {
    const contactPoints = this.configService.get<string[]>(
      "cassandra.contactPoints",
    ) || ["127.0.0.1"];
    const localDataCenter =
      this.configService.get<string>("cassandra.localDataCenter") ||
      "datacenter1";
    const keyspace =
      this.configService.get<string>("cassandra.keyspace") || "datemate_chat";
    const username = this.configService.get<string>("cassandra.username");
    const password = this.configService.get<string>("cassandra.password");

    const rootClientOptions: any = {
      contactPoints,
      localDataCenter,
    };
    if (username && password) {
      rootClientOptions.credentials = { username, password };
    }

    const client = new Client(rootClientOptions);

    try {
      await client.connect();
      this.logger.log("Cassandra migration client connected.");

      // 1. Create keyspace
      await client.execute(`
        CREATE KEYSPACE IF NOT EXISTS ${keyspace}
        WITH replication = {
          'class': 'SimpleStrategy',
          'replication_factor': 1
        };
      `);
      this.logger.log(`Keyspace ${keyspace} verified.`);

      // Switch to keyspace
      await client.execute(`USE ${keyspace};`);

      // 2. conversations table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS conversations (
          conversation_id uuid PRIMARY KEY,
          conversation_type text,
          created_by bigint,
          created_at timestamp,
          title text,
          last_message_at timeuuid,
          last_message_id uuid,
          last_message_sender_id bigint,
          last_message_preview text,
          updated_at timestamp
        );
      `);

      // 3. conversation_members table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS conversation_members (
          conversation_id uuid,
          user_id bigint,
          joined_at timestamp,
          role text,
          PRIMARY KEY ((conversation_id), user_id)
        );
      `);

      // 4. messages_by_conversation table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS messages_by_conversation (
          conversation_id uuid,
          bucket text,
          created_at timeuuid,
          message_id uuid,
          sender_id bigint,
          content text,
          client_message_id text,
          message_type text,
          media_url text,
          duration double,
          attachment_name text,
          attachment_size bigint,
          mime_type text,
          PRIMARY KEY ((conversation_id, bucket), created_at, message_id)
        ) WITH CLUSTERING ORDER BY (
          created_at DESC,
          message_id ASC
        );
      `);

      for (const [column, type] of [
        ["message_type", "text"],
        ["media_url", "text"],
        ["duration", "double"],
        ["attachment_name", "text"],
        ["attachment_size", "bigint"],
        ["mime_type", "text"],
      ]) {
        try {
          await client.execute(
            `ALTER TABLE messages_by_conversation ADD ${column} ${type};`,
          );
        } catch (error: any) {
          if (
            !/already exists|conflicts with an existing column/i.test(
              String(error?.message),
            )
          )
            throw error;
        }
      }

      // 5. conversations_by_user table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS conversations_by_user (
          user_id bigint,
          last_message_at timeuuid,
          conversation_id uuid,
          conversation_type text,
          last_message_preview text,
          last_message_sender_id bigint,
          title text,
          PRIMARY KEY ((user_id), last_message_at, conversation_id)
        ) WITH CLUSTERING ORDER BY (
          last_message_at DESC,
          conversation_id ASC
        );
      `);

      // 6. direct_conversations_by_pair table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS direct_conversations_by_pair (
          canonical_pair_key text PRIMARY KEY,
          conversation_id uuid,
          created_at timestamp
        );
      `);

      // 7. message_idempotency table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS message_idempotency (
          conversation_id uuid,
          sender_id bigint,
          client_message_id text,
          message_id uuid,
          created_at timeuuid,
          PRIMARY KEY ((conversation_id, sender_id), client_message_id)
        );
      `);

      // Group metadata and relationships are separate from conversations: a
      // conversation stays small while membership state can grow independently.
      await client.execute(`
        CREATE TABLE IF NOT EXISTS group_profiles_by_id (
          conversation_id uuid PRIMARY KEY,
          owner_id bigint, active boolean, is_private boolean, title text, bio text,
          gender text, minimum_age int, maximum_age int, subject_id bigint, city_id bigint,
          avatar text, created_at timestamp, updated_at timestamp
        );
      `);
      await client.execute(`
        CREATE TABLE IF NOT EXISTS group_relationships_by_user (
          conversation_id uuid, user_id bigint, status text, role text, created_at timestamp, updated_at timestamp,
          requested_at timestamp, invited_at timestamp, joined_at timestamp, banned_at timestamp,
          banned_by_user_id bigint, ban_reason text,
          PRIMARY KEY ((conversation_id, user_id))
        );
      `);
      await client.execute(`
        CREATE TABLE IF NOT EXISTS group_relationships_by_group (
          conversation_id uuid, shard tinyint, user_id bigint, status text, created_at timestamp, updated_at timestamp,
          PRIMARY KEY ((conversation_id, shard), user_id)
        );
      `);
      await client.execute(`
        CREATE TABLE IF NOT EXISTS group_relationships_by_group_and_status (
          conversation_id uuid, shard tinyint, status text, user_id bigint, role text,
          created_at timestamp, updated_at timestamp, requested_at timestamp, invited_at timestamp,
          joined_at timestamp, banned_at timestamp, banned_by_user_id bigint, ban_reason text,
          PRIMARY KEY ((conversation_id, shard, status), user_id)
        );
      `);

      // The table may have been created by the first group release. Cassandra
      // has no portable ADD IF NOT EXISTS, so duplicate-column errors are the
      // expected idempotent path here.
      for (const [column, type] of [
        ["role", "text"],
        ["requested_at", "timestamp"],
        ["invited_at", "timestamp"],
        ["joined_at", "timestamp"],
        ["banned_at", "timestamp"],
        ["banned_by_user_id", "bigint"],
        ["ban_reason", "text"],
      ]) {
        try {
          await client.execute(
            `ALTER TABLE group_relationships_by_user ADD ${column} ${type};`,
          );
        } catch (error: any) {
          if (
            !/already exists|conflicts with an existing column/i.test(
              String(error?.message),
            )
          )
            throw error;
        }
      }

      // 8. user_presence table
      await client.execute(`
        CREATE TABLE IF NOT EXISTS user_presence (
          user_id bigint PRIMARY KEY,
          is_online boolean,
          last_seen_at timestamp
        );
      `);

      this.logger.log("All Cassandra schema tables verified and ready.");
    } finally {
      await client.shutdown();
    }
  }
}
