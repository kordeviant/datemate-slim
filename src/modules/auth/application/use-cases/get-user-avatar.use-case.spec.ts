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
          },
        },
      },
    });
  });

  it("should return resolved avatarUrl from profile", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 1,
      profile: {
        avatarUrl: "avatars/onboarding.webp",
      },
    });

    const result = await useCase.execute(1);

    expect(result).toEqual({
      id: 1,
      avatarUrl: "http://localhost:3000/assets/avatars/onboarding.webp",
    });
    expect(mockMediaUrlResolver.resolveUrl).toHaveBeenCalledWith("avatars/onboarding.webp");
  });

  it("should return avatarUrl as null if user profile is null or has empty avatarUrl", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 2,
      profile: null,
    });

    const result1 = await useCase.execute(2);
    expect(result1).toEqual({
      id: 2,
      avatarUrl: null,
    });

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 3,
      profile: {
        avatarUrl: "   ",
      },
    });

    const result2 = await useCase.execute(3);
    expect(result2).toEqual({
      id: 3,
      avatarUrl: null,
    });
  });

  it("should return raw path if mediaUrlResolver is not provided", async () => {
    const useCaseWithoutResolver = new GetUserAvatarUseCase(mockPrisma);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 4,
      profile: {
        avatarUrl: "avatars/avatar_4.webp",
      },
    });

    const result = await useCaseWithoutResolver.execute(4);

    expect(result).toEqual({
      id: 4,
      avatarUrl: "avatars/avatar_4.webp",
    });
  });
});
