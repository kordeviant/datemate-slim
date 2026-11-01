import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UnauthorizedException,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { GetInterestsUseCase } from '../application/use-cases/get-interests.use-case';
import { CreateInterestUseCase } from '../application/use-cases/create-interest.use-case';
import { CreateInterestCategoryDto } from '../application/dtos/create-interest.dto';
import {
  InterestCategoryResponseDto,
  InterestListResponseDto,
} from '../application/dtos/interest-response.dto';
import { TokenService } from '../../auth/application/services/token.service';

@ApiTags('Interests')
@Controller({ path: ['interests', 'interest'], version: ['1', VERSION_NEUTRAL] })
export class InterestsController {
  constructor(
    private readonly getInterestsUseCase: GetInterestsUseCase,
    private readonly createInterestUseCase: CreateInterestUseCase,
    private readonly tokenService: TokenService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  // @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all interest categories with their interests',
    description:
      'Retrieves all interest categories, each containing a list of child interests. ' +
      'Matches client format: id, en, fa, icon: object, Interest: List<Interest>. ' +
      'Supports optional language filter (en, fa) and category ID filter.',
  })
  @ApiQuery({
    name: 'id',
    required: false,
    type: Number,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Language filter (en or fa). If omitted, returns both English and Farsi texts.',
    enum: ['en', 'fa'],
  })
  @ApiResponse({
    status: 200,
    description: 'Interest categories retrieved successfully',
    type: [InterestCategoryResponseDto],
  })
  // @ApiResponse({
  //   status: 401,
  //   description: 'Missing or invalid access token',
  // })
  @ApiResponse({
    status: 404,
    description: 'Interest category with specified ID not found',
  })
  async getInterests(
    // @Headers('authorization') authHeader: string,
    @Query('id') id?: string,
    @Query('language') language?: string,
  ): Promise<any> {
    // if (!authHeader) {
    //   throw new UnauthorizedException('Missing Authorization header');
    // }
    // const token = authHeader
    //   .replace(/^(Bearer\s*)+/i, '')
    //   .trim()
    //   .replace(/^["']|["']$/g, '');
    // this.tokenService.verifyAccessToken(token);

    let numericId: number | undefined;
    if (id !== undefined && id !== '') {
      numericId = Number(id);
      if (isNaN(numericId)) {
        throw new BadRequestException('Query parameter "id" must be a valid number');
      }
    }

    return this.getInterestsUseCase.execute(language, numericId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  // @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get a single interest category by ID',
    description: 'Retrieves a single interest category with its child interests by numeric ID.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Interest category ID',
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Language filter (en or fa). If omitted, returns both languages.',
    enum: ['en', 'fa'],
  })
  @ApiResponse({
    status: 200,
    description: 'Interest category retrieved successfully',
    type: InterestCategoryResponseDto,
  })
  // @ApiResponse({
  //   status: 401,
  //   description: 'Missing or invalid access token',
  // })
  @ApiResponse({
    status: 404,
    description: 'Interest category not found',
  })
  async getInterestById(
    // @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('language') language?: string,
  ): Promise<any> {
    // if (!authHeader) {
    //   throw new UnauthorizedException('Missing Authorization header');
    // }
    // const token = authHeader
    //   .replace(/^(Bearer\s*)+/i, '')
    //   .trim()
    //   .replace(/^["']|["']$/g, '');
    // this.tokenService.verifyAccessToken(token);

    return this.getInterestsUseCase.execute(language, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a new interest category with interests (admin only)',
    description:
      'Creates a new interest category with bilingual names and child interests. ' +
      'Matches client format: id, en, fa, icon, Interest: List<Interest>. Requires admin role.',
  })
  @ApiResponse({
    status: 201,
    description: 'Interest category created successfully',
    type: InterestCategoryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient permissions',
  })
  async createInterest(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateInterestCategoryDto,
  ): Promise<InterestCategoryResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, '')
      .trim()
      .replace(/^["']|["']$/g, '');
    const decoded = await this.tokenService.verifyAccessToken(token);

    // Only admins can create interest categories
    if (decoded.role !== 'ADMIN') {
      throw new UnauthorizedException('Only administrators can create interest categories');
    }

    return this.createInterestUseCase.execute(dto);
  }
}

