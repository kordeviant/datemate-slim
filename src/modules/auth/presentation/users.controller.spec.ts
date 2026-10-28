import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { TokenService } from "../application/services/token.service";
import { GetProfileUseCase } from "../application/use-cases/get-profile.use-case";
import { UpdateProfileUseCase } from "../application/use-cases/update-profile.use-case";
import { DeleteAccountUseCase } from "../application/use-cases/delete-account.use-case";
import { DeleteGalleryImageUseCase } from "../application/use-cases/delete-gallery-image.use-case";
import { GetUserDevicesUseCase } from "../application/use-cases/get-user-devices.use-case";
import { TerminateClientDeviceUseCase } from "../application/use-cases/terminate-client-device.use-case";
import { TerminateAllClientDevicesUseCase } from "../application/use-cases/terminate-all-client-devices.use-case";
import { GetBulkUsersUseCase } from "../application/use-cases/get-bulk-users.use-case";
import { UpdateDeviceTokenUseCase } from "../application/use-cases/update-device-token.use-case";
import { GetDeviceTokenUseCase } from "../application/use-cases/get-device-token.use-case";
import { GetUserAvatarUseCase } from "../application/use-cases/get-user-avatar.use-case";
import { GetBulkAvatarsUseCase } from "../application/use-cases/get-bulk-avatars.use-case";

describe("UsersController", () => {
  let controller: UsersController;
  let mockTokenService: any;
  let mockGetProfileUseCase: any;
  let mockUpdateProfileUseCase: any;
  let mockDeleteAccountUseCase: any;
  let mockDeleteGalleryImageUseCase: any;
  let mockGetUserDevicesUseCase: any;
  let mockTerminateClientDeviceUseCase: any;
  let mockTerminateAllClientDevicesUseCase: any;
  let mockGetBulkUsersUseCase: any;
  let mockUpdateDeviceTokenUseCase: any;
  let mockGetDeviceTokenUseCase: any;
  let mockGetUserAvatarUseCase: any;
  let mockGetBulkAvatarsUseCase: any;

  beforeEach(async () => {
    mockTokenService = {
      verifyAccessToken: jest.fn().mockReturnValue({ sub: 1, sessionId: 10 }),
    };

    mockGetProfileUseCase = {
      execute: jest.fn(),
    };

    mockUpdateProfileUseCase = {
      execute: jest.fn(),
    };

    mockDeleteAccountUseCase = {
      execute: jest.fn().mockResolvedValue({ userId: 1, deleted: true }),
    };

    mockDeleteGalleryImageUseCase = {
      execute: jest.fn().mockResolvedValue({ userId: 1, galleryId: 10, deleted: true }),
    };

    mockGetUserDevicesUseCase = {
      execute: jest.fn(),
    };

    mockTerminateClientDeviceUseCase = {
      execute: jest.fn(),
    };

    mockTerminateAllClientDevicesUseCase = {
      execute: jest.fn(),
    };

    mockGetBulkUsersUseCase = {
      execute: jest.fn(),
    };

    mockUpdateDeviceTokenUseCase = {
      execute: jest.fn(),
    };

    mockGetDeviceTokenUseCase = {
      execute: jest.fn(),
    };

    mockGetUserAvatarUseCase = {
      execute: jest.fn(),
    };

    mockGetBulkAvatarsUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: TokenService, useValue: mockTokenService },
        { provide: GetProfileUseCase, useValue: mockGetProfileUseCase },
        { provide: UpdateProfileUseCase, useValue: mockUpdateProfileUseCase },
        { provide: DeleteAccountUseCase, useValue: mockDeleteAccountUseCase },
        { provide: DeleteGalleryImageUseCase, useValue: mockDeleteGalleryImageUseCase },
        { provide: GetUserDevicesUseCase, useValue: mockGetUserDevicesUseCase },
        { provide: TerminateClientDeviceUseCase, useValue: mockTerminateClientDeviceUseCase },
        { provide: TerminateAllClientDevicesUseCase, useValue: mockTerminateAllClientDevicesUseCase },
        { provide: GetBulkUsersUseCase, useValue: mockGetBulkUsersUseCase },
        { provide: UpdateDeviceTokenUseCase, useValue: mockUpdateDeviceTokenUseCase },
        { provide: GetDeviceTokenUseCase, useValue: mockGetDeviceTokenUseCase },
        { provide: GetUserAvatarUseCase, useValue: mockGetUserAvatarUseCase },
        { provide: GetBulkAvatarsUseCase, useValue: mockGetBulkAvatarsUseCase },
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
      expect(typeof res.profileValidated).toBe("boolean");
      expect(res.profileValidated).toBe(false);
      expect(res.Profile.profileCompleted).toBe(true);
      expect(res.isPremium).toBe(true);
      expect(res.Profile.isPremium).toBe(true);
    });
  });

  describe("GET /users/:id", () => {
    it("should throw UnauthorizedException if header is missing", async () => {
      await expect(controller.getUserProfile("", 2)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException when token is expired", async () => {
      mockTokenService.verifyAccessToken.mockImplementationOnce(() => {
        throw new UnauthorizedException("Access token has expired");
      });
      await expect(
        controller.getUserProfile("Bearer expired_token", 2),
      ).rejects.toThrow(new UnauthorizedException("Access token has expired"));
    });

    it("should return target user profile in Android-matching schema", async () => {
      const mockProfile: any = {
        id: 2,
        email: "other@example.com",
        language: "FA",
        lat: 35.6892,
        lon: 51.389,
        profileValidated: true,
        isPremium: false,
        Profile: {
          fullName: "Other User",
          username: "other_user",
          profileCompleted: true,
          isPremium: false,
          Demographic: {
            birthDate: "1999-01-01",
            gender: "FEMALE",
          },
          RelationType: "LONG",
        },
        gallery: [
          {
            id: 10,
            url: "http://cdn/photo.webp",
            isProfilePicture: true,
          },
        ],
      };
      mockGetProfileUseCase.execute.mockResolvedValue(mockProfile);

      const res = await controller.getUserProfile("Bearer valid_token", 2);
      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith(
        "valid_token",
      );
      expect(mockGetProfileUseCase.execute).toHaveBeenCalledWith(2);
      expect(res).toEqual(mockProfile);
      expect(res.id).toBe(2);
      expect(res.Profile.fullName).toBe("Other User");
      expect(res.gallery?.[0].isProfilePicture).toBe(true);
    });

    it("should throw NotFoundException if user is not found", async () => {
      mockGetProfileUseCase.execute.mockRejectedValueOnce(
        new UnauthorizedException("User account not found"),
      );

      await expect(
        controller.getUserProfile("Bearer valid_token", 999),
      ).rejects.toThrow(new NotFoundException("User with ID 999 not found"));
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

    it("should accept single gallery file and pass to updateProfileUseCase", async () => {
      const dto = {
        Profile: { fullName: "Gallery User" },
      };
      const avatarFile: any = { buffer: Buffer.from("avatar_buf") };
      const galleryFiles: any[] = [
        { buffer: Buffer.from("img1") },
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

    it("should reject multiple gallery files with BadRequestException", async () => {
      const dto = {
        Profile: { fullName: "Gallery User" },
      };
      const galleryFiles: any[] = [
        { buffer: Buffer.from("img1") },
        { buffer: Buffer.from("img2") },
      ];

      await expect(
        controller.updateProfile(
          "Bearer token123",
          dto as any,
          { gallery: galleryFiles } as any,
        ),
      ).rejects.toThrow(
        new BadRequestException("Only one gallery image is allowed per request"),
      );
    });
  });

  describe("DELETE /users/me", () => {
    it("should throw UnauthorizedException if header is missing", async () => {
      await expect(controller.deleteAccount("")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should delete account and return success response", async () => {
      const res = await controller.deleteAccount("Bearer valid_token");

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith("valid_token");
      expect(mockDeleteAccountUseCase.execute).toHaveBeenCalledWith(1);
      expect(res).toEqual({
        status: "success",
        message: "Account deleted successfully",
        data: { userId: 1, deleted: true },
      });
    });
  });

  describe("DELETE /users/gallery/:galleryId", () => {
    it("should throw UnauthorizedException if header is missing", async () => {
      await expect(controller.deleteGalleryImage("", 10)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should delete gallery image and return success response", async () => {
      const res = await controller.deleteGalleryImage("Bearer valid_token", 10);

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith("valid_token");
      expect(mockDeleteGalleryImageUseCase.execute).toHaveBeenCalledWith(1, 10);
      expect(res).toEqual({
        status: "success",
        success: true,
        message: "Gallery image deleted successfully",
        data: { userId: 1, galleryId: 10, deleted: true },
      });
    });
  });

  describe("GET /users/devices", () => {
    it("should throw UnauthorizedException if header is missing", async () => {
      await expect(controller.getUserDevices("")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should retrieve devices list and return success envelope", async () => {
      const mockResult = {
        devices: [
          {
            id: 1,
            deviceInfo: "iPhone 15",
            fcmToken: "fcm1",
            isActive: true,
            isCurrent: true,
            createdAt: "2026-10-10T00:00:00.000Z",
            expiresAt: "2026-11-10T00:00:00.000Z",
          },
        ],
        activeDevices: [],
        inactiveDevices: [],
        total: 1,
        activeCount: 1,
        inactiveCount: 0,
      };

      mockGetUserDevicesUseCase.execute.mockResolvedValue(mockResult);

      const res = await controller.getUserDevices("Bearer valid_token");

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith("valid_token");
      expect(mockGetUserDevicesUseCase.execute).toHaveBeenCalledWith(
        1,
        10,
      );
      expect(res).toEqual({
        status: "success",
        message: "User devices retrieved successfully",
        data: mockResult,
      });
    });
  });

  describe("DELETE /users/devices/:deviceId", () => {
    it("should throw UnauthorizedException if header is missing", async () => {
      await expect(controller.terminateDevice("", 5)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should terminate a single device and return success response", async () => {
      const mockResult = {
        deviceId: 5,
        terminated: true,
      };

      mockTerminateClientDeviceUseCase.execute.mockResolvedValue(mockResult);

      const res = await controller.terminateDevice("Bearer valid_token", 5);

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith("valid_token");
      expect(mockTerminateClientDeviceUseCase.execute).toHaveBeenCalledWith(1, 5);
      expect(res).toEqual({
        status: "success",
        success: true,
        message: "Device session terminated successfully",
        data: mockResult,
      });
    });
  });

  describe("DELETE /users/devices", () => {
    it("should throw UnauthorizedException if header is missing", async () => {
      await expect(controller.terminateAllDevices("")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should terminate all devices when excludeCurrent is false", async () => {
      const mockResult = {
        terminatedCount: 3,
        excludedCurrent: false,
      };

      mockTerminateAllClientDevicesUseCase.execute.mockResolvedValue(mockResult);

      const res = await controller.terminateAllDevices(
        "Bearer valid_token",
        { excludeCurrent: false },
      );

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith("valid_token");
      expect(mockTerminateAllClientDevicesUseCase.execute).toHaveBeenCalledWith(
        1,
        false,
        undefined,
        10,
      );
      expect(res).toEqual({
        status: "success",
        success: true,
        message: "Device sessions terminated successfully",
        data: mockResult,
      });
    });

    it("should terminate all devices except current when excludeCurrent is true", async () => {
      const mockResult = {
        terminatedCount: 2,
        excludedCurrent: true,
      };

      mockTerminateAllClientDevicesUseCase.execute.mockResolvedValue(mockResult);

      const res = await controller.terminateAllDevices(
        "Bearer valid_token",
        { excludeCurrent: true, refreshToken: "current_refresh_token" },
      );

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith("valid_token");
      expect(mockTerminateAllClientDevicesUseCase.execute).toHaveBeenCalledWith(
        1,
        true,
        "current_refresh_token",
        10,
      );
      expect(res).toEqual({
        status: "success",
        success: true,
        message: "Device sessions terminated successfully",
        data: mockResult,
      });
    });
  });

  describe("POST /users/bulk", () => {
    it("should accept bare array of user IDs and return bulk user details", async () => {
      const mockUsers = [
        {
          id: 1,
          avatar: "http://localhost:3000/assets/avatars/user1.webp",
          username: "alice",
          fullName: "Alice Smith",
        },
        {
          id: 2,
          avatar: "http://localhost:3000/assets/avatars/user2.webp",
          username: "bob",
          fullName: "Bob Jones",
        },
      ];
      mockGetBulkUsersUseCase.execute.mockResolvedValue(mockUsers);

      const res = await controller.getBulkUsers([1, 2]);

      expect(mockGetBulkUsersUseCase.execute).toHaveBeenCalledWith([1, 2]);
      expect(res).toEqual(mockUsers);
    });

    it("should verify token if authHeader is provided", async () => {
      mockGetBulkUsersUseCase.execute.mockResolvedValue([]);

      await controller.getBulkUsers([1], "Bearer valid_token");

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith("valid_token");
      expect(mockGetBulkUsersUseCase.execute).toHaveBeenCalledWith([1]);
    });

    it("should extract IDs if wrapped in object with userIds or ids", async () => {
      mockGetBulkUsersUseCase.execute.mockResolvedValue([]);

      await controller.getBulkUsers({ userIds: [10, 20] });
      expect(mockGetBulkUsersUseCase.execute).toHaveBeenCalledWith([10, 20]);

      await controller.getBulkUsers({ ids: [30, 40] });
      expect(mockGetBulkUsersUseCase.execute).toHaveBeenCalledWith([30, 40]);
    });

    it("should pass empty array when body is null, undefined, or empty", async () => {
      mockGetBulkUsersUseCase.execute.mockResolvedValue([]);

      await controller.getBulkUsers([]);
      expect(mockGetBulkUsersUseCase.execute).toHaveBeenCalledWith([]);

      await controller.getBulkUsers(null);
      expect(mockGetBulkUsersUseCase.execute).toHaveBeenCalledWith([]);
    });
  });

  describe("PUT /users/device-token", () => {
    it("should throw UnauthorizedException if authorization header is missing", async () => {
      await expect(
        controller.updateDeviceToken("", { token: "fcm_token_123" }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should update device token successfully for authenticated user", async () => {
      const mockResult = {
        userId: 1,
        token: "fcm_token_123",
        deviceInfo: "Pixel 8 Pro",
      };
      mockUpdateDeviceTokenUseCase.execute.mockResolvedValue(mockResult);

      const res = await controller.updateDeviceToken("Bearer valid_token", {
        token: "fcm_token_123",
        deviceInfo: "Pixel 8 Pro",
      });

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith("valid_token");
      expect(mockUpdateDeviceTokenUseCase.execute).toHaveBeenCalledWith(
        1,
        { token: "fcm_token_123", deviceInfo: "Pixel 8 Pro" },
        10,
      );
      expect(res).toEqual({
        status: "success",
        message: "Device token updated successfully",
        data: mockResult,
      });
    });
  });

  describe("GET /users/:userId/device-token", () => {
    it("should return device token and deviceInfo for specified user", async () => {
      const mockResult = {
        userId: 42,
        token: "token_sample",
        deviceInfo: "iPhone 15",
      };
      mockGetDeviceTokenUseCase.execute.mockResolvedValue(mockResult);

      const res = await controller.getDeviceTokenByUserId(42);

      expect(mockGetDeviceTokenUseCase.execute).toHaveBeenCalledWith(42);
      expect(res).toEqual({
        status: "success",
        message: "Device token retrieved successfully",
        data: mockResult,
      });
    });

    it("should retrieve device token without validating JWT", async () => {
      const mockResult = {
        userId: 42,
        token: "token_sample",
        deviceInfo: null,
      };
      mockGetDeviceTokenUseCase.execute.mockResolvedValue(mockResult);

      const res = await controller.getDeviceTokenByUserId(42);

      expect(mockTokenService.verifyAccessToken).not.toHaveBeenCalled();
      expect(mockGetDeviceTokenUseCase.execute).toHaveBeenCalledWith(42);
      expect(res).toEqual({
        status: "success",
        message: "Device token retrieved successfully",
        data: mockResult,
      });
    });

    it("should propagate NotFoundException when user does not exist", async () => {
      mockGetDeviceTokenUseCase.execute.mockRejectedValue(
        new NotFoundException("User not found"),
      );

      await expect(controller.getDeviceTokenByUserId(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("GET /users/:id/avatar", () => {
    it("should throw UnauthorizedException when auth header is missing", async () => {
      await expect(controller.getUserAvatar("", 1)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should verify access token and call getUserAvatarUseCase", async () => {
      const mockResult = {
        id: 1,
        avatarUrl: "http://localhost:3000/assets/avatars/avatar_1.webp",
      };
      mockGetUserAvatarUseCase.execute.mockResolvedValue(mockResult);

      const res = await controller.getUserAvatar("Bearer valid_token", 1);

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith("valid_token");
      expect(mockGetUserAvatarUseCase.execute).toHaveBeenCalledWith(1);
      expect(res).toEqual(mockResult);
    });

    it("should propagate NotFoundException when user does not exist", async () => {
      mockGetUserAvatarUseCase.execute.mockRejectedValue(
        new NotFoundException("User with ID 999 not found"),
      );

      await expect(
        controller.getUserAvatar("Bearer valid_token", 999),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("GET /users/avatars/:ids", () => {
    it("should throw UnauthorizedException when auth header is missing", async () => {
      await expect(controller.getBulkAvatars("", "1,2,3")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should verify access token, parse comma-separated IDs, and call getBulkAvatarsUseCase", async () => {
      const mockResult = [
        { id: 1, avatarUrl: "http://localhost:3000/assets/avatars/avatar_1.webp" },
        { id: 2, avatarUrl: null },
      ];
      mockGetBulkAvatarsUseCase.execute.mockResolvedValue(mockResult);

      const res = await controller.getBulkAvatars("Bearer valid_token", " 1, 2, abc, -5 ");

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith("valid_token");
      expect(mockGetBulkAvatarsUseCase.execute).toHaveBeenCalledWith([1, 2]);
      expect(res).toEqual(mockResult);
    });

    it("should handle empty or invalid rawIds string gracefully", async () => {
      mockGetBulkAvatarsUseCase.execute.mockResolvedValue([]);

      const res = await controller.getBulkAvatars("Bearer valid_token", "");

      expect(mockTokenService.verifyAccessToken).toHaveBeenCalledWith("valid_token");
      expect(mockGetBulkAvatarsUseCase.execute).toHaveBeenCalledWith([]);
      expect(res).toEqual([]);
    });
  });
});



