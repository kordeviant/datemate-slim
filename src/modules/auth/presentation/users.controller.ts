import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UnauthorizedException,
  VERSION_NEUTRAL,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { ApiKeyGuard } from "../../../common/guards/api-key.guard";
import { TokenService } from "../application/services/token.service";
import { GetProfileUseCase } from "../application/use-cases/get-profile.use-case";
import { UpdateProfileUseCase } from "../application/use-cases/update-profile.use-case";
import { DeleteAccountUseCase } from "../application/use-cases/delete-account.use-case";
import { DeleteGalleryImageUseCase } from "../application/use-cases/delete-gallery-image.use-case";
import { GetUserDevicesUseCase } from "../application/use-cases/get-user-devices.use-case";
import { TerminateClientDeviceUseCase } from "../application/use-cases/terminate-client-device.use-case";
import { TerminateAllClientDevicesUseCase } from "../application/use-cases/terminate-all-client-devices.use-case";
import { UpdateProfileDto } from "../application/dtos/update-profile.dto";
import { ProfileResponseDto } from "../application/dtos/profile-response.dto";
import { DeleteAccountResponseDto } from "../application/dtos/delete-account-response.dto";
import { DeleteGalleryImageResponseDto } from "../application/dtos/delete-gallery-image-response.dto";
import {
  UserDevicesResponseDto,
  TerminateClientDeviceResponseDto,
  TerminateAllClientDevicesResponseDto,
  TerminateClientDevicesDto,
} from "../application/dtos/user-devices.dto";
import { GetBulkUsersUseCase } from "../application/use-cases/get-bulk-users.use-case";
import { BulkUserItemDto } from "../application/dtos/bulk-user-item.dto";
import { UpdateDeviceTokenUseCase } from "../application/use-cases/update-device-token.use-case";
import { GetDeviceTokenUseCase } from "../application/use-cases/get-device-token.use-case";
import { GetUserAvatarUseCase } from "../application/use-cases/get-user-avatar.use-case";
import { GetBulkAvatarsUseCase } from "../application/use-cases/get-bulk-avatars.use-case";
import { UserAvatarDto } from "../application/dtos/user-avatar.dto";
import {
  DeviceTokenResponseDto,
  UpdateDeviceTokenDto,
} from "../application/dtos/device-token.dto";

@ApiTags("Users")
@Controller({ path: "users", version: ["1", VERSION_NEUTRAL] })
export class UsersController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly getProfileUseCase: GetProfileUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly deleteAccountUseCase: DeleteAccountUseCase,
    private readonly deleteGalleryImageUseCase: DeleteGalleryImageUseCase,
    private readonly getUserDevicesUseCase: GetUserDevicesUseCase,
    private readonly terminateClientDeviceUseCase: TerminateClientDeviceUseCase,
    private readonly terminateAllClientDevicesUseCase: TerminateAllClientDevicesUseCase,
    private readonly getBulkUsersUseCase: GetBulkUsersUseCase,
    private readonly updateDeviceTokenUseCase: UpdateDeviceTokenUseCase,
    private readonly getDeviceTokenUseCase: GetDeviceTokenUseCase,
    private readonly getUserAvatarUseCase: GetUserAvatarUseCase,
    private readonly getBulkAvatarsUseCase: GetBulkAvatarsUseCase,
  ) {}

  @Delete(["me", "account"])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Delete user account",
    description:
      "Allows the authenticated user to permanently delete their own account and all associated profile, gallery, swipe, and session data.",
  })
  @ApiResponse({
    status: 200,
    description: "Account deleted successfully",
    type: DeleteAccountResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid access token",
  })
  async deleteAccount(
    @Headers("authorization") authHeader: string,
  ): Promise<DeleteAccountResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    const decoded = await this.tokenService.verifyAccessToken(token);
    const result = await this.deleteAccountUseCase.execute(decoded.sub);
    return {
      status: "success",
      message: "Account deleted successfully",
      data: result,
    };
  }

  @Delete("gallery/:galleryId")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Delete user gallery image",
    description:
      "Allows the authenticated user to delete a specific photo from their gallery by galleryId. If the deleted photo was the active profile picture, the backend automatically falls back to another gallery photo or clears profilePictureUrl.",
  })
  @ApiParam({
    name: "galleryId",
    description: "ID of the gallery image to delete",
    type: Number,
    example: 12,
  })
  @ApiResponse({
    status: 200,
    description: "Gallery image deleted successfully",
    type: DeleteGalleryImageResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid access token",
  })
  @ApiResponse({
    status: 404,
    description: "Gallery image not found or does not belong to the user",
  })
  async deleteGalleryImage(
    @Headers("authorization") authHeader: string,
    @Param("galleryId", ParseIntPipe) galleryId: number,
  ): Promise<DeleteGalleryImageResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    const decoded = await this.tokenService.verifyAccessToken(token);
    const result = await this.deleteGalleryImageUseCase.execute(
      decoded.sub,
      galleryId,
    );
    return {
      status: "success",
      success: true,
      message: "Gallery image deleted successfully",
      data: result,
    };
  }

  @Get("devices")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get list of active and inactive devices/sessions for the authenticated user",
    description:
      "Retrieves all active and inactive device sessions for the authenticated user. Automatically identifies the current session as isCurrent: true using the Bearer access token.",
  })
  @ApiResponse({
    status: 200,
    description: "User devices retrieved successfully",
    type: UserDevicesResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid access token",
  })
  async getUserDevices(
    @Headers("authorization") authHeader: string,
  ): Promise<UserDevicesResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    const decoded = await this.tokenService.verifyAccessToken(token);

    const result = await this.getUserDevicesUseCase.execute(
      decoded.sub,
      decoded.sessionId,
    );

    return {
      status: "success",
      message: "User devices retrieved successfully",
      data: result,
    };
  }

  @Delete("devices/:deviceId")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Terminate a specific device session for the authenticated user",
    description:
      "Terminates/logs out a single device session belonging to the authenticated user by deviceId (session ID).",
  })
  @ApiParam({
    name: "deviceId",
    description: "Session ID of the device to terminate",
    type: Number,
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: "Device session terminated successfully",
    type: TerminateClientDeviceResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid access token",
  })
  @ApiResponse({
    status: 404,
    description: "Device session not found or does not belong to the user",
  })
  async terminateDevice(
    @Headers("authorization") authHeader: string,
    @Param("deviceId", ParseIntPipe) deviceId: number,
  ): Promise<TerminateClientDeviceResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    const decoded = await this.tokenService.verifyAccessToken(token);

    const result = await this.terminateClientDeviceUseCase.execute(
      decoded.sub,
      deviceId,
    );

    return {
      status: "success",
      success: true,
      message: "Device session terminated successfully",
      data: result,
    };
  }

  @Delete("devices")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Terminate all device sessions or all except current device",
    description:
      "Terminates all sessions for the authenticated user, or terminates all sessions except the current active session when excludeCurrent is true in the request body.",
  })
  @ApiResponse({
    status: 200,
    description: "Device sessions terminated successfully",
    type: TerminateAllClientDevicesResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad request",
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid access token",
  })
  async terminateAllDevices(
    @Headers("authorization") authHeader: string,
    @Body() body?: TerminateClientDevicesDto,
  ): Promise<TerminateAllClientDevicesResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    const decoded = await this.tokenService.verifyAccessToken(token);

    const excludeCurrent = Boolean(body?.excludeCurrent);
    const refreshToken = body?.refreshToken;

    const result = await this.terminateAllClientDevicesUseCase.execute(
      decoded.sub,
      excludeCurrent,
      refreshToken,
      decoded.sessionId,
    );

    return {
      status: "success",
      success: true,
      message: "Device sessions terminated successfully",
      data: result,
    };
  }

  @Put("device-token")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Update device token",
    description:
      "Updates the device push notification token (and optional deviceInfo) for the authenticated user's current session.",
  })
  @ApiBody({ type: UpdateDeviceTokenDto })
  @ApiResponse({
    status: 200,
    description: "Device token updated successfully",
    type: DeviceTokenResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Validation error (missing or invalid token)",
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid authorization token",
  })
  async updateDeviceToken(
    @Headers("authorization") authHeader: string,
    @Body() dto: UpdateDeviceTokenDto,
  ): Promise<DeviceTokenResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    const decoded = await this.tokenService.verifyAccessToken(token);

    const result = await this.updateDeviceTokenUseCase.execute(
      decoded.sub,
      dto,
      decoded.sessionId,
    );

    return {
      status: "success",
      message: "Device token updated successfully",
      data: result,
    };
  }

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
    const decoded = await this.tokenService.verifyAccessToken(token);
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
    const decoded = await this.tokenService.verifyAccessToken(token);
    const profile = await this.getProfileUseCase.execute(decoded.sub);
    return profile.Profile.profileCompleted;
  }

  @Post("bulk")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get bulk users by IDs",
    description:
      "Reads a list of user IDs directly from the request body and returns their id, avatar, username, and fullName.",
  })
  @ApiBody({
    description: "List of user IDs",
    schema: {
      type: "array",
      items: { type: "integer", example: 1 },
      example: [1, 2, 3],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Bulk users retrieved successfully",
    type: [BulkUserItemDto],
  })
  @ApiResponse({
    status: 401,
    description: "Invalid access token",
  })
  async getBulkUsers(
    @Body() body: any,
    @Headers("authorization") authHeader?: string,
  ): Promise<BulkUserItemDto[]> {
    if (authHeader) {
      const token = authHeader
        .replace(/^(Bearer\s*)+/i, "")
        .trim()
        .replace(/^["']|["']$/g, "");
      if (token) {
        await this.tokenService.verifyAccessToken(token);
      }
    }

    let rawIds: any[] = [];
    if (Array.isArray(body)) {
      rawIds = body;
    } else if (body && typeof body === "object") {
      if (Array.isArray(body.userIds)) {
        rawIds = body.userIds;
      } else if (Array.isArray(body.ids)) {
        rawIds = body.ids;
      }
    }

    return this.getBulkUsersUseCase.execute(rawIds);
  }

  @Get(":userId/device-token")
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiSecurity("api-key")
  @ApiHeader({
    name: "x-api-key",
    description: "Internal service API key for accessing device tokens",
    required: true,
    example: "datemate_device_token_api_key_2026",
  })
  @ApiOperation({
    summary: "Get device token and deviceInfo by user ID",
    description:
      "Retrieves the active device push notification token and device info for the specified user ID. Authenticated exclusively via API key (server-to-server), not JWT.",
  })
  @ApiParam({
    name: "userId",
    description: "User ID to retrieve device token for",
    type: Number,
    example: 12,
  })
  @ApiResponse({
    status: 200,
    description: "Device token retrieved successfully",
    type: DeviceTokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Invalid or missing API key",
  })
  @ApiResponse({
    status: 404,
    description: "User not found",
  })
  async getDeviceTokenByUserId(
    @Param("userId", ParseIntPipe) userId: number,
  ): Promise<DeviceTokenResponseDto> {
    const result = await this.getDeviceTokenUseCase.execute(userId);

    return {
      status: "success",
      message: "Device token retrieved successfully",
      data: result,
    };
  }

  @Get("avatars/:ids")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get multiple user avatars by comma-separated IDs",
    description:
      "Returns a list containing only the user ID and avatar URL for each requested ID in the path.",
  })
  @ApiParam({
    name: "ids",
    description: "Comma-separated list of user IDs (e.g. 1,2,3)",
    type: String,
    example: "1,2,3",
  })
  @ApiResponse({
    status: 200,
    description: "User avatars retrieved successfully",
    type: [UserAvatarDto],
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid access token",
  })
  async getBulkAvatars(
    @Headers("authorization") authHeader: string,
    @Param("ids") rawIds: string,
  ): Promise<UserAvatarDto[]> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    await this.tokenService.verifyAccessToken(token);

    const ids = (rawIds || "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((id) => !isNaN(id) && id > 0);

    return this.getBulkAvatarsUseCase.execute(ids);
  }

  @Get(":id/avatar")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get user avatar by ID",
    description:
      "Retrieves only the user ID and resolved avatar URL for the specified user ID.",
  })
  @ApiParam({
    name: "id",
    description: "ID of the user to retrieve avatar for",
    type: Number,
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: "User avatar retrieved successfully",
    type: UserAvatarDto,
  })
  @ApiResponse({
    status: 401,
    description: "Missing or invalid access token",
  })
  @ApiResponse({
    status: 404,
    description: "User not found",
  })
  async getUserAvatar(
    @Headers("authorization") authHeader: string,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<UserAvatarDto> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    await this.tokenService.verifyAccessToken(token);

    return this.getUserAvatarUseCase.execute(id);
  }

  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({
    summary: "Get user profile by ID for client",
    description:
      "Retrieves another user's profile details in canonical Android schema (identical response model to /me): language, lat, lon, profileValidated, isPremium, Profile (fullName, username, phoneNumber, bio, languages, avatar, profilePicture, profilePictureId, profileCompleted, isPremium, Demographic, RelationType, Answers, LikedActivities), and gallery.",
  })
  @ApiParam({
    name: "id",
    description: "ID of the user to retrieve profile for",
    type: Number,
    example: 30,
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
  @ApiResponse({
    status: 404,
    description: "User not found",
  })
  async getUserProfile(
    @Headers("authorization") authHeader: string,
    @Param("id", ParseIntPipe) id: number,
  ): Promise<ProfileResponseDto> {
    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }
    const token = authHeader
      .replace(/^(Bearer\s*)+/i, "")
      .trim()
      .replace(/^["']|["']$/g, "");
    await this.tokenService.verifyAccessToken(token);

    try {
      return await this.getProfileUseCase.execute(id);
    } catch (err) {
      if (
        err instanceof UnauthorizedException &&
        err.message === "User account not found"
      ) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      throw err;
    }
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
      "Updates user profile using Android schema (language, lat, lon, profilePictureId, gallery, Profile: { fullName, username, phoneNumber, bio, languages, Demographic, Preferences }). Supports avatar, selfie, and at most 1 gallery photo upload per request (WebP/JPEG, min 50KB, max 10MB). Single canonical contract: gallery and profilePictureId are sent strictly outside the Profile object at the root level (no duplicate keys). profilePictureId can be provided to select an existing gallery photo as profile picture without needing profilePicture key.",
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
      "Validation error (e.g. invalid username, age < 18 or > 80, corrupted/invalid image, size not between 50KB and 10MB)",
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
    const decoded = await this.tokenService.verifyAccessToken(token);

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
