import { GetBulkUsersUseCase } from "./get-bulk-users.use-case";

describe("GetBulkUsersUseCase", () => {
  let useCase: GetBulkUsersUseCase;
  let mockPrisma: any;
  let mockMediaUrlResolver: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findMany: jest.fn(),
      },
    };

    mockMediaUrlResolver = {
      resolveUrl: jest.fn((path: string) => `http://localhost:3000/assets/${path.replace(/^\/+/, "")}`),
    };

    useCase = new GetBulkUsersUseCase(mockPrisma, mockMediaUrlResolver);
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
          fullName: "Bob Jones",
          username: "bob",
          avatarUrl: "avatars/bob.webp",
          profilePictureUrl: null,
        },
      },
      {
        id: 1,
        profile: {
          fullName: "Alice Smith",
          username: "alice",
          avatarUrl: "avatars/alice.webp",
          profilePictureUrl: null,
        },
      },
    ]);

    // Requesting [1, 2] in that specific order, with duplicate 1
    const result = await useCase.execute([1, 2, 1]);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [1, 2] },
      },
      select: {
        id: true,
        profile: {
          select: {
            fullName: true,
            username: true,
            avatarUrl: true,
            profilePictureUrl: true,
          },
        },
      },
    });

    expect(result).toEqual([
      {
        id: 1,
        avatar: "http://localhost:3000/assets/avatars/alice.webp",
        username: "alice",
        fullName: "Alice Smith",
      },
      {
        id: 2,
        avatar: "http://localhost:3000/assets/avatars/bob.webp",
        username: "bob",
        fullName: "Bob Jones",
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
          fullName: null,
          username: "user4",
          avatarUrl: "",
          profilePictureUrl: null,
        },
      },
    ]);

    const result = await useCase.execute([3, 4]);

    expect(result).toEqual([
      {
        id: 3,
        avatar: null,
        username: null,
        fullName: null,
      },
      {
        id: 4,
        avatar: null,
        username: "user4",
        fullName: null,
      },
    ]);
  });

  it("should fallback to profilePictureUrl if avatarUrl is missing", async () => {
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: 5,
        profile: {
          fullName: "Charlie",
          username: "charlie",
          avatarUrl: null,
          profilePictureUrl: "gallery/photo.webp",
        },
      },
    ]);

    const result = await useCase.execute([5]);

    expect(result).toEqual([
      {
        id: 5,
        avatar: "http://localhost:3000/assets/gallery/photo.webp",
        username: "charlie",
        fullName: "Charlie",
      },
    ]);
  });
});
