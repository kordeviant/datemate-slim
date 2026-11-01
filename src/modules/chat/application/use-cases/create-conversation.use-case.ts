import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v4 as uuidv4 } from "uuid";
import { CreateConversationDto } from "../dtos/create-conversation.dto";
import { ConversationResponseDto } from "../dtos/conversation-response.dto";
import { ConversationType } from "../../domain/enums/conversation-type.enum";
import { MemberRole } from "../../domain/enums/member-role.enum";
import { CanonicalPairKey } from "../../domain/value-objects/canonical-pair-key.vo";
import { CanonicalPairUtil } from "@common/utils/canonical-pair.util";
import { Conversation } from "../../domain/entities/conversation.entity";
import { ConversationMember } from "../../domain/entities/conversation-member.entity";
import { IConversationRepository } from "../../domain/repositories/conversation.repository.interface";
import { IConversationMemberRepository } from "../../domain/repositories/conversation-member.repository.interface";
import { IDirectPairRepository } from "../../domain/repositories/direct-pair.repository.interface";
import { SelfConversationNotAllowedException } from "../../domain/exceptions/self-conversation-not-allowed.exception";
import { InvalidParticipantsException } from "../../domain/exceptions/invalid-participants.exception";
import { types as CassandraTypes } from "cassandra-driver";

export interface CreateConversationResult {
  conversation: ConversationResponseDto;
  created: boolean;
}

@Injectable()
export class CreateConversationUseCase {
  private readonly maxGroupMembers: number;

  constructor(
    @Inject("IConversationRepository")
    private readonly conversationRepo: IConversationRepository,
    @Inject("IConversationMemberRepository")
    private readonly memberRepo: IConversationMemberRepository,
    @Inject("IDirectPairRepository")
    private readonly directPairRepo: IDirectPairRepository,
    private readonly configService: ConfigService,
  ) {
    this.maxGroupMembers = this.configService.get<number>("chat.maxGroupMembers") || 100;
  }

  public async execute(creatorId: number, dto: CreateConversationDto): Promise<CreateConversationResult> {
    const rawParticipantIds = dto.participantIds || [];

    // Rule: creator must not be in participantIds
    if (rawParticipantIds.includes(creatorId)) {
      throw new SelfConversationNotAllowedException();
    }

    // Deduplicate participants
    const uniqueParticipants = Array.from(new Set(rawParticipantIds));
    if (uniqueParticipants.length === 0) {
      throw new InvalidParticipantsException("At least one participant is required");
    }

    if (dto.type === ConversationType.DIRECT) {
      return this.handleDirectConversation(creatorId, uniqueParticipants[0]);
    } else {
      return this.handleGroupConversation(creatorId, uniqueParticipants, dto.name);
    }
  }

  private async handleDirectConversation(creatorId: number, recipientId: number): Promise<CreateConversationResult> {
    const pairKeyVo = new CanonicalPairKey(creatorId, recipientId);
    const canonicalKey = pairKeyVo.value;
    const deterministicId = CanonicalPairUtil.generateDeterministicId(canonicalKey);
    const now = new Date();

    // Cassandra LWT: INSERT INTO direct_conversations_by_pair IF NOT EXISTS
    const lwtResult = await this.directPairRepo.createIfNotExists(canonicalKey, deterministicId, now);

    if (!lwtResult.applied) {
      // Direct conversation already exists! Fetch existing conversation idempotently
      const existingId = lwtResult.conversationId || deterministicId;
      const existingConv = await this.conversationRepo.findById(existingId);
      const members = await this.memberRepo.findMembersByConversation(existingId);
      const memberIds = members.map((m) => m.userId);

      if (existingConv) {
        return {
          conversation: {
            conversationId: existingConv.conversationId,
            type: existingConv.conversationType,
            createdBy: existingConv.createdBy,
            createdAt: existingConv.createdAt.toISOString(),
            title: existingConv.title || null,
            memberIds: memberIds.length > 0 ? memberIds : [creatorId, recipientId],
            created: false,
          },
          created: false,
        };
      }
    }

    // Winning create request: initialize canonical conversation and members
    const initialTimeUuid = CassandraTypes.TimeUuid.now().toString();
    const conversation = new Conversation({
      conversationId: deterministicId,
      conversationType: ConversationType.DIRECT,
      createdBy: creatorId,
      createdAt: now,
      title: null,
      lastMessageAt: initialTimeUuid,
      updatedAt: now,
    });

    const creatorMember = new ConversationMember({
      conversationId: deterministicId,
      userId: creatorId,
      joinedAt: now,
      role: MemberRole.OWNER,
    });

    const recipientMember = new ConversationMember({
      conversationId: deterministicId,
      userId: recipientId,
      joinedAt: now,
      role: MemberRole.MEMBER,
    });

    // Save conversation metadata and members
    await this.conversationRepo.create(conversation);
    await this.memberRepo.addMembers([creatorMember, recipientMember]);

    // Initial user inbox projection for both members
    const initialProjection = {
      conversationId: deterministicId,
      conversationType: ConversationType.DIRECT,
      lastMessageAt: initialTimeUuid,
      lastMessagePreview: null,
      lastMessageSenderId: null,
      title: null,
    };

    await Promise.all([
      this.conversationRepo.upsertUserConversationProjection({ ...initialProjection, userId: creatorId }),
      this.conversationRepo.upsertUserConversationProjection({ ...initialProjection, userId: recipientId }),
    ]);

    return {
      conversation: {
        conversationId: deterministicId,
        type: ConversationType.DIRECT,
        createdBy: creatorId,
        createdAt: now.toISOString(),
        title: null,
        memberIds: [creatorId, recipientId],
        created: true,
      },
      created: true,
    };
  }

  private async handleGroupConversation(
    creatorId: number,
    participantIds: number[],
    name?: string,
  ): Promise<CreateConversationResult> {
    const totalMembersCount = participantIds.length + 1; // including creator

    if (totalMembersCount < 3) {
      throw new InvalidParticipantsException("Group conversation must contain at least 3 total members");
    }

    if (totalMembersCount > this.maxGroupMembers) {
      throw new InvalidParticipantsException(
        `Group conversation cannot exceed ${this.maxGroupMembers} members (attempted ${totalMembersCount})`,
      );
    }

    const conversationId = uuidv4();
    const now = new Date();
    const initialTimeUuid = CassandraTypes.TimeUuid.now().toString();

    const conversation = new Conversation({
      conversationId,
      conversationType: ConversationType.GROUP,
      createdBy: creatorId,
      createdAt: now,
      title: name || null,
      lastMessageAt: initialTimeUuid,
      updatedAt: now,
    });

    const members: ConversationMember[] = [
      new ConversationMember({
        conversationId,
        userId: creatorId,
        joinedAt: now,
        role: MemberRole.OWNER,
      }),
      ...participantIds.map(
        (pid) =>
          new ConversationMember({
            conversationId,
            userId: pid,
            joinedAt: now,
            role: MemberRole.MEMBER,
          }),
      ),
    ];

    await this.conversationRepo.create(conversation);
    await this.memberRepo.addMembers(members);

    // Initial user inbox projection for all group members
    const allMemberIds = [creatorId, ...participantIds];
    const initialProjection = {
      conversationId,
      conversationType: ConversationType.GROUP,
      lastMessageAt: initialTimeUuid,
      lastMessagePreview: null,
      lastMessageSenderId: null,
      title: name || null,
    };

    await Promise.all(
      allMemberIds.map((uid) =>
        this.conversationRepo.upsertUserConversationProjection({ ...initialProjection, userId: uid }),
      ),
    );

    return {
      conversation: {
        conversationId,
        type: ConversationType.GROUP,
        createdBy: creatorId,
        createdAt: now.toISOString(),
        title: name || null,
        memberIds: allMemberIds,
        created: true,
      },
      created: true,
    };
  }
}
