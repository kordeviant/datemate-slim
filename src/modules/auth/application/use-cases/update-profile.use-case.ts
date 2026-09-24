import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { UpdateProfileDto } from "../dtos/update-profile.dto";
import { ProfileResponseDto } from "../dtos/profile-response.dto";
import { AvatarProcessorService } from "../services/avatar-processor.service";
import { calculateAge, validateDateOfBirth } from "../validators/dob.validator";
import { validateUsername } from "../validators/username.validator";
import { Gender, Language } from "@prisma/client";

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
  ): Promise<ProfileResponseDto> {
    // 1. Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException("User account not found");
    }

    // 2. Fetch existing records for incremental / step-by-step update
    const existingProfile = await this.prisma.profile.findUnique({
      where: { userId },
    });
    const existingDemographic = await this.prisma.demographic.findUnique({
      where: { userId },
    });

    // 3. Process avatar if uploaded
    let avatarUrl = existingProfile?.avatarUrl || "";
    if (avatarFile && avatarFile.buffer) {
      const processedAvatar = await this.avatarProcessor.processAndSaveAvatar(
        avatarFile.buffer,
        userId,
      );
      avatarUrl = processedAvatar.relativeUrl;
    }

    // 4. Validate and update username if provided
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
            mode: "insensitive",
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

    // 5. First name
    let cleanFirstName: string = existingProfile?.firstName || "";
    if (dto.firstName !== undefined && dto.firstName !== null) {
      cleanFirstName = dto.firstName.trim();
    }

    // 6. Validate Date of Birth / Age
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
            "Date of birth cannot be changed after initial setup without support verification.",
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
            "Date of birth cannot be changed after initial setup without support verification.",
          );
        }
      }
      parsedBirthDate = newBirthDate;
      calculatedUserAge = ageNum;
    }

    // 7. City ID
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

    // 8. Gender
    let normalizedGender: Gender | null = existingDemographic?.gender ?? null;
    if (dto.gender) {
      normalizedGender =
        dto.gender.toUpperCase() === "FEMALE" ? Gender.FEMALE : Gender.MALE;
    }

    // 9. Language
    let cleanLanguage: string =
      (existingProfile?.languages as string[])?.[0] ||
      (user.language ? user.language.toLowerCase() : "en");
    let dbUserLanguage: Language | null = null;

    if (dto.language !== undefined && dto.language !== null) {
      if (typeof dto.language !== "string" || !dto.language.trim()) {
        throw new BadRequestException("Language cannot be empty");
      }
      const candidateLang = dto.language.toLowerCase().trim();
      if (candidateLang !== "en" && candidateLang !== "fa") {
        throw new BadRequestException(
          "Language must be either EN (English) or FA (Farsi)",
        );
      }
      cleanLanguage = candidateLang;
      dbUserLanguage = candidateLang.toUpperCase() as Language;
    }

    // 10. Phone number, bio, coordinates
    const cleanPhoneNumber =
      dto.phoneNumber !== undefined
        ? dto.phoneNumber?.trim() || null
        : (existingProfile?.phoneNumber ?? null);

    const cleanBio =
      dto.bio !== undefined
        ? dto.bio?.trim() || null
        : (existingProfile?.bio ?? null);

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

    // 11. Transaction: atomic update of profile, demographic, user
    await this.prisma.$transaction(async (tx) => {
      await tx.profile.upsert({
        where: { userId },
        create: {
          userId,
          firstName: cleanFirstName,
          username: cleanUsername,
          phoneNumber: cleanPhoneNumber,
          bio: cleanBio,
          languages: [cleanLanguage],
          avatarUrl,
          latitude: cleanLatitude,
          longitude: cleanLongitude,
        },
        update: {
          firstName: cleanFirstName,
          username: cleanUsername,
          phoneNumber: cleanPhoneNumber,
          bio: cleanBio,
          languages: [cleanLanguage],
          avatarUrl,
          latitude: cleanLatitude,
          longitude: cleanLongitude,
        },
      });

      if (existingDemographic) {
        await tx.demographic.update({
          where: { userId },
          data: {
            ...(normalizedGender ? { gender: normalizedGender } : {}),
            ...(parsedBirthDate ? { birthDate: parsedBirthDate } : {}),
            ...(dto.cityId !== undefined ? { cityId: validCityId } : {}),
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
          },
          update: {
            gender: normalizedGender,
            birthDate: parsedBirthDate,
            cityId: validCityId,
          },
        });
      }

      if (dbUserLanguage) {
        await tx.user.update({
          where: { id: userId },
          data: {
            language: dbUserLanguage,
          },
        });
      }
    });

    // 12. Check profile completion status:
    // Profile is only complete when all basic onboarding profile fields AND all questions are completed.
    // If questions or steps are not yet completed, return false.
    let profileCompleted = false;
    const questionsCount = await this.prisma.question.count();
    if (questionsCount > 0) {
      const answeredCount = await this.prisma.userQuestionAnswer.count({
        where: { userId },
      });
      const hasBasicProfile = !!(
        cleanFirstName &&
        cleanUsername &&
        avatarUrl &&
        parsedBirthDate &&
        normalizedGender
      );
      if (hasBasicProfile && answeredCount >= questionsCount) {
        profileCompleted = true;
      }
    }

    this.logger.log(
      `[Profile Updated] User ${userId} profile updated. Completed status: ${profileCompleted}`,
    );

    return {
      userId,
      firstName: cleanFirstName,
      username: cleanUsername ?? "",
      phoneNumber: cleanPhoneNumber,
      bio: cleanBio,
      avatarUrl,
      age: calculatedUserAge,
      gender: normalizedGender,
      cityId: validCityId,
      language: cleanLanguage,
      profileCompleted,
    };
  }
}

export { UpdateProfileUseCase as CreateProfileUseCase };
