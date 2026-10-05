import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UploadedFiles,
  UseInterceptors,
  UnauthorizedException,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { TokenService } from "../application/services/token.service";
import { GetProfileUseCase } from "../application/use-cases/get-profile.use-case";
import { UpdateProfileUseCase } from "../application/use-cases/update-profile.use-case";
import { UpdateProfileDto } from "../application/dtos/update-profile.dto";
import { ProfileResponseDto } from "../application/dtos/profile-response.dto";

@ApiTags("Users")
@Controller({ path: "users", version: ["1", VERSION_NEUTRAL] })
export class UsersController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly getProfileUseCase: GetProfileUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
  ) {}

  @Get("me")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get current authenticated user profile",
    description:
      "Retrieves the authenticated user profile details in Android schema: language, lat, lon, profileValidated, and Profile (fullName, username, phoneNumber, bio, languages, avatar, profileCompleted, Demographic, Preferences).",
  })
  @ApiResponse({
    status: 200,
    description: "User profile successfully retrieved",
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid access token",
  })
  async getMe(
    @Headers("authorization") authHeader: string,
  ): Promise<ProfileResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    const decoded = this.tokenService.verifyAccessToken(token);
    return this.getProfileUseCase.execute(decoded.sub);
  }

  @Get("profile")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Check profile completion status",
    description:
      "Checks whether the authenticated user has completed their profile onboarding. Returns boolean status wrapped in ResponseResult envelope for mobile onboarding check.",
  })
  @ApiResponse({
    status: 200,
    description: "Profile completion status boolean",
    type: Boolean,
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid access token",
  })
  async checkProfileStatus(
    @Headers("authorization") authHeader: string,
  ): Promise<boolean> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    const decoded = this.tokenService.verifyAccessToken(token);
    const profile = await this.getProfileUseCase.execute(decoded.sub);
    return profile.Profile.profileCompleted;
  }

  @Put("profile")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "avatar", maxCount: 1 },
      { name: "selfie", maxCount: 1 },
      { name: "gallery", maxCount: 1 },
    ]),
  )
  @ApiConsumes("multipart/form-data", "application/json")
  @ApiOperation({
    summary: "Update user profile (step-by-step onboarding, edit profile & gallery)",
    description:
      "Updates user profile using Android schema (language, lat, lon, profilePictureId, gallery, Profile: { fullName, username, phoneNumber, bio, languages, Demographic, Preferences }). Supports avatar, selfie, and at most 1 gallery photo upload per request (WebP/JPEG, min 1200x800, max 4096x4096, max 3MB). Single canonical contract: gallery and profilePictureId are sent strictly outside the Profile object at the root level (no duplicate keys). profilePictureId can be provided to select an existing gallery photo as profile picture without needing profilePicture key.",
  })
  @ApiBody({
    description:
      "Android schema profile update payload and optional image files",
    type: UpdateProfileDto,
  })
  @ApiResponse({
    status: 200,
    description: "Profile successfully updated with categorized response",
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Validation error (e.g. invalid username, age < 18 or > 80, corrupted/invalid image, resolution below 1200x800)",
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
          gallery?: Express.Multer.File[];
        }
      | Express.Multer.File,
  ): Promise<ProfileResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    const decoded = this.tokenService.verifyAccessToken(token);

    let avatarFile: Express.Multer.File | undefined;
    let selfieFile: Express.Multer.File | undefined;
    let galleryFiles: Express.Multer.File[] = [];

    if (files) {
      if ((files as any).buffer) {
        avatarFile = files as Express.Multer.File;
      } else {
        const fileMap = files as {
          avatar?: Express.Multer.File[];
          selfie?: Express.Multer.File[];
          gallery?: Express.Multer.File[];
        };
        avatarFile = fileMap.avatar?.[0];
        selfieFile = fileMap.selfie?.[0];
        galleryFiles = fileMap.gallery || [];
      }
    }

    if (galleryFiles && galleryFiles.length > 1) {
      throw new BadRequestException("Only one gallery image is allowed per request");
    }

    console.log("User with ID:", decoded.sub, "with data:", dto);

    if (galleryFiles && galleryFiles.length > 0) {
      return this.updateProfileUseCase.execute(
        decoded.sub,
        dto,
        avatarFile,
        selfieFile,
        galleryFiles,
      );
    }

    return this.updateProfileUseCase.execute(
      decoded.sub,
      dto,
      avatarFile,
      selfieFile,
    );
  }

  @Post("profile")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "avatar", maxCount: 1 },
      { name: "selfie", maxCount: 1 },
      { name: "gallery", maxCount: 1 },
    ]),
  )
  @ApiConsumes("multipart/form-data", "application/json")
  @ApiOperation({
    summary: "Update user profile via POST (mobile client onboarding & edit profile)",
    description:
      "Handles profile updates for mobile clients that submit via HTTP POST to /users/profile. Only 1 gallery photo upload allowed per request.",
  })
  @ApiBody({
    description:
      "Categorized profile update payload or mobile multipart data and optional image files",
    type: UpdateProfileDto,
  })
  @ApiResponse({
    status: 200,
    description: "Profile successfully updated with categorized response",
    type: ProfileResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid authorization token",
  })
  async updateProfilePost(
    @Headers("authorization") authHeader: string,
    @Body() dto: UpdateProfileDto,
    @UploadedFiles()
    files?:
      | {
          avatar?: Express.Multer.File[];
          selfie?: Express.Multer.File[];
          gallery?: Express.Multer.File[];
        }
      | Express.Multer.File,
  ): Promise<ProfileResponseDto> {
    return this.updateProfile(authHeader, dto, files);
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
