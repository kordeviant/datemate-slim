import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { types as CassandraTypes } from "cassandra-driver";
import { v4 as uuidv4 } from "uuid";
import { Conversation } from "../../domain/entities/conversation.entity";
import { ConversationMember } from "../../domain/entities/conversation-member.entity";
import { GroupProfile } from "../../domain/entities/group-profile.entity";
import { GroupRelationship } from "../../domain/entities/group-relationship.entity";
import { ConversationType } from "../../domain/enums/conversation-type.enum";
import { GroupMembershipStatus } from "../../domain/enums/group-membership-status.enum";
import { MemberRole } from "../../domain/enums/member-role.enum";
import { ConversationForbiddenException } from "../../domain/exceptions/conversation-forbidden.exception";
import { ConversationNotFoundException } from "../../domain/exceptions/conversation-not-found.exception";
import { ParticipantNotFoundException } from "../../domain/exceptions/participant-not-found.exception";
import { IConversationMemberRepository } from "../../domain/repositories/conversation-member.repository.interface";
import { IConversationRepository } from "../../domain/repositories/conversation.repository.interface";
import { IGroupRepository } from "../../domain/repositories/group.repository.interface";
import { CreateGroupDto, ListGroupParticipantsQueryDto, UpdateGroupDto } from "../dtos/create-group.dto";
import { GroupParticipantResponseDto, GroupResponseDto, ListGroupParticipantsResponseDto } from "../dtos/group-response.dto";
import { UserPresenceService } from "../services/user-presence.service";

@Injectable()
export class GroupUseCases {
  private readonly maxGroupMembers: number;
  constructor(
    @Inject("IConversationRepository") private readonly conversationRepo: IConversationRepository,
    @Inject("IConversationMemberRepository") private readonly memberRepo: IConversationMemberRepository,
    @Inject("IGroupRepository") private readonly groupRepo: IGroupRepository,
    private readonly presenceService: UserPresenceService,
    config: ConfigService,
  ) {
    this.maxGroupMembers = config.get<number>("chat.maxGroupMembers") || 1000;
  }

  public async create(ownerId: number, dto: CreateGroupDto): Promise<GroupResponseDto> {
    if (dto.minimumAge !== undefined && dto.maximumAge !== undefined && dto.minimumAge > dto.maximumAge) {
      throw new BadRequestException("minimumAge cannot be greater than maximumAge");
    }
    const now = new Date();
    const conversationId = uuidv4();
    const title = dto.title.trim();
    const conversation = new Conversation({
      conversationId,
      conversationType: ConversationType.GROUP,
      createdBy: ownerId,
      createdAt: now,
      title,
      lastMessageAt: CassandraTypes.TimeUuid.now().toString(),
      updatedAt: now,
    });
    const profile = new GroupProfile({
      conversationId,
      ownerId,
      active: true,
      isPrivate: dto.isPrivate,
      title,
      bio: dto.bio?.trim() || null,
      gender: dto.gender || null,
      minimumAge: dto.minimumAge ?? null,
      maximumAge: dto.maximumAge ?? null,
      subjectId: dto.subjectId ?? null,
      cityId: dto.cityId ?? null,
      avatar: dto.avatar ?? null,
      createdAt: now,
      updatedAt: now,
    });

    // No cross-partition Cassandra batch: each write is independently retryable.
    await this.conversationRepo.create(conversation);
    await this.groupRepo.createProfile(profile);
    await this.memberRepo.addMember(new ConversationMember({ conversationId, userId: ownerId, joinedAt: now, role: MemberRole.OWNER }));
    await this.groupRepo.createRelationshipIfAbsent(
      new GroupRelationship({
        conversationId,
        userId: ownerId,
        status: GroupMembershipStatus.ACTIVE,
        role: MemberRole.OWNER,
        createdAt: now,
        updatedAt: now,
        joinedAt: now,
      }),
    );
    await this.conversationRepo.upsertUserConversationProjection({
      userId: ownerId,
      conversationId,
      conversationType: ConversationType.GROUP,
      lastMessageAt: conversation.lastMessageAt!,
      lastMessagePreview: null,
      lastMessageSenderId: null,
      title,
    });

    const invitees = [...new Set(dto.initialInviteUserIds || [])].filter((id) => id !== ownerId);
    if (invitees.length > this.maxGroupMembers - 1) throw new BadRequestException("Too many initial invitations");
    await Promise.all(
      invitees.map((userId) =>
        this.groupRepo.createRelationshipIfAbsent(
          new GroupRelationship({
            conversationId,
            userId,
            status: GroupMembershipStatus.INVITED,
            role: MemberRole.MEMBER,
            createdAt: now,
            updatedAt: now,
            invitedAt: now,
          }),
        ),
      ),
    );
    return this.toResponse(profile, GroupMembershipStatus.ACTIVE);
  }

  public async get(conversationId: string, viewerId: number): Promise<GroupResponseDto> {
    const profile = await this.requireProfile(conversationId);
    const relationship = await this.groupRepo.findRelationship(conversationId, viewerId);
    if (!profile.active || (profile.isPrivate && !relationship)) throw new ConversationNotFoundException(conversationId);
    return this.toResponse(profile, relationship?.status || null);
  }

  public async update(conversationId: string, actorId: number, dto: UpdateGroupDto): Promise<GroupResponseDto> {
    const previous = await this.requireOwner(conversationId, actorId);
    const old = previous.toJSON();
    const now = new Date();
    const profile = new GroupProfile({
      ...old,
      active: dto.active ?? old.active,
      isPrivate: dto.isPrivate ?? old.isPrivate,
      title: dto.title?.trim() ?? old.title,
      bio: dto.bio?.trim() ?? old.bio,
      gender: dto.gender ?? old.gender,
      minimumAge: dto.minimumAge ?? old.minimumAge,
      maximumAge: dto.maximumAge ?? old.maximumAge,
      subjectId: dto.subjectId ?? old.subjectId,
      cityId: dto.cityId ?? old.cityId,
      avatar: dto.avatar ?? old.avatar,
      updatedAt: now,
    });
    await this.groupRepo.updateProfile(profile);
    return this.toResponse(profile, GroupMembershipStatus.ACTIVE);
  }

  /** Public group joins immediately; private group joins become a request. */
  public async join(conversationId: string, userId: number): Promise<GroupResponseDto> {
    const profile = await this.requireProfile(conversationId);
    if (!profile.active) throw new ConversationNotFoundException(conversationId);
    const current = await this.groupRepo.findRelationship(conversationId, userId);
    if (current?.status === GroupMembershipStatus.BANNED) throw new ConversationForbiddenException();
    if (current?.status === GroupMembershipStatus.ACTIVE) return this.toResponse(profile, current.status);
    // An invitation has its own explicit acceptance flow; repeated private
    // joins remain pending instead of silently changing a different state.
    if (current?.status === GroupMembershipStatus.INVITED || (profile.isPrivate && current?.status === GroupMembershipStatus.PENDING)) {
      return this.toResponse(profile, current.status);
    }
    const now = new Date();
    const status = profile.isPrivate ? GroupMembershipStatus.PENDING : GroupMembershipStatus.ACTIVE;
    const next = new GroupRelationship({
      conversationId,
      userId,
      status,
      role: current?.role || MemberRole.MEMBER,
      createdAt: current?.createdAt || now,
      updatedAt: now,
      requestedAt: profile.isPrivate ? now : current?.requestedAt || null,
      invitedAt: current?.invitedAt || null,
      joinedAt: status === GroupMembershipStatus.ACTIVE ? now : current?.joinedAt || null,
    });
    const changed = current
      ? await this.groupRepo.transitionRelationship(next, current.status)
      : (await this.groupRepo.createRelationshipIfAbsent(next)).applied;
    if (!changed) throw new BadRequestException("Group membership changed; retry the request");
    if (status === GroupMembershipStatus.ACTIVE) await this.activateMember(conversationId, userId, profile, now);
    return this.toResponse(profile, status);
  }

  public async approveRequest(conversationId: string, actorId: number, userId: number): Promise<GroupResponseDto> {
    const profile = await this.requireAdminOrOwner(conversationId, actorId);
    const current = await this.groupRepo.findRelationship(conversationId, userId);
    if (current?.status !== GroupMembershipStatus.PENDING) throw new BadRequestException("User has no pending join request");
    const now = new Date();
    const next = new GroupRelationship({
      conversationId,
      userId,
      status: GroupMembershipStatus.ACTIVE,
      role: current.role || MemberRole.MEMBER,
      createdAt: current.createdAt,
      updatedAt: now,
      requestedAt: current.requestedAt || null,
      invitedAt: current.invitedAt || null,
      joinedAt: now,
    });
    const changed = await this.groupRepo.transitionRelationship(next, GroupMembershipStatus.PENDING);
    if (!changed) throw new BadRequestException("Join request changed; retry the request");
    await this.activateMember(conversationId, userId, profile, now);
    return this.toResponse(profile, GroupMembershipStatus.ACTIVE);
  }

  public async acceptInvitation(conversationId: string, userId: number): Promise<GroupResponseDto> {
    const profile = await this.requireProfile(conversationId);
    const current = await this.groupRepo.findRelationship(conversationId, userId);
    if (current?.status !== GroupMembershipStatus.INVITED) throw new BadRequestException("User has no invitation to this group");
    const now = new Date();
    const next = new GroupRelationship({
      conversationId,
      userId,
      status: GroupMembershipStatus.ACTIVE,
      role: current.role || MemberRole.MEMBER,
      createdAt: current.createdAt,
      updatedAt: now,
      requestedAt: current.requestedAt || null,
      invitedAt: current.invitedAt || null,
      joinedAt: now,
    });
    const changed = await this.groupRepo.transitionRelationship(next, GroupMembershipStatus.INVITED);
    if (!changed) throw new BadRequestException("Invitation changed; retry the request");
    await this.activateMember(conversationId, userId, profile, now);
    return this.toResponse(profile, GroupMembershipStatus.ACTIVE);
  }

  public async ban(conversationId: string, actorId: number, userId: number, reason?: string): Promise<void> {
    const profile = await this.requireAdminOrOwner(conversationId, actorId);
    if (userId === profile.ownerId) throw new BadRequestException("The owner cannot be banned");
    const current = await this.groupRepo.findRelationship(conversationId, userId);
    if (actorId !== profile.ownerId && (current?.role === MemberRole.ADMIN || current?.role === MemberRole.OWNER)) {
      throw new ConversationForbiddenException();
    }
    const now = new Date();
    const next = new GroupRelationship({
      conversationId,
      userId,
      status: GroupMembershipStatus.BANNED,
      role: current?.role || MemberRole.MEMBER,
      createdAt: current?.createdAt || now,
      updatedAt: now,
      requestedAt: current?.requestedAt || null,
      invitedAt: current?.invitedAt || null,
      joinedAt: current?.joinedAt || null,
      bannedAt: now,
      bannedByUserId: actorId,
      banReason: reason?.trim() || null,
    });
    const changed = current
      ? await this.groupRepo.transitionRelationship(next, current.status)
      : (await this.groupRepo.createRelationshipIfAbsent(next)).applied;
    if (!changed) throw new BadRequestException("Group membership changed; retry the request");
    await this.memberRepo.removeMember(conversationId, userId);
  }

  public async listParticipants(
    conversationId: string,
    actorId: number,
    query: ListGroupParticipantsQueryDto,
  ): Promise<ListGroupParticipantsResponseDto> {
    const profile = await this.requireAdminOrOwner(conversationId, actorId);
    const status = query.status || GroupMembershipStatus.ACTIVE;
    const limit = query.limit || 30;

    const { items, nextCursor } = await this.groupRepo.listRelationships(
      conversationId,
      status,
      limit,
      query.cursor || null,
    );

    const userIds = items.map((rel) => rel.userId);
    const presenceMap = await this.presenceService.getUserActivityBatch(userIds);

    return {
      items: items.map((rel) => {
        const res = this.toParticipantResponse(rel, profile.ownerId);
        const presence = presenceMap.get(rel.userId);
        if (presence) {
          res.isOnline = presence.isOnline;
          res.lastSeenAt = presence.lastSeenAt;
        }
        return res;
      }),
      nextCursor,
    };
  }

  public async getParticipant(
    conversationId: string,
    actorId: number,
    targetUserId: number,
  ): Promise<GroupParticipantResponseDto> {
    const profile = await this.requireProfile(conversationId);
    const isOwnerOrAdmin =
      profile.ownerId === actorId || (await this.isAdmin(conversationId, actorId));

    if (actorId !== targetUserId && !isOwnerOrAdmin) {
      throw new ConversationForbiddenException();
    }

    const relationship = await this.groupRepo.findRelationship(conversationId, targetUserId);
    if (!relationship) {
      throw new ParticipantNotFoundException(targetUserId, conversationId);
    }

    const res = this.toParticipantResponse(relationship, profile.ownerId);
    const presence = await this.presenceService.getUserActivity(targetUserId);
    res.isOnline = presence.isOnline;
    res.lastSeenAt = presence.lastSeenAt;
    return res;
  }

  private async activateMember(conversationId: string, userId: number, profile: GroupProfile, now: Date): Promise<void> {
    await this.memberRepo.addMember(new ConversationMember({ conversationId, userId, joinedAt: now, role: MemberRole.MEMBER }));
    const conversation = await this.conversationRepo.findById(conversationId);
    if (!conversation) throw new ConversationNotFoundException(conversationId);
    await this.conversationRepo.upsertUserConversationProjection({
      userId,
      conversationId,
      conversationType: ConversationType.GROUP,
      lastMessageAt: conversation.lastMessageAt!,
      lastMessagePreview: conversation.lastMessagePreview || null,
      lastMessageSenderId: conversation.lastMessageSenderId || null,
      title: profile.title,
    });
  }

  private async requireProfile(id: string): Promise<GroupProfile> {
    const p = await this.groupRepo.findProfile(id);
    if (!p) throw new ConversationNotFoundException(id);
    return p;
  }

  private async requireOwner(id: string, userId: number): Promise<GroupProfile> {
    const p = await this.requireProfile(id);
    if (p.ownerId !== userId) throw new ConversationForbiddenException();
    return p;
  }

  private async requireAdminOrOwner(id: string, userId: number): Promise<GroupProfile> {
    const p = await this.requireProfile(id);
    if (p.ownerId === userId) return p;
    const isAdm = await this.isAdmin(id, userId);
    if (isAdm) return p;
    throw new ConversationForbiddenException();
  }

  private async isAdmin(conversationId: string, userId: number): Promise<boolean> {
    const rel = await this.groupRepo.findRelationship(conversationId, userId);
    return (
      rel?.status === GroupMembershipStatus.ACTIVE &&
      (rel?.role === MemberRole.ADMIN || rel?.role === MemberRole.OWNER)
    );
  }

  private toResponse(profile: GroupProfile, membershipStatus: GroupMembershipStatus | null): GroupResponseDto {
    return {
      conversationId: profile.conversationId,
      ownerId: profile.ownerId,
      active: profile.active,
      membershipStatus,
      groupData: {
        isPrivate: profile.isPrivate,
        title: profile.title,
        bio: profile.bio || null,
        gender: profile.gender || null,
        minimumAge: profile.minimumAge ?? null,
        maximumAge: profile.maximumAge ?? null,
        subjectId: profile.subjectId ?? null,
        cityId: profile.cityId ?? null,
        avatar: profile.avatar || null,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      },
    };
  }

  private toParticipantResponse(
    relationship: GroupRelationship,
    ownerId: number,
  ): GroupParticipantResponseDto {
    const role =
      relationship.role ||
      (relationship.userId === ownerId ? MemberRole.OWNER : MemberRole.MEMBER);

    return {
      userId: relationship.userId,
      status: relationship.status,
      role,
      joinedAt: relationship.joinedAt ? relationship.joinedAt.toISOString() : null,
      requestedAt: relationship.requestedAt ? relationship.requestedAt.toISOString() : null,
      invitedAt: relationship.invitedAt ? relationship.invitedAt.toISOString() : null,
      bannedAt: relationship.bannedAt ? relationship.bannedAt.toISOString() : null,
      bannedByUserId: relationship.bannedByUserId ?? null,
      banReason: relationship.banReason ?? null,
      updatedAt: relationship.updatedAt.toISOString(),
    };
  }
}
