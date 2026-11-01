import { Test, TestingModule } from '@nestjs/testing';
import { DeleteGalleryImageUseCase } from './delete-gallery-image.use-case';
import {
  IUserRepository,
  USER_REPOSITORY,
} from '../../domain/repositories/user.repository.interface';
import { NotFoundException } from '@nestjs/common';

describe('DeleteGalleryImageUseCase', () => {
  let useCase: DeleteGalleryImageUseCase;
  let mockUserRepository: Partial<IUserRepository>;

  beforeEach(async () => {
    mockUserRepository = {
      deleteGalleryItem: jest.fn().mockResolvedValue({
        userId: 1,
        galleryId: 10,
        deleted: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteGalleryImageUseCase,
        {
          provide: USER_REPOSITORY,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    useCase = module.get<DeleteGalleryImageUseCase>(DeleteGalleryImageUseCase);
  });

  it('should be defined', () => {
    expect(useCase).toBeDefined();
  });

  it('should call userRepository.deleteGalleryItem and return result', async () => {
    const result = await useCase.execute(1, 10);

    expect(mockUserRepository.deleteGalleryItem).toHaveBeenCalledWith(1, 10);
    expect(result).toEqual({
      userId: 1,
      galleryId: 10,
      deleted: true,
    });
  });

  it('should propagate NotFoundException if gallery item is not found', async () => {
    (mockUserRepository.deleteGalleryItem as jest.Mock).mockRejectedValue(
      new NotFoundException('Gallery image with ID 999 not found'),
    );

    await expect(useCase.execute(1, 999)).rejects.toThrow(NotFoundException);
  });
});
