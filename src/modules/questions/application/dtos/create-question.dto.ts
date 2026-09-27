import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateQuestionAnswerDto {
  @ApiPropertyOptional({ example: 'Meditation and mindfulness practices.', description: 'Answer text in English' })
  @IsOptional()
  @IsString()
  enAnswer?: string;

  @ApiPropertyOptional({ example: 'مراقبه و تمرین‌های ذهن‌آگاهی.', description: 'Answer text in Farsi' })
  @IsOptional()
  @IsString()
  faAnswer?: string;

  @ApiPropertyOptional({ example: 'Meditation and mindfulness practices.', description: 'Legacy alias' })
  @IsOptional()
  @IsString()
  answerEn?: string;

  @ApiPropertyOptional({ example: 'مراقبه و تمرین‌های ذهن‌آگاهی.', description: 'Legacy alias' })
  @IsOptional()
  @IsString()
  answerFa?: string;
}

export class CreateQuestionDto {
  @ApiProperty({
    example: 'PREFERENCES',
    description: 'Question type/category (e.g. PREFERENCES, PERSONALITY, INTERESTS, LIFESTYLE, VALUES)',
    enum: ['PREFERENCES', 'PERSONALITY', 'INTERESTS', 'LIFESTYLE', 'VALUES'],
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.toUpperCase().trim() : value)
  @IsEnum(['PREFERENCES', 'PERSONALITY', 'INTERESTS', 'LIFESTYLE', 'VALUES'], {
    message: 'Type must be one of: PREFERENCES, PERSONALITY, INTERESTS, LIFESTYLE, VALUES',
  })
  type: string;

  @ApiPropertyOptional({
    example: 'SINGLE',
    description: 'Answer selection type: SINGLE or MULTI',
    enum: ['SINGLE', 'MULTI'],
    default: 'SINGLE',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.toUpperCase().trim() : value)
  @IsEnum(['SINGLE', 'MULTI'], {
    message: 'answerType must be either SINGLE or MULTI',
  })
  answerType?: string;

  @ApiPropertyOptional({ example: 'How do you practice self-care?', description: 'Question text in English' })
  @IsOptional()
  @IsString()
  enName?: string;

  @ApiPropertyOptional({ example: 'چگونه از خود مراقبت می‌کنید؟', description: 'Question text in Farsi' })
  @IsOptional()
  @IsString()
  faName?: string;

  @ApiPropertyOptional({ example: 'How do you practice self-care?', description: 'Legacy alias' })
  @IsOptional()
  @IsString()
  nameEn?: string;

  @ApiPropertyOptional({ example: 'چگونه از خود مراقبت می‌کنید؟', description: 'Legacy alias' })
  @IsOptional()
  @IsString()
  nameFa?: string;

  @ApiProperty({
    type: [CreateQuestionAnswerDto],
    description: 'Answer options for the question (must include both en and fa)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionAnswerDto)
  answers: CreateQuestionAnswerDto[];
}
