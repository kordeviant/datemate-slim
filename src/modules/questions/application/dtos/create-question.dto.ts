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
    description: 'Question type/category (e.g. PREFERENCES, PERSONALITY, or any custom type)',
  })
  @IsNotEmpty({ message: 'type is required' })
  @IsString({ message: 'type must be a string' })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase().replace(/[-\s.]+/g, '_')
      : value,
  )
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

  @ApiProperty({ example: 'How do you practice self-care?', description: 'Question text in English' })
  @IsNotEmpty({ message: 'enName is required' })
  @IsString()
  enName: string;

  @ApiProperty({ example: 'چگونه از خود مراقبت می‌کنید؟', description: 'Question text in Farsi' })
  @IsNotEmpty({ message: 'faName is required' })
  @IsString()
  faName: string;

  @ApiPropertyOptional({
    example: 'icons/drink.png',
    description: 'Icon asset relative path or filename',
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    example: 'Self care',
    description: 'Alt text for the icon',
  })
  @IsOptional()
  @IsString()
  iconAlt?: string;

  @ApiPropertyOptional({
    example: 'Self care',
    description: 'Alt text for the icon (alias)',
  })
  @IsOptional()
  @IsString()
  alt?: string;

  @ApiProperty({
    type: [CreateQuestionAnswerDto],
    description: 'Answer options for the question (must include both en and fa)',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionAnswerDto)
  answers: CreateQuestionAnswerDto[];
}
