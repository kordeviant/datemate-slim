import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Put,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";
import {
  IUserRepository,
  USER_REPOSITORY,
} from "../domain/repositories/user.repository.interface";
import { TokenService } from "../application/services/token.service";
import { UpdateProfileUseCase } from "../application/use-cases/update-profile.use-case";
import { UpdateProfileDto } from "../application/dtos/update-profile.dto";
import { ProfileResponseDto } from "../application/dtos/profile-response.dto";

@ApiTags("Users")
@Controller({ path: "users", version: "1" })
export class UsersController {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly tokenService: TokenService,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
  ) {}

  @Get("profile")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Check profile completion status",
    description:
      "Checks whether the authenticated user has created their basic profile and uploaded an avatar. Returns true or false.",
  })
  @ApiResponse({
    status: 200,
    description: "Profile status retrieved",
    schema: {
      example: {
        status: "success",
        message: "Operation successful",
        data: true,
        error: null,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid access token",
  })
  async checkUserProfile(
    @Headers("authorization") authHeader: string,
  ): Promise<boolean> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const decoded = this.tokenService.verifyAccessToken(token);
    return this.userRepository.hasCompletedProfile(decoded.sub);
  }

  @Put("profile")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "avatar", maxCount: 1 },
      { name: "selfie", maxCount: 1 },
    ]),
  )
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary: "Update user profile (step-by-step onboarding & edit profile)",
    description:
      "Updates profile step-by-step during onboarding or edit profile. Supports partial updates for username, name, date of birth, gender, language, avatar, selfie, height, languages, educations, job, relation status, kind of relationship, bio, city, coordinates, etc. profileCompleted remains false until all questions and onboarding steps are completed.",
  })
  @ApiBody({
    description:
      "User profile update information and optional avatar or selfie verification image files",
    type: UpdateProfileDto,
  })
  @ApiResponse({
    status: 200,
    description: "Profile successfully updated",
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Validation error (e.g. invalid username, age < 18 or > 80, corrupted/invalid image)",
  })
  @ApiResponse({
    status: 409,
    description: "Conflict error (username is already taken)",
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid authorization token",
  })
  async updateProfile(
    @Headers("authorization") authHeader: string,
    @Body() dto: UpdateProfileDto,
    @UploadedFiles()
    files?:
      | {
          avatar?: Express.Multer.File[];
          selfie?: Express.Multer.File[];
        }
      | Express.Multer.File,
  ): Promise<ProfileResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const decoded = this.tokenService.verifyAccessToken(token);

    let avatarFile: Express.Multer.File | undefined;
    let selfieFile: Express.Multer.File | undefined;

    if (files) {
      if ((files as any).buffer) {
        avatarFile = files as Express.Multer.File;
      } else {
        const fileMap = files as {
          avatar?: Express.Multer.File[];
          selfie?: Express.Multer.File[];
        };
        avatarFile = fileMap.avatar?.[0];
        selfieFile = fileMap.selfie?.[0];
      }
    }

    let effectiveDto: any = { ...dto };
    if ((dto as any)?.data) {
      try {
        const parsed =
          typeof (dto as any).data === "string"
            ? JSON.parse((dto as any).data)
            : (dto as any).data;
        if (parsed && typeof parsed === "object") {
          effectiveDto = { ...parsed };
          for (const [k, v] of Object.entries(dto)) {
            if (k !== "data" && v !== undefined && v !== null && v !== "") {
              effectiveDto[k] = v;
            }
          }
        }
      } catch (err) {
        // ignore JSON parse error and proceed with original dto
      }
    }

    // Unpack nested Demographic if sent by client (e.g. Android UpdateUserHttp)
    const demo = effectiveDto.Demographic || effectiveDto.demographic;
    if (demo && typeof demo === "object") {
      const demoCityId =
        demo.City?.id ??
        demo.city?.id ??
        demo.cityId ??
        demo.city_id ??
        (typeof demo.City === "number" ? demo.City : undefined) ??
        (typeof demo.city === "number" ? demo.city : undefined);

      if (
        demoCityId !== undefined &&
        effectiveDto.cityId === undefined &&
        effectiveDto.city_id === undefined
      ) {
        effectiveDto.cityId = demoCityId;
      }
      if (demo.birthDate && !effectiveDto.birthDate) {
        effectiveDto.birthDate =
          typeof demo.birthDate === "string"
            ? demo.birthDate
            : new Date(demo.birthDate).toISOString().slice(0, 10);
      }
      if (demo.gender && !effectiveDto.gender) {
        effectiveDto.gender = demo.gender;
      }
      if (demo.height !== undefined && effectiveDto.height === undefined) {
        effectiveDto.height = demo.height;
      }
      if (demo.degree && !effectiveDto.degree && !effectiveDto.education) {
        effectiveDto.degree = demo.degree;
      }
      if (demo.profession && !effectiveDto.profession && !effectiveDto.job) {
        effectiveDto.profession = demo.profession;
      }
      if (demo.relationStatus && !effectiveDto.relationStatus) {
        effectiveDto.relationStatus = demo.relationStatus;
      }
    }

    // Top-level city aliases fallback
    if (effectiveDto.cityId === undefined) {
      if (effectiveDto.city_id !== undefined) {
        effectiveDto.cityId = effectiveDto.city_id;
      } else if (effectiveDto.city?.id !== undefined) {
        effectiveDto.cityId = effectiveDto.city.id;
      } else if (typeof effectiveDto.city === "number") {
        effectiveDto.cityId = effectiveDto.city;
      } else if (effectiveDto.City?.id !== undefined) {
        effectiveDto.cityId = effectiveDto.City.id;
      }
    }

    // Unpack nested Preferences if sent by client
    const pref = effectiveDto.Preferences || effectiveDto.preferences;
    if (pref && typeof pref === "object") {
      if (pref.relation && !effectiveDto.kindOfRelationship && !effectiveDto.relation) {
        effectiveDto.relation = pref.relation;
      }
    }

    return this.updateProfileUseCase.execute(
      decoded.sub,
      effectiveDto,
      avatarFile,
      selfieFile,
    );
  }

  /**
   * Backwards-compatible method alias for callers of createProfile
   */
  async createProfile(
    authHeader: string,
    dto: UpdateProfileDto,
    avatar?: Express.Multer.File,
    selfie?: Express.Multer.File,
  ): Promise<ProfileResponseDto> {
    return this.updateProfile(
      authHeader,
      dto,
      avatar && selfie ? { avatar: [avatar], selfie: [selfie] } : avatar,
    );
  }
}
