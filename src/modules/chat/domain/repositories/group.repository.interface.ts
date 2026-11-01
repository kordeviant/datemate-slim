import { GroupProfile } from "../entities/group-profile.entity";
import { GroupRelationship } from "../entities/group-relationship.entity";

export interface IGroupRepository {
  createProfile(profile: GroupProfile): Promise<void>;
  findProfile(conversationId: string): Promise<GroupProfile | null>;
  updateProfile(profile: GroupProfile): Promise<void>;
  findRelationship(conversationId: string, userId: number): Promise<GroupRelationship | null>;
  createRelationshipIfAbsent(relationship: GroupRelationship): Promise<{ applied: boolean; existing?: GroupRelationship | null }>;
  upsertRelationship(relationship: GroupRelationship): Promise<void>;
  /** Atomic state transition on the exact relationship row; protects lifecycle races. */
  transitionRelationship(relationship: GroupRelationship, expectedStatus: string): Promise<boolean>;
  listRelationships(
    conversationId: string,
    status: string,
    limit: number,
    cursor?: string | null,
  ): Promise<{ items: GroupRelationship[]; nextCursor: string | null }>;
}
