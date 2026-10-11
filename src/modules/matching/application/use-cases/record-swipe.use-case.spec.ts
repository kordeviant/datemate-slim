import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecordSwipeUseCase } from './record-swipe.use-case';
import { IMatchingRepository } from '../../domain/repositories/matching.repository.interface';

describe('RecordSwipeUseCase', () => {
  let useCase: RecordSwipeUseCase;
  let mockMatchingRepository: jest.Mocked<IMatchingRepository>;

  beforeEach(() => {
    mockMatchingRepository = {
      findCandidateProfiles: jest.fn(),
      recordSwipe: jest.fn(),
      getUserDemographicGender: jest.fn(),
      findLikesReceived: jest.fn(),
      findTargetUserStatus: jest.fn(),
    };
    useCase = new RecordSwipeUseCase(mockMatchingRepository);
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

  it('successfully records swipe pass (LEFT)', async () => {
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
  });

  it('successfully records swipe like (RIGHT)', async () => {
    mockMatchingRepository.findTargetUserStatus.mockResolvedValue({
      exists: true,
      isBanned: false,
    });
    mockMatchingRepository.recordSwipe.mockResolvedValue();

    await useCase.execute(1, {
      targetUserId: 2,
      direction: 'RIGHT',
    });

    expect(mockMatchingRepository.recordSwipe).toHaveBeenCalledWith(
      1,
      2,
      'RIGHT',
    );
  });
});
