import { Logger } from '@nestjs/common';
import { CreateInterestUseCase } from './create-interest.use-case';
import { IInterestRepository } from '../../domain/repositories/interest.repository.interface';
import { InterestCategoryEntity } from '../../domain/interest.entity';

describe('CreateInterestUseCase', () => {
  let useCase: CreateInterestUseCase;
  let mockRepo: jest.Mocked<IInterestRepository>;

  const createdCategory: InterestCategoryEntity = {
    id: 1,
    enName: 'Food',
    faName: 'غذا',
    icon: 'icons/food.svg',
    iconAlt: 'Food',
    interests: [
      { id: 1, categoryId: 1, enName: 'Fast food', faName: 'فست فود', icon: null, iconAlt: null },
      { id: 2, categoryId: 1, enName: 'Pizza', faName: 'پیتزا', icon: null, iconAlt: null },
    ],
  };

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});

    mockRepo = {
      findAllCategories: jest.fn(),
      findCategoryById: jest.fn(),
      createCategory: jest.fn().mockResolvedValue(createdCategory),
      countCategories: jest.fn(),
    };

    useCase = new CreateInterestUseCase(mockRepo);
  });

  it('should create a category with interests successfully', async () => {
    const result = await useCase.execute({
      enName: 'Food',
      faName: 'غذا',
      icon: 'icons/food.svg',
      iconAlt: 'Food',
      interests: [
        { enName: 'Fast food', faName: 'فست فود' },
        { enName: 'Pizza', faName: 'پیتزا' },
      ],
    });

    expect(mockRepo.createCategory).toHaveBeenCalledWith({
      enName: 'Food',
      faName: 'غذا',
      icon: 'icons/food.svg',
      iconAlt: 'Food',
      interests: [
        { enName: 'Fast food', faName: 'فست فود', icon: undefined, iconAlt: undefined },
        { enName: 'Pizza', faName: 'پیتزا', icon: undefined, iconAlt: undefined },
      ],
    });
    expect(result.id).toBe(1);
    expect(result.en).toBe('Food');
    expect(result.fa).toBe('غذا');
    expect(result.Interest).toHaveLength(2);
  });

  it('should support en, fa, Interest payload format', async () => {
    const result = await useCase.execute({
      en: 'Food',
      fa: 'غذا',
      icon: 'icons/Beach With Umbrella.svg',
      Interest: [
        { en: 'Gaming', fa: 'بازی' },
        { en: 'Camping', fa: 'کمپینگ' },
      ],
    });

    expect(mockRepo.createCategory).toHaveBeenCalledWith({
      enName: 'Food',
      faName: 'غذا',
      icon: 'icons/Beach With Umbrella.svg',
      iconAlt: undefined,
      interests: [
        { enName: 'Gaming', faName: 'بازی', icon: undefined, iconAlt: undefined },
        { enName: 'Camping', faName: 'کمپینگ', icon: undefined, iconAlt: undefined },
      ],
    });
    expect(result.id).toBe(1);
    expect(result.en).toBe('Food');
    expect(result.Interest).toHaveLength(2);
  });

  it('should throw if no interests are provided', async () => {
    await expect(
      useCase.execute({
        enName: 'Food',
        faName: 'غذا',
        interests: [],
      }),
    ).rejects.toThrow('At least one interest is required within the category');
  });

  it('should throw if enName is missing', async () => {
    await expect(
      useCase.execute({
        enName: '',
        faName: 'غذا',
        interests: [{ enName: 'Pizza', faName: 'پیتزا' }],
      }),
    ).rejects.toThrow('Category must have both English (en/enName) and Farsi (fa/faName) text');
  });

  it('should throw if faName is missing', async () => {
    await expect(
      useCase.execute({
        enName: 'Food',
        faName: '',
        interests: [{ enName: 'Pizza', faName: 'پیتزا' }],
      }),
    ).rejects.toThrow('Category must have both English (en/enName) and Farsi (fa/faName) text');
  });

  it('should throw if an interest is missing enName', async () => {
    await expect(
      useCase.execute({
        enName: 'Food',
        faName: 'غذا',
        interests: [{ enName: '', faName: 'پیتزا' }],
      }),
    ).rejects.toThrow('Each interest must have both English (en/enName) and Farsi (fa/faName) text');
  });

  it('should throw if an interest is missing faName', async () => {
    await expect(
      useCase.execute({
        enName: 'Food',
        faName: 'غذا',
        interests: [{ enName: 'Pizza', faName: '' }],
      }),
    ).rejects.toThrow('Each interest must have both English (en/enName) and Farsi (fa/faName) text');
  });


  it('should trim whitespace from names', async () => {
    await useCase.execute({
      enName: '  Food  ',
      faName: '  غذا  ',
      interests: [{ enName: '  Pizza  ', faName: '  پیتزا  ' }],
    });

    expect(mockRepo.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        enName: 'Food',
        faName: 'غذا',
        interests: [
          expect.objectContaining({
            enName: 'Pizza',
            faName: 'پیتزا',
          }),
        ],
      }),
    );
  });
});
