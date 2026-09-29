import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  INTEREST_REPOSITORY,
  IInterestRepository,
} from '../../domain/repositories/interest.repository.interface';
import { CreateInterestCategoryDto } from '../dtos/create-interest.dto';
import { InterestCategoryEntity } from '../../domain/interest.entity';
import { InterestCategoryResponseDto } from '../dtos/interest-response.dto';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';

@Injectable()
export class CreateInterestUseCase {
  private readonly logger = new Logger(CreateInterestUseCase.name);

  constructor(
    @Inject(INTEREST_REPOSITORY)
    private readonly interestRepo: IInterestRepository,
    @Optional() private readonly mediaUrlResolver?: MediaUrlResolverService,
  ) {}

  /**
   * Creates a new interest category with its child interests.
   * Each category has bilingual names and optional icons.
   */
  async execute(dto: CreateInterestCategoryDto): Promise<InterestCategoryResponseDto> {
    const rawInterests = dto.Interest || dto.interests;
    if (!rawInterests || rawInterests.length === 0) {
      throw new BadRequestException('At least one interest is required within the category');
    }

    const enName = (dto.en || dto.enName)?.trim();
    const faName = (dto.fa || dto.faName)?.trim();
    if (!enName || !faName) {
      throw new BadRequestException(
        'Category must have both English (en/enName) and Farsi (fa/faName) text',
      );
    }

    // Validate all interests have both languages
    for (const interest of rawInterests) {
      const en = (interest.en || interest.enName)?.trim();
      const fa = (interest.fa || interest.faName)?.trim();
      if (!en || !fa) {
        throw new BadRequestException(
          'Each interest must have both English (en/enName) and Farsi (fa/faName) text',
        );
      }
    }

    const category = await this.interestRepo.createCategory({
      enName,
      faName,
      icon: dto.icon,
      iconAlt: dto.iconAlt || dto.alt,
      interests: rawInterests.map((i) => ({
        enName: (i.en || i.enName)!.trim(),
        faName: (i.fa || i.faName)!.trim(),
        icon: i.icon,
        iconAlt: i.iconAlt || i.alt,
      })),
    });

    this.logger.log(
      `[Create Interest] Created category #${category.id} "${category.enName}" with ${category.interests.length} interests`,
    );

    return this.mapCategory(category);
  }

  private mapCategory(c: InterestCategoryEntity): InterestCategoryResponseDto {
    const categoryIcon = this.resolveIcon(c.icon, c.iconAlt);

    const childInterests = (c.interests || []).map((i) => {
      return {
        id: i.id,
        en: i.enName,
        fa: i.faName,
        categoryId: i.categoryId,
        name: i.enName,
        enName: i.enName,
        faName: i.faName,
      };
    });

    return {
      id: c.id,
      en: c.enName,
      fa: c.faName,
      name: c.enName,
      enName: c.enName,
      faName: c.faName,
      icon: categoryIcon,
      Interest: childInterests,
      interests: childInterests,
    };
  }

  private resolveIcon(
    rawIcon?: string | null,
    rawAlt?: string | null,
  ): { type: string; url: string; alt: string } | null {
    if (!rawIcon) return null;

    const resolvedUrl = this.mediaUrlResolver
      ? this.mediaUrlResolver.resolveUrl(rawIcon)
      : rawIcon;

    if (!resolvedUrl) return null;

    return {
      type: 'IMAGE',
      url: resolvedUrl,
      alt: rawAlt ?? '',
    };
  }
}

