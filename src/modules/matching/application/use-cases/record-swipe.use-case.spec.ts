import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecordSwipeUseCase } from './record-swipe.use-case';
import { IMatchingRepository } from '../../domain/repositories/matching.repository.interface';
import { IPushNotificationService } from '../../../../infrastructure/notification/push-notification.service.interface';

describe('RecordSwipeUseCase', () => {
  let useCase: RecordSwipeUseCase;
  let mockMatchingRepository: jest.Mocked<IMatchingRepository>;
  let mockPushNotificationService: jest.Mocked<IPushNotificationService>;

  beforeEach(() => {
    mockMatchingRepository = {
      findCandidateProfiles: jest.fn(),
      recordSwipe: jest.fn(),
      getUserDemographicGender: jest.fn(),
      findLikesReceived: jest.fn(),
      findTargetUserStatus: jest.fn(),
      getUserFullName: jest.fn(),
    };
    mockPushNotificationService = {
      sendPush: jest.fn(),
      sendFriendRequestNotification: jest.fn(),
      sendFriendRequestAcceptedNotification: jest.fn(),
      sendLikeUserNotification: jest.fn(),
      sendSelfieAcceptedNotification: jest.fn(),
      sendSelfieRejectedNotification: jest.fn(),
    };
    useCase = new RecordSwipeUseCase(
      mockMatchingRepository,
      mockPushNotificationService,
    );
  });

  it('throws BadRequestException if user attempts to swipe on themselves', async () => {
    await expect(
      useCase.execute(1, { targetUserId: 1, direction: 'RIGHT' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException if target user does not exist', async () => {
    mockMatchingRepository.findTargetUserStatus.mockResolvedValue({
      exists: false,
      isBanned: false,
    });

    await expect(
      useCase.execute(1, { targetUserId: 999, direction: 'RIGHT' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException if target user is banned', async () => {
    mockMatchingRepository.findTargetUserStatus.mockResolvedValue({
      exists: true,
      isBanned: true,
    });

    await expect(
      useCase.execute(1, { targetUserId: 2, direction: 'RIGHT' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('successfully records swipe pass (LEFT) and does NOT dispatch like notification', async () => {
    mockMatchingRepository.findTargetUserStatus.mockResolvedValue({
      exists: true,
      isBanned: false,
    });
    mockMatchingRepository.recordSwipe.mockResolvedValue();

    await useCase.execute(1, {
      targetUserId: 2,
      direction: 'LEFT',
    });

    expect(mockMatchingRepository.recordSwipe).toHaveBeenCalledWith(
      1,
      2,
      'LEFT',
    );
    expect(
      mockPushNotificationService.sendLikeUserNotification,
    ).not.toHaveBeenCalled();
  });

  it('successfully records swipe like (RIGHT) and dispatches like push notification with swiper name', async () => {
    mockMatchingRepository.findTargetUserStatus.mockResolvedValue({
      exists: true,
      isBanned: false,
    });
    mockMatchingRepository.recordSwipe.mockResolvedValue();
    mockMatchingRepository.getUserFullName.mockResolvedValue('Parsa Moloudie');

    await useCase.execute(1, {
      targetUserId: 2,
      direction: 'RIGHT',
    });

    expect(mockMatchingRepository.recordSwipe).toHaveBeenCalledWith(
      1,
      2,
      'RIGHT',
    );
    expect(mockMatchingRepository.getUserFullName).toHaveBeenCalledWith(1);
    expect(
      mockPushNotificationService.sendLikeUserNotification,
    ).toHaveBeenCalledWith({
      recipientUserId: 2,
      likerFullName: 'Parsa Moloudie',
    });
  });

  it('successfully falls back to User if swiper profile has no full name on RIGHT swipe', async () => {
    mockMatchingRepository.findTargetUserStatus.mockResolvedValue({
      exists: true,
      isBanned: false,
    });
    mockMatchingRepository.recordSwipe.mockResolvedValue();
    mockMatchingRepository.getUserFullName.mockResolvedValue(null);

    await useCase.execute(1, {
      targetUserId: 2,
      direction: 'RIGHT',
    });

    expect(
      mockPushNotificationService.sendLikeUserNotification,
    ).toHaveBeenCalledWith({
      recipientUserId: 2,
      likerFullName: 'User',
    });
  });
});
