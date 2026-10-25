import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { GetProfileUseCase } from './get-profile.use-case';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';

describe('GetProfileUseCase', () => {
  let useCase: GetProfileUseCase;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
      question: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      userQuestionAnswer: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetProfileUseCase,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    useCase = module.get<GetProfileUseCase>(GetProfileUseCase);
  });

  it('should throw UnauthorizedException if user is not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(999)).rejects.toThrow(UnauthorizedException);
    await expect(useCase.execute(999)).rejects.toThrow('User account not found');
  });

  it('should return Android-matching profile with defaults and profileCompleted: false when profile records do not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'newuser@example.com',
      language: 'EN',
      profileValidated: false,
      profile: null,
      demographic: null,
      preferences: null,
      interests: [],
    });

    const res = await useCase.execute(1);

    expect(res).toEqual({
      id: 1,
      email: 'newuser@example.com',
      language: 'EN',
      lat: null,
      lon: null,
      profileValidated: false,
      isPremium: false,
      Profile: {
        fullName: null,
        username: null,
        phoneNumber: null,
        bio: null,
        languages: null,
        avatar: '',
        profilePicture: null,
        profilePictureId: null,
        profileCompleted: false,
        isPremium: false,
        Demographic: {
          birthDate: null,
          gender: null,
          height: null,
          degree: null,
          profession: null,
          relationStatus: null,
          City: null,
        },
        RelationType: null,
        Answers: {},
        LikedActivities: {},
      },
      gallery: [],
    });
  });


  it('should return birthDate as YYYY-MM-DD string, uppercase gender, and City with name/state/country', async () => {
    const birthDate = new Date('2000-01-15');

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      language: 'FA',
      profileValidated: true,
      profile: {
        fullName: 'Ali Ahmadi',
        username: 'ali123',
        avatarUrl: '/uploads/avatars/ali.webp',
        selfieUrl: '/uploads/selfies/ali.webp',
        phoneNumber: '+989123456789',
        bio: 'Hello world',
        languages: ['fa'],
        latitude: 35.6892,
        longitude: 51.389,
      },
      demographic: {
        birthDate,
        gender: 'MALE',
        height: 180,
        degree: 'BACHELOR_DEGREE',
        job: 'Developer',
        relationStatus: 'SINGLE',
        cityId: 5,
        city: {
          name: 'Tehran',
          state: {
            name: 'Tehran Province',
            country: {
              name: 'Iran',
            },
          },
        },
      },
      preferences: {
        relation: 'LONG',
      },
      interests: [
        {
          interest: {
            nameEn: 'Photography',
          },
        },
      ],
    });

    const res = await useCase.execute(1);

    expect(res.Profile.fullName).toBe('Ali Ahmadi');
    expect(res.Profile.Demographic.birthDate).toBe('2000-01-15');
    expect(res.Profile.Demographic.gender).toBe('MALE');
    expect(res.language).toBe('FA');
    expect(res.lat).toBe(35.6892);
    expect(res.lon).toBe(51.389);
    expect(res.Profile.Demographic.City).toMatchObject({
      id: 5,
      name: 'Tehran',
      state: 'Tehran Province',
      country: 'Iran',
    });
    expect(res.Profile.profileCompleted).toBe(true);
    expect(res.profileValidated).toBe(true);
    expect(typeof res.profileValidated).toBe('boolean');
    expect(res.isPremium).toBe(false);
    expect(res.Profile.isPremium).toBe(false);
    expect(res.Profile.username).toBe('ali123');
    expect(res.email).toBe('user@example.com');
  });

  it('should return isPremium: true when user is marked as premium in database', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'premium@example.com',
      language: 'EN',
      profileValidated: true,
      isPremium: true,
      profile: null,
      demographic: null,
      preferences: null,
      interests: [],
    });

    const res = await useCase.execute(1);
    expect(res.isPremium).toBe(true);
    expect(res.Profile.isPremium).toBe(true);
    expect(res.profileValidated).toBe(true);
    expect(typeof res.profileValidated).toBe('boolean');
  });

  it('should return profileValidated as boolean false when not set in database', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'unvalidated@example.com',
      language: 'EN',
      profileValidated: undefined,
      isPremium: false,
      profile: null,
      demographic: null,
      preferences: null,
      interests: [],
    });

    const res = await useCase.execute(1);
    expect(res.profileValidated).toBe(false);
    expect(typeof res.profileValidated).toBe('boolean');
  });

  it('should return profileCompleted: false if basic profile is incomplete (missing avatar)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      language: 'EN',
      profileValidated: false,
      profile: {
        fullName: 'John Doe',
        username: 'john_doe',
        avatarUrl: '', // missing avatar
        selfieUrl: null,
        languages: ['en'],
      },
      demographic: {
        birthDate: new Date('1995-05-15'),
        gender: 'MALE',
        height: 175,
        degree: 'MASTER_DEGREE',
        job: 'Designer',
        relationStatus: 'SINGLE',
        cityId: 10,
      },
      preferences: {
        relation: 'FUN',
      },
    });

    const res = await useCase.execute(1);

    expect(res.Profile.profileCompleted).toBe(false);
  });

  it('should return profileCompleted: true when selfie is missing but other required steps are completed', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      language: 'EN',
      profileValidated: false,
      profile: {
        fullName: 'John Doe',
        username: 'john_doe',
        avatarUrl: '/uploads/avatars/john.webp',
        selfieUrl: null, // missing optional selfie
        languages: ['en'],
      },
      demographic: {
        birthDate: new Date('1995-05-15'),
        gender: 'MALE',
        height: 175,
        degree: 'MASTER_DEGREE',
        job: 'Designer',
        relationStatus: 'SINGLE',
        cityId: 10,
      },
      preferences: {
        relation: 'FUN',
      },
      questionAnswers: [],
    });

    mockPrisma.question.count.mockResolvedValue(0);

    const res = await useCase.execute(1);

    expect(res.Profile.profileCompleted).toBe(true);
  });

  it('should return profileCompleted: false if demographics are incomplete', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      language: 'EN',
      profileValidated: false,
      profile: {
        fullName: 'John Doe',
        username: 'john_doe',
        avatarUrl: '/uploads/avatars/john.webp',
        selfieUrl: '/uploads/selfies/john.webp',
        languages: ['en'],
      },
      demographic: {
        birthDate: new Date('1995-05-15'),
        gender: 'MALE',
        height: null, // missing height
        degree: 'MASTER_DEGREE',
        job: 'Designer',
        relationStatus: 'SINGLE',
      },
      preferences: {
        relation: 'FUN',
      },
    });

    const res = await useCase.execute(1);

    expect(res.Profile.profileCompleted).toBe(false);
  });

  it('should return profileCompleted: false if preferences are missing', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      language: 'EN',
      profileValidated: false,
      profile: {
        fullName: 'John Doe',
        username: 'john_doe',
        avatarUrl: '/uploads/avatars/john.webp',
        selfieUrl: '/uploads/selfies/john.webp',
        languages: ['en'],
      },
      demographic: {
        birthDate: new Date('1995-05-15'),
        gender: 'MALE',
        height: 175,
        degree: 'MASTER_DEGREE',
        job: 'Designer',
        relationStatus: 'SINGLE',
      },
      preferences: null, // missing preferences
    });

    const res = await useCase.execute(1);

    expect(res.Profile.profileCompleted).toBe(false);
  });

  it('should return profileCompleted: false if questions are not all answered', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      language: 'EN',
      profileValidated: false,
      profile: {
        fullName: 'John Doe',
        username: 'john_doe',
        avatarUrl: '/uploads/avatars/john.webp',
        selfieUrl: '/uploads/selfies/john.webp',
        languages: ['en'],
      },
      demographic: {
        birthDate: new Date('1995-05-15'),
        gender: 'MALE',
        height: 175,
        degree: 'MASTER_DEGREE',
        job: 'Designer',
        relationStatus: 'SINGLE',
      },
      preferences: {
        relation: 'FUN',
      },
    });

    mockPrisma.question.count.mockResolvedValue(5);
    mockPrisma.userQuestionAnswer.count.mockResolvedValue(3); // only answered 3 of 5

    const res = await useCase.execute(1);

    expect(res.Profile.profileCompleted).toBe(false);
  });

  it('should ignore PREFERENCES and INTERESTS question types when checking profileCompleted', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      language: 'EN',
      profileValidated: false,
      profile: {
        fullName: 'John Doe',
        username: 'john_doe',
        avatarUrl: '/uploads/avatars/john.webp',
        languages: ['en'],
      },
      demographic: {
        birthDate: new Date('1995-05-15'),
        gender: 'MALE',
        height: 175,
        degree: 'MASTER_DEGREE',
        job: 'Designer',
        relationStatus: 'SINGLE',
      },
      preferences: {
        relation: 'FUN',
      },
      questionAnswers: [
        {
          questionAnswerId: 1,
          questionAnswer: {
            id: 1,
            questionId: 10,
            question: { id: 10, type: 'PERSONALITY' },
          },
        },
        {
          questionAnswerId: 2,
          questionAnswer: {
            id: 2,
            questionId: 20,
            question: { id: 20, type: 'PERSONALITY' },
          },
        },
      ],
    });

    // 2 mandatory questions in DB (non-preferences, non-interests)
    mockPrisma.question.count.mockResolvedValue(2);

    const res = await useCase.execute(1);
    expect(res.Profile.profileCompleted).toBe(true);
  });

  it('should not count PREFERENCES or INTERESTS question answers towards required questions', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      language: 'EN',
      profileValidated: false,
      profile: {
        fullName: 'John Doe',
        username: 'john_doe',
        avatarUrl: '/uploads/avatars/john.webp',
        languages: ['en'],
      },
      demographic: {
        birthDate: new Date('1995-05-15'),
        gender: 'MALE',
        height: 175,
        degree: 'MASTER_DEGREE',
        job: 'Designer',
        relationStatus: 'SINGLE',
      },
      preferences: {
        relation: 'FUN',
      },
      questionAnswers: [
        {
          questionAnswerId: 1,
          questionAnswer: {
            id: 1,
            questionId: 10,
            question: { id: 10, type: 'PREFERENCES' },
          },
        },
        {
          questionAnswerId: 2,
          questionAnswer: {
            id: 2,
            questionId: 20,
            question: { id: 20, type: 'INTERESTS' },
          },
        },
      ],
    });

    // 2 mandatory personality questions exist, but user only answered PREFERENCES & INTERESTS
    mockPrisma.question.count.mockResolvedValue(2);

    const res = await useCase.execute(1);
    expect(res.Profile.profileCompleted).toBe(false);
  });

  it('should map user question answers as { [questionId]: answerId } starting from 0', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      language: 'EN',
      profileValidated: true,
      profile: null,
      demographic: null,
      preferences: null,
      questionAnswers: [
        {
          questionAnswerId: 10,
          questionAnswer: {
            id: 10,
            questionId: 2,
            answerEn: 'Opt 2',
            answerFa: 'گزینه ۲',
          },
        },
      ],
    });

    mockPrisma.question.findMany.mockResolvedValue([
      {
        id: 2,
        answers: [
          { id: 9, questionId: 2 },
          { id: 10, questionId: 2 },
        ],
      },
    ]);

    const res = await useCase.execute(1);

    expect(res.Profile.Answers).toEqual({ '2': 1 });
    expect((res.Profile as any).answersList).toBeUndefined();
    expect((res.Profile as any).answerIds).toBeUndefined();
  });

  it('should format LikedActivities as key-value map by category ID like questions', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      language: 'EN',
      profileValidated: true,
      profile: null,
      demographic: null,
      preferences: null,
      interests: [
        { interestId: 1, interest: { id: 1, categoryId: 1 } },
        { interestId: 2, interest: { id: 2, categoryId: 1 } },
        { interestId: 72, interest: { id: 72, categoryId: 9 } },
      ],
      questionAnswers: [],
    });

    const res = await useCase.execute(1);

    expect(res.Profile.LikedActivities).toEqual({
      '1': [1, 2],
      '9': 72,
    });
    expect((res.Profile as any).interest).toBeUndefined();
    expect((res.Profile as any).interests).toBeUndefined();
  });

  it('should resolve city details from GeoLookupService when DB city relation is null', async () => {
    const mockGeoLookup = {
      getCityById: jest.fn().mockResolvedValue({
        id: 135129,
        name: 'Tehran',
        state: 'Tehran',
        country: 'Iran',
      }),
    };

    const customUseCase = new GetProfileUseCase(mockPrisma, undefined, mockGeoLookup as any);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      language: 'FA',
      profileValidated: true,
      profile: {
        fullName: 'Parsa',
        username: 'parsa1',
      },
      demographic: {
        birthDate: new Date('2000-01-01'),
        gender: 'MALE',
        cityId: 135129,
        city: null, // city is not in DB
      },
      preferences: null,
      interests: [],
      questionAnswers: [],
    });

    const res = await customUseCase.execute(1);

    expect(mockGeoLookup.getCityById).toHaveBeenCalledWith(135129);
    expect(res.Profile.Demographic.City).toMatchObject({
      id: 135129,
      name: 'Tehran',
      state: 'Tehran',
      country: 'Iran',
    });
  });
});
