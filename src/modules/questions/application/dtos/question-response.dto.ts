import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuestionAnswerResponseDto {
  @ApiProperty({ example: 0, description: 'Answer ID starting from 0 for each question' })
  id: number;

  @ApiPropertyOptional({ example: 0, description: 'Answer ID alias (0-indexed per question)' })
  answerId?: number;

  @ApiPropertyOptional({ example: 1, description: 'Database answer ID' })
  dbId?: number;

  @ApiPropertyOptional({ example: 1, description: 'Parent Question ID' })
  questionId?: number;

  @ApiProperty({ example: 'Meditation and mindfulness practices.', description: 'Localized or default answer text' })
  answer: string;

  @ApiPropertyOptional({ example: 'Meditation and mindfulness practices.', description: 'English answer text' })
  answerEn?: string;

  @ApiPropertyOptional({ example: 'مراقبه و تمرین‌های ذهن‌آگاهی.', description: 'Farsi answer text' })
  answerFa?: string;
}

export class QuestionResponseDto {
  @ApiProperty({ example: 1, description: 'Question ID' })
  id: number;

  @ApiProperty({ example: 'PERSONALITY', description: 'Question type/category' })
  type: string;

  @ApiProperty({ example: 'How do you practice self-care?', description: 'Localized or default question text' })
  name: string;

  @ApiPropertyOptional({ example: 'How do you practice self-care?', description: 'English question text' })
  nameEn?: string;

  @ApiPropertyOptional({ example: 'چگونه از خود مراقبت می‌کنید؟', description: 'Farsi question text' })
  nameFa?: string;

  @ApiProperty({ type: [QuestionAnswerResponseDto], description: 'Answer options' })
  answers: QuestionAnswerResponseDto[];
}

export class QuestionListResponseDto {
  @ApiProperty({ example: 24, description: 'Total number of questions returned' })
  total: number;

  @ApiProperty({ type: [QuestionResponseDto], description: 'List of questions' })
  questions: QuestionResponseDto[];

  @ApiPropertyOptional({ type: QuestionResponseDto, description: 'Single question when queried by ID' })
  question?: QuestionResponseDto;

  @ApiPropertyOptional({ example: 1, description: 'Question ID filter applied' })
  id?: number;

  @ApiPropertyOptional({ example: 'PERSONALITY', description: 'Question type filter applied' })
  type?: string;

  @ApiPropertyOptional({ example: 'en', description: 'Language filter applied' })
  language?: string;
}
