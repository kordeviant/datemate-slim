import { ConfigService } from "@nestjs/config";
import { ListUserConversationsUseCase } from "../application/use-cases/list-user-conversations.use-case";
import {
  MockConversationRepository,
  MockConversationMemberRepository,
  MockMessageRepository,
} from "./mocks/mock-repositories";
import { ConversationMember } from "../domain/entities/conversation-member.entity";
import { Conversation } from "../domain/entities/conversation.entity";
import { Message } from "../domain/entities/message.entity";
import { MemberRole } from "../domain/enums/member-role.enum";
import { ConversationType } from "../domain/enums/conversation-type.enum";
import { TimeBucketUtil } from "@common/utils/time-bucket.util";

import { UserPresenceService } from "../application/services/user-presence.service";

describe("ListUserConversationsUseCase", () => {
  let useCase: ListUserConversationsUseCase;
  let convRepo: MockConversationRepository;
  let memberRepo: MockConversationMemberRepository;
  let messageRepo: MockMessageRepository;
  let presenceService: UserPresenceService;

  beforeEach(() => {
    convRepo = new MockConversationRepository();
    memberRepo = new MockConversationMemberRepository();
    messageRepo = new MockMessageRepository();

    const configService = {
      get: jest.fn((key: string) => {
        if (key === "chat.defaultPageSize") return 20;
        if (key === "chat.maxPageSize") return 100;
        return null;
      }),
    } as unknown as ConfigService;

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

    useCase = new ListUserConversationsUseCase(convRepo, memberRepo, messageRepo, configService, presenceService);
  });

  it("should return user conversations sorted by latest activity", async () => {
    const conv1 = "c1";
    const conv2 = "c2";

    await convRepo.upsertUserConversationProjection({
      userId: 1,
      lastMessageAt: "1000",
      conversationId: conv1,
      conversationType: "direct",
      lastMessagePreview: "Old message",
    });

    await convRepo.upsertUserConversationProjection({
      userId: 1,
      lastMessageAt: "2000",
      conversationId: conv2,
      conversationType: "direct",
      lastMessagePreview: "New message",
    });

    await memberRepo.addMember(new ConversationMember({ conversationId: conv1, userId: 1, joinedAt: new Date(), role: MemberRole.OWNER }));
    await memberRepo.addMember(new ConversationMember({ conversationId: conv2, userId: 1, joinedAt: new Date(), role: MemberRole.OWNER }));

    const res = await useCase.execute(1, {});
    expect(res.items.length).toBe(2);
    // conv2 should be first because lastMessageAt 2000 > 1000
    expect(res.items[0].conversationId).toBe(conv2);
    expect(res.items[1].conversationId).toBe(conv1);
  });

  it("should deduplicate stale projection entries defensively", async () => {
    // Simulate stale row
    await convRepo.upsertUserConversationProjection({
      userId: 1,
      lastMessageAt: "1000",
      conversationId: "convA",
      conversationType: "direct",
      lastMessagePreview: "Stale message",
    });

    // Same conversation with higher lastMessageAt
    await convRepo.upsertUserConversationProjection({
      userId: 1,
      lastMessageAt: "2000",
      conversationId: "convA",
      conversationType: "direct",
      lastMessagePreview: "Latest message",
    });

    const res = await useCase.execute(1, {});
    expect(res.items.length).toBe(1);
    expect(res.items[0].conversationId).toBe("convA");
  });

  it("should return the last 20 recent messages in chronological order and set lastMessage", async () => {
    const convId = "conv-messages";
    const now = new Date("2026-10-15T08:30:00.000Z");
    const bucket = TimeBucketUtil.getBucket(now);

    const conv = new Conversation({
      conversationId: convId,
      conversationType: ConversationType.DIRECT,
      createdBy: 2,
      createdAt: now,
      title: null,
      lastMessageId: "msg-025",
      lastMessageSenderId: 56,
      lastMessagePreview: "Message 25",
      lastMessageAt: "2026-10-15T08:55:00.000Z",
    });
    await convRepo.create(conv);

    await convRepo.upsertUserConversationProjection({
      userId: 2,
      lastMessageAt: "2026-10-15T08:55:00.000Z",
      conversationId: convId,
      conversationType: ConversationType.DIRECT,
      lastMessagePreview: "Message 25",
      lastMessageSenderId: 56,
    });

    await memberRepo.addMember(new ConversationMember({ conversationId: convId, userId: 2, joinedAt: now, role: MemberRole.OWNER }));
    await memberRepo.addMember(new ConversationMember({ conversationId: convId, userId: 56, joinedAt: now, role: MemberRole.MEMBER }));

    // Add 25 messages into the bucket (from 08:31:00Z to 08:55:00Z)
    for (let i = 1; i <= 25; i++) {
      const pad = String(i).padStart(3, "0");
      const minute = String(30 + i).padStart(2, "0");
      const createdAt = `2026-10-15T08:${minute}:00.000Z`;
      await messageRepo.save(
        new Message({
          conversationId: convId,
          bucket,
          createdAt,
          messageId: `msg-${pad}`,
          senderId: i % 2 === 0 ? 2 : 56,
          content: `Message ${i}`,
        }),
      );
    }

    const res = await useCase.execute(2, {});
    expect(res.items.length).toBe(1);
    const item = res.items[0];

    expect(item.conversationId).toBe(convId);
    expect(item.type).toBe("direct");
    expect(item.createdBy).toBe(2);
    expect(item.createdAt).toBe("2026-10-15T08:30:00.000Z");
    expect(item.memberIds).toEqual([2, 56]);

    // Should return exactly the last 20 messages (msg-006 to msg-025)
    expect(item.recentMessages?.length).toBe(20);
    expect(item.recentMessages?.[0].messageId).toBe("msg-006");
    expect(item.recentMessages?.[0].content).toBe("Message 6");
    expect(item.recentMessages?.[19].messageId).toBe("msg-025");
    expect(item.recentMessages?.[19].content).toBe("Message 25");

    // Chronological order verification
    for (let i = 0; i < 19; i++) {
      const curr = item.recentMessages![i].createdAt;
      const next = item.recentMessages![i + 1].createdAt;
      expect(new Date(curr).getTime()).toBeLessThan(new Date(next).getTime());
    }

    // lastMessage should match the most recent message (msg-025)
    expect(item.lastMessage).toEqual({
      messageId: "msg-025",
      senderId: 56,
      content: "Message 25",
      createdAt: "2026-10-15T08:55:00.000Z",
    });
  });

  it("should return empty recentMessages and null lastMessage when conversation has no messages", async () => {
    const convId = "conv-empty";
    const now = new Date("2026-10-15T08:35:00.000Z");

    const conv = new Conversation({
      conversationId: convId,
      conversationType: ConversationType.DIRECT,
      createdBy: 2,
      createdAt: now,
      title: null,
      lastMessageId: null,
      lastMessagePreview: null,
      lastMessageSenderId: null,
    });
    await convRepo.create(conv);

    await convRepo.upsertUserConversationProjection({
      userId: 2,
      lastMessageAt: "2026-10-15T08:35:00.000Z",
      conversationId: convId,
      conversationType: ConversationType.DIRECT,
      lastMessagePreview: null,
      lastMessageSenderId: null,
    });

    await memberRepo.addMember(new ConversationMember({ conversationId: convId, userId: 2, joinedAt: now, role: MemberRole.OWNER }));
    await memberRepo.addMember(new ConversationMember({ conversationId: convId, userId: 88, joinedAt: now, role: MemberRole.MEMBER }));

    const res = await useCase.execute(2, {});
    expect(res.items.length).toBe(1);
    const item = res.items[0];

    expect(item.conversationId).toBe(convId);
    expect(item.type).toBe("direct");
    expect(item.createdBy).toBe(2);
    expect(item.createdAt).toBe("2026-10-15T08:35:00.000Z");
    expect(item.memberIds).toEqual([2, 88]);
    expect(item.lastMessage).toBeNull();
    expect(item.recentMessages).toEqual([]);
  });

  it("should filter by direct and group when filterType is specified", async () => {
    await convRepo.upsertUserConversationProjection({
      userId: 5,
      lastMessageAt: "2000",
      conversationId: "conv-d1",
      conversationType: ConversationType.DIRECT,
      lastMessagePreview: "Direct 1",
    });
    await convRepo.upsertUserConversationProjection({
      userId: 5,
      lastMessageAt: "1500",
      conversationId: "conv-g1",
      conversationType: ConversationType.GROUP,
      lastMessagePreview: "Group 1",
    });
    await convRepo.upsertUserConversationProjection({
      userId: 5,
      lastMessageAt: "1000",
      conversationId: "conv-d2",
      conversationType: ConversationType.DIRECT,
      lastMessagePreview: "Direct 2",
    });

    const directRes = await useCase.execute(5, { limit: 10 }, ConversationType.DIRECT);
    expect(directRes.items).toHaveLength(2);
    expect(directRes.items.map((i) => i.conversationId)).toEqual(["conv-d1", "conv-d2"]);

    const groupRes = await useCase.execute(5, { limit: 10 }, ConversationType.GROUP);
    expect(groupRes.items).toHaveLength(1);
    expect(groupRes.items[0].conversationId).toBe("conv-g1");
    expect((groupRes.items[0] as any).memberIds).toBeUndefined();
    expect((groupRes.items[0] as any).peerActivity).toBeUndefined();
    expect(groupRes.items[0].membersCount).toBe(0);
    expect(groupRes.items[0].lastUsers).toEqual([]);
  });

  it("should return membersCount and last 3 joined lastUsers without memberIds or peerActivity for group conversations", async () => {
    const convId = "conv-group-members";
    const now = new Date("2026-10-26T10:00:00.000Z");

    await convRepo.upsertUserConversationProjection({
      userId: 1,
      lastMessageAt: "3000",
      conversationId: convId,
      conversationType: ConversationType.GROUP,
      lastMessagePreview: "Hello group",
      title: "Test Group",
    });

    // Add 4 members with different join dates: User 10 (oldest), 20, 30, 40 (newest)
    await memberRepo.addMember(
      new ConversationMember({
        conversationId: convId,
        userId: 10,
        joinedAt: new Date("2026-10-20T10:00:00.000Z"),
        role: MemberRole.OWNER,
      }),
    );
    await memberRepo.addMember(
      new ConversationMember({
        conversationId: convId,
        userId: 20,
        joinedAt: new Date("2026-10-21T10:00:00.000Z"),
        role: MemberRole.MEMBER,
      }),
    );
    await memberRepo.addMember(
      new ConversationMember({
        conversationId: convId,
        userId: 30,
        joinedAt: new Date("2026-10-22T10:00:00.000Z"),
        role: MemberRole.MEMBER,
      }),
    );
    await memberRepo.addMember(
      new ConversationMember({
        conversationId: convId,
        userId: 40,
        joinedAt: new Date("2026-10-23T10:00:00.000Z"),
        role: MemberRole.MEMBER,
      }),
    );

    const res = await useCase.execute(1, { limit: 10 }, ConversationType.GROUP);
    expect(res.items).toHaveLength(1);
    const groupItem = res.items[0] as any;

    expect(groupItem.conversationId).toBe(convId);
    expect(groupItem.type).toBe("group");
    expect(groupItem.title).toBe("Test Group");
    expect(groupItem.memberIds).toBeUndefined();
    expect(groupItem.peerActivity).toBeUndefined();
    expect(groupItem.membersCount).toBe(4);
    // Last 3 joined users in reverse chronological order
    expect(groupItem.lastUsers).toEqual([40, 30, 20]);
  });
});
