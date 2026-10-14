import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Req,
  UnauthorizedException,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetLikesReceivedUseCase } from '../application/use-cases/get-likes-received.use-case';
import { LikesListResponseDto } from '../application/dtos/like.dto';
import { UserAuthGuard } from '../application/guards/user-auth.guard';
import { TokenService } from '../../auth/application/services/token.service';

@ApiTags('Matches')
@Controller({ path: 'matches', version: ['1', VERSION_NEUTRAL] })
@UseGuards(UserAuthGuard)
export class MatchesController {
  constructor(
    private readonly getLikesReceivedUseCase: GetLikesReceivedUseCase,
    private readonly tokenService: TokenService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'List users who liked the current user (alias route for matches screen)',
    description:
      'Retrieves all profiles that swiped right on the authenticated user. Displays everyone who liked the user with full profile cards.',
  })
  @ApiResponse({
    status: 200,
    description: 'Matches/Likes retrieved successfully',
    type: LikesListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  async getMatches(
    @Req() req: any,
    @Headers('authorization') authHeader?: string,
  ): Promise<LikesListResponseDto> {
    const userId = await this.extractUserId(req, authHeader);
    const result = await this.getLikesReceivedUseCase.execute(userId);

    return {
      status: 'success',
      message: 'Matches retrieved successfully',
      data: result,
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
