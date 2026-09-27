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
import { GetQuestionsUseCase } from '../application/use-cases/get-questions.use-case';
import { CreateQuestionUseCase } from '../application/use-cases/create-question.use-case';
import { CreateQuestionDto } from '../application/dtos/create-question.dto';
import { QuestionListResponseDto } from '../application/dtos/question-response.dto';
import { TokenService } from '../../auth/application/services/token.service';

@ApiTags('Questions')
@Controller({ path: 'questions', version: ['1', VERSION_NEUTRAL] })
export class QuestionsController {
  constructor(
    private readonly getQuestionsUseCase: GetQuestionsUseCase,
    private readonly createQuestionUseCase: CreateQuestionUseCase,
    private readonly tokenService: TokenService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get questions with optional filters or by ID',
    description:
      'Retrieves all questions with their IDs, or filters by id, type (PERSONALITY, INTERESTS, LIFESTYLE, VALUES) and language (en, fa). ' +
      'If no query params are provided, returns all questions with English and Farsi text. ' +
      'If id query param is provided, returns that specific question.',
  })
  @ApiQuery({
    name: 'id',
    required: false,
    type: Number,
    description: 'Filter by question ID',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Question type/category filter',
    enum: ['PERSONALITY', 'INTERESTS', 'LIFESTYLE', 'VALUES'],
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Language filter (en or fa). If omitted, returns both English and Farsi texts.',
    enum: ['en', 'fa'],
  })
  @ApiResponse({
    status: 200,
    description: 'Questions retrieved successfully',
    type: QuestionListResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
  })
  @ApiResponse({
    status: 404,
    description: 'Question with specified ID not found',
  })
  async getQuestions(
    @Headers('authorization') authHeader: string,
    @Query('id') id?: string,
    @Query('type') type?: string,
    @Query('language') language?: string,
  ): Promise<QuestionListResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, '')
      .trim()
      .replace(/^["']|["']$/g, '');
    this.tokenService.verifyAccessToken(token);

    let numericId: number | undefined;
    if (id !== undefined && id !== '') {
      numericId = Number(id);
      if (isNaN(numericId)) {
        throw new BadRequestException('Query parameter "id" must be a valid number');
      }
    }

    return this.getQuestionsUseCase.execute(type, language, numericId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get single question by route parameter ID',
    description: 'Retrieves a single question by its numeric ID path parameter.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Question ID',
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Language filter (en or fa). If omitted, returns both languages.',
    enum: ['en', 'fa'],
  })
  @ApiResponse({
    status: 200,
    description: 'Question retrieved successfully',
    type: QuestionListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
  })
  @ApiResponse({
    status: 404,
    description: 'Question not found',
  })
  async getQuestionById(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('language') language?: string,
  ): Promise<QuestionListResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, '')
      .trim()
      .replace(/^["']|["']$/g, '');
    this.tokenService.verifyAccessToken(token);

    return this.getQuestionsUseCase.execute(undefined, language, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create a new question (admin only)',
    description:
      'Creates a new question with bilingual name and answer options. ' +
      'Each question is stored with both English and Farsi text. ' +
      'Requires admin role.',
  })
  @ApiResponse({
    status: 201,
    description: 'Question created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient permissions',
  })
  async createQuestion(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateQuestionDto,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, '')
      .trim()
      .replace(/^["']|["']$/g, '');
    const decoded = this.tokenService.verifyAccessToken(token);

    // Only admins can create questions
    if (decoded.role !== 'ADMIN') {
      throw new UnauthorizedException('Only administrators can create questions');
    }

    return this.createQuestionUseCase.execute(dto);
  }
}
