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
  @ApiProperty({ example: 'Meditation and mindfulness practices.', description: 'Answer text in English' })
  @IsNotEmpty()
  @IsString()
  answerEn: string;

  @ApiProperty({ example: 'مراقبه و تمرین‌های ذهن‌آگاهی.', description: 'Answer text in Farsi' })
  @IsNotEmpty()
  @IsString()
  answerFa: string;
}

export class CreateQuestionDto {
  @ApiProperty({
    example: 'PERSONALITY',
    description: 'Question type/category (e.g. PERSONALITY, INTERESTS, LIFESTYLE, VALUES)',
    enum: ['PERSONALITY', 'INTERESTS', 'LIFESTYLE', 'VALUES'],
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => typeof value === 'string' ? value.toUpperCase().trim() : value)
  @IsEnum(['PERSONALITY', 'INTERESTS', 'LIFESTYLE', 'VALUES'], {
    message: 'Type must be one of: PERSONALITY, INTERESTS, LIFESTYLE, VALUES',
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

  @ApiProperty({ example: 'How do you take care of yourself?', description: 'Question text in English' })
  @IsNotEmpty()
  @IsString()
  nameEn: string;

  @ApiProperty({ example: 'چگونه از خود مراقبت می‌کنید؟', description: 'Question text in Farsi' })
  @IsNotEmpty()
  @IsString()
  nameFa: string;

  @ApiProperty({
    type: [CreateQuestionAnswerDto],
    description: 'Answer options for the question (must include both en and fa)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionAnswerDto)
  answers: CreateQuestionAnswerDto[];
}
