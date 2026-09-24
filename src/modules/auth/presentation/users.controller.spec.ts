import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { TokenService } from "../application/services/token.service";
import { UpdateProfileUseCase } from "../application/use-cases/update-profile.use-case";
import { USER_REPOSITORY } from "../domain/repositories/user.repository.interface";

describe("UsersController", () => {
  let controller: UsersController;
  let mockTokenService: any;
  let mockUserRepo: any;
  let mockUpdateProfileUseCase: any;

  beforeEach(async () => {
    mockTokenService = {
      verifyAccessToken: jest.fn().mockReturnValue({ sub: 1 }),
    };

    mockUserRepo = {
      hasCompletedProfile: jest.fn().mockResolvedValue(false),
    };

    mockUpdateProfileUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: TokenService, useValue: mockTokenService },
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: UpdateProfileUseCase, useValue: mockUpdateProfileUseCase },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe("GET /users/profile", () => {
    it("should throw UnauthorizedException if header is missing", async () => {
      await expect(controller.checkUserProfile("")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should return completion status", async () => {
      mockUserRepo.hasCompletedProfile.mockResolvedValue(true);
      const res = await controller.checkUserProfile("Bearer valid_token");
      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith(
        "valid_token",
      );
      expect(mockUserRepo.hasCompletedProfile).toHaveBeenCalledWith(1);
      expect(res).toBe(true);
    });
  });

  describe("PUT /users/profile", () => {
    it("should throw UnauthorizedException if header is missing", async () => {
      await expect(
        controller.updateProfile("", {} as any, undefined),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should delegate to updateProfileUseCase and return profileCompleted: false", async () => {
      const dto = {
        firstName: "John",
        username: "john_doe",
        birthDate: "1998-11-25",
        gender: "Male",
        language: "EN",
      };
      const mockFile: any = { buffer: Buffer.from("img") };
      const expectedResponse: any = {
        userId: 1,
        firstName: "John",
        username: "john_doe",
        age: 27,
        gender: "MALE",
        language: "en",
        profileCompleted: false,
      };

      mockUpdateProfileUseCase.execute.mockResolvedValue(expectedResponse);

      const res = await controller.updateProfile(
        "Bearer token123",
        dto as any,
        mockFile,
      );

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith(
        "token123",
      );
      expect(mockUpdateProfileUseCase.execute).toHaveBeenCalledWith(
        1,
        dto,
        mockFile,
        undefined,
      );
      expect(res).toEqual(expectedResponse);
      expect(res.profileCompleted).toBe(false);
    });

    it("should accept both avatar and selfie files and pass to use case", async () => {
      const dto = {
        firstName: "John",
        height: 180,
      };
      const avatarFile: any = { buffer: Buffer.from("avatar_buf") };
      const selfieFile: any = { buffer: Buffer.from("selfie_buf") };
      const expectedResponse: any = {
        userId: 1,
        firstName: "John",
        avatarUrl: "/uploads/avatars/avatar_1.webp",
        selfieUrl: "/uploads/selfies/selfie_1.webp",
        profileCompleted: false,
      };

      mockUpdateProfileUseCase.execute.mockResolvedValue(expectedResponse);

      const res = await controller.updateProfile(
        "Bearer token123",
        dto as any,
        { avatar: [avatarFile], selfie: [selfieFile] } as any,
      );

      expect(mockUpdateProfileUseCase.execute).toHaveBeenCalledWith(
        1,
        dto,
        avatarFile,
        selfieFile,
      );
      expect(res).toEqual(expectedResponse);
    });

    it("should parse Retrofit multipart data string and unwrap nested Demographic.City.id", async () => {
      const rawData = JSON.stringify({
        firstName: "Sarah",
        Demographic: {
          City: { id: 150293, name: "Tehran" },
          height: 172,
          degree: "BACHELOR",
        },
        Preferences: {
          relation: "LONG_TERM",
        },
      });

      mockUpdateProfileUseCase.execute.mockResolvedValue({
        userId: 1,
        firstName: "Sarah",
        cityId: 150293,
        profileCompleted: false,
      });

      await controller.updateProfile(
        "Bearer token123",
        { data: rawData } as any,
        undefined,
      );

      expect(mockUpdateProfileUseCase.execute).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          firstName: "Sarah",
          cityId: 150293,
          height: 172,
          degree: "BACHELOR",
          relation: "LONG_TERM",
        }),
        undefined,
        undefined,
      );
    });

    it("should unpack snake_case city_id and nested city objects", async () => {
      mockUpdateProfileUseCase.execute.mockResolvedValue({
        userId: 1,
        cityId: 42,
        profileCompleted: false,
      });

      await controller.updateProfile(
        "Bearer token123",
        { city_id: 42 } as any,
        undefined,
      );

      expect(mockUpdateProfileUseCase.execute).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          cityId: 42,
        }),
        undefined,
        undefined,
      );
    });

    it("should support backwards-compatible createProfile alias method", async () => {
      const dto = { firstName: "John" };
      const expectedResponse: any = {
        userId: 1,
        firstName: "John",
        profileCompleted: false,
      };
      mockUpdateProfileUseCase.execute.mockResolvedValue(expectedResponse);

      const res = await controller.createProfile(
        "Bearer token123",
        dto as any,
        undefined,
      );

      expect(res).toEqual(expectedResponse);
    });
  });
});
