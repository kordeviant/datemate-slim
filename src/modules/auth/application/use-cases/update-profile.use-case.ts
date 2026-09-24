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

    // 3. Process avatar if uploaded
    let avatarUrl = existingProfile?.avatarUrl || '';
    if (avatarFile && avatarFile.buffer) {
      const processedAvatar = await this.avatarProcessor.processAndSaveAvatar(
        avatarFile.buffer,
        userId,
      );
      avatarUrl = processedAvatar.relativeUrl;
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

    // 5. First name
    let cleanFirstName: string = existingProfile?.firstName || '';
    if (dto.firstName !== undefined && dto.firstName !== null) {
      cleanFirstName = dto.firstName.trim();
    }

    // 6. Validate and update username if provided
    let cleanUsername: string | null = existingProfile?.username || null;
    if (dto.username !== undefined && dto.username !== null) {
      const usernameValidation = validateUsername(dto.username);
      if (!usernameValidation.isValid) {
        throw new BadRequestException(usernameValidation.error);
      }
      const candidateUsername = dto.username.toLowerCase().trim();
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
          `Username "${dto.username}" is already taken. Please choose another one.`,
        );
      }
      cleanUsername = candidateUsername;
    }

    // 7. Validate Date of Birth / Age
    let parsedBirthDate: Date | null = existingDemographic?.birthDate || null;
    let calculatedUserAge: number | null = parsedBirthDate
      ? calculateAge(parsedBirthDate)
      : null;

    if (dto.birthDate) {
      const dobValidation = validateDateOfBirth(dto.birthDate);
      if (!dobValidation.isValid || !dobValidation.parsedDate) {
        throw new BadRequestException(dobValidation.error);
      }
      const newBirthDate = dobValidation.parsedDate;

      // Anti-fraud check: DOB cannot be changed after initial setup without support verification
      if (existingDemographic && existingDemographic.birthDate) {
        const existingDobString = existingDemographic.birthDate
          .toISOString()
          .slice(0, 10);
        const newDobString = newBirthDate.toISOString().slice(0, 10);
        if (existingDobString !== newDobString) {
          throw new BadRequestException(
            'Date of birth cannot be changed after initial setup without support verification.',
          );
        }
      }
      parsedBirthDate = newBirthDate;
      calculatedUserAge = calculateAge(parsedBirthDate);
    } else if (dto.age !== undefined && dto.age !== null) {
      const ageNum = Number(dto.age);
      if (isNaN(ageNum) || ageNum < 18 || ageNum > 80) {
        throw new BadRequestException(
          `Age must be between 18 and 80 years old (provided: ${dto.age}).`,
        );
      }
      const approxYear = new Date().getFullYear() - ageNum;
      const newBirthDate = new Date(Date.UTC(approxYear, 0, 1));

      if (existingDemographic && existingDemographic.birthDate) {
        const existingDobString = existingDemographic.birthDate
          .toISOString()
          .slice(0, 10);
        const newDobString = newBirthDate.toISOString().slice(0, 10);
        if (existingDobString !== newDobString) {
          throw new BadRequestException(
            'Date of birth cannot be changed after initial setup without support verification.',
          );
        }
      }
      parsedBirthDate = newBirthDate;
      calculatedUserAge = ageNum;
    }

    // 8. City ID
    let validCityId: number | null = existingDemographic?.cityId ?? null;
    if (dto.cityId !== undefined && dto.cityId !== null) {
      const cityNum = Number(dto.cityId);
      if (cityNum > 0) {
        const cityExists = await this.prisma.city.findUnique({
          where: { id: cityNum },
          select: { id: true },
        });
        if (cityExists) {
          validCityId = cityExists.id;
        } else {
          this.logger.warn(
            `[Profile Update] City ID ${dto.cityId} does not exist in database. Storing demographic without foreign key link until seeded.`,
          );
          validCityId = null;
        }
      } else {
        validCityId = null;
      }
    }

    // 9. Gender
    let normalizedGender: Gender | null = existingDemographic?.gender ?? null;
    if (dto.gender) {
      normalizedGender =
        dto.gender.toUpperCase() === 'FEMALE' ? Gender.FEMALE : Gender.MALE;
    }

    // 10. Language (app language)
    let cleanLanguage: string =
      (user.language ? user.language.toLowerCase() : 'en');
    let dbUserLanguage: Language | null = null;

    if (dto.language !== undefined && dto.language !== null) {
      if (typeof dto.language !== 'string' || !dto.language.trim()) {
        throw new BadRequestException('Language cannot be empty');
      }
      const candidateLang = dto.language.toLowerCase().trim();
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
    const passedLanguages = normalizeLanguages(dto.languages);
    if (passedLanguages !== undefined) {
      cleanLanguages = passedLanguages;
    }

    // 12. Height
    let cleanHeight: number | null = existingDemographic?.height ?? null;
    if (dto.height !== undefined && dto.height !== null) {
      const h = Number(dto.height);
      if (!isNaN(h) && h > 0) {
        cleanHeight = h;
      }
    }

    // 13. Education / Degree
    let cleanDegree: EducationStatus | null =
      existingDemographic?.degree ?? null;
    const rawEducation = dto.education ?? dto.educations ?? dto.degree;
    if (rawEducation !== undefined && rawEducation !== null) {
      const normalized = normalizeEducation(rawEducation);
      if (normalized) {
        cleanDegree = normalized;
      }
    }

    // 14. Job / Profession
    let cleanProfession: string | null =
      existingDemographic?.profession ?? null;
    const rawJob = dto.job ?? dto.profession;
    if (rawJob !== undefined && rawJob !== null) {
      cleanProfession = rawJob.trim() ? rawJob.trim() : null;
    }

    // 15. Relation Status
    let cleanRelationStatus: RelationshipStatus | null =
      existingDemographic?.relationStatus ?? null;
    const rawRelStatus = dto.relationStatus ?? dto.relation_status;
    if (rawRelStatus !== undefined && rawRelStatus !== null) {
      const normalized = normalizeRelationshipStatus(rawRelStatus);
      if (normalized) {
        cleanRelationStatus = normalized;
      }
    }

    // 16. Kind of Relationship (Preferences)
    let cleanRelationType: RelationType | null =
      existingPreferences?.relation ?? null;
    const rawRelType = dto.kindOfRelationship ?? dto.relation;
    if (rawRelType !== undefined && rawRelType !== null) {
      const normalized = normalizeRelationType(rawRelType);
      if (normalized) {
        cleanRelationType = normalized;
      }
    }

    // 17. Phone number, bio, coordinates
    const cleanPhoneNumber =
      dto.phoneNumber !== undefined
        ? dto.phoneNumber?.trim() || null
        : existingProfile?.phoneNumber ?? null;

    const cleanBio =
      dto.bio !== undefined
        ? dto.bio?.trim() || null
        : existingProfile?.bio ?? null;

    const cleanLatitude =
      dto.latitude !== undefined
        ? dto.latitude
        : existingProfile
          ? Number(existingProfile.latitude)
          : 0.0;

    const cleanLongitude =
      dto.longitude !== undefined
        ? dto.longitude
        : existingProfile
          ? Number(existingProfile.longitude)
          : 0.0;

    // 18. Database Transaction: atomic updates to Profile, Demographic, Preferences, User
    await this.prisma.$transaction(async (tx) => {
      // 1. Profile upsert
      await tx.profile.upsert({
        where: { userId },
        create: {
          userId,
          firstName: cleanFirstName,
          username: cleanUsername,
          phoneNumber: cleanPhoneNumber,
          bio: cleanBio,
          languages: cleanLanguages ? cleanLanguages : [cleanLanguage],
          avatarUrl,
          selfieUrl,
          latitude: cleanLatitude,
          longitude: cleanLongitude,
        },
        update: {
          firstName: cleanFirstName,
          username: cleanUsername,
          phoneNumber: cleanPhoneNumber,
          bio: cleanBio,
          languages: cleanLanguages ? cleanLanguages : [cleanLanguage],
          avatarUrl,
          selfieUrl,
          latitude: cleanLatitude,
          longitude: cleanLongitude,
        },
      });

      // 2. Demographic handling
      if (existingDemographic) {
        await tx.demographic.update({
          where: { userId },
          data: {
            ...(normalizedGender ? { gender: normalizedGender } : {}),
            ...(parsedBirthDate ? { birthDate: parsedBirthDate } : {}),
            ...(dto.cityId !== undefined ? { cityId: validCityId } : {}),
            ...(cleanHeight !== null ? { height: cleanHeight } : {}),
            ...(cleanDegree ? { degree: cleanDegree } : {}),
            ...(cleanProfession !== null ? { profession: cleanProfession } : {}),
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
            profession: cleanProfession,
            relationStatus: cleanRelationStatus,
          },
          update: {
            gender: normalizedGender,
            birthDate: parsedBirthDate,
            cityId: validCityId,
            ...(cleanHeight !== null ? { height: cleanHeight } : {}),
            ...(cleanDegree ? { degree: cleanDegree } : {}),
            ...(cleanProfession !== null ? { profession: cleanProfession } : {}),
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

      // 4. User app language update if specified
      if (dbUserLanguage) {
        await tx.user.update({
          where: { id: userId },
          data: {
            language: dbUserLanguage,
          },
        });
      }
    });

    // 19. Check profile completion status:
    // Profile is only complete when all required onboarding steps are completed:
    // - Basic profile: firstName, username, avatarUrl, selfieUrl, languages (non-empty)
    // - Demographics: birthDate, gender, height, degree, profession, relationStatus
    // - Preferences: relation (kind of relationship)
    // - Questions: answered all questions if questions exist in DB
    const hasBasicProfile = !!(
      cleanFirstName &&
      cleanUsername &&
      avatarUrl &&
      selfieUrl &&
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
      cleanProfession &&
      cleanRelationStatus
    );

    const hasPreferences = !!cleanRelationType;

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

    this.logger.log(
      `[Profile Updated] User ${userId} profile updated. Completed status: ${profileCompleted}`,
    );

    return {
      userId,
      firstName: cleanFirstName,
      username: cleanUsername ?? '',
      phoneNumber: cleanPhoneNumber,
      bio: cleanBio,
      avatarUrl,
      selfieUrl,
      age: calculatedUserAge,
      gender: normalizedGender,
      height: cleanHeight,
      languages: cleanLanguages,
      degree: cleanDegree,
      profession: cleanProfession,
      relationStatus: cleanRelationStatus,
      relation: cleanRelationType,
      cityId: validCityId,
      language: cleanLanguage,
      profileCompleted,
      profileValidated: user.profileValidated ?? false,
    };
  }
}

export { UpdateProfileUseCase as CreateProfileUseCase };
