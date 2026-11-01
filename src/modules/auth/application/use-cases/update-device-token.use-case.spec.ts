import { NotFoundException } from '@nestjs/common';
import { UpdateDeviceTokenUseCase } from './update-device-token.use-case';

describe('UpdateDeviceTokenUseCase', () => {
  let useCase: UpdateDeviceTokenUseCase;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      userSession: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    useCase = new UpdateDeviceTokenUseCase(mockPrisma);
  });

  it('should throw NotFoundException if user is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      useCase.execute(999, { token: 'new_token' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should update existing session identified by sessionId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 10 });
    mockPrisma.userSession.findFirst.mockResolvedValue({
      id: 5,
      userId: 10,
      fcmToken: 'old_token',
      deviceInfo: 'Old Phone',
    });
    mockPrisma.userSession.update.mockResolvedValue({
      id: 5,
      userId: 10,
      fcmToken: 'new_token',
      deviceInfo: 'New Phone',
    });

    const result = await useCase.execute(
      10,
      { token: 'new_token', deviceInfo: 'New Phone' },
      5,
    );

    expect(mockPrisma.userSession.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { fcmToken: 'new_token', deviceInfo: 'New Phone' },
    });
    expect(result).toEqual({
      userId: 10,
      token: 'new_token',
      deviceInfo: 'New Phone',
    });
  });

  it('should update latest user session when sessionId is not provided', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 10 });
    mockPrisma.userSession.findFirst.mockResolvedValue({
      id: 8,
      userId: 10,
      fcmToken: 'prev_token',
      deviceInfo: 'Pixel 8',
    });
    mockPrisma.userSession.update.mockResolvedValue({
      id: 8,
      userId: 10,
      fcmToken: 'updated_token',
      deviceInfo: 'Pixel 8',
    });

    const result = await useCase.execute(10, { token: 'updated_token' });

    expect(mockPrisma.userSession.update).toHaveBeenCalledWith({
      where: { id: 8 },
      data: { fcmToken: 'updated_token' },
    });
    expect(result).toEqual({
      userId: 10,
      token: 'updated_token',
      deviceInfo: 'Pixel 8',
    });
  });

  it('should create a new session if user has no existing session', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 10 });
    mockPrisma.userSession.findFirst.mockResolvedValue(null);
    mockPrisma.userSession.create.mockResolvedValue({
      id: 1,
      userId: 10,
      fcmToken: 'brand_new_token',
      deviceInfo: 'iPhone 16',
    });

    const result = await useCase.execute(10, {
      token: 'brand_new_token',
      deviceInfo: 'iPhone 16',
    });

    expect(mockPrisma.userSession.create).toHaveBeenCalled();
    expect(result).toEqual({
      userId: 10,
      token: 'brand_new_token',
      deviceInfo: 'iPhone 16',
    });
  });
});
