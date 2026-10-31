import { Injectable } from "@nestjs/common";
import { types as CassandraTypes } from "cassandra-driver";
import { CassandraClientService } from "../cassandra.client";
import { DirectPair } from "../../../domain/entities/direct-pair.entity";
import { IDirectPairRepository } from "../../../domain/repositories/direct-pair.repository.interface";

@Injectable()
export class CassandraDirectPairRepository implements IDirectPairRepository {
  constructor(private readonly cassandra: CassandraClientService) {}

  public async createIfNotExists(
    canonicalPairKey: string,
    conversationId: string,
    createdAt: Date,
  ): Promise<{ applied: boolean; conversationId: string }> {
    const client = this.cassandra.getClient();

    const insertQuery = `
      INSERT INTO direct_conversations_by_pair (canonical_pair_key, conversation_id, created_at)
      VALUES (?, ?, ?)
      IF NOT EXISTS;
    `;

    const params = [
      canonicalPairKey,
      CassandraTypes.Uuid.fromString(conversationId),
      createdAt,
    ];

    const result = await client.execute(insertQuery, params, { prepare: true });

    if (result.wasApplied()) {
      return { applied: true, conversationId };
    }

    // LWT did not apply; fetch the existing conversationId from the row
    if (result.rows && result.rows.length > 0 && result.rows[0].conversation_id) {
      return {
        applied: false,
        conversationId: result.rows[0].conversation_id.toString(),
      };
    }

    // Fallback: explicit select query
    const selectQuery = `SELECT conversation_id FROM direct_conversations_by_pair WHERE canonical_pair_key = ?;`;
    const selectRes = await client.execute(selectQuery, [canonicalPairKey], { prepare: true });
    if (selectRes.rows && selectRes.rows.length > 0) {
      return {
        applied: false,
        conversationId: selectRes.rows[0].conversation_id.toString(),
      };
    }

    return { applied: false, conversationId };
  }

  public async findByPairKey(canonicalPairKey: string): Promise<DirectPair | null> {
    const query = `SELECT * FROM direct_conversations_by_pair WHERE canonical_pair_key = ?;`;
    const result = await this.cassandra.getClient().execute(query, [canonicalPairKey], { prepare: true });

    if (!result.rows || result.rows.length === 0) return null;

    const row = result.rows[0];
    return new DirectPair({
      canonicalPairKey: row.canonical_pair_key,
      conversationId: row.conversation_id.toString(),
      createdAt: row.created_at,
    });
  }
}
