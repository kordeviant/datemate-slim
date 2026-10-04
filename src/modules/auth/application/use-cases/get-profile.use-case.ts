import { Injectable, Logger, Optional, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { ProfileResponseDto, GalleryItemResponseDto } from '../dtos/profile-response.dto';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';

@Injectable()
export class GetProfileUseCase {
  private readonly logger = new Logger(GetProfileUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly mediaUrlResolver?: MediaUrlResolverService,
  ) { }

  async execute(userId: number): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        gallery: {
          orderBy: { createdAt: 'asc' },
        },
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

    const relationType =
      (profile as any)?.relationType || preferences?.relation || null;
    const hasPreferences = !!relationType;

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

    const answersMap: Record<string, number | number[]> = {};
    const dbIdToAnswerInfo = new Map<number, { questionId: number; answerIndex: number }>();
    const questionEntityMap = new Map<number, any>();

    if (user.questionAnswers && user.questionAnswers.length > 0) {
      const allDbQuestions =
        typeof (this.prisma as any).question?.findMany === 'function'
          ? await this.prisma.question.findMany({
            include: { answers: { orderBy: { id: 'asc' } } },
            orderBy: { id: 'asc' },
          })
          : [];
      for (const q of allDbQuestions) {
        questionEntityMap.set(q.id, q);
        (q.answers || []).forEach((ans: any, idx: number) => {
          dbIdToAnswerInfo.set(ans.id, { questionId: q.id, answerIndex: idx });
        });
      }

      const answersByQId = new Map<number, number[]>();
      for (const uqa of user.questionAnswers) {
        const info = dbIdToAnswerInfo.get(uqa.questionAnswerId);
        if (info) {
          if (!answersByQId.has(info.questionId)) {
            answersByQId.set(info.questionId, []);
          }
          answersByQId.get(info.questionId)!.push(info.answerIndex);
        } else if (uqa.questionAnswer?.questionId) {
          const qId = uqa.questionAnswer.questionId;
          if (!answersByQId.has(qId)) {
            answersByQId.set(qId, []);
          }
          answersByQId.get(qId)!.push(0);
        }
      }

      for (const [qId, indices] of answersByQId.entries()) {
        const qEntity = questionEntityMap.get(qId);
        const sorted = indices.sort((a, b) => a - b);
        if (qEntity?.answerType === 'MULTI' || sorted.length > 1) {
          answersMap[String(qId)] = sorted;
        } else {
          answersMap[String(qId)] = sorted[0];
        }
      }
    }

    this.logger.log(
      `[Profile Retrieved] User ${userId} profile retrieved. Completed status: ${profileCompleted}`,
    );

    const likedActivitiesMap: Record<string, number | number[]> = {};
    if ((user as any).interests && Array.isArray((user as any).interests)) {
      const interestsByCatId = new Map<number, number[]>();
      for (const ui of (user as any).interests) {
        const catId = ui.interest?.categoryId;
        const interestId = ui.interest?.id ?? ui.interestId;
        if (catId !== undefined && catId !== null && interestId !== undefined && interestId !== null) {
          if (!interestsByCatId.has(catId)) {
            interestsByCatId.set(catId, []);
          }
          interestsByCatId.get(catId)!.push(interestId);
        }
      }

      for (const [catId, ids] of interestsByCatId.entries()) {
        const sorted = ids.sort((a, b) => a - b);
        likedActivitiesMap[String(catId)] = sorted.length > 1 ? sorted : sorted[0];
      }
    }

    const userGalleries = (user as any).gallery || [];
    const mappedGallery: GalleryItemResponseDto[] = userGalleries.map((g: any) => ({
      id: g.id,
      url: this.mediaUrlResolver ? this.mediaUrlResolver.resolveUrl(g.imageUrl) : g.imageUrl,
      description: g.description,
      likesCount: g.likesCount || 0,
      isProfilePicture: Boolean(g.isProfilePicture),
      createdAt: g.createdAt
        ? typeof g.createdAt.toISOString === 'function'
          ? g.createdAt.toISOString()
          : String(g.createdAt)
        : undefined,
    }));

    const profilePictureUrl = profile?.profilePictureUrl || null;
    const resolvedProfilePicture = profilePictureUrl
      ? (this.mediaUrlResolver ? this.mediaUrlResolver.resolveUrl(profilePictureUrl) : profilePictureUrl)
      : null;

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
        avatar: this.mediaUrlResolver
          ? this.mediaUrlResolver.resolveUrl(avatarUrl)
          : avatarUrl,
        profilePicture: resolvedProfilePicture,
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
        RelationType: relationType,
        Answers: answersMap,
        LikedActivities: likedActivitiesMap,
      },
      gallery: mappedGallery,
    };
  }
}

