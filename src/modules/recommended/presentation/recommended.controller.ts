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
import { GetRecommendedUseCase } from '../application/use-cases/get-recommended.use-case';
import { GetRecommendedDetailUseCase } from '../application/use-cases/get-recommended-detail.use-case';
import {
  RecommendedDetailQueryDto,
  RecommendedDetailResponseDto,
  RecommendedQueryDto,
  RecommendedResponseDto,
} from '../application/dtos/recommended.dto';
import { UserAuthGuard } from '../application/guards/user-auth.guard';
import { TokenService } from '../../auth/application/services/token.service';

@ApiTags('Recommended')
@Controller({ path: 'recommended', version: ['1', VERSION_NEUTRAL] })
@UseGuards(UserAuthGuard)
export class RecommendedController {
  constructor(
    private readonly getRecommendedUseCase: GetRecommendedUseCase,
    private readonly getRecommendedDetailUseCase: GetRecommendedDetailUseCase,
    private readonly tokenService: TokenService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get recommended profiles',
    description:
      'Retrieves top recommended candidate profiles filtered by the 6 hygiene rules and ranked dynamically by compatibility score (lifestyle & questions overlap, shared interests, city match, relation goal, and age proximity). Supports numeric start (0-based item index) and limit pagination. Cached for 1 day per user.',
  })
  @ApiResponse({
    status: 200,
    description: 'Recommended profiles retrieved successfully',
    type: RecommendedResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (gender demographic not completed)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  @ApiResponse({
    status: 403,
    description: 'Account suspended',
  })
  @ApiResponse({
    status: 404,
    description: 'User profile not found',
  })
  async getRecommended(
    @Query() query: RecommendedQueryDto,
    @Req() req: any,
    @Headers('authorization') authHeader?: string,
  ): Promise<RecommendedResponseDto> {
    const userId = await this.extractUserId(req, authHeader);
    const result = await this.getRecommendedUseCase.execute(userId, query);

    return {
      status: 'success',
      message: 'Recommended profiles retrieved successfully',
      data: result,
    };
  }

  @Get('detail')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get recommended profiles with full details',
    description:
      'Retrieves recommended candidate profiles with full details (matching /me API schema) while strictly preserving cached recommendation ranking order. Supports start, end, offset, and limit pagination, as well as anchor-based window pagination (anchorUserId, before, after).',
  })
  @ApiResponse({
    status: 200,
    description: 'Recommended detailed profiles retrieved successfully',
    type: RecommendedDetailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (gender demographic not completed)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  @ApiResponse({
    status: 403,
    description: 'Account suspended',
  })
  @ApiResponse({
    status: 404,
    description: 'User profile not found',
  })
  async getRecommendedDetail(
    @Query() query: RecommendedDetailQueryDto,
    @Req() req: any,
    @Headers('authorization') authHeader?: string,
  ): Promise<RecommendedDetailResponseDto> {
    const userId = await this.extractUserId(req, authHeader);
    const result = await this.getRecommendedDetailUseCase.execute(userId, query);

    return {
      status: 'success',
      message: 'Recommended detailed profiles retrieved successfully',
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
