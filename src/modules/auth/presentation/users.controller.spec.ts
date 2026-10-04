import { Test, TestingModule } from "@nestjs/testing";
import { UnauthorizedException } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { TokenService } from "../application/services/token.service";
import { GetProfileUseCase } from "../application/use-cases/get-profile.use-case";
import { UpdateProfileUseCase } from "../application/use-cases/update-profile.use-case";

describe("UsersController", () => {
  let controller: UsersController;
  let mockTokenService: any;
  let mockGetProfileUseCase: any;
  let mockUpdateProfileUseCase: any;

  beforeEach(async () => {
    mockTokenService = {
      verifyAccessToken: jest.fn().mockReturnValue({ sub: 1 }),
    };

    mockGetProfileUseCase = {
      execute: jest.fn(),
    };

    mockUpdateProfileUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: TokenService, useValue: mockTokenService },
        { provide: GetProfileUseCase, useValue: mockGetProfileUseCase },
        { provide: UpdateProfileUseCase, useValue: mockUpdateProfileUseCase },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  describe("GET /users/me", () => {
    it("should throw UnauthorizedException if header is missing", async () => {
      await expect(controller.getMe("")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when token is expired", async () => {
      mockTokenService.verifyAccessToken.mockImplementationOnce(() => {
        throw new UnauthorizedException("Access token has expired");
      });
      await expect(controller.getMe("Bearer expired_token")).rejects.toThrow(
        new UnauthorizedException("Access token has expired"),
      );
    });

    it("should return profile in Android-matching schema with profileCompleted status", async () => {
      const mockProfile: any = {
        id: 1,
        email: "user@example.com",
        language: "EN",
        lat: null,
        lon: null,
        profileValidated: false,
        isPremium: true,
        Profile: {
          fullName: "John Doe",
          username: "john_doe",
          profileCompleted: true,
          isPremium: true,
          Demographic: {},
          RelationType: null,
        },
      };
      mockGetProfileUseCase.execute.mockResolvedValue(mockProfile);

      const res = await controller.getMe("Bearer valid_token");
      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith(
        "valid_token",
      );
      expect(mockGetProfileUseCase.execute).toHaveBeenCalledWith(1);
      expect(res).toEqual(mockProfile);
      expect(res.Profile.profileCompleted).toBe(true);
      expect(res.isPremium).toBe(true);
      expect(res.Profile.isPremium).toBe(true);
    });
  });

  describe("PUT /users/profile", () => {
    it("should throw UnauthorizedException if header is missing", async () => {
      await expect(
        controller.updateProfile("", {} as any, undefined),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw UnauthorizedException when token is expired", async () => {
      mockTokenService.verifyAccessToken.mockImplementationOnce(() => {
        throw new UnauthorizedException("Access token has expired");
      });
      await expect(
        controller.updateProfile("Bearer expired_token", {} as any, undefined),
      ).rejects.toThrow(new UnauthorizedException("Access token has expired"));
    });

    it("should throw UnauthorizedException when token is invalid", async () => {
      mockTokenService.verifyAccessToken.mockImplementationOnce(() => {
        throw new UnauthorizedException("Invalid access token");
      });
      await expect(
        controller.updateProfile("Bearer invalid_token", {} as any, undefined),
      ).rejects.toThrow(new UnauthorizedException("Invalid access token"));
    });

    it("should delegate dto to updateProfileUseCase and return Android-matching response", async () => {
      const dto = {
        language: "EN",
        Profile: {
          fullName: "John Doe",
          Demographic: {
            birthDate: "1998-11-25",
            gender: "Male",
          },
        },
      };
      const mockFile: any = { buffer: Buffer.from("img") };
      const expectedResponse: any = {
        id: 1,
        email: null,
        language: "EN",
        lat: null,
        lon: null,
        profileValidated: false,
        Profile: {
          fullName: "John Doe",
          username: null,
          profileCompleted: false,
          Demographic: {
            birthDate: "1998-11-25",
            gender: "MALE",
          },
          RelationType: null,
        },
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
      expect(res.Profile.profileCompleted).toBe(false);
    });

    it("should accept both avatar and selfie files and pass to use case", async () => {
      const dto = {
        Profile: {
          fullName: "John Doe",
          Demographic: {
            height: 180,
          },
        },
      };
      const avatarFile: any = { buffer: Buffer.from("avatar_buf") };
      const selfieFile: any = { buffer: Buffer.from("selfie_buf") };
      const expectedResponse: any = {
        id: 1,
        language: "EN",
        profileValidated: false,
        Profile: {
          fullName: "John Doe",
          avatar: "/uploads/avatars/avatar_1.webp",
          profileCompleted: false,
          Demographic: { height: 180 },
          RelationType: null,
        },
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

    it("should pass Android-matching dto structure directly to updateProfileUseCase", async () => {
      const payload: any = {
        language: "EN",
        lat: 35.6892,
        lon: 51.389,
        Profile: {
          fullName: "Sarah Connor",
          username: "sarah_c",
          Demographic: {
            birthDate: "1995-05-15",
            height: 172,
            degree: "BACHELOR_DEGREE",
            profession: "Engineer",
            relationStatus: "SINGLE",
            City: { id: 150293 },
          },
          RelationType: "LONG",
        },
      };

      mockUpdateProfileUseCase.execute.mockResolvedValue({
        id: 1,
        language: "EN",
        lat: 35.6892,
        lon: 51.389,
        profileValidated: false,
        Profile: {
          ...payload.Profile,
          profileCompleted: false,
        },
      });

      await controller.updateProfile(
        "Bearer token123",
        payload,
        undefined,
      );

      expect(mockUpdateProfileUseCase.execute).toHaveBeenCalledWith(
        1,
        payload,
        undefined,
        undefined,
      );
    });

    it("should support backwards-compatible createProfile alias method", async () => {
      const dto = { Profile: { fullName: "John Doe" } };
      const expectedResponse: any = {
        id: 1,
        language: "EN",
        profileValidated: false,
        Profile: {
          fullName: "John Doe",
          profileCompleted: false,
        },
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

  describe("GET /users/profile (mobile profile completion check)", () => {
    it("should throw UnauthorizedException if header is missing", async () => {
      await expect(controller.checkProfileStatus("")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should return boolean profileCompleted status", async () => {
      const mockProfile: any = {
        id: 1,
        language: "EN",
        Profile: { fullName: "John Doe", profileCompleted: true },
      };
      mockGetProfileUseCase.execute.mockResolvedValue(mockProfile);

      const res = await controller.checkProfileStatus("Bearer valid_token");
      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith(
        "valid_token",
      );
      expect(mockGetProfileUseCase.execute).toHaveBeenCalledWith(1);
      expect(res).toBe(true);
    });
  });

  describe("POST /users/profile (mobile onboarding & profile update)", () => {
    it("should delegate to updateProfile and return profile response", async () => {
      const dto = {
        Profile: { fullName: "Mobile User" },
      };
      const expectedResponse: any = {
        id: 1,
        language: "EN",
        profileValidated: false,
        Profile: { fullName: "Mobile User", profileCompleted: false },
      };
      mockUpdateProfileUseCase.execute.mockResolvedValue(expectedResponse);

      const res = await controller.updateProfilePost(
        "Bearer mobile_token",
        dto as any,
        undefined,
      );

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith(
        "mobile_token",
      );
      expect(mockUpdateProfileUseCase.execute).toHaveBeenCalledWith(
        1,
        dto,
        undefined,
        undefined,
      );
      expect(res).toEqual(expectedResponse);
    });

    it("should accept gallery files and pass them to updateProfileUseCase", async () => {
      const dto = {
        Profile: { fullName: "Gallery User" },
      };
      const avatarFile: any = { buffer: Buffer.from("avatar_buf") };
      const galleryFiles: any[] = [
        { buffer: Buffer.from("img1") },
        { buffer: Buffer.from("img2") },
      ];
      const expectedResponse: any = {
        id: 1,
        Profile: { fullName: "Gallery User" },
        gallery: [],
      };
      mockUpdateProfileUseCase.execute.mockResolvedValue(expectedResponse);

      const res = await controller.updateProfile(
        "Bearer token123",
        dto as any,
        { avatar: [avatarFile], gallery: galleryFiles } as any,
      );

      expect(mockUpdateProfileUseCase.execute).toHaveBeenCalledWith(
        1,
        dto,
        avatarFile,
        undefined,
        galleryFiles,
      );
      expect(res).toEqual(expectedResponse);
    });
  });
});
