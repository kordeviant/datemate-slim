import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InterestIconResponseDto {
  @ApiProperty({
    example: 'IMAGE',
    description: 'Icon asset type (e.g. IMAGE, SVG)',
  })
  type: string;

  @ApiProperty({
    example: 'https://cdn.example.com/icons/Beach%20With%20Umbrella.svg',
    description: 'Full public URL of the interest icon',
  })
  url: string;

  @ApiProperty({
    example: '',
    description: 'Alt text for the icon (empty string if not set)',
  })
  alt: string;
}

export class InterestItemResponseDto {
  @ApiProperty({ example: 1, description: 'Interest ID' })
  id: number;

  @ApiProperty({ example: 'Gaming', description: 'English name of interest' })
  en: string;

  @ApiProperty({ example: 'بازی', description: 'Farsi name of interest' })
  fa: string;

  @ApiPropertyOptional({ example: 1, description: 'Parent category ID' })
  categoryId?: number;

  @ApiPropertyOptional({ example: 'Gaming', description: 'Localized interest name' })
  name?: string;

  @ApiPropertyOptional({ example: 'Gaming', description: 'English interest name (alias)' })
  enName?: string;

  @ApiPropertyOptional({ example: 'بازی', description: 'Farsi interest name (alias)' })
  faName?: string;
}

export class InterestCategoryResponseDto {
  @ApiProperty({ example: 1, description: 'Interest category ID' })
  id: number;

  @ApiProperty({ example: 'Food', description: 'English category name' })
  en: string;

  @ApiProperty({ example: 'غذا', description: 'Farsi category name' })
  fa: string;

  @ApiPropertyOptional({
    type: InterestIconResponseDto,
    description: 'Category icon object (null if no icon)',
    nullable: true,
  })
  icon?: InterestIconResponseDto | null;

  @ApiProperty({
    type: [InterestItemResponseDto],
    description: 'List of interests within this category',
  })
  Interest: InterestItemResponseDto[];

  // Aliases for backwards compatibility:
  @ApiPropertyOptional({
    type: [InterestItemResponseDto],
    description: 'List of interests within this category (alias)',
  })
  interests?: InterestItemResponseDto[];

  @ApiPropertyOptional({ example: 'Food', description: 'Localized category name' })
  name?: string;

  @ApiPropertyOptional({ example: 'Food', description: 'English category name (alias)' })
  enName?: string;

  @ApiPropertyOptional({ example: 'غذا', description: 'Farsi category name (alias)' })
  faName?: string;
}


export class InterestListResponseDto {
  @ApiProperty({ example: 3, description: 'Total number of interest categories' })
  total: number;

  @ApiProperty({
    type: [InterestCategoryResponseDto],
    description: 'List of interest categories with their child interests',
  })
  categories: InterestCategoryResponseDto[];

  @ApiPropertyOptional({ example: 'en', description: 'Language filter applied' })
  language?: string;
}

