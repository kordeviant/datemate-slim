import { DirectPair } from "../entities/direct-pair.entity";

export interface IDirectPairRepository {
  /**
   * Performs an LWT INSERT IF NOT EXISTS.
   * Returns applied = true if row inserted, false if already exists, and existing conversationId.
   */
  createIfNotExists(
    canonicalPairKey: string,
    conversationId: string,
    createdAt: Date,
  ): Promise<{ applied: boolean; conversationId: string }>;

  findByPairKey(canonicalPairKey: string): Promise<DirectPair | null>;
}
