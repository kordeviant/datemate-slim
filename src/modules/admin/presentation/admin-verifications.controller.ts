import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
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
import { GetPendingVerificationsUseCase } from '../application/use-cases/get-pending-verifications.use-case';
import { ApproveVerificationUseCase } from '../application/use-cases/approve-verification.use-case';
import { RejectVerificationUseCase } from '../application/use-cases/reject-verification.use-case';
import { PaginationQueryDto } from '../application/dtos/pagination-query.dto';
import {
  AdminVerificationsResponseDto,
  ApproveVerificationResponseDto,
  RejectVerificationResponseDto,
} from '../application/dtos/admin-verifications-response.dto';
import { RejectVerificationDto } from '../application/dtos/reject-verification.dto';

@ApiTags('Admin - Verifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminAuthGuard)
@Controller({ path: 'admin/verifications', version: ['1', VERSION_NEUTRAL] })
export class AdminVerificationsController {
  constructor(
    private readonly getPendingVerificationsUseCase: GetPendingVerificationsUseCase,
    private readonly approveVerificationUseCase: ApproveVerificationUseCase,
    private readonly rejectVerificationUseCase: RejectVerificationUseCase,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get list of pending identity selfie verifications',
    description:
      "Retrieves the queue of pending selfie reviews with user avatarUrl and selfieUrl for admin inspection.",
  })
  @ApiResponse({
    status: 200,
    description: 'Pending verifications retrieved successfully',
    type: AdminVerificationsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async getPendingVerifications(
    @Query() query: PaginationQueryDto,
  ): Promise<AdminVerificationsResponseDto> {
    const result = await this.getPendingVerificationsUseCase.execute(
      query.page,
      query.limit,
    );

    return {
      status: 'success',
      message: 'Pending verifications retrieved',
      data: result,
    };
  }

  @Post(':userId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve selfie verification for a user',
    description:
      'Approves the user identity selfie verification, sets User.profileValidated = true, and fires a PROFILE_VERIFIED notification.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID whose verification is being approved',
    example: 101,
  })
  @ApiResponse({
    status: 200,
    description: 'Selfie verification approved successfully',
    type: ApproveVerificationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async approveVerification(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<ApproveVerificationResponseDto> {
    const result = await this.approveVerificationUseCase.execute(userId);

    return {
      status: 'success',
      message: 'User selfie verification approved',
      data: result,
    };
  }

  @Post(':userId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject selfie verification for a user',
    description:
      'Rejects the user identity selfie verification, clears the selfieUrl, sets profileValidated = false, and creates a notification explaining the rejection reason.',
  })
  @ApiParam({
    name: 'userId',
    description: 'User ID whose verification is being rejected',
    example: 101,
  })
  @ApiResponse({
    status: 200,
    description: 'Selfie verification rejected successfully',
    type: RejectVerificationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async rejectVerification(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: RejectVerificationDto,
  ): Promise<RejectVerificationResponseDto> {
    const result = await this.rejectVerificationUseCase.execute(
      userId,
      body.reason,
    );

    return {
      status: 'success',
      message: 'User selfie verification rejected',
      data: result,
    };
  }
}
