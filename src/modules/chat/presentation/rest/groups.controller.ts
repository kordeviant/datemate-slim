import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CurrentUser } from "../../../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../../../common/guards/jwt-auth.guard";
import { AuthUser } from "../../../auth/domain/auth-user.interface";
import {
  BanGroupUserDto,
  CreateGroupDto,
  GroupUserDto,
  ListGroupParticipantsQueryDto,
  UpdateGroupDto,
} from "../../application/dtos/create-group.dto";
import {
  GroupParticipantResponseDto,
  GroupResponseDto,
  ListGroupParticipantsResponseDto,
} from "../../application/dtos/group-response.dto";
import { GroupMembershipStatus } from "../../domain/enums/group-membership-status.enum";
import { GroupUseCases } from "../../application/use-cases/group.use-cases";

@ApiTags("Groups")
@ApiBearerAuth("JWT-auth")
@UseGuards(JwtAuthGuard)
@Controller("groups")
export class GroupsController {
  constructor(private readonly groups: GroupUseCases) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a group conversation",
    description: "Creates a new group conversation, assigns the creator as owner, and sends optional invitations.",
  })
  @ApiResponse({
    status: 201,
    description: "Group conversation created successfully",
    type: GroupResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad Request - Validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized - Missing or invalid JWT" })
  public create(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto): Promise<GroupResponseDto> {
    return this.groups.create(user.id, dto);
  }

  @Get(":conversationId")
  @ApiOperation({
    summary: "Get group metadata",
    description: "Returns group profile metadata and the caller's membership status.",
  })
  @ApiParam({ name: "conversationId", format: "uuid", description: "Group conversation UUID" })
  @ApiResponse({
    status: 200,
    description: "Group profile returned successfully",
    type: GroupResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized - Missing or invalid JWT" })
  @ApiResponse({ status: 404, description: "Not Found - Group conversation not found" })
  public get(
    @CurrentUser() user: AuthUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
  ): Promise<GroupResponseDto> {
    return this.groups.get(conversationId, user.id);
  }

  @Patch(":conversationId")
  @ApiOperation({
    summary: "Update group metadata (owner only)",
    description: "Updates group settings such as title, bio, age limits, or privacy settings.",
  })
  @ApiParam({ name: "conversationId", format: "uuid", description: "Group conversation UUID" })
  @ApiResponse({
    status: 200,
    description: "Group profile updated successfully",
    type: GroupResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized - Missing or invalid JWT" })
  @ApiResponse({ status: 403, description: "Forbidden - Caller is not the group owner" })
  @ApiResponse({ status: 404, description: "Not Found - Group conversation not found" })
  public update(
    @CurrentUser() user: AuthUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() dto: UpdateGroupDto,
  ): Promise<GroupResponseDto> {
    return this.groups.update(conversationId, user.id, dto);
  }

  @Get(":conversationId/participants")
  @ApiOperation({
    summary: "List group participants by status (owner/admin only)",
    description: "Returns a paginated list of participants filtered by status (active, pending, invited, banned). Supports cursor-based pagination.",
  })
  @ApiParam({ name: "conversationId", format: "uuid", description: "Group conversation UUID" })
  @ApiQuery({
    name: "status",
    enum: GroupMembershipStatus,
    required: false,
    description: "Filter by status: active, pending, invited, banned (default: active)",
  })
  @ApiQuery({
    name: "limit",
    type: Number,
    required: false,
    description: "Number of participants to return (1-100, default: 30)",
  })
  @ApiQuery({
    name: "cursor",
    type: String,
    required: false,
    description: "Opaque cursor for pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Participants list returned successfully",
    type: ListGroupParticipantsResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized - Missing or invalid JWT" })
  @ApiResponse({ status: 403, description: "Forbidden - Caller is not owner or admin" })
  @ApiResponse({ status: 404, description: "Not Found - Group not found" })
  public listParticipants(
    @CurrentUser() user: AuthUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Query() query: ListGroupParticipantsQueryDto,
  ): Promise<ListGroupParticipantsResponseDto> {
    return this.groups.listParticipants(conversationId, user.id, query);
  }

  @Get(":conversationId/participants/:userId")
  @ApiOperation({
    summary: "Get participant relationship details",
    description: "Returns the detailed relationship record for a user (status, role, timestamps, ban reason). Accessible by group owner/admin or the user themselves.",
  })
  @ApiParam({ name: "conversationId", format: "uuid", description: "Group conversation UUID" })
  @ApiParam({ name: "userId", type: Number, description: "Target user ID" })
  @ApiResponse({
    status: 200,
    description: "Participant details returned successfully",
    type: GroupParticipantResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized - Missing or invalid JWT" })
  @ApiResponse({ status: 403, description: "Forbidden - Caller not authorized to view this participant" })
  @ApiResponse({ status: 404, description: "Not Found - Group or participant not found" })
  public getParticipant(
    @CurrentUser() user: AuthUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Param("userId", ParseIntPipe) targetUserId: number,
  ): Promise<GroupParticipantResponseDto> {
    return this.groups.getParticipant(conversationId, user.id, targetUserId);
  }

  @Post(":conversationId/join")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Join or request to join a group",
    description: "Immediately joins a public group, or creates a pending membership request for a private group.",
  })
  @ApiParam({ name: "conversationId", format: "uuid", description: "Group conversation UUID" })
  @ApiResponse({
    status: 200,
    description: "Joined public group (active) or submitted request (pending)",
    type: GroupResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized - Missing or invalid JWT" })
  @ApiResponse({ status: 403, description: "Forbidden - User is banned from this group" })
  @ApiResponse({ status: 404, description: "Not Found - Group not found" })
  public join(
    @CurrentUser() user: AuthUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
  ): Promise<GroupResponseDto> {
    return this.groups.join(conversationId, user.id);
  }

  @Post(":conversationId/invitations/accept")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Accept an invitation to join a group",
    description: "Accepts a pending invitation and activates membership with chat access.",
  })
  @ApiParam({ name: "conversationId", format: "uuid", description: "Group conversation UUID" })
  @ApiResponse({
    status: 200,
    description: "Invitation accepted successfully",
    type: GroupResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad Request - User has no invitation to this group" })
  @ApiResponse({ status: 401, description: "Unauthorized - Missing or invalid JWT" })
  @ApiResponse({ status: 404, description: "Not Found - Group not found" })
  public acceptInvitation(
    @CurrentUser() user: AuthUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
  ): Promise<GroupResponseDto> {
    return this.groups.acceptInvitation(conversationId, user.id);
  }

  @Post(":conversationId/join-requests/approve")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Approve a private group join request (owner or admin only)",
    description: "Approves a pending membership request and activates the user's chat access.",
  })
  @ApiParam({ name: "conversationId", format: "uuid", description: "Group conversation UUID" })
  @ApiResponse({
    status: 200,
    description: "Join request approved successfully",
    type: GroupResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad Request - User has no pending join request" })
  @ApiResponse({ status: 401, description: "Unauthorized - Missing or invalid JWT" })
  @ApiResponse({ status: 403, description: "Forbidden - Caller is not owner or admin" })
  @ApiResponse({ status: 404, description: "Not Found - Group not found" })
  public approve(
    @CurrentUser() user: AuthUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() dto: GroupUserDto,
  ): Promise<GroupResponseDto> {
    return this.groups.approveRequest(conversationId, user.id, dto.userId);
  }

  @Post(":conversationId/bans")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Ban a user and revoke chat access (owner or admin only)",
    description: "Bans a user from the group, revokes their chat access, and records the ban timestamp, executor, and optional reason.",
  })
  @ApiParam({ name: "conversationId", format: "uuid", description: "Group conversation UUID" })
  @ApiResponse({ status: 204, description: "User banned successfully" })
  @ApiResponse({ status: 400, description: "Bad Request - The owner cannot be banned" })
  @ApiResponse({ status: 401, description: "Unauthorized - Missing or invalid JWT" })
  @ApiResponse({ status: 403, description: "Forbidden - Caller is not owner or admin, or admin attempting to ban owner/admin" })
  @ApiResponse({ status: 404, description: "Not Found - Group not found" })
  public async ban(
    @CurrentUser() user: AuthUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Body() dto: BanGroupUserDto,
  ): Promise<void> {
    await this.groups.ban(conversationId, user.id, dto.userId, dto.reason);
  }
}
