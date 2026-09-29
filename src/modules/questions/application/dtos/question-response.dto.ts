import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuestionAnswerResponseDto {
  @ApiProperty({ example: 0, description: 'Answer ID starting from 0 for each question' })
  id: number;

  @ApiPropertyOptional({ example: 1, description: 'Parent Question ID' })
  questionId?: number;

  @ApiProperty({ example: 'Meditation and mindfulness practices.', description: 'Localized or default answer text' })
  answer: string;

  @ApiPropertyOptional({ example: 'Meditation and mindfulness practices.', description: 'English answer text' })
  enAnswer?: string;

  @ApiPropertyOptional({ example: 'مراقبه و تمرین‌های ذهن‌آگاهی.', description: 'Farsi answer text' })
  faAnswer?: string;

  @ApiPropertyOptional({ example: 'Meditation and mindfulness practices.', description: 'English answer text (legacy alias)' })
  answerEn?: string;

  @ApiPropertyOptional({ example: 'مراقبه و تمرین‌های ذهن‌آگاهی.', description: 'Farsi answer text (legacy alias)' })
  answerFa?: string;
}

export class QuestionIconResponseDto {
  @ApiProperty({
    example: 'IMAGE',
    description: 'Icon asset type (e.g. IMAGE, SVG)',
  })
  type: string;

  @ApiProperty({
    example: 'https://cdn.example.com/icons/self-care.png',
    description: 'Full public URL of the question icon',
  })
  url: string;

  @ApiProperty({
    example: 'Self care',
    description: 'Alt text for the icon (empty string if not set)',
  })
  alt: string;
}

export class QuestionResponseDto {
  @ApiProperty({ example: 1, description: 'Question ID' })
  id: number;

  @ApiProperty({ example: 'PREFERENCES', description: 'Question type/category' })
  type: string;

  @ApiProperty({
    example: 'SINGLE',
    description: 'Answer selection type: SINGLE or MULTI',
    enum: ['SINGLE', 'MULTI'],
  })
  answerType: string;

  @ApiProperty({ example: 'How do you practice self-care?', description: 'Localized or default question text' })
  name: string;

  @ApiPropertyOptional({ example: 'How do you practice self-care?', description: 'English question text' })
  enName?: string;

  @ApiPropertyOptional({ example: 'چگونه از خود مراقبت می‌کنید؟', description: 'Farsi question text' })
  faName?: string;

  @ApiPropertyOptional({
    type: QuestionIconResponseDto,
    description: 'Question icon object containing type, url, and alt (empty string if alt not set)',
    nullable: true,
  })
  icon?: QuestionIconResponseDto | null;

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

  @ApiPropertyOptional({ example: 'PREFERENCES', description: 'Question type filter applied' })
  type?: string;

  @ApiPropertyOptional({ example: 'en', description: 'Language filter applied' })
  language?: string;
}
