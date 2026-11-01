import { ConfigService } from "@nestjs/config";
import { GroupUseCases } from "../application/use-cases/group.use-cases";
import { GroupMembershipStatus } from "../domain/enums/group-membership-status.enum";
import { MemberRole } from "../domain/enums/member-role.enum";
import { ConversationForbiddenException } from "../domain/exceptions/conversation-forbidden.exception";
import { ParticipantNotFoundException } from "../domain/exceptions/participant-not-found.exception";
import { GroupRelationship } from "../domain/entities/group-relationship.entity";
import {
  MockConversationMemberRepository,
  MockConversationRepository,
  MockGroupRepository,
} from "./mocks/mock-repositories";
import { UserPresenceService } from "../application/services/user-presence.service";

describe("GroupUseCases", () => {
  let useCases: GroupUseCases;
  let conversationRepo: MockConversationRepository;
  let memberRepo: MockConversationMemberRepository;
  let groupRepo: MockGroupRepository;
  let presenceService: UserPresenceService;

  beforeEach(() => {
    conversationRepo = new MockConversationRepository();
    memberRepo = new MockConversationMemberRepository();
    groupRepo = new MockGroupRepository();

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

    useCases = new GroupUseCases(
      conversationRepo,
      memberRepo,
      groupRepo,
      presenceService,
      {
        get: jest.fn().mockReturnValue(1_000),
      } as unknown as ConfigService,
    );
  });

  it("creates only the owner as an active member and records invitees separately", async () => {
    const group = await useCases.create(1, { title: "Tehran hikers", isPrivate: true, initialInviteUserIds: [2, 3] });
    expect(group.ownerId).toBe(1);
    expect(group.membershipStatus).toBe(GroupMembershipStatus.ACTIVE);
    expect((await memberRepo.findMembersByConversation(group.conversationId)).map((member) => member.userId)).toEqual([1]);
    expect((await groupRepo.findRelationship(group.conversationId, 2))?.status).toBe(GroupMembershipStatus.INVITED);
  });

  it("adds a public joiner to the message-authorized membership only after active status", async () => {
    const group = await useCases.create(1, { title: "Coffee", isPrivate: false });
    const joined = await useCases.join(group.conversationId, 2);
    expect(joined.membershipStatus).toBe(GroupMembershipStatus.ACTIVE);
    expect(await memberRepo.isMember(group.conversationId, 2)).toBe(true);
  });

  it("keeps a private joiner out of the chat until the owner approves", async () => {
    const group = await useCases.create(1, { title: "Private coffee", isPrivate: true });
    const pending = await useCases.join(group.conversationId, 2);
    expect(pending.membershipStatus).toBe(GroupMembershipStatus.PENDING);
    expect(await memberRepo.isMember(group.conversationId, 2)).toBe(false);
    await useCases.approveRequest(group.conversationId, 1, 2);
    expect(await memberRepo.isMember(group.conversationId, 2)).toBe(true);
  });

  describe("listParticipants", () => {
    it("allows owner to list participants filtered by status", async () => {
      const group = await useCases.create(1, { title: "Study Group", isPrivate: true, initialInviteUserIds: [2, 3] });
      await useCases.join(group.conversationId, 4); // pending join request

      // Active participants (only owner initially)
      const activeList = await useCases.listParticipants(group.conversationId, 1, {
        status: GroupMembershipStatus.ACTIVE,
        limit: 10,
      });
      expect(activeList.items).toHaveLength(1);
      expect(activeList.items[0].userId).toBe(1);
      expect(activeList.items[0].role).toBe(MemberRole.OWNER);
      expect(activeList.items[0].status).toBe(GroupMembershipStatus.ACTIVE);
      expect(activeList.items[0].joinedAt).toBeDefined();

      // Invited participants
      const invitedList = await useCases.listParticipants(group.conversationId, 1, {
        status: GroupMembershipStatus.INVITED,
        limit: 10,
      });
      expect(invitedList.items).toHaveLength(2);
      expect(invitedList.items.map((i) => i.userId)).toEqual([2, 3]);
      expect(invitedList.items[0].invitedAt).toBeDefined();

      // Pending participants
      const pendingList = await useCases.listParticipants(group.conversationId, 1, {
        status: GroupMembershipStatus.PENDING,
        limit: 10,
      });
      expect(pendingList.items).toHaveLength(1);
      expect(pendingList.items[0].userId).toBe(4);
      expect(pendingList.items[0].requestedAt).toBeDefined();
    });

    it("allows an admin to list participants", async () => {
      const group = await useCases.create(1, { title: "Dev Team", isPrivate: false });
      await useCases.join(group.conversationId, 2);
      // Promote user 2 to admin
      const now = new Date();
      await groupRepo.upsertRelationship(
        new GroupRelationship({
          conversationId: group.conversationId,
          userId: 2,
          status: GroupMembershipStatus.ACTIVE,
          role: MemberRole.ADMIN,
          createdAt: now,
          updatedAt: now,
          joinedAt: now,
        }),
      );

      const list = await useCases.listParticipants(group.conversationId, 2, {
        status: GroupMembershipStatus.ACTIVE,
      });
      expect(list.items).toHaveLength(2);
    });

    it("forbids regular member or outsider from listing participants", async () => {
      const group = await useCases.create(1, { title: "Secret Club", isPrivate: false });
      await useCases.join(group.conversationId, 2); // regular member

      // Member 2 is regular member, not owner/admin
      await expect(
        useCases.listParticipants(group.conversationId, 2, { status: GroupMembershipStatus.ACTIVE }),
      ).rejects.toThrow(ConversationForbiddenException);

      // Outsider 99
      await expect(
        useCases.listParticipants(group.conversationId, 99, { status: GroupMembershipStatus.ACTIVE }),
      ).rejects.toThrow(ConversationForbiddenException);
    });
  });

  describe("getParticipant", () => {
    it("allows owner to get participant details including ban reason", async () => {
      const group = await useCases.create(1, { title: "Book Club", isPrivate: false });
      await useCases.join(group.conversationId, 2);
      await useCases.ban(group.conversationId, 1, 2, "Violated guidelines");

      const participant = await useCases.getParticipant(group.conversationId, 1, 2);
      expect(participant.userId).toBe(2);
      expect(participant.status).toBe(GroupMembershipStatus.BANNED);
      expect(participant.role).toBe(MemberRole.MEMBER);
      expect(participant.bannedByUserId).toBe(1);
      expect(participant.banReason).toBe("Violated guidelines");
      expect(participant.bannedAt).toBeDefined();
    });

    it("allows user to get their own participant relationship", async () => {
      const group = await useCases.create(1, { title: "Art Club", isPrivate: true });
      await useCases.join(group.conversationId, 5); // pending

      const details = await useCases.getParticipant(group.conversationId, 5, 5);
      expect(details.userId).toBe(5);
      expect(details.status).toBe(GroupMembershipStatus.PENDING);
      expect(details.requestedAt).toBeDefined();
    });

    it("forbids regular member from viewing another member's relationship", async () => {
      const group = await useCases.create(1, { title: "Gaming Club", isPrivate: false });
      await useCases.join(group.conversationId, 2);
      await useCases.join(group.conversationId, 3);

      await expect(
        useCases.getParticipant(group.conversationId, 2, 3),
      ).rejects.toThrow(ConversationForbiddenException);
    });

    it("throws ParticipantNotFoundException when user has no relationship in group", async () => {
      const group = await useCases.create(1, { title: "Music Club", isPrivate: false });
      await expect(
        useCases.getParticipant(group.conversationId, 1, 999),
      ).rejects.toThrow(ParticipantNotFoundException);
    });
  });
});
