import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../../../common/guards/jwt-auth.guard";
import { CurrentUser } from "../../../../common/decorators/current-user.decorator";
import { AuthUser } from "../../../auth/domain/auth-user.interface";
import { CreateConversationDto } from "../../application/dtos/create-conversation.dto";
import { ListConversationsQueryDto } from "../../application/dtos/list-conversations.dto";
import { GetMessagesQueryDto, MessageItemDto, PaginatedMessagesResponseDto } from "../../application/dtos/get-messages.dto";
import {
  ConversationResponseDto,
  CreateConversationResponseData,
  PaginatedConversationsResponseDto,
  GroupConversationResponseDto,
  PaginatedGroupConversationsResponseDto,
} from "../../application/dtos/conversation-response.dto";
import { ConversationType } from "../../domain/enums/conversation-type.enum";
import { PaginatedResult } from "../../../../common/dtos/pagination.dto";
import { CreateConversationUseCase } from "../../application/use-cases/create-conversation.use-case";
import { ListUserConversationsUseCase } from "../../application/use-cases/list-user-conversations.use-case";
import { GetConversationDetailsUseCase } from "../../application/use-cases/get-conversation-details.use-case";
import { GetMessageHistoryUseCase } from "../../application/use-cases/get-message-history.use-case";

@ApiTags("Conversations")
@ApiBearerAuth("JWT-auth")
@UseGuards(JwtAuthGuard)
@Controller("conversations")
export class ConversationsController {
  constructor(
    private readonly createConversationUseCase: CreateConversationUseCase,
    private readonly listUserConversationsUseCase: ListUserConversationsUseCase,
    private readonly getConversationDetailsUseCase: GetConversationDetailsUseCase,
    private readonly getMessageHistoryUseCase: GetMessageHistoryUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Create a direct or group conversation",
    description:
      "Creates a direct (one-to-one) or group conversation. Direct conversation creation is idempotent and returns the existing conversation if one already exists.",
  })
  @ApiResponse({
    status: 200,
    description: "Conversation created or retrieved successfully",
    type: CreateConversationResponseData,
  })
  public async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateConversationDto,
  ): Promise<CreateConversationResponseData> {
    const result = await this.createConversationUseCase.execute(user.id, dto);
    return {
      conversation: result.conversation,
    };
  }

  @Get()
  @ApiOperation({
    summary: "List conversations for the authenticated user",
    description:
      "Returns conversations ordered by most recent activity descending. Supports cursor-based pagination.",
  })
  @ApiResponse({
    status: 200,
    description: "Conversations retrieved successfully",
    type: PaginatedConversationsResponseDto,
  })
  public async list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListConversationsQueryDto,
  ): Promise<PaginatedResult<ConversationResponseDto>> {
    return this.listUserConversationsUseCase.execute(user.id, query);
  }

  @Get("direct")
  @ApiOperation({
    summary: "List direct (one-to-one) conversations for the authenticated user",
    description:
      "Returns only direct conversations ordered by most recent activity descending. Supports cursor-based pagination.",
  })
  @ApiResponse({
    status: 200,
    description: "Direct conversations retrieved successfully",
    type: PaginatedConversationsResponseDto,
  })
  public async listDirect(
    @CurrentUser() user: AuthUser,
    @Query() query: ListConversationsQueryDto,
  ): Promise<PaginatedResult<ConversationResponseDto>> {
    return this.listUserConversationsUseCase.execute(user.id, query, ConversationType.DIRECT);
  }

  @Get("group")
  @ApiOperation({
    summary: "List group conversations for the authenticated user",
    description:
      "Returns only group conversations that the authenticated user is a member of. Supports cursor-based pagination.",
  })
  @ApiResponse({
    status: 200,
    description: "Group conversations retrieved successfully",
    type: PaginatedGroupConversationsResponseDto,
  })
  public async listGroup(
    @CurrentUser() user: AuthUser,
    @Query() query: ListConversationsQueryDto,
  ): Promise<PaginatedResult<GroupConversationResponseDto>> {
    return this.listUserConversationsUseCase.execute(
      user.id,
      query,
      ConversationType.GROUP,
    );
  }

  @Get(":conversationId")
  @ApiOperation({
    summary: "Get conversation details and members",
    description:
      "Returns conversation metadata and member IDs. Requires the authenticated user to be a member.",
  })
  @ApiParam({ name: "conversationId", description: "UUID of the conversation" })
  @ApiResponse({
    status: 200,
    description: "Conversation details retrieved",
    type: ConversationResponseDto,
  })
  public async getDetails(
    @CurrentUser() user: AuthUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
  ): Promise<ConversationResponseDto> {
    return this.getConversationDetailsUseCase.execute(conversationId, user.id);
  }

  @Get(":conversationId/messages")
  @ApiOperation({
    summary: "Get message history for a conversation",
    description:
      "Returns messages in reverse chronological order (newest first). Supports cursor-based pagination traversing UTC time buckets.",
  })
  @ApiParam({ name: "conversationId", description: "UUID of the conversation" })
  @ApiResponse({
    status: 200,
    description: "Messages retrieved successfully",
    type: PaginatedMessagesResponseDto,
  })
  public async getMessages(
    @CurrentUser() user: AuthUser,
    @Param("conversationId", new ParseUUIDPipe()) conversationId: string,
    @Query() query: GetMessagesQueryDto,
  ): Promise<PaginatedResult<MessageItemDto>> {
    return this.getMessageHistoryUseCase.execute(conversationId, user.id, query);
  }
}
