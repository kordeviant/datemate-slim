import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CreateQuestionAnswerDto } from './create-question.dto';

export class UpdateQuestionDto {
  @ApiPropertyOptional({
    example: 'PREFERENCES',
    description:
      'Question type/category (e.g. PREFERENCES, PERSONALITY, or any custom type)',
  })
  @IsOptional()
  @IsString({ message: 'type must be a string' })
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().toUpperCase().replace(/[-\s.]+/g, '_')
      : value,
  )
  type?: string;

  @ApiPropertyOptional({
    example: 'SINGLE',
    description: 'Answer selection type: SINGLE or MULTI',
    enum: ['SINGLE', 'MULTI'],
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase().trim() : value,
  )
  @IsEnum(['SINGLE', 'MULTI'], {
    message: 'answerType must be either SINGLE or MULTI',
  })
  answerType?: string;

  @ApiPropertyOptional({
    example: 'How do you practice self-care?',
    description: 'Question text in English',
  })
  @IsOptional()
  @IsString()
  enName?: string;

  @ApiPropertyOptional({
    example: 'چگونه از خود مراقبت می‌کنید؟',
    description: 'Question text in Farsi',
  })
  @IsOptional()
  @IsString()
  faName?: string;

  @ApiPropertyOptional({
    example: 'icons/drink.png',
    description:
      'Icon asset relative path or filename (or uploaded directly via icon file)',
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
    type: [CreateQuestionAnswerDto],
    description: 'Updated answer options for the question',
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
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionAnswerDto)
  answers?: CreateQuestionAnswerDto[];
}
