import { BadRequestException, NotFoundException } from "@nestjs/common";
import { GetUserAvatarUseCase } from "./get-user-avatar.use-case";

describe("GetUserAvatarUseCase", () => {
  let useCase: GetUserAvatarUseCase;
  let mockPrisma: any;
  let mockMediaUrlResolver: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    mockMediaUrlResolver = {
      resolveUrl: jest.fn(
        (path: string) => `http://localhost:3000/assets/${path.replace(/^\/+/, "")}`,
      ),
    };

    useCase = new GetUserAvatarUseCase(mockPrisma, mockMediaUrlResolver);
  });

  it("should throw BadRequestException for invalid user IDs", async () => {
    await expect(useCase.execute(0)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(-5)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(NaN)).rejects.toThrow(BadRequestException);
    await expect(useCase.execute(null as any)).rejects.toThrow(BadRequestException);
  });

  it("should throw NotFoundException if user does not exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(99)).rejects.toThrow(NotFoundException);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 99 },
      select: {
        id: true,
        profile: {
          select: {
            avatarUrl: true,
            profilePictureUrl: true,
          },
        },
        gallery: {
          select: {
            imageUrl: true,
            isProfilePicture: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  });

  it("should prioritize active profile picture from gallery", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      profile: {
        avatarUrl: "avatars/onboarding.webp",
        profilePictureUrl: "gallery/old.webp",
      },
      gallery: [
        { imageUrl: "gallery/photo1.webp", isProfilePicture: false },
        { imageUrl: "gallery/active_pic.webp", isProfilePicture: true },
      ],
    });

    const result = await useCase.execute(1);

    expect(result).toEqual({
      id: 1,
      avatarUrl: "http://localhost:3000/assets/gallery/active_pic.webp",
    });
  });

  it("should fallback to profilePictureUrl if no gallery photo has isProfilePicture true", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 2,
      profile: {
        avatarUrl: "avatars/onboarding.webp",
        profilePictureUrl: "gallery/profile_pic.webp",
      },
      gallery: [
        { imageUrl: "gallery/photo1.webp", isProfilePicture: false },
      ],
    });

    const result = await useCase.execute(2);

    expect(result).toEqual({
      id: 2,
      avatarUrl: "http://localhost:3000/assets/gallery/profile_pic.webp",
    });
  });

  it("should fallback to profile avatarUrl if no profilePictureUrl or gallery isProfilePicture", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 3,
      profile: {
        avatarUrl: "avatars/avatar_1.webp",
        profilePictureUrl: null,
      },
      gallery: [],
    });

    const result = await useCase.execute(3);

    expect(result).toEqual({
      id: 3,
      avatarUrl: "http://localhost:3000/assets/avatars/avatar_1.webp",
    });
  });

  it("should fallback to first gallery photo if other sources are null", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 4,
      profile: {
        avatarUrl: null,
        profilePictureUrl: null,
      },
      gallery: [
        { imageUrl: "gallery/first_photo.webp", isProfilePicture: false },
      ],
    });

    const result = await useCase.execute(4);

    expect(result).toEqual({
      id: 4,
      avatarUrl: "http://localhost:3000/assets/gallery/first_photo.webp",
    });
  });

  it("should return avatarUrl as null if user has no avatar or photos", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 5,
      profile: null,
      gallery: [],
    });

    const result = await useCase.execute(5);

    expect(result).toEqual({
      id: 5,
      avatarUrl: null,
    });
  });

  it("should return raw path if mediaUrlResolver is not provided", async () => {
    const useCaseWithoutResolver = new GetUserAvatarUseCase(mockPrisma);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 6,
      profile: {
        avatarUrl: "avatars/avatar_6.webp",
        profilePictureUrl: null,
      },
      gallery: [],
    });

    const result = await useCaseWithoutResolver.execute(6);

    expect(result).toEqual({
      id: 6,
      avatarUrl: "avatars/avatar_6.webp",
    });
  });
});
