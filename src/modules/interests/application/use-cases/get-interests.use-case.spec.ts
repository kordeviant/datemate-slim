import { Logger } from '@nestjs/common';
import { GetInterestsUseCase } from './get-interests.use-case';
import { IInterestRepository } from '../../domain/repositories/interest.repository.interface';
import { InterestCategoryEntity } from '../../domain/interest.entity';

describe('GetInterestsUseCase', () => {
  let useCase: GetInterestsUseCase;
  let mockRepo: jest.Mocked<IInterestRepository>;

  const sampleCategories: InterestCategoryEntity[] = [
    {
      id: 1,
      enName: 'Food',
      faName: 'غذا',
      icon: 'icons/food.svg',
      iconAlt: 'Food',
      interests: [
        { id: 1, categoryId: 1, enName: 'Fast food', faName: 'فست فود', icon: null, iconAlt: null },
        { id: 2, categoryId: 1, enName: 'Healthy food', faName: 'غذای سالم', icon: null, iconAlt: null },
      ],
    },
    {
      id: 2,
      enName: 'Sport',
      faName: 'ورزش',
      icon: 'icons/sport.svg',
      iconAlt: null,
      interests: [
        { id: 3, categoryId: 2, enName: 'Football', faName: 'فوتبال', icon: null, iconAlt: null },
        { id: 4, categoryId: 2, enName: 'Swimming', faName: 'شنا', icon: null, iconAlt: null },
      ],
    },
  ];

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    mockRepo = {
      findAllCategories: jest.fn().mockResolvedValue(sampleCategories),
      findCategoryById: jest.fn(),
      createCategory: jest.fn(),
      countCategories: jest.fn(),
    };

    useCase = new GetInterestsUseCase(mockRepo);
  });

  it('should return all categories with English names when language=en', async () => {
    const result = await useCase.execute('en');

    expect(mockRepo.findAllCategories).toHaveBeenCalled();
    expect(result.language).toBe('en');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].en).toBe('Food');
    expect(result[0].fa).toBe('غذا');
    expect(result[0].name).toBe('Food');
    expect(result[0].Interest).toHaveLength(2);
    expect(result[0].Interest[0].en).toBe('Fast food');
    expect(result[0].Interest[0].fa).toBe('فست فود');
    expect(result[1].en).toBe('Sport');
  });

  it('should return all categories with Farsi names when language=fa', async () => {
    const result = await useCase.execute('fa');

    expect(result.language).toBe('fa');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('غذا');
    expect(result[0].Interest[0].name).toBe('فست فود');
  });

  it('should return all categories with bilingual fields when language is not specified', async () => {
    const result = await useCase.execute();

    expect(result).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.language).toBeUndefined();
    expect(result[0].id).toBe(1);
    expect(result[0].en).toBe('Food');
    expect(result[0].fa).toBe('غذا');
    expect(result[0].enName).toBe('Food');
    expect(result[0].faName).toBe('غذا');
    expect(result[0].Interest[0].en).toBe('Fast food');
    expect(result[0].Interest[0].fa).toBe('فست فود');
  });

  it('should return single category when id is specified', async () => {
    mockRepo.findCategoryById.mockResolvedValue(sampleCategories[0]);

    const result = await useCase.execute(undefined, 1);

    expect(mockRepo.findCategoryById).toHaveBeenCalledWith(1);
    expect(result.id).toBe(1);
    expect(result.en).toBe('Food');
    expect(result.fa).toBe('غذا');
    expect(result.Interest).toHaveLength(2);
  });


  it('should throw NotFoundException when category by id does not exist', async () => {
    mockRepo.findCategoryById.mockResolvedValue(null);

    await expect(useCase.execute(undefined, 999)).rejects.toThrow(
      'Interest category with ID 999 not found',
    );
  });

  it('should handle empty categories list', async () => {
    mockRepo.findAllCategories.mockResolvedValue([]);

    const result = await useCase.execute('en');

    expect(result.categories).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should resolve category icon object using MediaUrlResolverService', async () => {
    const mockResolver: any = {
      resolveUrl: jest.fn().mockReturnValue('http://localhost:3000/assets/icons/food.svg'),
    };
    const useCaseWithResolver = new GetInterestsUseCase(mockRepo, mockResolver);

    const result = await useCaseWithResolver.execute();

    expect(mockResolver.resolveUrl).toHaveBeenCalledWith('icons/food.svg');
    expect(result.categories[0].icon).toEqual({
      type: 'IMAGE',
      url: 'http://localhost:3000/assets/icons/food.svg',
      alt: 'Food',
    });
  });

  it('should return icon: null when category has no icon', async () => {
    const noIconCategories: InterestCategoryEntity[] = [
      {
        ...sampleCategories[0],
        icon: null,
      },
    ];
    mockRepo.findAllCategories.mockResolvedValue(noIconCategories);

    const result = await useCase.execute();

    expect(result.categories[0].icon).toBeNull();
  });

  it('should return empty alt when iconAlt is null', async () => {
    const mockResolver: any = {
      resolveUrl: jest.fn().mockReturnValue('http://localhost:3000/assets/icons/sport.svg'),
    };
    const useCaseWithResolver = new GetInterestsUseCase(mockRepo, mockResolver);

    const result = await useCaseWithResolver.execute();

    // Sport category has iconAlt: null
    expect(result.categories[1].icon).toEqual({
      type: 'IMAGE',
      url: 'http://localhost:3000/assets/icons/sport.svg',
      alt: '',
    });
  });

  it('should normalize language to lowercase', async () => {
    const result = await useCase.execute('EN');

    expect(result.language).toBe('en');
    expect(result.categories[0].name).toBe('Food');
  });
});
