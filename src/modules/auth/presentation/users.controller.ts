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

    return this.updateProfileUseCase.execute(
      decoded.sub,
      dto,
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
