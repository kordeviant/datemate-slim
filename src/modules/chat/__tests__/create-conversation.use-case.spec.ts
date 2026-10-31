import { ConfigService } from "@nestjs/config";
import { CreateConversationUseCase } from "../application/use-cases/create-conversation.use-case";
import {
  MockConversationRepository,
  MockConversationMemberRepository,
  MockDirectPairRepository,
} from "./mocks/mock-repositories";
import { ConversationType } from "../domain/enums/conversation-type.enum";
import { SelfConversationNotAllowedException } from "../domain/exceptions/self-conversation-not-allowed.exception";
import { InvalidParticipantsException } from "../domain/exceptions/invalid-participants.exception";

describe("CreateConversationUseCase", () => {
  let useCase: CreateConversationUseCase;
  let convRepo: MockConversationRepository;
  let memberRepo: MockConversationMemberRepository;
  let pairRepo: MockDirectPairRepository;

  beforeEach(() => {
    convRepo = new MockConversationRepository();
    memberRepo = new MockConversationMemberRepository();
    pairRepo = new MockDirectPairRepository();

    const configService = {
      get: jest.fn((key: string) => {
        if (key === "chat.maxGroupMembers") return 100;
        return null;
      }),
    } as unknown as ConfigService;

    useCase = new CreateConversationUseCase(convRepo, memberRepo, pairRepo, configService);
  });

  it("should create direct conversation with exactly one other participant", async () => {
    const res = await useCase.execute(1, {
      type: ConversationType.DIRECT,
      participantIds: [42],
    });

    expect(res.created).toBe(true);
    expect(res.conversation.conversationId).toBeDefined();
    expect(res.conversation.type).toBe(ConversationType.DIRECT);
    expect(res.conversation.memberIds).toEqual([1, 42]);
  });

  it("should be idempotent and return existing conversation on repeat direct create", async () => {
    const res1 = await useCase.execute(1, {
      type: ConversationType.DIRECT,
      participantIds: [42],
    });
    expect(res1.created).toBe(true);

    // Call from other user
    const res2 = await useCase.execute(42, {
      type: ConversationType.DIRECT,
      participantIds: [1],
    });

    expect(res2.created).toBe(false);
    expect(res2.conversation.conversationId).toBe(res1.conversation.conversationId);
  });

  it("should reject self-conversation", async () => {
    await expect(
      useCase.execute(1, {
        type: ConversationType.DIRECT,
        participantIds: [1],
      }),
    ).rejects.toThrow(SelfConversationNotAllowedException);
  });

  it("should create group conversation with at least 3 total members", async () => {
    const res = await useCase.execute(1, {
      type: ConversationType.GROUP,
      participantIds: [42, 43],
      name: "Trip Group",
    });

    expect(res.created).toBe(true);
    expect(res.conversation.type).toBe(ConversationType.GROUP);
    expect(res.conversation.title).toBe("Trip Group");
    expect(res.conversation.memberIds).toEqual([1, 42, 43]);
  });

  it("should reject group conversation with fewer than 3 total members", async () => {
    await expect(
      useCase.execute(1, {
        type: ConversationType.GROUP,
        participantIds: [42], // only 2 members total
      }),
    ).rejects.toThrow(InvalidParticipantsException);
  });
});
