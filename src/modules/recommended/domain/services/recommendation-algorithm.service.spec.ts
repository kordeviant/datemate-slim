import { RecommendationAlgorithmService } from './recommendation-algorithm.service';
import {
  CandidatePoolItem,
  UserRecommendationProfile,
} from '../repositories/recommended.repository.interface';

describe('RecommendationAlgorithmService', () => {
  let service: RecommendationAlgorithmService;

  const mockCurrentUser: UserRecommendationProfile = {
    id: 1,
    gender: 'MALE',
    birthDate: new Date('1998-05-15'), // age ~ 28
    cityId: 10,
    cityName: 'Tehran',
    relationPreference: 'LONG',
    answerIds: [101, 102, 103],
    interestIds: [1, 2, 3],
    interestNames: ['Music', 'Art', 'Coffee'],
    bannedUntil: null,
  };

  beforeEach(() => {
    service = new RecommendationAlgorithmService();
  });

  describe('calculateQuestionScore', () => {
    it('returns baseline 15 when current user has not answered questions', () => {
      expect(service.calculateQuestionScore([], [101, 102])).toBe(15);
    });

    it('returns proportional score based on overlapping answers', () => {
      // 1 out of 3 matches -> 1/3 * 35 = 11.66 -> 12
      expect(service.calculateQuestionScore([101, 102, 103], [101])).toBe(12);
      // 3 out of 3 matches -> 35
      expect(
        service.calculateQuestionScore([101, 102, 103], [101, 102, 103]),
      ).toBe(35);
      // 0 out of 3 matches -> 0
      expect(service.calculateQuestionScore([101, 102, 103], [999])).toBe(0);
    });
  });

  describe('calculateInterestScore', () => {
    it('returns baseline 10 when current user has no interests', () => {
      expect(service.calculateInterestScore([], [1, 2])).toBe(10);
    });

    it('returns proportional score based on overlapping interests', () => {
      // 2 out of 3 matches -> 2/3 * 25 = 16.66 -> 17
      expect(service.calculateInterestScore([1, 2, 3], [1, 2])).toBe(17);
      // 3 out of 3 matches -> 25
      expect(service.calculateInterestScore([1, 2, 3], [1, 2, 3])).toBe(25);
    });
  });

  describe('calculateCityScore', () => {
    it('returns 20 when cities match, 0 otherwise', () => {
      expect(service.calculateCityScore(10, 10)).toBe(20);
      expect(service.calculateCityScore(10, 20)).toBe(0);
      expect(service.calculateCityScore(10, null)).toBe(0);
      expect(service.calculateCityScore(null, null)).toBe(0);
    });
  });

  describe('calculateRelationScore', () => {
    it('returns 10 when relation goals match, 0 otherwise', () => {
      expect(service.calculateRelationScore('LONG', 'LONG')).toBe(10);
      expect(service.calculateRelationScore('LONG', 'FUN')).toBe(0);
      expect(service.calculateRelationScore(null, 'LONG')).toBe(0);
    });
  });

  describe('calculateAgeScore', () => {
    it('returns baseline 5 when either age is null', () => {
      expect(service.calculateAgeScore(null, 25)).toBe(5);
      expect(service.calculateAgeScore(28, null)).toBe(5);
    });

    it('evaluates age proximity brackets', () => {
      expect(service.calculateAgeScore(28, 29)).toBe(10); // diff <= 3
      expect(service.calculateAgeScore(28, 33)).toBe(6);  // diff <= 6 (5)
      expect(service.calculateAgeScore(28, 37)).toBe(3);  // diff <= 10 (9)
      expect(service.calculateAgeScore(28, 45)).toBe(0);  // diff > 10 (17)
    });
  });

  describe('rankCandidates', () => {
    it('filters out candidates without photo or unvalidated profile', () => {
      const candidateNoPhoto: CandidatePoolItem = {
        id: 2,
        fullName: 'No Photo',
        username: 'nophoto',
        gender: 'FEMALE',
        birthDate: new Date('1998-05-15'),
        bio: null,
        avatarUrl: null,
        profilePictureUrl: null,
        profileValidated: true,
        cityId: 10,
        cityName: 'Tehran',
        relationPreference: 'LONG',
        isOnline: true,
        lastSeenAt: new Date(),
        gallery: [],
        interestNames: [],
        interestIds: [],
        answerIds: [],
      };

      const candidateUnvalidated: CandidatePoolItem = {
        id: 3,
        fullName: 'Unvalidated',
        username: 'unvalidated',
        gender: 'FEMALE',
        birthDate: new Date('1998-05-15'),
        bio: null,
        avatarUrl: 'https://cdn.example.com/photo.webp',
        profilePictureUrl: null,
        profileValidated: false,
        cityId: 10,
        cityName: 'Tehran',
        relationPreference: 'LONG',
        isOnline: true,
        lastSeenAt: new Date(),
        gallery: [],
        interestNames: [],
        interestIds: [],
        answerIds: [],
      };

      const validCandidate: CandidatePoolItem = {
        id: 4,
        fullName: 'Valid User',
        username: 'valid',
        gender: 'FEMALE',
        birthDate: new Date('1998-05-15'),
        bio: null,
        avatarUrl: 'https://cdn.example.com/valid.webp',
        profilePictureUrl: null,
        profileValidated: true,
        cityId: 10,
        cityName: 'Tehran',
        relationPreference: 'LONG',
        isOnline: true,
        lastSeenAt: new Date(),
        gallery: [],
        interestNames: [],
        interestIds: [],
        answerIds: [],
      };

      const result = service.rankCandidates(
        mockCurrentUser,
        [candidateNoPhoto, candidateUnvalidated, validCandidate],
        [],
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(4);
    });

    it('prioritizes unswiped candidates over swiped candidates and ranks by compatibilityScore', () => {
      const swipedHighMatch: CandidatePoolItem = {
        id: 10,
        fullName: 'Swiped High',
        username: 'swiped_high',
        gender: 'FEMALE',
        birthDate: new Date('1998-05-15'),
        bio: null,
        avatarUrl: 'https://cdn.example.com/high.webp',
        profilePictureUrl: null,
        profileValidated: true,
        cityId: 10,
        cityName: 'Tehran',
        relationPreference: 'LONG',
        isOnline: true,
        lastSeenAt: new Date(),
        gallery: [],
        interestNames: ['Music', 'Art', 'Coffee'],
        interestIds: [1, 2, 3],
        answerIds: [101, 102, 103],
      };

      const unswipedLowMatch: CandidatePoolItem = {
        id: 20,
        fullName: 'Unswiped Low',
        username: 'unswiped_low',
        gender: 'FEMALE',
        birthDate: new Date('1980-01-01'),
        bio: null,
        avatarUrl: 'https://cdn.example.com/low.webp',
        profilePictureUrl: null,
        profileValidated: true,
        cityId: 99,
        cityName: 'Shiraz',
        relationPreference: 'FUN',
        isOnline: false,
        lastSeenAt: null,
        gallery: [],
        interestNames: [],
        interestIds: [99],
        answerIds: [999],
      };

      const result = service.rankCandidates(
        mockCurrentUser,
        [swipedHighMatch, unswipedLowMatch],
        [10], // user 10 is swiped
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(20); // unswiped first
      expect(result[1].id).toBe(10); // swiped second
    });
  });
});
