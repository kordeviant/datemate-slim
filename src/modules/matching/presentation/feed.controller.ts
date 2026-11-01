import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Query,
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
import { GetFeedUseCase } from '../application/use-cases/get-feed.use-case';
import { FeedQueryDto, FeedResponseDto } from '../application/dtos/feed.dto';
import { UserAuthGuard } from '../application/guards/user-auth.guard';
import { TokenService } from '../../auth/application/services/token.service';

@ApiTags('Feed')
@Controller({ path: 'feed', version: ['1', VERSION_NEUTRAL] })
@UseGuards(UserAuthGuard)
export class FeedController {
  constructor(
    private readonly getFeedUseCase: GetFeedUseCase,
    private readonly tokenService: TokenService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get candidate profiles feed',
    description:
      'Retrieves candidate profiles for swiping deck (default: 20 cards), filtered strictly by the 6 rules: Exclude Self, Exclude Already Swiped, Not Banned, Has Active Photo, Profile Validated, and Opposite Gender.',
  })
  @ApiResponse({
    status: 200,
    description: 'Feed retrieved successfully',
    type: FeedResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (missing gender demographics)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  async getFeed(
    @Query() query: FeedQueryDto,
    @Req() req: any,
    @Headers('authorization') authHeader?: string,
  ): Promise<FeedResponseDto> {
    const userId = await this.extractUserId(req, authHeader);
    const result = await this.getFeedUseCase.execute(userId, query);

    return {
      status: 'success',
      message: 'Feed retrieved successfully',
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
