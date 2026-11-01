import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaUserRepository } from './prisma-user.repository';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

describe('PrismaUserRepository - deleteGalleryItem', () => {
  let repository: PrismaUserRepository;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      userGallery: {
        findFirst: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      profile: {
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaUserRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<PrismaUserRepository>(PrismaUserRepository);
  });

  it('should throw NotFoundException if user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(repository.deleteGalleryItem(999, 10)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw NotFoundException if gallery image does not exist for the user', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      profile: { profilePictureUrl: 'gallery/photo1.webp' },
    });
    mockPrisma.userGallery.findFirst.mockResolvedValueOnce(null);

    await expect(repository.deleteGalleryItem(1, 999)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should delete gallery item and fallback profilePicture to next gallery photo when deleted image was active', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      profile: { profilePictureUrl: 'gallery/photo1.webp' },
    });
    mockPrisma.userGallery.findFirst
      .mockResolvedValueOnce({
        id: 1,
        userId: 1,
        imageUrl: 'gallery/photo1.webp',
        isProfilePicture: true,
      })
      .mockResolvedValueOnce({
        id: 2,
        userId: 1,
        imageUrl: 'gallery/photo2.webp',
        isProfilePicture: false,
      });
    mockPrisma.userGallery.delete.mockResolvedValueOnce({});
    mockPrisma.userGallery.update.mockResolvedValueOnce({});
    mockPrisma.profile.update.mockResolvedValueOnce({});

    const result = await repository.deleteGalleryItem(1, 1);

    expect(mockPrisma.userGallery.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(mockPrisma.userGallery.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { isProfilePicture: true },
    });
    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { profilePictureUrl: 'gallery/photo2.webp' },
    });
    expect(result).toEqual({
      userId: 1,
      galleryId: 1,
      deleted: true,
    });
  });

  it('should set profilePictureUrl to null when deleted image was active and no other gallery photos remain', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({
      id: 1,
      profile: { profilePictureUrl: 'gallery/photo1.webp' },
    });
    mockPrisma.userGallery.findFirst
      .mockResolvedValueOnce({
        id: 1,
        userId: 1,
        imageUrl: 'gallery/photo1.webp',
        isProfilePicture: true,
      })
      .mockResolvedValueOnce(null); // No more gallery photos
    mockPrisma.userGallery.delete.mockResolvedValueOnce({});
    mockPrisma.profile.update.mockResolvedValueOnce({});

    const result = await repository.deleteGalleryItem(1, 1);

    expect(mockPrisma.profile.update).toHaveBeenCalledWith({
      where: { userId: 1 },
      data: { profilePictureUrl: null },
    });
    expect(result).toEqual({
      userId: 1,
      galleryId: 1,
      deleted: true,
    });
  });
});
