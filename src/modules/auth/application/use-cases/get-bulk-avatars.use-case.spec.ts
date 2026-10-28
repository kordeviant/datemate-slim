import { GetBulkAvatarsUseCase } from "./get-bulk-avatars.use-case";

describe("GetBulkAvatarsUseCase", () => {
  let useCase: GetBulkAvatarsUseCase;
  let mockPrisma: any;
  let mockMediaUrlResolver: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findMany: jest.fn(),
      },
    };

    mockMediaUrlResolver = {
      resolveUrl: jest.fn(
        (path: string) => `http://localhost:3000/assets/${path.replace(/^\/+/, "")}`,
      ),
    };

    useCase = new GetBulkAvatarsUseCase(mockPrisma, mockMediaUrlResolver);
  });

  it("should return empty array when ids is null, undefined, or empty", async () => {
    expect(await useCase.execute(null as any)).toEqual([]);
    expect(await useCase.execute(undefined as any)).toEqual([]);
    expect(await useCase.execute([])).toEqual([]);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("should return empty array when no valid positive integers are provided", async () => {
    expect(await useCase.execute([-1, 0, NaN, "abc" as any])).toEqual([]);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("should fetch users, resolve avatars, and preserve order of requested IDs", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 2,
        profile: {
          avatarUrl: "avatars/bob.webp",
        },
      },
      {
        id: 1,
        profile: {
          avatarUrl: "avatars/alice.webp",
        },
      },
    ]);

    // Requesting [1, 2] with duplicate 1
    const result = await useCase.execute([1, 2, 1]);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [1, 2] },
      },
      select: {
        id: true,
        profile: {
          select: {
            avatarUrl: true,
          },
        },
      },
    });

    expect(result).toEqual([
      {
        id: 1,
        avatarUrl: "http://localhost:3000/assets/avatars/alice.webp",
      },
      {
        id: 2,
        avatarUrl: "http://localhost:3000/assets/avatars/bob.webp",
      },
    ]);
  });

  it("should handle users with no profile or empty avatar safely", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 3,
        profile: null,
      },
      {
        id: 4,
        profile: {
          avatarUrl: "",
        },
      },
    ]);

    const result = await useCase.execute([3, 4]);

    expect(result).toEqual([
      {
        id: 3,
        avatarUrl: null,
      },
      {
        id: 4,
        avatarUrl: null,
      },
    ]);
  });

  it("should handle string IDs and filter out invalid values", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 10,
        profile: {
          avatarUrl: "avatars/ten.webp",
        },
      },
    ]);

    const result = await useCase.execute(["10" as any, "invalid" as any, -2 as any]);

    expect(result).toEqual([
      {
        id: 10,
        avatarUrl: "http://localhost:3000/assets/avatars/ten.webp",
      },
    ]);
  });
});
