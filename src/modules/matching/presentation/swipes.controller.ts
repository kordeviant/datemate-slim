import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
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
import { RecordSwipeUseCase } from '../application/use-cases/record-swipe.use-case';
import { SwipeRequestDto, SwipeResponseDto } from '../application/dtos/swipe.dto';
import { UserAuthGuard } from '../application/guards/user-auth.guard';
import { TokenService } from '../../auth/application/services/token.service';

@ApiTags('Swipes')
@Controller({ path: 'swipes', version: ['1', VERSION_NEUTRAL] })
@UseGuards(UserAuthGuard)
export class SwipesController {
  constructor(
    private readonly recordSwipeUseCase: RecordSwipeUseCase,
    private readonly tokenService: TokenService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Record a swipe (Like or Pass)',
    description:
      'Records a swipe action (RIGHT or LEFT) on a target user. Returns a fast 200 OK without extra payload for maximum throughput and sub-50ms latency.',
  })
  @ApiResponse({
    status: 200,
    description: 'Swipe recorded successfully',
    type: SwipeResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request (self swipe, invalid direction, or banned user)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized access',
  })
  @ApiResponse({
    status: 404,
    description: 'Target user not found',
  })
  async swipe(
    @Body() dto: SwipeRequestDto,
    @Req() req: any,
    @Headers('authorization') authHeader?: string,
  ): Promise<SwipeResponseDto> {
    const userId = await this.extractUserId(req, authHeader);
    await this.recordSwipeUseCase.execute(userId, dto);

    return {
      status: 'success',
      message: 'Swipe recorded successfully',
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
