import { Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import {
  INTEREST_REPOSITORY,
  IInterestRepository,
} from '../../domain/repositories/interest.repository.interface';
import { InterestCategoryEntity, InterestEntity } from '../../domain/interest.entity';
import {
  InterestCategoryResponseDto,
  InterestItemResponseDto,
  InterestListResponseDto,
} from '../dtos/interest-response.dto';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';

@Injectable()
export class GetInterestsUseCase {
  private readonly logger = new Logger(GetInterestsUseCase.name);

  constructor(
    @Inject(INTEREST_REPOSITORY)
    private readonly interestRepo: IInterestRepository,
    @Optional() private readonly mediaUrlResolver?: MediaUrlResolverService,
  ) {}

  /**
   * Returns all interest categories with their interests, optionally filtered by language.
   * If id is provided, returns the single category matching the ID.
   */
  async execute(
    language?: string,
    id?: number,
  ): Promise<any> {
    const normalizedLang = language?.toLowerCase().trim();

    // If ID is provided, query single category by ID
    if (id !== undefined && id !== null && !isNaN(Number(id))) {
      const numericId = Number(id);
      const category = await this.interestRepo.findCategoryById(numericId);
      if (!category) {
        throw new NotFoundException(`Interest category with ID ${numericId} not found`);
      }

      const mapped = this.mapCategory(category, normalizedLang);
      // this.logger.log(`[Get Interests] Found category by ID #${numericId}`);

      return mapped;
    }

    // Otherwise fetch all categories
    const categories = await this.interestRepo.findAllCategories();
    const result: any = categories.map((c) =>
      this.mapCategory(c, normalizedLang),
    );

    result.total = result.length;
    result.categories = [...result];
    result.language = normalizedLang;

    this.logger.log(
      `[Get Interests] Found ${result.length} categories (lang=${normalizedLang ?? 'all'})`,
    );

    return result;
  }



  private mapCategory(
    c: InterestCategoryEntity,
    lang?: string,
  ): InterestCategoryResponseDto {
    const isFa = lang === 'fa';
    const primaryName = isFa ? c.faName : c.enName;

    const categoryIcon = this.resolveIcon(c.icon, c.iconAlt);

    const childInterests = (c.interests || []).map((i) =>
      this.mapInterest(i, lang),
    );

    return {
      id: c.id,
      en: c.enName,
      fa: c.faName,
      name: primaryName,
      enName: c.enName,
      faName: c.faName,
      icon: categoryIcon,
      Interest: childInterests,
      interests: childInterests,
    };
  }

  private mapInterest(
    i: InterestEntity,
    lang?: string,
  ): InterestItemResponseDto {
    const isFa = lang === 'fa';
    const primaryName = isFa ? i.faName : i.enName;

    return {
      id: i.id,
      en: i.enName,
      fa: i.faName,
      categoryId: i.categoryId,
      name: primaryName,
      enName: i.enName,
      faName: i.faName,
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

