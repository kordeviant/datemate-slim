import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ProfileResponseDto } from '../dtos/profile-response.dto';

@Injectable()
export class GetProfileUseCase {
  private readonly logger = new Logger(GetProfileUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(userId: number): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        demographic: {
          include: {
            city: {
              include: {
                state: {
                  include: {
                    country: true,
                  },
                },
              },
            },
          },
        },
        preferences: true,
        interests: {
          include: {
            interest: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User account not found');
    }

    const { profile, demographic, preferences } = user;

    const cleanFullName = profile?.fullName || (profile as any)?.firstName || null;
    const cleanUsername = profile?.username || null;
    const avatarUrl = profile?.avatarUrl || '';
    const selfieUrl = profile?.selfieUrl || null;
    const cleanLanguages = (profile?.languages as string[]) || null;
    const cleanBio = profile?.bio || null;
    const cleanPhoneNumber = profile?.phoneNumber || null;
    const cleanLatitude = profile?.latitude !== undefined && profile?.latitude !== null ? Number(profile.latitude) : null;
    const cleanLongitude = profile?.longitude !== undefined && profile?.longitude !== null ? Number(profile.longitude) : null;

    const cleanFavorites =
      (user as any).interests?.map(
        (ui: any) => ui.interest?.nameEn || ui.interestId,
      ) || [];

    const formattedBirthDate = demographic?.birthDate
      ? demographic.birthDate.toISOString().slice(0, 10)
      : null;

    const formattedGender = demographic?.gender
      ? demographic.gender.toUpperCase()
      : null;

    const cityName = demographic?.city?.name ?? null;
    const stateName = demographic?.city?.state?.name ?? null;
    const countryName = demographic?.city?.state?.country?.name ?? null;
    const cityObj =
      demographic?.cityId !== undefined && demographic?.cityId !== null
        ? {
            id: demographic.cityId,
            name: cityName,
            state: stateName,
            country: countryName,
          }
        : null;

    // Profile is only complete when all required onboarding steps are completed:
    // - Basic profile: fullName, username, avatarUrl, selfieUrl, languages (non-empty)
    // - Demographics: birthDate, gender, height, degree, job, relationStatus
    // - Preferences: relation (kind of relationship)
    // - Questions: answered all questions if questions exist in DB
    const hasBasicProfile = !!(
      cleanFullName &&
      cleanUsername &&
      avatarUrl &&
      selfieUrl &&
      cleanLanguages &&
      Array.isArray(cleanLanguages) &&
      cleanLanguages.length > 0
    );

    const hasDemographics = !!(
      demographic?.birthDate &&
      demographic?.gender &&
      demographic?.height !== null &&
      demographic?.height !== undefined &&
      demographic?.degree &&
      demographic?.job &&
      demographic?.relationStatus
    );

    const hasPreferences = !!preferences?.relation;

    let hasAnsweredAllQuestions = true;
    const questionsCount = await this.prisma.question.count();
    if (questionsCount > 0) {
      const answeredCount = await this.prisma.userQuestionAnswer.count({
        where: { userId },
      });
      hasAnsweredAllQuestions = answeredCount >= questionsCount;
    }

    const profileCompleted =
      hasBasicProfile &&
      hasDemographics &&
      hasPreferences &&
      hasAnsweredAllQuestions;

    const cleanLanguage = user.language ? user.language.toLowerCase() : 'en';

    this.logger.log(
      `[Profile Retrieved] User ${userId} profile retrieved. Completed status: ${profileCompleted}`,
    );

    return {
      id: user.id,
      email: user.email,
      language: cleanLanguage.toUpperCase(),
      lat: cleanLatitude,
      lon: cleanLongitude,
      profileValidated: user.profileValidated ?? false,
      Profile: {
        fullName: cleanFullName,
        username: cleanUsername,
        phoneNumber: cleanPhoneNumber,
        bio: cleanBio,
        languages: cleanLanguages,
        avatar: avatarUrl,
        // selfie url: this will not use still, only cline shoululs send
        profileCompleted,
        Demographic: {
          birthDate: formattedBirthDate,
          gender: formattedGender,
          height: demographic?.height ?? null,
          degree: demographic?.degree || null,
          profession: demographic?.job || null,
          relationStatus: demographic?.relationStatus || null,
          City: cityObj,
        },
        Preferences: {
          relation: preferences?.relation || null,
        },
      },
    };
  }
}
