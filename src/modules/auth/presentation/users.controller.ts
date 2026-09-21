import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../domain/repositories/user.repository.interface';
import { TokenService } from '../application/services/token.service';
import { CreateProfileUseCase } from '../application/use-cases/create-profile.use-case';
import { CreateProfileDto } from '../application/dtos/create-profile.dto';
import { ProfileResponseDto } from '../application/dtos/profile-response.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly tokenService: TokenService,
    private readonly createProfileUseCase: CreateProfileUseCase,
  ) {}

  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Check profile completion status',
    description:
      'Checks whether the authenticated user has created their basic profile and uploaded an avatar. Returns true or false.',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile status retrieved',
    schema: {
      example: {
        status: 'success',
        message: 'Operation successful',
        data: true,
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
  })
  async checkUserProfile(
    @Headers('authorization') authHeader: string,
  ): Promise<boolean> {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const decoded = this.tokenService.verifyAccessToken(token);
    return this.userRepository.hasCompletedProfile(decoded.sub);
  }

  @Post('profile')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Make/Create user onboarding profile',
    description:
      'Uploads profile picture (avatar), validates username, name, date of birth (age 18–80), binary gender (Male/Female), strips EXIF metadata, converts avatar to WebP, and saves profile.',
  })
  @ApiBody({
    description: 'User profile onboarding information and avatar image file',
    type: CreateProfileDto,
  })
  @ApiResponse({
    status: 201,
    description: 'Profile successfully created',
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error (e.g. invalid username, age < 18 or > 80, corrupted/invalid image, missing avatar)',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict error (username is already taken)',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid authorization token',
  })
  async createProfile(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateProfileDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ): Promise<ProfileResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const decoded = this.tokenService.verifyAccessToken(token);

    return this.createProfileUseCase.execute(decoded.sub, dto, avatar);
  }
}
