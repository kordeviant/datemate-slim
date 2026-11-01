import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInterestItemDto {
  @ApiPropertyOptional({ example: 'Gaming', description: 'Interest name in English' })
  @IsOptional()
  @IsString()
  en?: string;

  @ApiPropertyOptional({ example: 'بازی', description: 'Interest name in Farsi' })
  @IsOptional()
  @IsString()
  fa?: string;

  @ApiPropertyOptional({ example: 'Gaming', description: 'Interest name in English (alias)' })
  @IsOptional()
  @IsString()
  enName?: string;

  @ApiPropertyOptional({ example: 'بازی', description: 'Interest name in Farsi (alias)' })
  @IsOptional()
  @IsString()
  faName?: string;

  @ApiPropertyOptional({
    example: 'icons/gaming.svg',
    description: 'Icon asset relative path or filename',
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    example: 'Gaming',
    description: 'Alt text for the icon',
  })
  @IsOptional()
  @IsString()
  iconAlt?: string;

  @ApiPropertyOptional({
    example: 'Gaming',
    description: 'Alt text for the icon (alias)',
  })
  @IsOptional()
  @IsString()
  alt?: string;
}

export class CreateInterestCategoryDto {
  @ApiPropertyOptional({ example: 'Food', description: 'Category name in English' })
  @IsOptional()
  @IsString()
  en?: string;

  @ApiPropertyOptional({ example: 'غذا', description: 'Category name in Farsi' })
  @IsOptional()
  @IsString()
  fa?: string;

  @ApiPropertyOptional({ example: 'Food', description: 'Category name in English (alias)' })
  @IsOptional()
  @IsString()
  enName?: string;

  @ApiPropertyOptional({ example: 'غذا', description: 'Category name in Farsi (alias)' })
  @IsOptional()
  @IsString()
  faName?: string;

  @ApiPropertyOptional({
    example: 'icons/Beach With Umbrella.svg',
    description: 'Category icon asset relative path or filename',
  })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({
    example: 'Food',
    description: 'Alt text for the category icon',
  })
  @IsOptional()
  @IsString()
  iconAlt?: string;

  @ApiPropertyOptional({
    example: 'Food',
    description: 'Alt text for the category icon (alias)',
  })
  @IsOptional()
  @IsString()
  alt?: string;

  @ApiPropertyOptional({
    type: [CreateInterestItemDto],
    description: 'Interests within this category',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInterestItemDto)
  Interest?: CreateInterestItemDto[];

  @ApiPropertyOptional({
    type: [CreateInterestItemDto],
    description: 'Interests within this category (alias)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInterestItemDto)
  interests?: CreateInterestItemDto[];
}

