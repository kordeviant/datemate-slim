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
        questionAnswers: {
          include: {
            questionAnswer: {
              include: {
                question: true,
              },
            },
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

    // Profile is complete when all required onboarding steps are completed:
    // - Basic profile: fullName, username, avatarUrl, languages (non-empty)
    //   Note: selfie is an optional verification photo and not required for completion.
    // - Demographics: birthDate, gender, height, degree, job, relationStatus
    // - Preferences: relation (kind of relationship)
    // - Questions: answered all questions if questions exist in DB
    const hasBasicProfile = !!(
      cleanFullName &&
      cleanUsername &&
      avatarUrl &&
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

    const answeredQuestionIds = new Set(
      user.questionAnswers?.map((uqa) => uqa.questionAnswer.questionId) || [],
    );
    const questionsCount =
      typeof (this.prisma as any).question?.count === 'function'
        ? await this.prisma.question.count()
        : 0;
    let hasAnsweredAllQuestions = true;
    if (questionsCount > 0) {
      hasAnsweredAllQuestions = answeredQuestionIds.size >= questionsCount;
    }

    const profileCompleted =
      hasBasicProfile &&
      hasDemographics &&
      hasPreferences &&
      hasAnsweredAllQuestions;

    const cleanLanguage = user.language ? user.language.toLowerCase() : 'en';

    const answersList = (user.questionAnswers || []).map((uqa) => ({
      id: uqa.questionAnswer.id,
      questionId: uqa.questionAnswer.questionId,
      answer:
        cleanLanguage === 'fa'
          ? uqa.questionAnswer.answerFa
          : uqa.questionAnswer.answerEn,
      faAnswer: uqa.questionAnswer.answerFa,
      answerEn: uqa.questionAnswer.answerEn,
      answerFa: uqa.questionAnswer.answerFa,
    }));
    const answerIds = (user.questionAnswers || []).map(
      (uqa) => uqa.questionAnswer.id,
    );

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
        firstName: cleanFullName,
        fullName: cleanFullName,
        username: cleanUsername,
        phoneNumber: cleanPhoneNumber,
        bio: cleanBio,
        languages: cleanLanguages,
        avatar: avatarUrl,
        // selfie url: this will not use still, only client should send
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
        Answers: answersList,
        answerIds,
      },
    };
  }
}
