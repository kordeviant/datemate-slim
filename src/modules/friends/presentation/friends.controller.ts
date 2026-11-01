import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserAuthGuard } from '../application/guards/user-auth.guard';
import { TokenService } from '../../auth/application/services/token.service';
import { AddFriendDto } from '../application/dtos/add-friend.dto';
import { FriendRequestsQueryDto } from '../application/dtos/friend-requests-query.dto';
import { FriendsQueryDto } from '../application/dtos/friends-query.dto';
import {
  AddFriendResponseDto,
  FriendActionResponseDto,
  FriendItemDto,
  FriendRequestsResponseDto,
  FriendsResponseDto,
} from '../application/dtos/friend-response.dto';
import { AddFriendUseCase } from '../application/use-cases/add-friend.use-case';
import { GetFriendRequestsUseCase } from '../application/use-cases/get-friend-requests.use-case';
import { AcceptFriendRequestUseCase } from '../application/use-cases/accept-friend-request.use-case';
import { RejectFriendRequestUseCase } from '../application/use-cases/reject-friend-request.use-case';
import { CancelFriendRequestUseCase } from '../application/use-cases/cancel-friend-request.use-case';
import { GetFriendsUseCase } from '../application/use-cases/get-friends.use-case';
import { RemoveFriendUseCase } from '../application/use-cases/remove-friend.use-case';
import { FriendRequestEntity } from '../domain/entities/friend-request.entity';

@ApiTags('Friends')
@ApiBearerAuth('JWT-auth')
@UseGuards(UserAuthGuard)
@Controller({ path: 'friends', version: ['1', VERSION_NEUTRAL] })
export class FriendsController {
  constructor(
    private readonly addFriendUseCase: AddFriendUseCase,
    private readonly getFriendRequestsUseCase: GetFriendRequestsUseCase,
    private readonly acceptFriendRequestUseCase: AcceptFriendRequestUseCase,
    private readonly rejectFriendRequestUseCase: RejectFriendRequestUseCase,
    private readonly cancelFriendRequestUseCase: CancelFriendRequestUseCase,
    private readonly getFriendsUseCase: GetFriendsUseCase,
    private readonly removeFriendUseCase: RemoveFriendUseCase,
    private readonly tokenService: TokenService,
  ) {}

  @Post('add')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add a friend / Send friend request',
    description:
      'Sends a friend request to the target user specified by userId. If a reciprocal pending request already exists from that user, it automatically accepts it and establishes friendship.',
  })
  @ApiResponse({
    status: 200,
    description: 'Friend request sent or accepted successfully',
    type: AddFriendResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (self-add, already friends, or already pending)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  @ApiResponse({
    status: 403,
    description: 'User or target user is banned',
  })
  @ApiResponse({
    status: 404,
    description: 'Target user not found',
  })
  async addFriend(
    @Body() dto: AddFriendDto,
    @Req() req: any,
    @Headers('authorization') authHeader?: string,
  ): Promise<AddFriendResponseDto> {
    const userId = await this.extractUserId(req, authHeader);
    const result = await this.addFriendUseCase.execute(userId, dto.userId);

    return {
      status: 'success',
      message: result.message,
      data: this.mapToFriendItem(result.request, userId),
    };
  }

  @Get('requests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get friend requests list with pagination',
    description:
      'Retrieves friend requests for the authenticated user. Supports filtering by type ("received" for incoming requests, "sent" for outgoing requests) and status ("PENDING", "ACCEPTED", "REJECTED", "CANCELLED").',
  })
  @ApiResponse({
    status: 200,
    description: 'Friend requests list retrieved successfully',
    type: FriendRequestsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  async getFriendRequests(
    @Query() query: FriendRequestsQueryDto,
    @Req() req: any,
    @Headers('authorization') authHeader?: string,
  ): Promise<FriendRequestsResponseDto> {
    const userId = await this.extractUserId(req, authHeader);
    const result = await this.getFriendRequestsUseCase.execute(userId, query);

    return {
      status: 'success',
      message: 'Friend requests retrieved successfully',
      data: result,
    };
  }

  @Post('accept/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept a friend request',
    description:
      'Accepts an incoming friend request by request ID (or sender user ID). Changes request status to ACCEPTED.',
  })
  @ApiParam({
    name: 'id',
    description: 'Friend request ID (or sender User ID)',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Friend request accepted successfully',
    type: FriendActionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Request was not sent to you',
  })
  @ApiResponse({
    status: 404,
    description: 'Friend request not found',
  })
  async acceptFriendRequest(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('authorization') authHeader?: string,
  ): Promise<FriendActionResponseDto> {
    const userId = await this.extractUserId(req, authHeader);
    const updated = await this.acceptFriendRequestUseCase.execute(userId, id);

    return {
      status: 'success',
      message: 'Friend request accepted successfully',
      data: this.mapToFriendItem(updated, userId),
    };
  }

  @Post('reject/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a friend request',
    description:
      'Rejects an incoming friend request by request ID (or sender user ID). Changes request status to REJECTED.',
  })
  @ApiParam({
    name: 'id',
    description: 'Friend request ID (or sender User ID)',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Friend request rejected successfully',
    type: FriendActionResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: Request was not sent to you',
  })
  @ApiResponse({
    status: 404,
    description: 'Friend request not found',
  })
  async rejectFriendRequest(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('authorization') authHeader?: string,
  ): Promise<FriendActionResponseDto> {
    const userId = await this.extractUserId(req, authHeader);
    const updated = await this.rejectFriendRequestUseCase.execute(userId, id);

    return {
      status: 'success',
      message: 'Friend request rejected successfully',
      data: this.mapToFriendItem(updated, userId),
    };
  }

  @Post('cancel/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an outgoing friend request',
    description:
      'Cancels a pending friend request sent by the authenticated user by request ID (or target user ID). Changes request status to CANCELLED.',
  })
  @ApiParam({
    name: 'id',
    description: 'Friend request ID (or target User ID)',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Friend request cancelled successfully',
    type: FriendActionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot cancel an already accepted friend request',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden: You can only cancel friend requests sent by you',
  })
  @ApiResponse({
    status: 404,
    description: 'Friend request not found',
  })
  async cancelFriendRequest(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
    @Headers('authorization') authHeader?: string,
  ): Promise<FriendActionResponseDto> {
    const userId = await this.extractUserId(req, authHeader);
    const updated = await this.cancelFriendRequestUseCase.execute(userId, id);

    return {
      status: 'success',
      message: 'Friend request cancelled successfully',
      data: this.mapToFriendItem(updated, userId),
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get friends list with pagination',
    description:
      'Retrieves all accepted friends for the authenticated user with page, limit, and optional name/username search filter.',
  })
  @ApiResponse({
    status: 200,
    description: 'Friends list retrieved successfully',
    type: FriendsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  async getFriends(
    @Query() query: FriendsQueryDto,
    @Req() req: any,
    @Headers('authorization') authHeader?: string,
  ): Promise<FriendsResponseDto> {
    const userId = await this.extractUserId(req, authHeader);
    const result = await this.getFriendsUseCase.execute(userId, query);

    return {
      status: 'success',
      message: 'Friends retrieved successfully',
      data: result,
    };
  }

  @Delete(':friendId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove a friend',
    description: 'Removes an existing friend by user ID (or friendship request ID).',
  })
  @ApiParam({
    name: 'friendId',
    description: 'User ID of the friend to remove (or friendship request ID)',
    example: 205,
  })
  @ApiResponse({
    status: 200,
    description: 'Friend removed successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Friendship not found',
  })
  async removeFriend(
    @Param('friendId', ParseIntPipe) friendId: number,
    @Req() req: any,
    @Headers('authorization') authHeader?: string,
  ): Promise<{ status: string; message: string }> {
    const userId = await this.extractUserId(req, authHeader);
    const result = await this.removeFriendUseCase.execute(userId, friendId);

    return {
      status: 'success',
      message: result.message,
    };
  }

  private mapToFriendItem(request: FriendRequestEntity, currentUserId: number): FriendItemDto {
    const friendUser =
      request.senderId === currentUserId ? request.receiver : request.sender;

    return {
      id: request.id,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      fullName: friendUser?.fullName || null,
      username: friendUser?.username || null,
      avatarUrl: friendUser?.avatarUrl || null,
    };
  }

  private async extractUserId(req: any, authHeader?: string): Promise<number> {
    if (req?.user?.sub) {
      return Number(req.user.sub);
    }
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, '')
      .trim()
      .replace(/^["']|["']$/g, '');
    const decoded = await this.tokenService.verifyAccessToken(token);
    return Number(decoded.sub);
  }
}
