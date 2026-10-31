import { GetConversationDetailsUseCase } from "../application/use-cases/get-conversation-details.use-case";
import { ChatAuthorizationService } from "../application/services/chat-authorization.service";
import {
  MockConversationRepository,
  MockConversationMemberRepository,
} from "./mocks/mock-repositories";
import { Conversation } from "../domain/entities/conversation.entity";
import { ConversationMember } from "../domain/entities/conversation-member.entity";
import { ConversationType } from "../domain/enums/conversation-type.enum";
import { MemberRole } from "../domain/enums/member-role.enum";
import { ConversationNotFoundException } from "../domain/exceptions/conversation-not-found.exception";
import { ConversationForbiddenException } from "../domain/exceptions/conversation-forbidden.exception";
import { UserPresenceService } from "../application/services/user-presence.service";

describe("GetConversationDetailsUseCase", () => {
  let useCase: GetConversationDetailsUseCase;
  let convRepo: MockConversationRepository;
  let memberRepo: MockConversationMemberRepository;
  let authService: ChatAuthorizationService;
  let presenceService: UserPresenceService;

  beforeEach(() => {
    convRepo = new MockConversationRepository();
    memberRepo = new MockConversationMemberRepository();
    authService = new ChatAuthorizationService(convRepo, memberRepo);

    presenceService = {
      getUserActivityBatch: jest.fn().mockImplementation(async (userIds: number[]) => {
        const map = new Map();
        for (const id of userIds) {
          map.set(id, { userId: id, isOnline: false, lastSeenAt: null });
        }
        return map;
      }),
      getUserActivity: jest.fn().mockResolvedValue({ userId: 1, isOnline: false, lastSeenAt: null }),
    } as unknown as UserPresenceService;

    useCase = new GetConversationDetailsUseCase(convRepo, memberRepo, authService, presenceService);
  });

  it("should return details for authorized member", async () => {
    const convId = "550e8400-e29b-41d4-a716-446655440000";
    await convRepo.create(
      new Conversation({
        conversationId: convId,
        conversationType: ConversationType.DIRECT,
        createdBy: 1,
        createdAt: new Date(),
      }),
    );
    await memberRepo.addMembers([
      new ConversationMember({ conversationId: convId, userId: 1, joinedAt: new Date(), role: MemberRole.OWNER }),
      new ConversationMember({ conversationId: convId, userId: 2, joinedAt: new Date(), role: MemberRole.MEMBER }),
    ]);

    const res = await useCase.execute(convId, 1);
    expect(res.conversationId).toBe(convId);
    expect(res.memberIds).toEqual([1, 2]);
  });

  it("should throw 403 Forbidden if user is not a member", async () => {
    const convId = "550e8400-e29b-41d4-a716-446655440000";
    await convRepo.create(
      new Conversation({
        conversationId: convId,
        conversationType: ConversationType.DIRECT,
        createdBy: 1,
        createdAt: new Date(),
      }),
    );
    await memberRepo.addMember(
      new ConversationMember({ conversationId: convId, userId: 1, joinedAt: new Date(), role: MemberRole.OWNER }),
    );

    await expect(useCase.execute(convId, 99)).rejects.toThrow(ConversationForbiddenException);
  });

  it("should throw 404 Not Found if conversation does not exist", async () => {
    await expect(useCase.execute("non-existent-uuid", 1)).rejects.toThrow(ConversationNotFoundException);
  });
});
