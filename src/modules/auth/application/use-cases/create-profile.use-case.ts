import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { CreateProfileDto } from '../dtos/create-profile.dto';
import { ProfileResponseDto } from '../dtos/profile-response.dto';
import { AvatarProcessorService } from '../services/avatar-processor.service';
import { calculateAge, validateDateOfBirth } from '../validators/dob.validator';
import { validateUsername } from '../validators/username.validator';
import { Gender, Language } from '@prisma/client';

@Injectable()
export class CreateProfileUseCase {
  private readonly logger = new Logger(CreateProfileUseCase.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly avatarProcessor: AvatarProcessorService,
  ) {}

  async execute(
    userId: number,
    dto: CreateProfileDto,
    avatarFile?: Express.Multer.File,
  ): Promise<ProfileResponseDto> {
    // 1. Ensure avatar is provided
    if (!avatarFile || !avatarFile.buffer) {
      throw new BadRequestException(
        'Profile picture is required. Please upload an avatar image file.',
      );
    }

    // 2. Validate username rules
    const usernameValidation = validateUsername(dto.username);
    if (!usernameValidation.isValid) {
      throw new BadRequestException(usernameValidation.error);
    }
    const cleanUsername = dto.username.toLowerCase().trim();

    // Check username uniqueness in DB
    const existingWithUsername = await this.prisma.profile.findFirst({
      where: {
        username: {
          equals: cleanUsername,
          mode: 'insensitive',
        },
      },
    });

    if (existingWithUsername && existingWithUsername.userId !== userId) {
      throw new ConflictException(
        `Username "${dto.username}" is already taken. Please choose another one.`,
      );
    }

    // 3. Validate Date of Birth / Age
    let parsedBirthDate: Date;
    let calculatedUserAge: number;

    if (dto.birthDate) {
      const dobValidation = validateDateOfBirth(dto.birthDate);
      if (!dobValidation.isValid || !dobValidation.parsedDate) {
        throw new BadRequestException(dobValidation.error);
      }
      parsedBirthDate = dobValidation.parsedDate;
      calculatedUserAge = calculateAge(parsedBirthDate);
    } else if (dto.age !== undefined && dto.age !== null) {
      const ageNum = Number(dto.age);
      if (isNaN(ageNum) || ageNum < 18 || ageNum > 80) {
        throw new BadRequestException(
          `Age must be between 18 and 80 years old (provided: ${dto.age}).`,
        );
      }
      calculatedUserAge = ageNum;
      // Synthesize approximate birthDate for demographic record
      const approxYear = new Date().getFullYear() - ageNum;
      parsedBirthDate = new Date(Date.UTC(approxYear, 0, 1));
    } else {
      throw new BadRequestException(
        'Date of birth (birthDate in YYYY-MM-DD format) or age is required.',
      );
    }

    // Check if user already set their DOB previously (dating app anti-fraud rule)
    const existingDemographic = await this.prisma.demographic.findUnique({
      where: { userId },
    });

    if (existingDemographic && existingDemographic.birthDate) {
      const existingDobString = existingDemographic.birthDate
        .toISOString()
        .slice(0, 10);
      const newDobString = parsedBirthDate.toISOString().slice(0, 10);
      if (existingDobString !== newDobString) {
        throw new BadRequestException(
          'Date of birth cannot be changed after initial setup without support verification.',
        );
      }
    }

    // 4. Validate City ID (Foreign Key safety)
    let validCityId: number | null = null;
    if (dto.cityId) {
      const cityExists = await this.prisma.city.findUnique({
        where: { id: Number(dto.cityId) },
        select: { id: true },
      });
      if (cityExists) {
        validCityId = cityExists.id;
      } else {
        this.logger.warn(
          `[Profile Onboarding] City ID ${dto.cityId} does not exist in database. Storing demographic without foreign key link until seeded.`,
        );
      }
    }

    // 5. Validate Gender
    const normalizedGender =
      dto.gender.toUpperCase() === 'FEMALE' ? Gender.FEMALE : Gender.MALE;

    // 6. Validate and normalize language (accept EN or FA case-insensitively, normalize to lowercase)
    if (!dto.language || typeof dto.language !== 'string') {
      throw new BadRequestException('Language cannot be empty');
    }
    const cleanLanguage = dto.language.toLowerCase().trim();
    if (cleanLanguage !== 'en' && cleanLanguage !== 'fa') {
      throw new BadRequestException(
        'Language must be either EN (English) or FA (Farsi)',
      );
    }
    const dbUserLanguage = cleanLanguage.toUpperCase() as Language;

    // 7. Process avatar image: magic bytes, dimensions, EXIF removal, WebP compression
    const processedAvatar = await this.avatarProcessor.processAndSaveAvatar(
      avatarFile.buffer,
      userId,
    );

    // 8. Persist Profile, Demographic, and User atomically in database transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.profile.upsert({
        where: { userId },
        create: {
          userId,
          firstName: dto.firstName.trim(),
          username: cleanUsername,
          phoneNumber: dto.phoneNumber?.trim() || null,
          languages: [cleanLanguage],
          avatarUrl: processedAvatar.relativeUrl,
          latitude: dto.latitude ?? 0.0,
          longitude: dto.longitude ?? 0.0,
        },
        update: {
          firstName: dto.firstName.trim(),
          username: cleanUsername,
          phoneNumber: dto.phoneNumber?.trim() || null,
          languages: [cleanLanguage],
          avatarUrl: processedAvatar.relativeUrl,
          latitude: dto.latitude ?? 0.0,
          longitude: dto.longitude ?? 0.0,
        },
      });

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
          cityId: validCityId,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          language: dbUserLanguage,
        },
      });
    });

    const age = calculatedUserAge;

    this.logger.log(
      `[Profile Created] User ${userId} successfully created profile with username "${cleanUsername}", language "${cleanLanguage}", and calculated age ${age}.`,
    );

    return {
      userId,
      firstName: dto.firstName.trim(),
      username: cleanUsername,
      phoneNumber: dto.phoneNumber?.trim() || null,
      avatarUrl: processedAvatar.relativeUrl,
      age,
      gender: normalizedGender,
      cityId: dto.cityId || null,
      language: cleanLanguage,
      profileCompleted: true,
    };
  }
}
