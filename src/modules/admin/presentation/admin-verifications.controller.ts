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
import { GetPendingSelfiesCountUseCase } from '../application/use-cases/get-pending-selfies-count.use-case';
import { GetAdminVerificationsDto } from '../application/dtos/get-admin-verifications.dto';
import {
  AdminVerificationsResponseDto,
  ApproveVerificationResponseDto,
  RejectVerificationResponseDto,
} from '../application/dtos/admin-verifications-response.dto';
import { RejectVerificationDto } from '../application/dtos/reject-verification.dto';
import { AdminCountResponseDto } from '../application/dtos/admin-count-response.dto';

@ApiTags('Admin - Verifications')
@ApiBearerAuth('JWT-auth')
@UseGuards(AdminAuthGuard)
@Controller({ path: 'admin/verifications', version: ['1', VERSION_NEUTRAL] })
export class AdminVerificationsController {
  constructor(
    private readonly getPendingVerificationsUseCase: GetPendingVerificationsUseCase,
    private readonly approveVerificationUseCase: ApproveVerificationUseCase,
    private readonly rejectVerificationUseCase: RejectVerificationUseCase,
    private readonly getPendingSelfiesCountUseCase: GetPendingSelfiesCountUseCase,
  ) {}

  @Get(['count', 'pending/count'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get count of unvalidated selfies awaiting review',
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

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get list of identity selfie verifications',
    description:
      'Retrieves the queue of selfie reviews with user avatarUrl and selfieUrl for admin inspection, filterable by status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Verifications retrieved successfully',
    type: AdminVerificationsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async getPendingVerifications(
    @Query() query: GetAdminVerificationsDto,
  ): Promise<AdminVerificationsResponseDto> {
    const result = await this.getPendingVerificationsUseCase.execute(
      query.page,
      query.limit,
      query.status,
    );

    return {
      status: 'success',
      message: 'Pending verifications retrieved successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve selfie verification for a user',
    description:
      'Approves the user identity selfie verification, sets User.profileValidated = true, and fires a PROFILE_VERIFIED notification.',
  })
  @ApiParam({
    name: 'id',
    description: 'Verification request ID or User ID being approved',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Selfie verification approved successfully',
    type: ApproveVerificationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Verification request not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async approveVerification(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApproveVerificationResponseDto> {
    const result = await this.approveVerificationUseCase.execute(id);

    return {
      status: 'success',
      success: true,
      message: 'Verification approved successfully',
      data: result,
    };
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject selfie verification for a user',
    description:
      'Rejects the user identity selfie verification, clears the selfieUrl, sets profileValidated = false, and creates a notification explaining the rejection reason.',
  })
  @ApiParam({
    name: 'id',
    description: 'Verification request ID or User ID being rejected',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Selfie verification rejected successfully',
    type: RejectVerificationResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Verification request not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient administrator privileges',
  })
  async rejectVerification(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RejectVerificationDto,
  ): Promise<RejectVerificationResponseDto> {
    const result = await this.rejectVerificationUseCase.execute(
      id,
      body?.reason,
    );

    return {
      status: 'success',
      success: true,
      message: 'Verification rejected successfully',
      data: result,
    };
  }
}
