import { ConversationMember } from "../entities/conversation-member.entity";

export interface IConversationMemberRepository {
  addMember(member: ConversationMember): Promise<void>;
  addMembers(members: ConversationMember[]): Promise<void>;
  findMembersByConversation(conversationId: string): Promise<ConversationMember[]>;
  isMember(conversationId: string, userId: number): Promise<boolean>;
  findMember(conversationId: string, userId: number): Promise<ConversationMember | null>;
  removeMember(conversationId: string, userId: number): Promise<void>;
}
