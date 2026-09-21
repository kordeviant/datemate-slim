import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../domain/repositories/user.repository.interface';
import { TokenService } from '../application/services/token.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly tokenService: TokenService,
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
}
