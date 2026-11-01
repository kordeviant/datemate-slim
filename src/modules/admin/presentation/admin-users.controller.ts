import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../application/guards/admin-auth.guard';
import { GetAdminUsersUseCase } from '../application/use-cases/get-admin-users.use-case';
import { GetAdminUserDetailsUseCase } from '../application/use-cases/get-admin-user-details.use-case';
import { UpdateAdminUserUseCase } from '../application/use-cases/update-admin-user.use-case';
import { BanUserUseCase } from '../application/use-cases/ban-user.use-case';
import { UnbanUserUseCase } from '../application/use-cases/unban-user.use-case';
import { DeleteUserGalleryItemUseCase } from '../application/use-cases/delete-user-gallery-item.use-case';
import { DeleteAdminUserUseCase } from '../application/use-cases/delete-admin-user.use-case';
import { TerminateUserDeviceUseCase } from '../application/use-cases/terminate-user-device.use-case';
import { TerminateAllUserDevicesUseCase } from '../application/use-cases/terminate-all-user-devices.use-case';
import { GetUsersCountUseCase } from '../application/use-cases/get-users-count.use-case';
import { GetPendingSelfiesCountUseCase } from '../application/use-cases/get-pending-selfies-count.use-case';
import { GetAdminUsersDto } from '../application/dtos/get-admin-users.dto';
import { AdminUsersResponseDto } from '../application/dtos/admin-users-response.dto';
import { AdminUserDetailsResponseDto } from '../application/dtos/admin-user-details-response.dto';
import { UpdateAdminUserDto } from '../application/dtos/update-admin-user.dto';
import { UpdateAdminUserResponseDto } from '../application/dtos/update-admin-user-response.dto';
import { BanUserDto } from '../application/dtos/ban-user.dto';
import { BanUserResponseDto } from '../application/dtos/ban-user-response.dto';
import { DeleteGalleryResponseDto } from '../application/dtos/delete-gallery-response.dto';
import { DeleteAdminUserResponseDto } from '../application/dtos/delete-admin-user-response.dto';
import {
  TerminateDeviceResponseDto,
  TerminateAllDevicesResponseDto,
} from '../application/dtos/terminate-device-response.dto';
import { AdminCountResponseDto } from '../application/dtos/admin-count-response.dto';

@ApiTags('Admin - Users')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminAuthGuard)
@Controller({ path: 'admin/users', version: ['1', VERSION_NEUTRAL] })
export class AdminUsersController {
  constructor(
    private readonly getAdminUsersUseCase: GetAdminUsersUseCase,
    private readonly getAdminUserDetailsUseCase: GetAdminUserDetailsUseCase,
    private readonly updateAdminUserUseCase: UpdateAdminUserUseCase,
    private readonly banUserUseCase: BanUserUseCase,
    private readonly unbanUserUseCase: UnbanUserUseCase,
    private readonly deleteUserGalleryItemUseCase: DeleteUserGalleryItemUseCase,
    private readonly deleteAdminUserUseCase: DeleteAdminUserUseCase,
    private readonly terminateUserDeviceUseCase: TerminateUserDeviceUseCase,
    private readonly terminateAllUserDevicesUseCase: TerminateAllUserDevicesUseCase,
    private readonly getUsersCountUseCase: GetUsersCountUseCase,
    private readonly getPendingSelfiesCountUseCase: GetPendingSelfiesCountUseCase,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Search and paginate platform users directory',
    description:
      'Filterable, searchable, and paginated user table with registration status, online status, gender, and sorting.',
  })
  @ApiResponse({
    status: 200,
    description: 'Users list retrieved successfully',
    type: AdminUsersResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async getUsers(
    @Query() query: GetAdminUsersDto,
  ): Promise<AdminUsersResponseDto> {
    const result = await this.getAdminUsersUseCase.execute({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
      gender: query.gender,
      minAge: query.minAge,
      maxAge: query.maxAge,
      sortBy: query.sortBy,
      order: query.order,
    });

    return {
      status: 'success',
      message: 'Users list retrieved',
      data: result,
    };
  }

  @Get('count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get total count of platform users',
    description:
      'Retrieves total count of users registered in the platform, with optional status filter (e.g. ALL, PENDING_VERIFICATION, BLOCKED, ONLINE).',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['ALL', 'PENDING_VERIFICATION', 'BLOCKED', 'ONLINE'],
    description: 'Optional status filter for count',
  })
  @ApiResponse({
    status: 200,
    description: 'Users count retrieved successfully',
    type: AdminCountResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async getUsersCount(
    @Query('status') status?: string,
  ): Promise<AdminCountResponseDto> {
    const result = await this.getUsersCountUseCase.execute(status);

    return {
      status: 'success',
      message: 'Users count retrieved successfully',
      data: result,
    };
  }

  @Get('pending-selfies/count')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get count of unvalidated selfies awaiting verification',
    description:
      'Retrieves count of users whose selfie is not validated, who have an existing selfie URL, and profileValidated is false.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending selfies count retrieved successfully',
    type: AdminCountResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async getPendingSelfiesCount(): Promise<AdminCountResponseDto> {
    const result = await this.getPendingSelfiesCountUseCase.execute();

    return {
      status: 'success',
      message: 'Pending selfies count retrieved successfully',
      data: result,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user detailed information for admin modal/details view',
    description:
      'Retrieves complete user information including profile, demographics, gallery, transactions, chatRooms, and interests.',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: 12,
  })
  @ApiResponse({
    status: 200,
    description: 'User details retrieved successfully',
    type: AdminUserDetailsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found / کاربر مورد نظر یافت نشد',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async getUserDetails(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<AdminUserDetailsResponseDto> {
    const result = await this.getAdminUserDetailsUseCase.execute(id);

    return {
      status: 'success',
      message: 'User details retrieved successfully',
      data: result,
    };
  }

  @Post(':id/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ban/block a user account with duration or permanent ban',
    description:
      'Moderation endpoint allowing admins to ban a user for specific duration (in hours, e.g. 24, 168) or permanently (null). Automatically invalidates active sessions.',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID to ban',
    example: 101,
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully banned',
    type: BanUserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async banUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: BanUserDto,
  ): Promise<BanUserResponseDto> {
    const result = await this.banUserUseCase.execute(
      id,
      body.durationHours,
      body.reason,
    );

    return {
      status: 'success',
      message: 'User banned successfully',
      data: result,
    };
  }

  @Post(':id/unban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unban/unblock a previously banned user',
    description: 'Removes the ban from a user account by setting bannedUntil to null.',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID to unban',
    example: 101,
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully unbanned',
    type: BanUserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async unbanUser(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<BanUserResponseDto> {
    const result = await this.unbanUserUseCase.execute(id);

    return {
      status: 'success',
      message: 'User unbanned successfully',
      data: result,
    };
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user details and/or confirm selfie verification',
    description:
      'Allows admin to update user fields including confirming their selfie verification (setting profileValidated = true), bio, fullName, wallet, and premium status.',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID to update',
    example: 101,
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UpdateAdminUserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAdminUserDto,
  ): Promise<UpdateAdminUserResponseDto> {
    const result = await this.updateAdminUserUseCase.execute(id, body);

    return {
      status: 'success',
      message: 'User updated successfully',
      data: result,
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user details and/or confirm selfie verification (PUT alias)',
    description: 'Allows admin to update user fields (PUT alias for PATCH :id).',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID to update',
    example: 101,
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UpdateAdminUserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async updateUserPut(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateAdminUserDto,
  ): Promise<UpdateAdminUserResponseDto> {
    return this.updateUser(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a single user by ID',
    description:
      'Allows administrators to delete a single user account and all associated profile, gallery, swipe, and session data. Strictly only for one user at a time (multi-user delete is not supported).',
  })
  @ApiParam({
    name: 'id',
    description: 'Single user ID to delete',
    example: 101,
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully',
    type: DeleteAdminUserResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found / کاربر مورد نظر یافت نشد',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async deleteUser(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DeleteAdminUserResponseDto> {
    const result = await this.deleteAdminUserUseCase.execute(id);

    return {
      status: 'success',
      success: true,
      message: 'User deleted successfully',
      data: result,
    };
  }

  @Delete(':userId/gallery/:galleryId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a gallery image of a user',
    description:
      'Allows administrators to delete a specific photo from a user gallery by userId and galleryId.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID whose gallery photo is being deleted',
    example: 63,
  })
  @ApiParam({
    name: 'galleryId',
    description: 'Gallery image ID to delete',
    example: 68,
  })
  @ApiResponse({
    status: 200,
    description: 'Gallery image deleted successfully',
    type: DeleteGalleryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User or gallery item not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async deleteUserGalleryItem(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('galleryId', ParseIntPipe) galleryId: number,
  ): Promise<DeleteGalleryResponseDto> {
    const result = await this.deleteUserGalleryItemUseCase.execute(
      userId,
      galleryId,
    );

    return {
      status: 'success',
      success: true,
      message: 'Gallery image deleted successfully',
      data: result,
    };
  }

  @Delete(':userId/devices/:deviceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Terminate a user device session',
    description:
      'Allows administrators to terminate/logout an active device session of a user by userId and deviceId (session ID).',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID whose device session is being terminated',
    example: 12,
  })
  @ApiParam({
    name: 'deviceId',
    description: 'Device session ID to terminate',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Device session terminated successfully',
    type: TerminateDeviceResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User or device session not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async terminateDevice(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('deviceId', ParseIntPipe) deviceId: number,
  ): Promise<TerminateDeviceResponseDto> {
    const result = await this.terminateUserDeviceUseCase.execute(
      userId,
      deviceId,
    );

    return {
      status: 'success',
      success: true,
      message: 'Device session terminated successfully',
      data: result,
    };
  }

  @Delete(':userId/devices')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Terminate all device sessions of a user',
    description:
      'Allows administrators to terminate/logout all active and inactive device sessions of a user by userId.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID whose device sessions are being terminated',
    example: 12,
  })
  @ApiResponse({
    status: 200,
    description: 'All user device sessions terminated successfully',
    type: TerminateAllDevicesResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async terminateAllDevices(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<TerminateAllDevicesResponseDto> {
    const result = await this.terminateAllUserDevicesUseCase.execute(userId);

    return {
      status: 'success',
      success: true,
      message: 'All user device sessions terminated successfully',
      data: result,
    };
  }
}

