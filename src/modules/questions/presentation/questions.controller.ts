import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
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
    summary: 'Get questions by type and language',
    description:
      'Retrieves questions filtered by optional type (PERSONALITY, INTERESTS, LIFESTYLE, VALUES) and language (en, fa). ' +
      'If language is not provided, returns questions in both languages.',
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
    description: 'Language filter (en or fa). If omitted, returns both languages.',
    enum: ['en', 'fa'],
  })
  @ApiResponse({
    status: 200,
    description: 'Questions retrieved successfully',
    type: QuestionListResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Missing or invalid access token',
  })
  async getQuestions(
    @Headers('authorization') authHeader: string,
    @Query('type') type?: string,
    @Query('language') language?: string,
  ): Promise<QuestionListResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    this.tokenService.verifyAccessToken(token);

    return this.getQuestionsUseCase.execute(type, language);
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
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const decoded = this.tokenService.verifyAccessToken(token);

    // Only admins can create questions
    if (decoded.role !== 'ADMIN') {
      throw new UnauthorizedException('Only administrators can create questions');
    }

    return this.createQuestionUseCase.execute(dto);
  }
}
