import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { GetQuestionsUseCase } from '../application/use-cases/get-questions.use-case';
import { CreateQuestionUseCase } from '../application/use-cases/create-question.use-case';
import { UpdateQuestionUseCase } from '../application/use-cases/update-question.use-case';
import { DeleteQuestionUseCase } from '../application/use-cases/delete-question.use-case';
import { CreateQuestionDto } from '../application/dtos/create-question.dto';
import { UpdateQuestionDto } from '../application/dtos/update-question.dto';
import { QuestionListResponseDto } from '../application/dtos/question-response.dto';
import { TokenService } from '../../auth/application/services/token.service';
import { UploadMediaUseCase } from '../../media/application/use-cases/upload-media.use-case';

@ApiTags('Questions')
@Controller({ path: 'questions', version: ['1', VERSION_NEUTRAL] })
export class QuestionsController {
  constructor(
    private readonly getQuestionsUseCase: GetQuestionsUseCase,
    private readonly createQuestionUseCase: CreateQuestionUseCase,
    private readonly updateQuestionUseCase: UpdateQuestionUseCase,
    private readonly deleteQuestionUseCase: DeleteQuestionUseCase,
    private readonly uploadMediaUseCase: UploadMediaUseCase,
    private readonly tokenService: TokenService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  // @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get questions with optional filters or by ID',
    description:
      'Retrieves all questions with their IDs, or filters by id, type (PREFERENCES, PERSONALITY, INTERESTS, LIFESTYLE, VALUES) and language (en, fa). ' +
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
    description: 'Question type/category filter (e.g. PREFERENCES, PERSONALITY, or custom type)',
    type: String,
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
  // @ApiResponse({
  //   status: 401,
  //   description: 'Missing or invalid access token',
  // })
  @ApiResponse({
    status: 404,
    description: 'Question with specified ID not found',
  })
  async getQuestions(
    // @Headers('authorization') authHeader: string,
    @Query('id') id?: string,
    @Query('type') type?: string,
    @Query('language') language?: string,
  ): Promise<QuestionListResponseDto> {
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

    return this.getQuestionsUseCase.execute(type, language, numericId);
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  // @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Search questions by type query parameter',
    description: 'Searches questions by type (e.g. PREFERENCES, PERSONALITY, INTERESTS, LIFESTYLE, VALUES).',
  })
  @ApiQuery({
    name: 'type',
    required: true,
    description: 'Question type to search',
    type: String,
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Language filter (en or fa)',
    enum: ['en', 'fa'],
  })
  @ApiResponse({
    status: 200,
    description: 'Questions retrieved successfully',
    type: QuestionListResponseDto,
  })
  // @ApiResponse({
  //   status: 401,
  //   description: 'Missing or invalid access token',
  // })
  async searchQuestionsByType(
    // @Headers('authorization') authHeader: string,
    @Query('type') type: string,
    @Query('language') language?: string,
  ): Promise<QuestionListResponseDto> {
    // if (!authHeader) {
    //   throw new UnauthorizedException('Missing Authorization header');
    // }
    // const token = authHeader
    //   .replace(/^(Bearer\s*)+/i, '')
    //   .trim()
    //   .replace(/^["']|["']$/g, '');
    // this.tokenService.verifyAccessToken(token);

    return this.getQuestionsUseCase.execute(type, language);
  }

  @Get('type/:type')
  @HttpCode(HttpStatus.OK)
  // @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Search/Get questions by type route parameter',
    description: 'Retrieves all questions of a specific type (e.g. PREFERENCES, PERSONALITY, INTERESTS, LIFESTYLE, VALUES).',
  })
  @ApiParam({
    name: 'type',
    description: 'Question type/category (e.g. PREFERENCES, PERSONALITY, INTERESTS, LIFESTYLE, VALUES)',
    enum: ['PREFERENCES', 'PERSONALITY', 'INTERESTS', 'LIFESTYLE', 'VALUES'],
  })
  @ApiQuery({
    name: 'language',
    required: false,
    description: 'Language filter (en or fa). If omitted, returns both languages.',
    enum: ['en', 'fa'],
  })
  @ApiResponse({
    status: 200,
    description: 'Questions of the specified type retrieved successfully',
    type: QuestionListResponseDto,
  })
  // @ApiResponse({
  //   status: 401,
  //   description: 'Missing or invalid access token',
  // })
  async getQuestionsByType(
    // @Headers('authorization') authHeader: string,
    @Param('type') type: string,
    @Query('language') language?: string,
  ): Promise<QuestionListResponseDto> {
    // if (!authHeader) {
    //   throw new UnauthorizedException('Missing Authorization header');
    // }
    // const token = authHeader
    //   .replace(/^(Bearer\s*)+/i, '')
    //   .trim()
    //   .replace(/^["']|["']$/g, '');
    // this.tokenService.verifyAccessToken(token);

    return this.getQuestionsUseCase.execute(type, language);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  // @ApiBearerAuth('JWT-auth')
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
  // @ApiResponse({
  //   status: 401,
  //   description: 'Missing or invalid access token',
  // })
  @ApiResponse({
    status: 404,
    description: 'Question not found',
  })
  async getQuestionById(
    // @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
    @Query('language') language?: string,
  ): Promise<QuestionListResponseDto> {
    // if (!authHeader) {
    //   throw new UnauthorizedException('Missing Authorization header');
    // }
    // const token = authHeader
    //   .replace(/^(Bearer\s*)+/i, '')
    //   .trim()
    //   .replace(/^["']|["']$/g, '');
    // this.tokenService.verifyAccessToken(token);

    return this.getQuestionsUseCase.execute(undefined, language, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('icon'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Create a new question (admin only)',
    description:
      'Creates a new question with bilingual name and answer options. ' +
      'Supports uploading an icon file directly via multipart/form-data (field "icon") or providing a relative path/URL in JSON. ' +
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
    @UploadedFile() iconFile?: Express.Multer.File,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, '')
      .trim()
      .replace(/^["']|["']$/g, '');
    const decoded = await this.tokenService.verifyAccessToken(token);

    // Only admins can create questions
    if (decoded.role !== 'ADMIN') {
      throw new UnauthorizedException('Only administrators can create questions');
    }

    if (iconFile) {
      const uploadResult = await this.uploadMediaUseCase.execute('icons', iconFile);
      dto.icon = uploadResult.relativePath;
    }

    return this.createQuestionUseCase.execute(dto);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @UseInterceptors(FileInterceptor('icon'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Update an existing question (admin only)',
    description:
      'Updates question details, bilingual text, answers, and icon. ' +
      'Supports uploading a new icon file directly via multipart/form-data (field "icon") or providing path/URL. ' +
      'Requires admin role.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Question ID to update',
  })
  @ApiResponse({
    status: 200,
    description: 'Question updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Question not found',
  })
  async updateQuestion(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuestionDto,
    @UploadedFile() iconFile?: Express.Multer.File,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, '')
      .trim()
      .replace(/^["']|["']$/g, '');
    const decoded = await this.tokenService.verifyAccessToken(token);

    if (decoded.role !== 'ADMIN') {
      throw new UnauthorizedException('Only administrators can update questions');
    }

    if (iconFile) {
      const uploadResult = await this.uploadMediaUseCase.execute('icons', iconFile);
      dto.icon = uploadResult.relativePath;
    }

    return this.updateQuestionUseCase.execute(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete a question (admin only)',
    description: 'Deletes a question and its answers. Requires admin role.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Question ID to delete',
  })
  @ApiResponse({
    status: 200,
    description: 'Question deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Missing/invalid token or insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Question not found',
  })
  async deleteQuestion(
    @Headers('authorization') authHeader: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, '')
      .trim()
      .replace(/^["']|["']$/g, '');
    const decoded = await this.tokenService.verifyAccessToken(token);

    if (decoded.role !== 'ADMIN') {
      throw new UnauthorizedException('Only administrators can delete questions');
    }

    return this.deleteQuestionUseCase.execute(id);
  }
}
