import { ConfigService } from "@nestjs/config";
import { SendMessageUseCase } from "../application/use-cases/send-message.use-case";
import { ChatAuthorizationService } from "../application/services/chat-authorization.service";
import {
  MockMessageRepository,
  MockConversationRepository,
  MockConversationMemberRepository,
  MockMessageIdempotencyRepository,
} from "./mocks/mock-repositories";
import { Conversation } from "../domain/entities/conversation.entity";
import { ConversationMember } from "../domain/entities/conversation-member.entity";
import { ConversationType } from "../domain/enums/conversation-type.enum";
import { MemberRole } from "../domain/enums/member-role.enum";

describe("SendMessageUseCase", () => {
  let useCase: SendMessageUseCase;
  let msgRepo: MockMessageRepository;
  let convRepo: MockConversationRepository;
  let memberRepo: MockConversationMemberRepository;
  let idempotencyRepo: MockMessageIdempotencyRepository;
  let authService: ChatAuthorizationService;

  beforeEach(() => {
    msgRepo = new MockMessageRepository();
    convRepo = new MockConversationRepository();
    memberRepo = new MockConversationMemberRepository();
    idempotencyRepo = new MockMessageIdempotencyRepository();
    authService = new ChatAuthorizationService(convRepo, memberRepo);

    const configService = {
      get: jest.fn((key: string) => {
        if (key === "chat.maxMessageLength") return 4000;
        return null;
      }),
    } as unknown as ConfigService;

    useCase = new SendMessageUseCase(
      msgRepo,
      convRepo,
      memberRepo,
      idempotencyRepo,
      authService,
      configService,
    );
  });

  it("should persist message, update conversation metadata, and update user projections", async () => {
    const convId = "c1";
    await convRepo.create(
      new Conversation({
        conversationId: convId,
        conversationType: ConversationType.DIRECT,
        createdBy: 1,
        createdAt: new Date(),
      }),
    );
    await memberRepo.addMembers([
      new ConversationMember({
        conversationId: convId,
        userId: 1,
        joinedAt: new Date(),
        role: MemberRole.OWNER,
      }),
      new ConversationMember({
        conversationId: convId,
        userId: 2,
        joinedAt: new Date(),
        role: MemberRole.MEMBER,
      }),
    ]);

    const res = await useCase.execute(1, {
      conversationId: convId,
      clientMessageId: "client_req_001",
      content: "Hello world!",
    });

    expect(res.isDuplicate).toBe(false);
    expect(res.message.content).toBe("Hello world!");
    expect(res.message.senderId).toBe(1);
    expect(res.recipientUserIds).toEqual([1, 2]);

    // Check message persisted in repo
    expect(msgRepo.messages.length).toBe(1);

    // Check conversation metadata updated
    const conv = await convRepo.findById(convId);
    expect(conv?.lastMessagePreview).toBe("Hello world!");
    expect(conv?.lastMessageSenderId).toBe(1);

    // Check user inbox projections updated for both members
    const user1Proj = await convRepo.findUserConversations(1, 10);
    const user2Proj = await convRepo.findUserConversations(2, 10);
    expect(user1Proj.items.length).toBe(1);
    expect(user2Proj.items.length).toBe(1);
    expect(user1Proj.items[0].lastMessagePreview).toBe("Hello world!");
    expect(user2Proj.items[0].lastMessagePreview).toBe("Hello world!");
  });

  it("should handle idempotent retries with same clientMessageId without duplicating message", async () => {
    const convId = "c1";
    await convRepo.create(
      new Conversation({
        conversationId: convId,
        conversationType: ConversationType.DIRECT,
        createdBy: 1,
        createdAt: new Date(),
      }),
    );
    await memberRepo.addMember(
      new ConversationMember({
        conversationId: convId,
        userId: 1,
        joinedAt: new Date(),
        role: MemberRole.OWNER,
      }),
    );

    const res1 = await useCase.execute(1, {
      conversationId: convId,
      clientMessageId: "retry_token_123",
      content: "Hello again!",
    });
    expect(res1.isDuplicate).toBe(false);

    // Repeat with same clientMessageId
    const res2 = await useCase.execute(1, {
      conversationId: convId,
      clientMessageId: "retry_token_123",
      content: "Hello again!",
    });

    expect(res2.isDuplicate).toBe(true);
    expect(res2.message.messageId).toBe(res1.message.messageId);
    expect(msgRepo.messages.length).toBe(1); // No second message created
  });

  it("should trigger push notification to recipient users excluding sender", async () => {
    const convId = "c1";
    await convRepo.create(
      new Conversation({
        conversationId: convId,
        conversationType: ConversationType.DIRECT,
        createdBy: 1,
        createdAt: new Date(),
      }),
    );
    await memberRepo.addMembers([
      new ConversationMember({
        conversationId: convId,
        userId: 1,
        joinedAt: new Date(),
        role: MemberRole.OWNER,
      }),
      new ConversationMember({
        conversationId: convId,
        userId: 2,
        joinedAt: new Date(),
        role: MemberRole.MEMBER,
      }),
    ]);

    const mockPushNotificationService = {
      notifyNewMessage: jest.fn().mockResolvedValue(undefined),
    };

    const configService = {
      get: jest.fn(() => 4000),
    } as unknown as ConfigService;

    const useCaseWithPush = new SendMessageUseCase(
      msgRepo,
      convRepo,
      memberRepo,
      idempotencyRepo,
      authService,
      configService,
      mockPushNotificationService as any,
    );

    await useCaseWithPush.execute(
      1,
      {
        conversationId: convId,
        clientMessageId: "push_test_msg_001",
        content: "hello Jhon, how are you?",
      },
      "Parsa Moloudie",
    );

    expect(mockPushNotificationService.notifyNewMessage).toHaveBeenCalledTimes(
      1,
    );
    expect(mockPushNotificationService.notifyNewMessage).toHaveBeenCalledWith({
      targetUserIds: [1, 2],
      senderId: 1,
      senderName: "Parsa Moloudie",
      conversationTitle: undefined,
      conversationId: convId,
      content: "hello Jhon, how are you?",
      customTitle: "Parsa Moloudie",
    });
  });

  it("should not trigger push notification on duplicate idempotent message", async () => {
    const convId = "c1";
    await convRepo.create(
      new Conversation({
        conversationId: convId,
        conversationType: ConversationType.DIRECT,
        createdBy: 1,
        createdAt: new Date(),
      }),
    );
    await memberRepo.addMembers([
      new ConversationMember({
        conversationId: convId,
        userId: 1,
        joinedAt: new Date(),
        role: MemberRole.OWNER,
      }),
      new ConversationMember({
        conversationId: convId,
        userId: 2,
        joinedAt: new Date(),
        role: MemberRole.MEMBER,
      }),
    ]);

    const mockPushNotificationService = {
      notifyNewMessage: jest.fn().mockResolvedValue(undefined),
    };

    const configService = {
      get: jest.fn(() => 4000),
    } as unknown as ConfigService;

    const useCaseWithPush = new SendMessageUseCase(
      msgRepo,
      convRepo,
      memberRepo,
      idempotencyRepo,
      authService,
      configService,
      mockPushNotificationService as any,
    );

    // First attempt
    await useCaseWithPush.execute(
      1,
      {
        conversationId: convId,
        clientMessageId: "push_dup_001",
        content: "First try",
      },
      "Parsa Moloudie",
    );
    expect(mockPushNotificationService.notifyNewMessage).toHaveBeenCalledTimes(
      1,
    );

    // Second retry attempt
    await useCaseWithPush.execute(
      1,
      {
        conversationId: convId,
        clientMessageId: "push_dup_001",
        content: "First try",
      },
      "Parsa Moloudie",
    );
    // Should NOT have been called a second time
    expect(mockPushNotificationService.notifyNewMessage).toHaveBeenCalledTimes(
      1,
    );
  });

  it("should send voice message with duration and update preview appropriately", async () => {
    const convId = "c1";
    await convRepo.create(
      new Conversation({
        conversationId: convId,
        conversationType: ConversationType.DIRECT,
        createdBy: 1,
        createdAt: new Date(),
      }),
    );
    await memberRepo.addMembers([
      new ConversationMember({
        conversationId: convId,
        userId: 1,
        joinedAt: new Date(),
        role: MemberRole.OWNER,
      }),
      new ConversationMember({
        conversationId: convId,
        userId: 2,
        joinedAt: new Date(),
        role: MemberRole.MEMBER,
      }),
    ]);

    const res = await useCase.execute(1, {
      conversationId: convId,
      clientMessageId: "voice_msg_001",
      type: "voice",
      url: "http://localhost:3001/uploads/voice_sample.ogg",
      duration: 15.6,
    });

    expect(res.isDuplicate).toBe(false);
    expect(res.message.type).toBe("voice");
    expect(res.message.url).toBe(
      "http://localhost:3001/uploads/voice_sample.ogg",
    );
    expect(res.message.duration).toBe(15.6);
    expect(res.message.attachment).toBeDefined();
    expect(res.message.attachment?.duration).toBe(15.6);

    // Verify conversation preview reflects voice message
    const conv = await convRepo.findById(convId);
    expect(conv?.lastMessagePreview).toContain("🎤 Voice message");

    // Verify persisted in repo
    expect(msgRepo.messages.length).toBe(1);
    expect(msgRepo.messages[0].messageType).toBe("voice");
    expect(msgRepo.messages[0].mediaUrl).toBe(
      "http://localhost:3001/uploads/voice_sample.ogg",
    );
    expect(msgRepo.messages[0].duration).toBe(15.6);
  });

  it("should send photo with caption and format preview", async () => {
    const convId = "c1";
    await convRepo.create(
      new Conversation({
        conversationId: convId,
        conversationType: ConversationType.DIRECT,
        createdBy: 1,
        createdAt: new Date(),
      }),
    );
    await memberRepo.addMembers([
      new ConversationMember({
        conversationId: convId,
        userId: 1,
        joinedAt: new Date(),
        role: MemberRole.OWNER,
      }),
      new ConversationMember({
        conversationId: convId,
        userId: 2,
        joinedAt: new Date(),
        role: MemberRole.MEMBER,
      }),
    ]);

    const res = await useCase.execute(1, {
      conversationId: convId,
      clientMessageId: "photo_msg_001",
      content: "Look at this view!",
      type: "image",
      url: "http://localhost:3001/uploads/sunset.jpg",
    });

    expect(res.message.type).toBe("image");
    expect(res.message.content).toBe("Look at this view!");
    expect(res.message.url).toBe("http://localhost:3001/uploads/sunset.jpg");

    const conv = await convRepo.findById(convId);
    expect(conv?.lastMessagePreview).toBe("📷 Look at this view!");
  });

  it("should reject message if both content and attachment are missing", async () => {
    const convId = "c1";
    await convRepo.create(
      new Conversation({
        conversationId: convId,
        conversationType: ConversationType.DIRECT,
        createdBy: 1,
        createdAt: new Date(),
      }),
    );
    await memberRepo.addMember(
      new ConversationMember({
        conversationId: convId,
        userId: 1,
        joinedAt: new Date(),
        role: MemberRole.OWNER,
      }),
    );

    await expect(
      useCase.execute(1, {
        conversationId: convId,
        clientMessageId: "empty_fail",
        content: "",
      }),
    ).rejects.toThrow();
  });
});
