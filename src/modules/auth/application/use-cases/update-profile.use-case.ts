import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import * as path from 'path';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { UpdateProfileDto } from '../dtos/update-profile.dto';
import { ProfileResponseDto, GalleryItemResponseDto } from '../dtos/profile-response.dto';
import { AvatarProcessorService } from '../services/avatar-processor.service';
import { GalleryProcessorService, ProcessedGalleryImage } from '../services/gallery-processor.service';
import { MediaUrlResolverService } from '../../../media/application/services/media-url-resolver.service';
import { GeoLookupService } from '../../../../infrastructure/geo/geo-lookup.service';
import { CityGeoDetails } from '../../../../infrastructure/geo/geo.interface';
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
    @Optional() private readonly galleryProcessor?: GalleryProcessorService,
    @Optional() private readonly mediaUrlResolver?: MediaUrlResolverService,
    @Optional() private readonly geoLookupService?: GeoLookupService,
  ) { }

  async execute(
    userId: number,
    dto: UpdateProfileDto,
    avatarFile?: Express.Multer.File,
    selfieFile?: Express.Multer.File,
    galleryFiles?: Express.Multer.File[],
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
      const initialProfileNested =
        dto.Profile ??
        (dto as any)?.profile ??
        initialDataObj?.Profile ??
        initialDataObj?.profile;
      const candidateAvatar =
        initialProfileNested?.avatar ??
        dto.avatar ??
        initialDataObj?.avatar ??
        initialDataObj?.Profile?.avatar ??
        initialDataObj?.profile?.avatar;
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

    const profileNested =
      dto.Profile ??
      (dto as any)?.profile ??
      dataObj?.Profile ??
      dataObj?.profile;

    const demographic =
      profileNested?.Demographic ??
      (profileNested as any)?.demographic ??
      dto.Demographic ??
      (dto as any)?.demographic ??
      dataObj?.Demographic ??
      dataObj?.demographic ??
      dataObj?.Profile?.Demographic ??
      dataObj?.Profile?.demographic ??
      dataObj?.profile?.Demographic ??
      dataObj?.profile?.demographic;

    const preferences =
      profileNested?.Preferences ??
      (profileNested as any)?.preferences ??
      dto.Preferences ??
      (dto as any)?.preferences ??
      dataObj?.Preferences ??
      dataObj?.preferences ??
      dataObj?.Profile?.Preferences ??
      dataObj?.Profile?.preferences ??
      dataObj?.profile?.Preferences ??
      dataObj?.profile?.preferences;

    // Gallery inputs extraction and validation (single contract: strictly outside Profile object)
    const candidateProfilePictureIdInput =
      dto.profilePictureId ??
      (dto as any)?.profile_picture_id ??
      dataObj?.profilePictureId ??
      dataObj?.profile_picture_id;

    const candidateProfilePictureInput =
      dto.profilePicture ??
      dataObj?.profilePicture;

    const candidateGalleryInput =
      dto.gallery ??
      dataObj?.gallery;

    // Single gallery photo rule: do not allow multi gallery
    if (galleryFiles && galleryFiles.length > 1) {
      throw new BadRequestException(
        'Only one gallery picture is allowed per request. Multiple gallery uploads are not permitted.',
      );
    }

    if (Array.isArray(candidateGalleryInput) && candidateGalleryInput.length > 1) {
      throw new BadRequestException(
        'Only one gallery picture is allowed per request. Multiple gallery uploads are not permitted.',
      );
    }

    // Unpack single gallery object
    const galleryObj: any = Array.isArray(candidateGalleryInput)
      ? candidateGalleryInput[0]
      : (candidateGalleryInput && typeof candidateGalleryInput === 'object')
        ? candidateGalleryInput
        : undefined;

    let isProfilePictureFlag: boolean | undefined = undefined;
    if (galleryObj) {
      const rawFlag =
        galleryObj.isProfilePicture !== undefined
          ? galleryObj.isProfilePicture
          : (galleryObj as any).is_profile_picture;
      if (typeof rawFlag === 'boolean') {
        isProfilePictureFlag = rawFlag;
      } else if (typeof rawFlag === 'string') {
        if (rawFlag.trim().toLowerCase() === 'true' || rawFlag.trim() === '1') {
          isProfilePictureFlag = true;
        } else if (rawFlag.trim().toLowerCase() === 'false' || rawFlag.trim() === '0') {
          isProfilePictureFlag = false;
        }
      }
    }

    const candidateDeleteGalleryIdsInput =
      profileNested?.deleteGalleryIds ??
      (profileNested as any)?.delete_gallery_ids ??
      dto.deleteGalleryIds ??
      (dto as any)?.delete_gallery_ids ??
      dataObj?.Profile?.deleteGalleryIds ??
      dataObj?.deleteGalleryIds;

    // Parse deleteGalleryIds
    const deleteGalleryIds: number[] = Array.isArray(candidateDeleteGalleryIdsInput)
      ? candidateDeleteGalleryIdsInput.map(Number).filter((n) => !isNaN(n) && n > 0)
      : [];

    const candidateTargetGalleryId =
      galleryObj?.id !== undefined && galleryObj?.id !== null && !isNaN(Number(galleryObj.id))
        ? Number(galleryObj.id)
        : null;

    let existingTargetGallery: any = null;
    if (candidateTargetGalleryId) {
      if (typeof (this.prisma as any).userGallery?.findFirst === 'function') {
        existingTargetGallery = await (this.prisma as any).userGallery.findFirst({
          where: { id: candidateTargetGalleryId, userId },
        });
      }
      if (galleryFiles && galleryFiles.length > 0 && !existingTargetGallery) {
        throw new BadRequestException('Gallery image with specified id not found.');
      }
    }

    const isReplacingGalleryImage = Boolean(
      existingTargetGallery && galleryFiles && galleryFiles.length > 0,
    );

    // Rule: Limit for total uploaded image gallery: 10
    const currentGalleryCount =
      typeof (this.prisma as any).userGallery?.count === 'function'
        ? await (this.prisma as any).userGallery.count({ where: { userId } })
        : 0;
    const newUploadsCount = (galleryFiles && !isReplacingGalleryImage) ? Math.min(galleryFiles.length, 1) : 0;
    const deleteCount = deleteGalleryIds.length;
    const projectedGalleryCount = Math.max(0, currentGalleryCount - deleteCount) + newUploadsCount;
    if (projectedGalleryCount > 10) {
      throw new BadRequestException(
        `User gallery cannot exceed maximum limit of 10 images (currently has ${currentGalleryCount}, deleting ${deleteCount}, uploading ${newUploadsCount}, total would be ${projectedGalleryCount}).`,
      );
    }

    // Process new gallery uploads via galleryProcessor (at most 1)
    let processedGalleryImages: ProcessedGalleryImage[] = [];
    if (galleryFiles && galleryFiles.length > 0) {
      if (this.galleryProcessor) {
        processedGalleryImages = await this.galleryProcessor.processBatchGallery(
          [galleryFiles[0]],
          userId,
        );
      }
    }

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
                : dataObj?.firstName !== undefined
                  ? dataObj.firstName
                  : dataObj?.Profile?.fullName !== undefined
                    ? dataObj.Profile.fullName
                    : dataObj?.profile?.fullName !== undefined
                      ? dataObj.profile.fullName
                      : dataObj?.Profile?.firstName !== undefined
                        ? dataObj.Profile.firstName
                        : dataObj?.profile?.firstName;

    const candidateUsernameInput =
      profileNested?.username ??
      dto.username ??
      dataObj?.username ??
      dataObj?.Profile?.username ??
      dataObj?.profile?.username;

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
      dataObj?.demographic?.birth_date ??
      dataObj?.Profile?.Demographic?.birthDate ??
      dataObj?.Profile?.demographic?.birthDate ??
      dataObj?.profile?.Demographic?.birthDate ??
      dataObj?.profile?.demographic?.birthDate;

    const candidateGenderInput =
      demographic?.gender ??
      dto.gender ??
      dataObj?.gender ??
      dataObj?.Demographic?.gender ??
      dataObj?.demographic?.gender ??
      dataObj?.Profile?.Demographic?.gender ??
      dataObj?.Profile?.demographic?.gender ??
      dataObj?.profile?.Demographic?.gender ??
      dataObj?.profile?.demographic?.gender;

    const candidatePhoneNumberInput =
      profileNested?.phoneNumber ??
      dto.phoneNumber ??
      dataObj?.phoneNumber ??
      dataObj?.Profile?.phoneNumber ??
      dataObj?.profile?.phoneNumber;

    const candidateLanguageInput =
      dto.language ??
      profileNested?.language ??
      dataObj?.language ??
      dataObj?.Profile?.language ??
      dataObj?.profile?.language;

    const candidateBioInput =
      profileNested?.bio ??
      dto.bio ??
      dataObj?.bio ??
      dataObj?.Profile?.bio ??
      dataObj?.profile?.bio;

    const candidateHeightInput =
      demographic?.height ??
      dto.height ??
      dataObj?.height ??
      dataObj?.Demographic?.height ??
      dataObj?.demographic?.height ??
      dataObj?.Profile?.Demographic?.height ??
      dataObj?.Profile?.demographic?.height ??
      dataObj?.profile?.Demographic?.height ??
      dataObj?.profile?.demographic?.height;

    const candidateEducationInput =
      demographic?.degree ??
      (demographic as any)?.education ??
      dto.degree ??
      (dto as any)?.education ??
      dataObj?.degree ??
      dataObj?.education ??
      dataObj?.Demographic?.degree ??
      dataObj?.demographic?.degree ??
      dataObj?.Profile?.Demographic?.degree ??
      dataObj?.Profile?.demographic?.degree ??
      dataObj?.profile?.Demographic?.degree ??
      dataObj?.profile?.demographic?.degree;

    const candidateJobInput =
      demographic?.profession ??
      (demographic as any)?.job ??
      dto.profession ??
      (dto as any)?.job ??
      dataObj?.profession ??
      dataObj?.job ??
      dataObj?.Demographic?.profession ??
      dataObj?.demographic?.profession ??
      dataObj?.Profile?.Demographic?.profession ??
      dataObj?.Profile?.demographic?.profession ??
      dataObj?.profile?.Demographic?.profession ??
      dataObj?.profile?.demographic?.profession;

    const candidateLanguagesInput =
      profileNested?.languages ??
      dto.languages ??
      dataObj?.languages ??
      dataObj?.Profile?.languages ??
      dataObj?.profile?.languages;

    const candidateCityInput =
      demographic?.City?.id ??
      demographic?.cityId ??
      (demographic as any)?.city?.id ??
      demographic?.City?.name ??
      (typeof demographic?.City === 'string' || typeof demographic?.City === 'number'
        ? demographic.City
        : undefined) ??
      (typeof demographic?.city === 'string' || typeof demographic?.city === 'number'
        ? demographic.city
        : undefined) ??
      (demographic as any)?.city?.name ??
      dto.cityId ??
      (dto as any)?.City?.id ??
      (dto as any)?.city?.id ??
      (dto as any)?.City?.name ??
      (typeof (dto as any)?.City === 'string' || typeof (dto as any)?.City === 'number'
        ? (dto as any).City
        : undefined) ??
      (typeof (dto as any)?.city === 'string' || typeof (dto as any)?.city === 'number'
        ? (dto as any).city
        : undefined) ??
      dataObj?.cityId ??
      dataObj?.City?.id ??
      dataObj?.City?.name ??
      (typeof dataObj?.City === 'string' || typeof dataObj?.City === 'number'
        ? dataObj.City
        : undefined) ??
      (typeof dataObj?.city === 'string' || typeof dataObj?.city === 'number'
        ? dataObj.city
        : undefined) ??
      dataObj?.Demographic?.City?.id ??
      dataObj?.Demographic?.City?.name ??
      dataObj?.Demographic?.cityId ??
      (typeof dataObj?.Demographic?.City === 'string' || typeof dataObj?.Demographic?.City === 'number'
        ? dataObj.Demographic.City
        : undefined) ??
      (typeof dataObj?.Demographic?.city === 'string' || typeof dataObj?.Demographic?.city === 'number'
        ? dataObj.Demographic.city
        : undefined) ??
      dataObj?.demographic?.City?.id ??
      dataObj?.demographic?.City?.name ??
      dataObj?.demographic?.cityId ??
      dataObj?.Profile?.Demographic?.City?.id ??
      dataObj?.Profile?.Demographic?.City?.name ??
      dataObj?.Profile?.Demographic?.cityId ??
      dataObj?.profile?.Demographic?.City?.id ??
      dataObj?.profile?.Demographic?.City?.name ??
      dataObj?.profile?.Demographic?.cityId;

    const candidateCityNameInput =
      demographic?.City?.name ??
      (demographic as any)?.city?.name ??
      demographic?.cityName ??
      (demographic as any)?.city_name ??
      (dto as any)?.cityName ??
      (dto as any)?.city_name ??
      (dto as any)?.City?.name ??
      (dto as any)?.city?.name ??
      dataObj?.Demographic?.City?.name ??
      dataObj?.Demographic?.city?.name ??
      dataObj?.Demographic?.cityName ??
      dataObj?.Demographic?.city_name ??
      dataObj?.demographic?.City?.name ??
      dataObj?.demographic?.city?.name ??
      dataObj?.demographic?.cityName ??
      dataObj?.demographic?.city_name ??
      dataObj?.Profile?.Demographic?.City?.name ??
      dataObj?.Profile?.Demographic?.city?.name ??
      dataObj?.Profile?.Demographic?.cityName ??
      dataObj?.Profile?.Demographic?.city_name ??
      dataObj?.cityName ??
      dataObj?.city_name;

    const candidateLatitudeInput =
      dto.lat ??
      (dto as any)?.latitude ??
      profileNested?.lat ??
      profileNested?.latitude ??
      dataObj?.lat ??
      dataObj?.latitude ??
      dataObj?.Profile?.lat ??
      dataObj?.Profile?.latitude;

    const candidateLongitudeInput =
      dto.lon ??
      (dto as any)?.longitude ??
      profileNested?.lon ??
      profileNested?.longitude ??
      dataObj?.lon ??
      dataObj?.longitude ??
      dataObj?.Profile?.lon ??
      dataObj?.Profile?.longitude;

    const candidateRelationStatusInput =
      demographic?.relationStatus ??
      dto.relationStatus ??
      dataObj?.relationStatus ??
      dataObj?.Demographic?.relationStatus ??
      dataObj?.demographic?.relationStatus ??
      dataObj?.Profile?.Demographic?.relationStatus ??
      dataObj?.Profile?.demographic?.relationStatus ??
      dataObj?.profile?.Demographic?.relationStatus ??
      dataObj?.profile?.demographic?.relationStatus;

    const candidateRelationInput =
      profileNested?.RelationType ??
      (profileNested as any)?.relationType ??
      dto.RelationType ??
      (dto as any)?.relationType ??
      preferences?.relation ??
      (preferences as any)?.RelationType ??
      (preferences as any)?.relationType ??
      dto.relation ??
      dataObj?.RelationType ??
      dataObj?.relationType ??
      dataObj?.relation ??
      dataObj?.Preferences?.relation ??
      dataObj?.Preferences?.RelationType ??
      dataObj?.preferences?.relation ??
      dataObj?.preferences?.relationType ??
      dataObj?.Profile?.RelationType ??
      dataObj?.Profile?.relationType ??
      dataObj?.Profile?.Preferences?.relation ??
      dataObj?.profile?.RelationType;

    let candidateFavoritesInput: any =
      (profileNested as any)?.LikedActivities ??
      (profileNested as any)?.likedActivities ??
      (profileNested as any)?.interest ??
      (profileNested as any)?.interests ??
      (profileNested as any)?.Interest ??
      (profileNested as any)?.favorites ??
      dto.LikedActivities ??
      (dto as any)?.likedActivities ??
      dto.interest ??
      dto.interests ??
      (dto as any)?.Interest ??
      dto.favorites ??
      dataObj?.LikedActivities ??
      dataObj?.likedActivities ??
      dataObj?.interest ??
      dataObj?.interests ??
      dataObj?.Interest ??
      dataObj?.favorites ??
      dataObj?.Profile?.LikedActivities ??
      dataObj?.Profile?.likedActivities ??
      dataObj?.Profile?.interests ??
      dataObj?.Profile?.interest ??
      dataObj?.profile?.LikedActivities ??
      dataObj?.profile?.interests;

    if (typeof candidateFavoritesInput === 'string') {
      try {
        candidateFavoritesInput = JSON.parse(candidateFavoritesInput);
      } catch { }
    }

    // Extract interest IDs from key-value map (like questions: { "1": [1, 2], "9": 72 } or { "1": 1 })
    if (
      candidateFavoritesInput &&
      typeof candidateFavoritesInput === 'object' &&
      !Array.isArray(candidateFavoritesInput)
    ) {
      const extractedIds: number[] = [];
      for (const [_, val] of Object.entries(candidateFavoritesInput)) {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (typeof item === 'number') extractedIds.push(item);
            else if (typeof item === 'string' && !isNaN(Number(item))) extractedIds.push(Number(item));
            else if (item && typeof item === 'object' && typeof item.id === 'number') extractedIds.push(item.id);
          }
        } else if (typeof val === 'number') {
          extractedIds.push(val);
        } else if (typeof val === 'string' && !isNaN(Number(val))) {
          extractedIds.push(Number(val));
        } else if (val && typeof val === 'object' && typeof (val as any).id === 'number') {
          extractedIds.push((val as any).id);
        }
      }
      candidateFavoritesInput = extractedIds;
    } else if (
      candidateFavoritesInput &&
      Array.isArray(candidateFavoritesInput) &&
      candidateFavoritesInput.length > 0 &&
      typeof candidateFavoritesInput[0] === 'object' &&
      candidateFavoritesInput[0] !== null
    ) {
      const hasInterestArrays = candidateFavoritesInput.some(
        (cat: any) => Array.isArray(cat?.Interest) || Array.isArray(cat?.interests),
      );
      if (hasInterestArrays) {
        const extractedIds: number[] = [];
        for (const cat of candidateFavoritesInput) {
          const list = cat?.Interest || cat?.interests;
          if (Array.isArray(list)) {
            for (const item of list) {
              if (typeof item?.id === 'number') extractedIds.push(item.id);
            }
          } else if (typeof cat?.id === 'number') {
            extractedIds.push(cat.id);
          }
        }
        candidateFavoritesInput = extractedIds;
      } else if (candidateFavoritesInput.every((item: any) => typeof item?.id === 'number')) {
        candidateFavoritesInput = candidateFavoritesInput.map((item: any) => item.id);
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
    const rawCityInput =
      (candidateCityInput !== undefined && candidateCityInput !== null && String(candidateCityInput).trim() !== '')
        ? candidateCityInput
        : (candidateCityNameInput !== undefined && candidateCityNameInput !== null && String(candidateCityNameInput).trim() !== '')
          ? candidateCityNameInput
          : undefined;

    let validCityId: number | null = existingDemographic?.cityId ?? null;
    let resolvedCityDetails: CityGeoDetails | null = null;
    if (rawCityInput !== undefined && rawCityInput !== null && String(rawCityInput).trim() !== '') {
      if (this.geoLookupService) {
        resolvedCityDetails = typeof this.geoLookupService.resolveCity === 'function'
          ? await this.geoLookupService.resolveCity(rawCityInput)
          : await this.geoLookupService.getCityById(Number(rawCityInput));
      }
      if (resolvedCityDetails) {
        validCityId = resolvedCityDetails.id;
      } else {
        const cityNum = Number(rawCityInput);
        if (!isNaN(cityNum) && cityNum > 0) {
          // Fallback check against Prisma city if DB is seeded or in unit tests
          const cityExists =
            typeof (this.prisma as any)?.city?.findUnique === 'function'
              ? await this.prisma.city.findUnique({
                  where: { id: cityNum },
                  select: { id: true },
                })
              : null;
          if (cityExists) {
            validCityId = cityExists.id;
          } else {
            this.logger.warn(
              `[Profile Update] City input "${rawCityInput}" does not exist in geo service or local DB.`,
            );
            validCityId = null;
          }
        } else {
          validCityId = null;
        }
      }
    } else if (validCityId && this.geoLookupService) {
      resolvedCityDetails = typeof this.geoLookupService.resolveCity === 'function'
        ? await this.geoLookupService.resolveCity(validCityId)
        : await this.geoLookupService.getCityById(validCityId);
    }

    let cityName: string | null =
      resolvedCityDetails?.name ?? candidateCityNameInput ?? (existingDemographic as any)?.cityName ?? null;
    let stateName: string | null =
      typeof resolvedCityDetails?.state === 'object' && resolvedCityDetails?.state
        ? resolvedCityDetails.state.name
        : ((resolvedCityDetails?.state as string) ?? null);
    let countryName: string | null =
      typeof resolvedCityDetails?.country === 'object' && resolvedCityDetails?.country
        ? resolvedCityDetails.country.name
        : ((resolvedCityDetails?.country as string) ?? null);

    if (validCityId && !cityName) {
      if (this.geoLookupService) {
        resolvedCityDetails = typeof this.geoLookupService.resolveCity === 'function'
          ? await this.geoLookupService.resolveCity(validCityId)
          : await this.geoLookupService.getCityById(validCityId);
        if (resolvedCityDetails) {
          cityName = resolvedCityDetails.name;
          stateName =
            typeof resolvedCityDetails.state === 'object' && resolvedCityDetails.state
              ? resolvedCityDetails.state.name
              : ((resolvedCityDetails.state as string) ?? null);
          countryName =
            typeof resolvedCityDetails.country === 'object' && resolvedCityDetails.country
              ? resolvedCityDetails.country.name
              : ((resolvedCityDetails.country as string) ?? null);
        }
      }
      if (!cityName && typeof (this.prisma as any)?.city?.findUnique === 'function') {
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
      (existingProfile as any)?.relationType ??
      existingPreferences?.relation ??
      null;
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

    let profilePictureUrl: string | null = existingProfile?.profilePictureUrl || null;

    // 19. Database Transaction: atomic updates to Profile, Demographic, Preferences, User, Gallery
    await this.prisma.$transaction(async (tx) => {
      // Gallery deletions
      if (deleteGalleryIds.length > 0 && typeof (tx as any).userGallery?.deleteMany === 'function') {
        await (tx as any).userGallery.deleteMany({
          where: {
            id: { in: deleteGalleryIds },
            userId,
          },
        });
      }

      // Newly uploaded gallery images (max 1) or in-place replacement
      let newlyCreatedGallery: any = null;
      let updatedGalleryRecord: any = null;

      if (processedGalleryImages.length > 0) {
        const img = processedGalleryImages[0];

        if (existingTargetGallery && typeof (tx as any).userGallery?.update === 'function') {
          // Replace existing gallery image file with new uploaded file
          let newIsProfilePicture = existingTargetGallery.isProfilePicture;
          if (isProfilePictureFlag === true) {
            newIsProfilePicture = true;
          } else if (isProfilePictureFlag === false) {
            newIsProfilePicture = false;
          }

          const updateData: any = {
            imageUrl: img.relativeUrl,
          };
          if (galleryObj?.description !== undefined) {
            updateData.description = galleryObj.description;
          }
          if (isProfilePictureFlag !== undefined) {
            updateData.isProfilePicture = newIsProfilePicture;
          }

          updatedGalleryRecord = await (tx as any).userGallery.update({
            where: { id: existingTargetGallery.id },
            data: updateData,
          });

          if (newIsProfilePicture) {
            if (typeof (tx as any).userGallery?.updateMany === 'function') {
              await (tx as any).userGallery.updateMany({
                where: { userId, id: { not: existingTargetGallery.id } },
                data: { isProfilePicture: false },
              });
            }
            profilePictureUrl = img.relativeUrl;
          }
        } else if (typeof (tx as any).userGallery?.create === 'function') {
          // Determine if new image should be profilePicture:
          // 1. If isProfilePicture flag was explicitly sent, use it.
          // 2. If isProfilePicture was NOT sent (undefined), set the first gallery as isProfilePicture by default:
          //    (i.e. if user has no existing gallery, or no existing gallery has isProfilePicture: true).
          let newIsProfilePicture = false;
          if (isProfilePictureFlag === true) {
            newIsProfilePicture = true;
          } else if (isProfilePictureFlag === false) {
            newIsProfilePicture = false;
          } else {
            const existingActive = typeof (tx as any).userGallery?.findFirst === 'function'
              ? await (tx as any).userGallery.findFirst({
                  where: { userId, isProfilePicture: true },
                })
              : null;
            if (!existingActive) {
              newIsProfilePicture = true;
            }
          }

          newlyCreatedGallery = await (tx as any).userGallery.create({
            data: {
              userId,
              imageUrl: img.relativeUrl,
              description: galleryObj?.description ?? null,
              likesCount: 0,
              isProfilePicture: newIsProfilePicture,
            },
          });

          if (newIsProfilePicture) {
            if (typeof (tx as any).userGallery?.updateMany === 'function') {
              await (tx as any).userGallery.updateMany({
                where: { userId, id: { not: newlyCreatedGallery.id } },
                data: { isProfilePicture: false },
              });
            }
            profilePictureUrl = newlyCreatedGallery.imageUrl;
          }
        }
      }

      // Update description of existing gallery item if specified (when not already replaced above)
      if (!isReplacingGalleryImage && galleryObj?.id && typeof (tx as any).userGallery?.updateMany === 'function') {
        const galleryId = Number(galleryObj.id);
        if (!isNaN(galleryId) && galleryObj.description !== undefined) {
          await (tx as any).userGallery.updateMany({
            where: { id: galleryId, userId },
            data: {
              description: galleryObj.description,
            },
          });
        }
      }

      // Profile picture selection logic (swipe profile picture from gallery, not avatar)
      let selectedGalleryId: number | null = candidateProfilePictureIdInput
        ? Number(candidateProfilePictureIdInput)
        : null;

      if (!selectedGalleryId && galleryObj?.id && isProfilePictureFlag === true) {
        selectedGalleryId = Number(galleryObj.id);
      }

      if (newlyCreatedGallery && newlyCreatedGallery.isProfilePicture) {
        selectedGalleryId = newlyCreatedGallery.id;
      }

      if (updatedGalleryRecord && (updatedGalleryRecord.isProfilePicture || isProfilePictureFlag === true)) {
        selectedGalleryId = updatedGalleryRecord.id;
      }

      const handledGalleryId = newlyCreatedGallery?.id ?? updatedGalleryRecord?.id;
      if (selectedGalleryId && (!handledGalleryId || selectedGalleryId !== handledGalleryId)) {
        if (typeof (tx as any).userGallery?.findFirst === 'function') {
          const chosen = await (tx as any).userGallery.findFirst({
            where: { id: selectedGalleryId, userId },
          });
          if (chosen) {
            await (tx as any).userGallery.updateMany({
              where: { userId },
              data: { isProfilePicture: false },
            });
            await (tx as any).userGallery.update({
              where: { id: chosen.id },
              data: { isProfilePicture: true },
            });
            profilePictureUrl = chosen.imageUrl;
          } else {
            throw new BadRequestException('Gallery image with specified profilePictureId not found.');
          }
        }
      } else if (!newlyCreatedGallery && !updatedGalleryRecord && candidateProfilePictureInput && typeof candidateProfilePictureInput === 'string') {
        const filename = path.basename(candidateProfilePictureInput.trim());
        const chosen = typeof (tx as any).userGallery?.findFirst === 'function'
          ? await (tx as any).userGallery.findFirst({
              where: {
                userId,
                imageUrl: { contains: filename },
              },
            })
          : null;
        if (chosen) {
          await (tx as any).userGallery.updateMany({
            where: { userId },
            data: { isProfilePicture: false },
          });
          await (tx as any).userGallery.update({
            where: { id: chosen.id },
            data: { isProfilePicture: true },
          });
          profilePictureUrl = chosen.imageUrl;
          selectedGalleryId = chosen.id;
        } else {
          profilePictureUrl = candidateProfilePictureInput.trim();
        }
      } else if (!newlyCreatedGallery && !updatedGalleryRecord) {
        // Fallback or maintain existing profile picture
        if (profilePictureUrl && typeof (tx as any).userGallery?.findFirst === 'function') {
          const stillExists = await (tx as any).userGallery.findFirst({
            where: { userId, imageUrl: profilePictureUrl },
          });
          if (!stillExists) {
            const fallback = await (tx as any).userGallery.findFirst({
              where: { userId },
              orderBy: { createdAt: 'asc' },
            });
            if (fallback) {
              profilePictureUrl = fallback.imageUrl;
              selectedGalleryId = fallback.id;
              await (tx as any).userGallery.updateMany({
                where: { userId },
                data: { isProfilePicture: false },
              });
              await (tx as any).userGallery.update({
                where: { id: fallback.id },
                data: { isProfilePicture: true },
              });
            } else {
              profilePictureUrl = null;
              selectedGalleryId = null;
            }
          }
        } else if (!profilePictureUrl && typeof (tx as any).userGallery?.findFirst === 'function') {
          // If user had no profile picture and has gallery images, set first as profile picture by default
          const first = await (tx as any).userGallery.findFirst({
            where: { userId },
            orderBy: { createdAt: 'asc' },
          });
          if (first) {
            profilePictureUrl = first.imageUrl;
            selectedGalleryId = first.id;
            await (tx as any).userGallery.update({
              where: { id: first.id },
              data: { isProfilePicture: true },
            });
          }
        }
      }

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
          profilePictureUrl,
          latitude: cleanLatitude,
          longitude: cleanLongitude,
          isOnline: true,
          lastSeenAt: new Date(),
          ...(cleanRelationType !== undefined ? { relationType: cleanRelationType } : {}),
        } as any,
        update: {
          fullName: cleanFullName,
          username: cleanUsername,
          phoneNumber: cleanPhoneNumber,
          bio: cleanBio,
          languages: cleanLanguages ? cleanLanguages : [cleanLanguage],
          avatarUrl,
          selfieUrl,
          profilePictureUrl,
          latitude: cleanLatitude,
          longitude: cleanLongitude,
          isOnline: existingProfile?.isOnline ?? true,
          lastSeenAt: new Date(),
          ...(cleanRelationType !== undefined ? { relationType: cleanRelationType } : {}),
        } as any,
      });

      // 2. Demographic handling
      if (validCityId && resolvedCityDetails && typeof (tx as any).city?.upsert === 'function') {
        try {
          const countryId = resolvedCityDetails.countryId ?? 103;
          const countryName = resolvedCityDetails.country ?? 'Iran';
          if (typeof (tx as any).country?.upsert === 'function') {
            await (tx as any).country.upsert({
              where: { id: countryId },
              create: { id: countryId, name: countryName, code: 'XX' },
              update: { name: countryName },
            });
          }
          const stateId = resolvedCityDetails.stateId ?? 1;
          const stateName = resolvedCityDetails.state ?? countryName;
          if (typeof (tx as any).state?.upsert === 'function') {
            await (tx as any).state.upsert({
              where: { id: stateId },
              create: { id: stateId, name: stateName, countryId },
              update: { name: stateName, countryId },
            });
          }
          await (tx as any).city.upsert({
            where: { id: validCityId },
            create: { id: validCityId, name: resolvedCityDetails.name, stateId },
            update: { name: resolvedCityDetails.name, stateId },
          });
        } catch (e: any) {
          this.logger.warn(`Could not ensure city ${validCityId} in local DB: ${e.message}`);
        }
      }

      const demographicUpdateData: any = {
        ...(parsedBirthDate ? { birthDate: parsedBirthDate } : {}),
        ...(normalizedGender ? { gender: normalizedGender } : {}),
        ...(rawCityInput !== undefined && rawCityInput !== null
          ? {
              cityId: validCityId,
              ...(cityName ? { cityName } : {}),
            }
          : {}),
        ...(cleanHeight !== null ? { height: cleanHeight } : {}),
        ...(cleanDegree ? { degree: cleanDegree } : {}),
        ...(cleanJob !== null ? { job: cleanJob } : {}),
        ...(cleanRelationStatus ? { relationStatus: cleanRelationStatus } : {}),
      };

      try {
        if (existingDemographic) {
          await tx.demographic.update({
            where: { userId },
            data: demographicUpdateData,
          });
        } else if (parsedBirthDate && normalizedGender) {
          await tx.demographic.upsert({
            where: { userId },
            create: {
              userId,
              birthDate: parsedBirthDate,
              gender: normalizedGender,
              cityId: validCityId,
              cityName: cityName ?? undefined,
              height: cleanHeight,
              degree: cleanDegree,
              job: cleanJob,
              relationStatus: cleanRelationStatus,
            },
            update: demographicUpdateData,
          });
        }
      } catch (err: any) {
        if (err?.code === 'P2003' && demographicUpdateData.cityId) {
          this.logger.warn(`Retrying demographic update without cityId due to FK constraint: ${err.message}`);
          delete demographicUpdateData.cityId;
          if (existingDemographic) {
            await tx.demographic.update({ where: { userId }, data: demographicUpdateData });
          } else if (parsedBirthDate && normalizedGender) {
            await tx.demographic.upsert({
              where: { userId },
              create: {
                userId,
                birthDate: parsedBirthDate,
                gender: normalizedGender,
                cityId: null,
                height: cleanHeight,
                degree: cleanDegree,
                job: cleanJob,
                relationStatus: cleanRelationStatus,
              },
              update: demographicUpdateData,
            });
          }
        } else {
          throw err;
        }
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
        dataObj?.answers ??
        dataObj?.Profile?.Answers ??
        dataObj?.Profile?.answers ??
        dataObj?.profile?.Answers ??
        dataObj?.profile?.answers;

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

    const EXCLUDED_QUESTION_TYPES = ['PREFERENCES', 'INTERESTS'];

    const questionsCount =
      typeof (this.prisma as any).question?.count === 'function'
        ? await this.prisma.question.count({
            where: {
              type: {
                notIn: EXCLUDED_QUESTION_TYPES as any,
              },
            },
          })
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
          userAnswers
            .filter((ua: any) => {
              const qType = ua.questionAnswer?.question?.type;
              return !qType || !EXCLUDED_QUESTION_TYPES.includes(String(qType).toUpperCase());
            })
            .map((ua: any) => ua.questionAnswer?.questionId),
        );
        hasAnsweredAllQuestions = distinctAnsweredQuestions.size >= questionsCount;
      }
    }

    const profileCompleted =
      hasBasicProfile &&
      hasDemographics &&
      hasPreferences &&
      hasAnsweredAllQuestions;

    // this.logger.log(
    //   `[Profile Updated] User ${userId} profile updated. Completed status: ${profileCompleted}`,
    // );

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

    const formattedBirthDate = parsedBirthDate
      ? parsedBirthDate.toISOString().slice(0, 10)
      : null;

    const formattedGender = normalizedGender
      ? normalizedGender.toUpperCase()
      : null;

    const stateObj = resolvedCityDetails?.State ?? (stateName
      ? {
          id: resolvedCityDetails?.stateId ?? 3945,
          name: stateName,
          countryId: resolvedCityDetails?.countryId ?? 103,
          Country: countryName ? {
            id: resolvedCityDetails?.countryId ?? 103,
            name: countryName,
            native: resolvedCityDetails?.countryNative ?? 'ایران',
            emoji: resolvedCityDetails?.countryEmoji ?? '🇮🇷',
          } : null,
        }
      : null);

    const cityObj =
      (validCityId !== null || cityName !== null || resolvedCityDetails !== null)
        ? {
          id: validCityId ?? resolvedCityDetails?.id ?? null,
          name: cityName ?? resolvedCityDetails?.name ?? null,
          state:
            stateName ??
            (typeof resolvedCityDetails?.state === 'object' && resolvedCityDetails?.state
              ? resolvedCityDetails.state.name
              : ((resolvedCityDetails?.state as string) ?? null)),
          country:
            countryName ??
            (typeof resolvedCityDetails?.country === 'object' && resolvedCityDetails?.country
              ? resolvedCityDetails.country.name
              : ((resolvedCityDetails?.country as string) ?? null)),
          State: stateObj,
        }
        : null;

    const userInterests = await (this.prisma as any).userInterest?.findMany?.({
      where: { userId },
      include: { interest: true },
    });
    const likedActivitiesMap: Record<string, number | number[]> = {};
    if (userInterests && Array.isArray(userInterests)) {
      const interestsByCatId = new Map<number, number[]>();
      for (const ui of userInterests) {
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

    let userGalleries: any[] = [];
    if (typeof (this.prisma as any).userGallery?.findMany === 'function') {
      userGalleries = await (this.prisma as any).userGallery.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
    }

    const mappedGallery: GalleryItemResponseDto[] = userGalleries.map((g: any) => ({
      id: g.id,
      url: this.mediaUrlResolver ? this.mediaUrlResolver.resolveUrl(g.imageUrl) : g.imageUrl,
      description: g.description,
      isProfilePicture: Boolean(g.isProfilePicture),
      createdAt: g.createdAt ? g.createdAt.toISOString() : undefined,
    }));

    const activeGallery = userGalleries.find((g: any) => Boolean(g.isProfilePicture));
    const activeProfilePictureId = activeGallery ? activeGallery.id : null;

    const resolvedProfilePicture = profilePictureUrl
      ? (this.mediaUrlResolver ? this.mediaUrlResolver.resolveUrl(profilePictureUrl) : profilePictureUrl)
      : null;

    return {
      id: userId,
      email: user.email,
      language: cleanLanguage.toUpperCase(),
      lat: cleanLatitude !== undefined ? cleanLatitude : null,
      lon: cleanLongitude !== undefined ? cleanLongitude : null,
      profileValidated: Boolean(user.profileValidated),
      isPremium: Boolean(user.isPremium),
      Profile: {
        fullName: cleanFullName ? cleanFullName : null,
        username: cleanUsername ? cleanUsername : null,
        phoneNumber: cleanPhoneNumber,
        bio: cleanBio,
        languages: cleanLanguages,
        avatar: this.mediaUrlResolver ? this.mediaUrlResolver.resolveUrl(avatarUrl) : avatarUrl,
        profilePicture: resolvedProfilePicture,
        profilePictureId: activeProfilePictureId,
        // selfie url: this will not use still, only client should send
        profileCompleted,
        isPremium: Boolean(user.isPremium),
        Demographic: {
          birthDate: formattedBirthDate,
          gender: formattedGender,
          height: cleanHeight,
          degree: cleanDegree,
          profession: cleanJob,
          relationStatus: cleanRelationStatus,
          City: cityObj,
        },
        RelationType: cleanRelationType,
        Answers: answersMap,
        LikedActivities: likedActivitiesMap,
      },
      gallery: mappedGallery,
    };
  }
}

export { UpdateProfileUseCase as CreateProfileUseCase };
