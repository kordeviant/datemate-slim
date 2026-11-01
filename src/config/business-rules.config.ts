export interface BusinessRulesConfig {
  pagination: {
    defaultLimit: number;
    maxLimit: number;
    minLimit: number;
  };
  roles: {
    defaultUserRole: string;
    allRoles: string[];
    adminRoles: string[];
    moderatorRoles: string[];
  };
  matching: {
    dailyFreeSwipeLimit: number;
    vipUnlimitedSwipes: boolean;
    minAge: number;
    maxAge: number;
    defaultMaxDistanceKm: number;
    maxDistanceKm: number;
  };
  verification: {
    requireSelfieForMatching: boolean;
    autoApproveSelfie: boolean;
  };
}

export const businessRulesConfig = (): { businessRules: BusinessRulesConfig } => ({
  businessRules: {
    pagination: {
      defaultLimit: parseInt(process.env.PAGINATION_DEFAULT_LIMIT || '20', 10),
      maxLimit: parseInt(process.env.PAGINATION_MAX_LIMIT || '100', 10),
      minLimit: 1,
    },
    roles: {
      defaultUserRole: 'USER',
      allRoles: ['USER', 'ADMIN', 'MODERATOR', 'VIP'],
      adminRoles: ['ADMIN', 'SUPER_ADMIN'],
      moderatorRoles: ['ADMIN', 'MODERATOR'],
    },
    matching: {
      dailyFreeSwipeLimit: parseInt(process.env.MATCHING_DAILY_FREE_SWIPE_LIMIT || '100', 10),
      vipUnlimitedSwipes: true,
      minAge: parseInt(process.env.MATCHING_MIN_AGE || '18', 10),
      maxAge: parseInt(process.env.MATCHING_MAX_AGE || '100', 10),
      defaultMaxDistanceKm: parseInt(process.env.MATCHING_DEFAULT_MAX_DISTANCE_KM || '100', 10),
      maxDistanceKm: parseInt(process.env.MATCHING_MAX_DISTANCE_KM || '500', 10),
    },
    verification: {
      requireSelfieForMatching: process.env.REQUIRE_SELFIE_FOR_MATCHING === 'true',
      autoApproveSelfie: process.env.AUTO_APPROVE_SELFIE === 'true',
    },
  },
});
