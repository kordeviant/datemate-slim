import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { CreateProfileUseCase } from './create-profile.use-case';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { AvatarProcessorService } from '../services/avatar-processor.service';

describe('CreateProfileUseCase', () => {
  let useCase: CreateProfileUseCase;
  let mockPrisma: any;
  let mockAvatarProcessor: any;

  beforeEach(async () => {
    mockPrisma = {
      profile: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
      demographic: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      city: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    mockAvatarProcessor = {
      processAndSaveAvatar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateProfileUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AvatarProcessorService, useValue: mockAvatarProcessor },
      ],
    }).compile();

    useCase = module.get<CreateProfileUseCase>(CreateProfileUseCase);
  });

  const validDto = {
    firstName: 'John',
    username: 'john_doe',
    birthDate: '1998-11-25',
    gender: 'Male',
    phoneNumber: '+1234567890',
    cityId: 10,
    latitude: 35.6892,
    longitude: 51.389,
  };

  const mockAvatarFile: any = {
    buffer: Buffer.from('fake_image_buffer'),
  };

  it('should throw BadRequestException if avatar file is missing', async () => {
    await expect(useCase.execute(1, validDto, undefined)).rejects.toThrow(
      'Profile picture is required',
    );
  });

  it('should throw BadRequestException if username is invalid', async () => {
    await expect(
      useCase.execute(1, { ...validDto, username: '123456' }, mockAvatarFile),
    ).rejects.toThrow('cannot contain only numbers');
  });

  it('should throw ConflictException if username is taken by another user', async () => {
    mockPrisma.profile.findFirst.mockResolvedValue({
      id: 99,
      userId: 2, // different user
      username: 'john_doe',
    });

    await expect(
      useCase.execute(1, validDto, mockAvatarFile),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw BadRequestException if date of birth indicates age < 18', async () => {
    mockPrisma.profile.findFirst.mockResolvedValue(null);

    await expect(
      useCase.execute(
        1,
        { ...validDto, birthDate: '2015-05-10' },
        mockAvatarFile,
      ),
    ).rejects.toThrow('at least 18 years old');
  });

  it('should reject modification of birthDate if user already set it previously', async () => {
    mockPrisma.profile.findFirst.mockResolvedValue(null);
    mockPrisma.demographic.findUnique.mockResolvedValue({
      userId: 1,
      birthDate: new Date('1990-01-01'),
    });

    await expect(
      useCase.execute(1, validDto, mockAvatarFile),
    ).rejects.toThrow('Date of birth cannot be changed after initial setup');
  });

  it('should successfully create profile and return privacy-safe response with calculated age', async () => {
    mockPrisma.profile.findFirst.mockResolvedValue(null);
    mockPrisma.demographic.findUnique.mockResolvedValue(null);
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: '/uploads/avatars/avatar_1_12345.webp',
      filePath: '/path/to/avatar_1_12345.webp',
      width: 1080,
      height: 1080,
      format: 'webp',
      sizeBytes: 200000,
    });

    const result = await useCase.execute(1, validDto, mockAvatarFile);

    expect(mockAvatarProcessor.processAndSaveAvatar).toHaveBeenCalledWith(
      mockAvatarFile.buffer,
      1,
    );
    expect(mockPrisma.profile.upsert).toHaveBeenCalled();
    expect(mockPrisma.demographic.upsert).toHaveBeenCalled();

    expect(result).toMatchObject({
      userId: 1,
      firstName: 'John',
      username: 'john_doe',
      avatarUrl: '/uploads/avatars/avatar_1_12345.webp',
      gender: 'MALE',
      profileCompleted: true,
    });
    expect(result.age).toBeGreaterThanOrEqual(18);
    expect((result as any).birthDate).toBeUndefined(); // Exact DOB is kept private!
  });
});
