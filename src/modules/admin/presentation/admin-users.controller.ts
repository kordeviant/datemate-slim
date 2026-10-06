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
import { GetAdminUsersDto } from '../application/dtos/get-admin-users.dto';
import { AdminUsersResponseDto } from '../application/dtos/admin-users-response.dto';
import { AdminUserDetailsResponseDto } from '../application/dtos/admin-user-details-response.dto';
import { UpdateAdminUserDto } from '../application/dtos/update-admin-user.dto';
import { UpdateAdminUserResponseDto } from '../application/dtos/update-admin-user-response.dto';
import { BanUserDto } from '../application/dtos/ban-user.dto';
import { BanUserResponseDto } from '../application/dtos/ban-user-response.dto';
import { DeleteGalleryResponseDto } from '../application/dtos/delete-gallery-response.dto';

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
}
