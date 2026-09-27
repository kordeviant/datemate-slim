import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { ProfileResponseDto } from '../dtos/profile-response.dto';
import { AvatarProcessorService } from '../services/avatar-processor.service';
import { calculateAge, validateDateOfBirth } from '../validators/dob.validator';
import { validateUsername } from '../validators/username.validator';
import {
  normalizeEducation,
  normalizeLanguages,
  normalizeRelationshipStatus,
  normalizeRelationType,
} from '../validators/profile-attributes.validator';
import { EducationStatus, Gender, Language, RelationshipStatus, RelationType } from '@prisma/client';

@Injectable()
export class UpdateProfileUseCase {
  private readonly logger = new Logger(UpdateProfileUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly avatarProcessor: AvatarProcessorService,
  ) {}

  async execute(
    userId: number,
    dto: UpdateProfileDto,
    avatarFile?: Express.Multer.File,
    selfieFile?: Express.Multer.File,
  ): Promise<ProfileResponseDto> {
    // 1. Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException('User account not found');
    }

    // 2. Fetch existing records for incremental / step-by-step update
    const existingProfile = await this.prisma.profile.findUnique({
      where: { userId },
    });
    const existingDemographic = await this.prisma.demographic.findUnique({
      where: { userId },
    });
    const existingPreferences = await this.prisma.preferences.findUnique({
      where: { userId },
    });

    // 3. Process avatar if uploaded or provided as string URL
    let avatarUrl = existingProfile?.avatarUrl || '';
    if (avatarFile && avatarFile.buffer) {
      const processedAvatar = await this.avatarProcessor.processAndSaveAvatar(
        avatarFile.buffer,
        userId,
      );
      avatarUrl = processedAvatar.relativeUrl;
    } else {
      const initialProfileNested = dto.Profile ?? (dto as any)?.profile;
      const initialDataObj =
        dto.data && typeof dto.data === 'object'
          ? dto.data
          : typeof dto.data === 'string'
            ? (() => {
                try {
                  return JSON.parse(dto.data);
                } catch {
                  return {};
                }
              })()
            : {};
      const candidateAvatar =
        initialProfileNested?.avatar ??
        dto.avatar ??
        initialDataObj?.avatar;
      if (typeof candidateAvatar === 'string' && candidateAvatar.trim().length > 0) {
        avatarUrl = candidateAvatar.trim();
      }
    }

    // 4. Process selfie if uploaded
    let selfieUrl: string | null = existingProfile?.selfieUrl || null;
    if (selfieFile && selfieFile.buffer) {
      const processedSelfie = await this.avatarProcessor.processAndSaveSelfie(
        selfieFile.buffer,
        userId,
      );
      selfieUrl = processedSelfie.relativeUrl;
    }

    // Extract fields from the new Android-matching DTO schema, flat fallbacks, and data payload
    const profileNested = dto.Profile ?? (dto as any)?.profile;
    const demographic =
      profileNested?.Demographic ??
      (profileNested as any)?.demographic ??
      dto.Demographic ??
      (dto as any)?.demographic;
    const preferences =
      profileNested?.Preferences ??
      (profileNested as any)?.preferences ??
      dto.Preferences ??
      (dto as any)?.preferences;
    const dataObj =
      dto.data && typeof dto.data === 'object'
        ? dto.data
        : typeof dto.data === 'string'
          ? (() => {
              try {
                return JSON.parse(dto.data);
              } catch {
                return {};
              }
            })()
          : {};

    const candidateFullNameInput =
      profileNested?.fullName !== undefined
        ? profileNested.fullName
        : (profileNested as any)?.firstName !== undefined
          ? (profileNested as any)?.firstName
          : dto.fullName !== undefined
            ? dto.fullName
            : (dto as any)?.firstName !== undefined
              ? (dto as any).firstName
              : dataObj?.fullName !== undefined
                ? dataObj.fullName
                : dataObj?.firstName;

    const candidateUsernameInput =
      profileNested?.username ??
      dto.username ??
      dataObj?.username;

    const candidateBirthDateInput =
      demographic?.birthDate ??
      (demographic as any)?.date ??
      (demographic as any)?.birth_date ??
      (demographic as any)?.birthdate ??
      dto.birthDate ??
      (dto as any)?.date ??
      (dto as any)?.birth_date ??
      dataObj?.birthDate ??
      dataObj?.date ??
      dataObj?.birth_date ??
      dataObj?.Demographic?.birthDate ??
      dataObj?.Demographic?.date ??
      dataObj?.Demographic?.birth_date ??
      dataObj?.demographic?.birthDate ??
      dataObj?.demographic?.date ??
      dataObj?.demographic?.birth_date;

    const candidateGenderInput =
      demographic?.gender ??
      dto.gender ??
      dataObj?.gender ??
      dataObj?.Demographic?.gender ??
      dataObj?.demographic?.gender;

    const candidatePhoneNumberInput =
      profileNested?.phoneNumber ??
      dto.phoneNumber ??
      dataObj?.phoneNumber;

    const candidateLanguageInput =
      dto.language ??
      dataObj?.language;

    const candidateBioInput =
      profileNested?.bio ??
      dto.bio ??
      dataObj?.bio;

    const candidateHeightInput =
      demographic?.height ??
      dto.height ??
      dataObj?.height ??
      dataObj?.Demographic?.height ??
      dataObj?.demographic?.height;

    const candidateEducationInput =
      demographic?.degree ??
      (demographic as any)?.education ??
      dto.degree ??
      (dto as any)?.education ??
      dataObj?.degree ??
      dataObj?.education ??
      dataObj?.Demographic?.degree ??
      dataObj?.demographic?.degree;

    const candidateJobInput =
      demographic?.profession ??
      (demographic as any)?.job ??
      dto.profession ??
      (dto as any)?.job ??
      dataObj?.profession ??
      dataObj?.job ??
      dataObj?.Demographic?.profession ??
      dataObj?.demographic?.profession;

    const candidateLanguagesInput =
      profileNested?.languages ??
      dto.languages ??
      dataObj?.languages;

    const candidateCityIdInput =
      demographic?.City?.id ??
      demographic?.cityId ??
      (demographic as any)?.city?.id ??
      dto.cityId ??
      dto.City?.id ??
      (dto as any)?.city?.id ??
      dataObj?.cityId ??
      dataObj?.City?.id ??
      dataObj?.Demographic?.City?.id ??
      dataObj?.Demographic?.cityId ??
      dataObj?.demographic?.City?.id ??
      dataObj?.demographic?.cityId;

    const candidateLatitudeInput =
      dto.lat ??
      (dto as any)?.latitude ??
      dataObj?.lat ??
      dataObj?.latitude;

    const candidateLongitudeInput =
      dto.lon ??
      (dto as any)?.longitude ??
      dataObj?.lon ??
      dataObj?.longitude;

    const candidateRelationStatusInput =
      demographic?.relationStatus ??
      dto.relationStatus ??
      dataObj?.relationStatus ??
      dataObj?.Demographic?.relationStatus ??
      dataObj?.demographic?.relationStatus;

    const candidateRelationInput =
      preferences?.relation ??
      dto.relation ??
      dataObj?.relation ??
      dataObj?.Preferences?.relation ??
      dataObj?.preferences?.relation;

    let candidateFavoritesInput: any[] | undefined =
      (profileNested as any)?.LikedActivities ??
      (profileNested as any)?.favorites ??
      dto.LikedActivities ??
      dto.favorites ??
      dataObj?.LikedActivities ??
      dataObj?.favorites;

    // Extract interest IDs from LikedActivities category structure
    if (
      candidateFavoritesInput &&
      Array.isArray(candidateFavoritesInput) &&
      candidateFavoritesInput.length > 0 &&
      typeof candidateFavoritesInput[0] === 'object' &&
      candidateFavoritesInput[0] !== null
    ) {
      const hasInterestArrays = candidateFavoritesInput.some(
        (cat: any) => Array.isArray(cat?.Interest),
      );
      if (hasInterestArrays) {
        const extractedIds: number[] = [];
        for (const cat of candidateFavoritesInput) {
          if (Array.isArray(cat?.Interest)) {
            for (const item of cat.Interest) {
              if (typeof item?.id === 'number') extractedIds.push(item.id);
            }
          } else if (typeof cat?.id === 'number') {
            extractedIds.push(cat.id);
          }
        }
        candidateFavoritesInput = extractedIds;
      }
    }

    // 5. Full name (preserves existing if omitted or sent as empty string)
    let cleanFullName: string =
      existingProfile?.fullName || (existingProfile as any)?.firstName || '';
    if (
      candidateFullNameInput !== undefined &&
      candidateFullNameInput !== null &&
      typeof candidateFullNameInput === 'string' &&
      candidateFullNameInput.trim().length > 0
    ) {
      cleanFullName = candidateFullNameInput.trim();
    }

    // 6. Validate and update username if provided (preserves existing if omitted or sent as empty string)
    let cleanUsername: string | null = existingProfile?.username || null;
    if (
      candidateUsernameInput !== undefined &&
      candidateUsernameInput !== null &&
      typeof candidateUsernameInput === 'string' &&
      candidateUsernameInput.trim().length > 0
    ) {
      const candidateUsername = candidateUsernameInput.toLowerCase().trim();
      const usernameValidation = validateUsername(candidateUsername);
      if (!usernameValidation.isValid) {
        throw new BadRequestException(usernameValidation.error);
      }
      const existingWithUsername = await this.prisma.profile.findFirst({
        where: {
          username: {
            equals: candidateUsername,
            mode: 'insensitive',
          },
        },
      });

      if (existingWithUsername && existingWithUsername.userId !== userId) {
        throw new ConflictException(
          `Username "${candidateUsernameInput}" is already taken. Please choose another one.`,
        );
      }
      cleanUsername = candidateUsername;
    }

    // 7. Validate Date of Birth
    let parsedBirthDate: Date | null = existingDemographic?.birthDate || null;
    let calculatedUserAge: number | null = parsedBirthDate
      ? calculateAge(parsedBirthDate)
      : null;

    if (
      candidateBirthDateInput !== undefined &&
      candidateBirthDateInput !== null &&
      candidateBirthDateInput !== ''
    ) {
      const dobValidation = validateDateOfBirth(candidateBirthDateInput);
      if (!dobValidation.isValid || !dobValidation.parsedDate) {
        throw new BadRequestException(dobValidation.error);
      }
      parsedBirthDate = dobValidation.parsedDate;
      calculatedUserAge = dobValidation.age ?? calculateAge(parsedBirthDate);
    }

    // 8. City ID
    let validCityId: number | null = existingDemographic?.cityId ?? null;
    if (candidateCityIdInput !== undefined && candidateCityIdInput !== null) {
      const cityNum = Number(candidateCityIdInput);
      if (!isNaN(cityNum) && cityNum > 0) {
        const cityExists = await this.prisma.city.findUnique({
          where: { id: cityNum },
          select: { id: true },
        });
        if (cityExists) {
          validCityId = cityExists.id;
        } else {
          this.logger.warn(
            `[Profile Update] City ID ${cityNum} does not exist in 'cities' table. Storing demographic without foreign key link until seeded.`,
          );
          validCityId = null;
        }
      } else {
        validCityId = null;
      }
    }

    // 9. Gender
    let normalizedGender: Gender | null = existingDemographic?.gender ?? null;
    if (candidateGenderInput) {
      normalizedGender =
        candidateGenderInput.toUpperCase() === 'FEMALE' ? Gender.FEMALE : Gender.MALE;
    }

    // 10. Language (app language)
    let cleanLanguage: string =
      (user.language ? user.language.toLowerCase() : 'en');
    let dbUserLanguage: Language | null = null;

    if (candidateLanguageInput !== undefined && candidateLanguageInput !== null) {
      if (typeof candidateLanguageInput !== 'string' || !candidateLanguageInput.trim()) {
        throw new BadRequestException('Language cannot be empty');
      }
      const candidateLang = candidateLanguageInput.toLowerCase().trim();
      if (candidateLang !== 'en' && candidateLang !== 'fa') {
        throw new BadRequestException(
          'Language must be either EN (English) or FA (Farsi)',
        );
      }
      cleanLanguage = candidateLang;
      dbUserLanguage = candidateLang.toUpperCase() as Language;
    }

    // 11. Spoken Languages list
    let cleanLanguages: string[] | null =
      (existingProfile?.languages as string[]) || null;
    const passedLanguages = normalizeLanguages(candidateLanguagesInput);
    if (passedLanguages !== undefined) {
      cleanLanguages = passedLanguages;
    }

    // 12. Height
    let cleanHeight: number | null = existingDemographic?.height ?? null;
    if (candidateHeightInput !== undefined && candidateHeightInput !== null) {
      const h = Number(candidateHeightInput);
      if (!isNaN(h) && h > 0) {
        cleanHeight = h;
      }
    }

    // 13. Education
    let cleanDegree: EducationStatus | null =
      existingDemographic?.degree ?? null;
    if (candidateEducationInput !== undefined && candidateEducationInput !== null) {
      const normalized = normalizeEducation(candidateEducationInput);
      if (normalized) {
        cleanDegree = normalized;
      }
    }

    // 14. Job
    let cleanJob: string | null =
      existingDemographic?.job ?? null;
    if (candidateJobInput !== undefined && candidateJobInput !== null) {
      cleanJob = candidateJobInput.trim() ? candidateJobInput.trim() : null;
    }

    // 15. Relation Status
    let cleanRelationStatus: RelationshipStatus | null =
      existingDemographic?.relationStatus ?? null;
    if (candidateRelationStatusInput !== undefined && candidateRelationStatusInput !== null) {
      const normalized = normalizeRelationshipStatus(candidateRelationStatusInput);
      if (normalized) {
        cleanRelationStatus = normalized;
      }
    }

    // 16. Kind of Relationship (Preferences)
    let cleanRelationType: RelationType | null =
      existingPreferences?.relation ?? null;
    if (candidateRelationInput !== undefined && candidateRelationInput !== null) {
      const normalized = normalizeRelationType(candidateRelationInput);
      if (normalized) {
        cleanRelationType = normalized;
      }
    }

    // 17. Favorites list
    let cleanFavorites: any[] = [];
    if (
      candidateFavoritesInput !== undefined &&
      candidateFavoritesInput !== null &&
      Array.isArray(candidateFavoritesInput)
    ) {
      cleanFavorites = candidateFavoritesInput;
    } else {
      const existingInterests = await (this.prisma as any).userInterest?.findMany?.({
        where: { userId },
        include: { interest: true },
      });
      if (existingInterests && Array.isArray(existingInterests)) {
        cleanFavorites = existingInterests.map(
          (ui: any) => ui.interest?.nameEn || ui.interestId,
        );
      }
    }

    // 18. Phone number, bio, coordinates
    let cleanPhoneNumber: string | null = existingProfile?.phoneNumber ?? null;
    if (
      candidatePhoneNumberInput !== undefined &&
      candidatePhoneNumberInput !== null &&
      typeof candidatePhoneNumberInput === 'string' &&
      candidatePhoneNumberInput.trim().length > 0
    ) {
      cleanPhoneNumber = candidatePhoneNumberInput.trim();
    }

    let cleanBio: string | null = existingProfile?.bio ?? null;
    if (
      candidateBioInput !== undefined &&
      candidateBioInput !== null &&
      typeof candidateBioInput === 'string' &&
      candidateBioInput.trim().length > 0
    ) {
      cleanBio = candidateBioInput.trim();
    }

    const cleanLatitude =
      candidateLatitudeInput !== undefined
        ? Number(candidateLatitudeInput)
        : existingProfile
          ? Number(existingProfile.latitude)
          : 0.0;

    const cleanLongitude =
      candidateLongitudeInput !== undefined
        ? Number(candidateLongitudeInput)
        : existingProfile
          ? Number(existingProfile.longitude)
          : 0.0;

    // 19. Database Transaction: atomic updates to Profile, Demographic, Preferences, User
    await this.prisma.$transaction(async (tx) => {
      // 1. Profile upsert
      await tx.profile.upsert({
        where: { userId },
        create: {
          userId,
          fullName: cleanFullName,
          username: cleanUsername,
          phoneNumber: cleanPhoneNumber,
          bio: cleanBio,
          languages: cleanLanguages ? cleanLanguages : [cleanLanguage],
          avatarUrl,
          selfieUrl,
          latitude: cleanLatitude,
          longitude: cleanLongitude,
        } as any,
        update: {
          fullName: cleanFullName,
          username: cleanUsername,
          phoneNumber: cleanPhoneNumber,
          bio: cleanBio,
          languages: cleanLanguages ? cleanLanguages : [cleanLanguage],
          avatarUrl,
          selfieUrl,
          latitude: cleanLatitude,
          longitude: cleanLongitude,
        } as any,
      });

      // 2. Demographic handling
      if (existingDemographic) {
        await tx.demographic.update({
          where: { userId },
          data: {
            ...(parsedBirthDate ? { birthDate: parsedBirthDate } : {}),
            ...(normalizedGender ? { gender: normalizedGender } : {}),
            ...(candidateCityIdInput !== undefined && candidateCityIdInput !== null
              ? { cityId: validCityId }
              : {}),
            ...(cleanHeight !== null ? { height: cleanHeight } : {}),
            ...(cleanDegree ? { degree: cleanDegree } : {}),
            ...(cleanJob !== null ? { job: cleanJob } : {}),
            ...(cleanRelationStatus ? { relationStatus: cleanRelationStatus } : {}),
          },
        });
      } else if (parsedBirthDate && normalizedGender) {
        await tx.demographic.upsert({
          where: { userId },
          create: {
            userId,
            birthDate: parsedBirthDate,
            gender: normalizedGender,
            cityId: validCityId,
            height: cleanHeight,
            degree: cleanDegree,
            job: cleanJob,
            relationStatus: cleanRelationStatus,
          },
          update: {
            gender: normalizedGender,
            birthDate: parsedBirthDate,
            cityId: validCityId,
            ...(cleanHeight !== null ? { height: cleanHeight } : {}),
            ...(cleanDegree ? { degree: cleanDegree } : {}),
            ...(cleanJob !== null ? { job: cleanJob } : {}),
            ...(cleanRelationStatus ? { relationStatus: cleanRelationStatus } : {}),
          },
        });
      }

      // 3. Preferences handling (kind of relationship)
      if (cleanRelationType) {
        await tx.preferences.upsert({
          where: { userId },
          create: {
            userId,
            relation: cleanRelationType,
          },
          update: {
            relation: cleanRelationType,
          },
        });
      }

      // 4. Favorites / Interests handling if provided
      if (
        candidateFavoritesInput !== undefined &&
        candidateFavoritesInput !== null &&
        Array.isArray(candidateFavoritesInput)
      ) {
        if ((tx as any).userInterest) {
          try {
            const numericIds = candidateFavoritesInput.filter(
              (id): id is number => typeof id === 'number',
            );
            if (numericIds.length > 0 && (tx as any).interest) {
              const valid = await (tx as any).interest.findMany({
                where: { id: { in: numericIds } },
                select: { id: true },
              });
              const validIds = valid.map((v: any) => v.id);
              await (tx as any).userInterest.deleteMany({ where: { userId } });
              if (validIds.length > 0) {
                await (tx as any).userInterest.createMany({
                  data: validIds.map((interestId: number) => ({
                    userId,
                    interestId,
                    isLiked: true,
                  })),
                });
              }
            } else if (candidateFavoritesInput.length === 0) {
              await (tx as any).userInterest.deleteMany({ where: { userId } });
            }
          } catch (err) {
            this.logger.warn(`Could not sync favorites to user_interests: ${err}`);
          }
        }
      }

      // 5. User app language update if specified
      if (dbUserLanguage) {
        await tx.user.update({
          where: { id: userId },
          data: {
            language: dbUserLanguage,
          },
        });
      }

      // 6. User question answers if provided in payload
      let rawAnswers =
        dto.Answers ??
        dto.answers ??
        (profileNested as any)?.Answers ??
        (profileNested as any)?.answers ??
        dataObj?.Answers ??
        dataObj?.answers;

      if (typeof rawAnswers === 'string') {
        try {
          rawAnswers = JSON.parse(rawAnswers);
        } catch {
          // ignore parse error
        }
      }

      if (rawAnswers && (tx as any).userQuestionAnswer) {
        try {
          const allDbQuestions = await (tx as any).question.findMany({
            include: { answers: { orderBy: { id: 'asc' } } },
            orderBy: { id: 'asc' },
          });

          const questionMap = new Map<number, any[]>();
          const dbIdToInfo = new Map<number, { questionId: number; answerIndex: number }>();
          for (const q of allDbQuestions) {
            questionMap.set(q.id, q.answers);
            (q.answers || []).forEach((ans: any, idx: number) => {
              dbIdToInfo.set(ans.id, { questionId: q.id, answerIndex: idx });
            });
          }

          const targetAnswerDbIds: number[] = [];
          const questionIdsToUpdate = new Set<number>();

          if (Array.isArray(rawAnswers)) {
            for (const item of rawAnswers) {
              if (typeof item === 'number' && item > 0) {
                if (dbIdToInfo.has(item)) {
                  targetAnswerDbIds.push(item);
                  questionIdsToUpdate.add(dbIdToInfo.get(item)!.questionId);
                }
              } else if (item && typeof item === 'object') {
                const qId = Number(item.questionId ?? item.questionid ?? item.qId);
                const aId = Number(item.answerId ?? item.answerid ?? item.aId ?? item.id);
                if (!isNaN(qId) && !isNaN(aId) && questionMap.has(qId)) {
                  const qAnswers = questionMap.get(qId)!;
                  if (qAnswers[aId]) {
                    targetAnswerDbIds.push(qAnswers[aId].id);
                    questionIdsToUpdate.add(qId);
                  } else if (dbIdToInfo.has(aId)) {
                    targetAnswerDbIds.push(aId);
                    questionIdsToUpdate.add(qId);
                  }
                }
              }
            }
          } else if (typeof rawAnswers === 'object' && rawAnswers !== null) {
            // Key-value map: { "1": 0, "2": [0, 1], ... } (questionid: answerId or array of answerIds for MULTI)
            for (const [qKey, aVal] of Object.entries(rawAnswers)) {
              const qId = Number(qKey);
              if (!isNaN(qId) && questionMap.has(qId)) {
                const qAnswers = questionMap.get(qId)!;
                const indices: number[] = Array.isArray(aVal)
                  ? aVal.map(Number).filter((n) => !isNaN(n))
                  : [Number(aVal)].filter((n) => !isNaN(n));

                for (const aIndex of indices) {
                  if (qAnswers[aIndex]) {
                    targetAnswerDbIds.push(qAnswers[aIndex].id);
                    questionIdsToUpdate.add(qId);
                  } else if (dbIdToInfo.has(aIndex)) {
                    targetAnswerDbIds.push(aIndex);
                    questionIdsToUpdate.add(qId);
                  }
                }
              }
            }
          }

          if (targetAnswerDbIds.length > 0) {
            const uniqueAnswerIds = Array.from(new Set(targetAnswerDbIds));
            // Delete existing answers for the specific questions being answered
            await (tx as any).userQuestionAnswer.deleteMany({
              where: {
                userId,
                questionAnswer: {
                  questionId: { in: Array.from(questionIdsToUpdate) },
                },
              },
            });
            await (tx as any).userQuestionAnswer.createMany({
              data: uniqueAnswerIds.map((questionAnswerId: number) => ({
                userId,
                questionAnswerId,
              })),
              skipDuplicates: true,
            });
          }
        } catch (err) {
          this.logger.warn(`Could not sync question answers: ${err}`);
        }
      }
    });

    // 20. Check profile completion status:
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
      parsedBirthDate &&
      normalizedGender &&
      cleanHeight !== null &&
      cleanHeight !== undefined &&
      cleanDegree &&
      cleanJob &&
      cleanRelationStatus
    );

    const hasPreferences = !!cleanRelationType;

    const questionsCount =
      typeof (this.prisma as any).question?.count === 'function'
        ? await this.prisma.question.count()
        : 0;
    let hasAnsweredAllQuestions = true;
    let userAnswers: any[] = [];
    if (typeof (this.prisma as any).userQuestionAnswer?.findMany === 'function') {
      userAnswers = await (this.prisma as any).userQuestionAnswer.findMany({
        where: { userId },
        include: {
          questionAnswer: {
            include: {
              question: true,
            },
          },
        },
      });
      if (questionsCount > 0) {
        const distinctAnsweredQuestions = new Set(
          userAnswers.map((ua: any) => ua.questionAnswer?.questionId),
        );
        hasAnsweredAllQuestions = distinctAnsweredQuestions.size >= questionsCount;
      }
    }

    const profileCompleted =
      hasBasicProfile &&
      hasDemographics &&
      hasPreferences &&
      hasAnsweredAllQuestions;

    this.logger.log(
      `[Profile Updated] User ${userId} profile updated. Completed status: ${profileCompleted}`,
    );

    const answersMap: Record<string, number | number[]> = {};
    const dbIdToAnswerInfo = new Map<number, { questionId: number; answerIndex: number }>();
    const questionEntityMap = new Map<number, any>();

    if (userAnswers.length > 0) {
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
      for (const uqa of userAnswers) {
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

    let cityName: string | null = null;
    let stateName: string | null = null;
    let countryName: string | null = null;

    if (validCityId) {
      const cityRecord = await this.prisma.city.findUnique({
        where: { id: validCityId },
        include: {
          state: {
            include: {
              country: true,
            },
          },
        },
      });
      if (cityRecord) {
        cityName = cityRecord.name;
        stateName = cityRecord.state?.name ?? null;
        countryName = cityRecord.state?.country?.name ?? null;
      }
    }

    const formattedBirthDate = parsedBirthDate
      ? parsedBirthDate.toISOString().slice(0, 10)
      : null;

    const formattedGender = normalizedGender
      ? normalizedGender.toUpperCase()
      : null;

    const cityObj =
      validCityId !== null
        ? {
            id: validCityId,
            name: cityName,
            state: stateName,
            country: countryName,
          }
        : null;

    return {
      id: userId,
      email: user.email,
      language: cleanLanguage.toUpperCase(),
      lat: cleanLatitude !== undefined ? cleanLatitude : null,
      lon: cleanLongitude !== undefined ? cleanLongitude : null,
      profileValidated: user.profileValidated ?? false,
      Profile: {
        fullName: cleanFullName ? cleanFullName : null,
        username: cleanUsername ? cleanUsername : null,
        phoneNumber: cleanPhoneNumber,
        bio: cleanBio,
        languages: cleanLanguages,
        avatar: avatarUrl,
        // selfie url: this will not use still, only client should send
        profileCompleted,
        Demographic: {
          birthDate: formattedBirthDate,
          gender: formattedGender,
          height: cleanHeight,
          degree: cleanDegree,
          profession: cleanJob,
          relationStatus: cleanRelationStatus,
          City: cityObj,
        },
        Preferences: {
          relation: cleanRelationType,
        },
        Answers: answersMap,
      },
    };
  }
}

export { UpdateProfileUseCase as CreateProfileUseCase };
