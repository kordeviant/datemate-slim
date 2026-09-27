import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuestionAnswerResponseDto {
  @ApiProperty({ example: 1, description: 'Answer ID' })
  id: number;

  @ApiProperty({ example: 'Meditation and mindfulness practices.', description: 'Answer text' })
  answer: string;
}

export class QuestionResponseDto {
  @ApiProperty({ example: 1, description: 'Question ID' })
  id: number;

  @ApiProperty({ example: 'PERSONALITY', description: 'Question type/category' })
  type: string;

  @ApiProperty({ example: 'How do you take care of yourself?', description: 'Question text' })
  name: string;

  @ApiProperty({ type: [QuestionAnswerResponseDto], description: 'Answer options' })
  answers: QuestionAnswerResponseDto[];
}

export class QuestionListResponseDto {
  @ApiProperty({ type: [QuestionResponseDto], description: 'List of questions' })
  questions: QuestionResponseDto[];

  @ApiPropertyOptional({ example: 'PERSONALITY', description: 'Question type filter applied' })
  type?: string;

  @ApiPropertyOptional({ example: 'en', description: 'Language filter applied' })
  language?: string;
}
