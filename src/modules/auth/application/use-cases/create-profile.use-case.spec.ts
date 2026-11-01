import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { UpdateProfileUseCase } from "./update-profile.use-case";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { AvatarProcessorService } from "../services/avatar-processor.service";
import { GalleryProcessorService } from "../services/gallery-processor.service";

describe("UpdateProfileUseCase (Profile step-by-step onboarding & edit)", () => {
  let useCase: UpdateProfileUseCase;
  let mockPrisma: any;
  let mockAvatarProcessor: any;
  let mockGalleryProcessor: any;

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, language: "EN", email: "user@example.com" }),
        update: jest.fn().mockResolvedValue({ id: 1, language: "EN" }),
      },
      profile: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      demographic: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      preferences: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      city: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      question: {
        count: jest.fn().mockResolvedValue(0),
      },
      userQuestionAnswer: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      userGallery: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 1, imageUrl: 'images/gallery_1.webp' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback(mockPrisma);
      }),
    };

    mockAvatarProcessor = {
      processAndSaveAvatar: jest.fn().mockResolvedValue({
        relativeUrl: "/uploads/avatars/avatar_1.webp",
        filePath: "/path/to/avatar.webp",
        width: 1080,
        height: 1080,
        format: "webp",
        sizeBytes: 100000,
      }),
      processAndSaveSelfie: jest.fn().mockResolvedValue({
        relativeUrl: "/uploads/selfies/selfie_1.webp",
        filePath: "/path/to/selfie.webp",
        width: 1080,
        height: 1080,
        format: "webp",
        sizeBytes: 100000,
      }),
    };

    mockGalleryProcessor = {
      processBatchGallery: jest.fn().mockResolvedValue([
        {
          relativeUrl: "images/gallery_1_first.webp",
          filePath: "/path/to/gallery.webp",
          width: 1200,
          height: 1200,
          format: "webp",
          sizeBytes: 100000,
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateProfileUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AvatarProcessorService, useValue: mockAvatarProcessor },
        { provide: GalleryProcessorService, useValue: mockGalleryProcessor },
      ],
    }).compile();

    useCase = module.get<UpdateProfileUseCase>(UpdateProfileUseCase);
  });

  // New DTO format matching Android client schema
  const validDto = {
    language: "EN",
    lat: 35.6892,
    lon: 51.389,
    Profile: {
      fullName: "John Doe",
      username: "john_doe",
      Demographic: {
        birthDate: "1998-11-25",
        gender: "Male",
        City: { id: 10 },
      },
    },
  };

  const mockAvatarFile: any = {
    buffer: Buffer.from("fake_image_buffer"),
  };

  it("should throw UnauthorizedException if user account does not exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(useCase.execute(999, validDto)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should allow step-by-step update without avatar (avatar is optional)", async () => {
    const result = await useCase.execute(1, validDto, undefined);
    expect(result.Profile.avatar).toBe("");
    expect(mockAvatarProcessor.processAndSaveAvatar).not.toHaveBeenCalled();
    expect(mockPrisma.profile.upsert).toHaveBeenCalled();
    expect(result.Profile.profileCompleted).toBe(false);
  });

  it("should retain existing avatar when no new avatar is uploaded", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      userId: 1,
      fullName: "John Doe",
      username: "john_doe",
      avatarUrl: "/uploads/avatars/existing.webp",
      languages: ["en"],
    });

    const result = await useCase.execute(1, { Profile: { fullName: "Johnny Doe" } }, undefined);
    expect(result.Profile.avatar).toBe("/uploads/avatars/existing.webp");
    expect(result.Profile.fullName).toBe("Johnny Doe");
    expect(result.Profile.profileCompleted).toBe(false);
  });

  it("should process avatar when provided", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1_12345.webp",
    });

    const result = await useCase.execute(1, validDto, mockAvatarFile);
    expect(mockAvatarProcessor.processAndSaveAvatar).toHaveBeenCalledWith(
      mockAvatarFile.buffer,
      1,
    );
    expect(result.Profile.avatar).toBe("/uploads/avatars/avatar_1_12345.webp");
    expect(result.Profile.profileCompleted).toBe(false);
  });

  it("should reject invalid username formats with BadRequestException", async () => {
    await expect(
      useCase.execute(1, { Profile: { username: "a" } }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute(1, { Profile: { username: "user with spaces" } }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute(1, { Profile: { username: "-invalidstart" } }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute(1, { Profile: { username: "invalidend_" } }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute(1, { Profile: { username: "two..dots" } }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute(1, { Profile: { username: "emoji🎉user" } }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should reject reserved usernames with BadRequestException", async () => {
    await expect(
      useCase.execute(1, { Profile: { username: "admin" } }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute(1, { Profile: { username: "root" } }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute(1, { Profile: { username: "support" } }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should throw ConflictException if username is already taken by another user (case-insensitive)", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue({
      userId: 2,
      username: "taken_user",
    });

    await expect(
      useCase.execute(1, { Profile: { username: "TAKEN_USER" } }),
    ).rejects.toThrow(ConflictException);

    expect(mockPrisma.profile.findFirst).toHaveBeenCalledWith({
      where: {
        username: {
          equals: "taken_user",
          mode: "insensitive",
        },
      },
    });
  });

  it("should allow user to keep their own username without conflict", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue({
      userId: 1,
      username: "my_current_username",
    });

    await expect(
      useCase.execute(1, { Profile: { username: "my_current_username" } }),
    ).resolves.toBeDefined();
  });

  it("should reject birthDate for users under 18 years old", async () => {
    const today = new Date();
    const sixteenYearsAgo = new Date(
      today.getFullYear() - 16,
      today.getMonth(),
      today.getDate(),
    );
    const dobString = sixteenYearsAgo.toISOString().split("T")[0];

    await expect(
      useCase.execute(1, { Profile: { Demographic: { birthDate: dobString } } }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should reject birthDate for users over 80 years old", async () => {
    const today = new Date();
    const eightyOneYearsAgo = new Date(
      today.getFullYear() - 81,
      today.getMonth(),
      today.getDate(),
    );
    const dobString = eightyOneYearsAgo.toISOString().split("T")[0];

    await expect(
      useCase.execute(1, { Profile: { Demographic: { birthDate: dobString } } }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should reject invalid/impossible calendar dates", async () => {
    await expect(
      useCase.execute(1, { Profile: { Demographic: { birthDate: "2000-02-30" } } }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute(1, { Profile: { Demographic: { birthDate: "1998-13-01" } } }),
    ).rejects.toThrow(BadRequestException);
  });

  it("should reject celebrity impersonation usernames", async () => {
    await expect(
      useCase.execute(1, { Profile: { username: "taylor_swift" } }),
    ).rejects.toThrow(/reserved|prohibited/);

    await expect(
      useCase.execute(1, { Profile: { username: "elon_musk" } }),
    ).rejects.toThrow(/reserved|prohibited/);
  });

  it("should reject fake official / verification status usernames", async () => {
    await expect(
      useCase.execute(1, { Profile: { username: "john_verified" } }),
    ).rejects.toThrow(/status|suffix|keywords/);

    await expect(
      useCase.execute(1, { Profile: { username: "anna_official" } }),
    ).rejects.toThrow(/status|suffix|keywords/);
  });

  it("should permit update without birthDate if demographic already exists", async () => {
    mockPrisma.demographic.findUnique.mockResolvedValue({
      userId: 1,
      birthDate: new Date("1998-11-25"),
      gender: "MALE",
    });

    const result = await useCase.execute(
      1,
      { Profile: { fullName: "John Updated" } },
      undefined,
    );
    expect(result.Profile.fullName).toBe("John Updated");
    expect(result.Profile.Demographic.birthDate).toBe("1998-11-25");
    expect(result.Profile.profileCompleted).toBe(false);
  });

  it("should return profileCompleted as false during onboarding steps", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1.webp",
    });

    const result = await useCase.execute(1, validDto, mockAvatarFile);

    expect(result).toMatchObject({
      id: 1,
      Profile: {
        fullName: "John Doe",
        username: "john_doe",
        avatar: "/uploads/avatars/avatar_1.webp",
        profileCompleted: false,
        Demographic: {
          gender: "MALE",
        },
      },
    });
    expect(result.Profile.Demographic.birthDate).toBeDefined();
  });

  // Complete DTO in the new Android-matching schema
  const completeDto = {
    language: "EN",
    lat: 35.6892,
    lon: 51.389,
    Profile: {
      fullName: "John Doe",
      username: "john_doe",
      phoneNumber: "+1234567890",
      bio: "Software Engineer in Tehran",
      languages: ["en", "fa"],
      Demographic: {
        birthDate: "1998-11-25",
        gender: "Male",
        height: 178,
        degree: "PhD",
        profession: "Software Engineer",
        relationStatus: "Single",
        City: { id: 10 },
      },
      Preferences: {
        relation: "Fun and Dating",
      },
    },
  };

  const mockSelfieFile: any = {
    buffer: Buffer.from("fake_selfie_buffer"),
  };

  it("should return profileCompleted as true only when all questions and steps are answered", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1.webp",
    });
    mockAvatarProcessor.processAndSaveSelfie.mockResolvedValue({
      relativeUrl: "/uploads/selfies/selfie_1.webp",
    });
    mockPrisma.question.count.mockResolvedValue(5);
    mockPrisma.userQuestionAnswer.findMany.mockResolvedValue([
      { questionAnswer: { id: 1, questionId: 1, answerEn: "A1", answerFa: "A1" } },
      { questionAnswer: { id: 2, questionId: 2, answerEn: "A2", answerFa: "A2" } },
      { questionAnswer: { id: 3, questionId: 3, answerEn: "A3", answerFa: "A3" } },
      { questionAnswer: { id: 4, questionId: 4, answerEn: "A4", answerFa: "A4" } },
      { questionAnswer: { id: 5, questionId: 5, answerEn: "A5", answerFa: "A5" } },
    ]);

    const result = await useCase.execute(
      1,
      completeDto,
      mockAvatarFile,
      mockSelfieFile,
    );
    expect(result.Profile.profileCompleted).toBe(true);
    expect(result.Profile.Demographic.height).toBe(178);
    expect(result.Profile.Demographic.degree).toBe("DOCTORATE");
    expect(result.Profile.Demographic.profession).toBe("Software Engineer");
    expect(result.Profile.Demographic.relationStatus).toBe("SINGLE");
    expect(result.Profile.RelationType).toBe("FUN");
    expect(result.Profile.languages).toEqual(["en", "fa"]);
  });

  it("should return profileCompleted as false if questions exist but not all answered", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1.webp",
    });
    mockAvatarProcessor.processAndSaveSelfie.mockResolvedValue({
      relativeUrl: "/uploads/selfies/selfie_1.webp",
    });
    mockPrisma.question.count.mockResolvedValue(5);
    mockPrisma.userQuestionAnswer.findMany.mockResolvedValue([
      { questionAnswer: { questionId: 1 } },
      { questionAnswer: { questionId: 2 } },
      { questionAnswer: { questionId: 3 } },
    ]); // only 3 answered

    const result = await useCase.execute(
      1,
      completeDto,
      mockAvatarFile,
      mockSelfieFile,
    );
    expect(result.Profile.profileCompleted).toBe(false);
  });

  it("should return profileCompleted as true when all mandatory questions are answered even if PREFERENCES/INTERESTS questions are unanswered", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1.webp",
    });
    mockAvatarProcessor.processAndSaveSelfie.mockResolvedValue({
      relativeUrl: "/uploads/selfies/selfie_1.webp",
    });
    // 2 mandatory non-preferences questions in DB
    mockPrisma.question.count.mockResolvedValue(2);
    mockPrisma.userQuestionAnswer.findMany.mockResolvedValue([
      { questionAnswer: { id: 1, questionId: 1, question: { id: 1, type: "PERSONALITY" } } },
      { questionAnswer: { id: 2, questionId: 2, question: { id: 2, type: "PERSONALITY" } } },
    ]);

    const result = await useCase.execute(
      1,
      completeDto,
      mockAvatarFile,
      mockSelfieFile,
    );
    expect(result.Profile.profileCompleted).toBe(true);
  });

  it("should return profileCompleted as true even if selfie is missing when all other required steps are completed", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1.webp",
    });

    const result = await useCase.execute(
      1,
      completeDto,
      mockAvatarFile,
      undefined,
    );
    expect(result.Profile.profileCompleted).toBe(true);
  });

  it("should return profileCompleted as false if height is missing", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1.webp",
    });
    mockAvatarProcessor.processAndSaveSelfie.mockResolvedValue({
      relativeUrl: "/uploads/selfies/selfie_1.webp",
    });

    const dtoWithoutHeight = {
      ...completeDto,
      Profile: {
        ...completeDto.Profile,
        Demographic: {
          ...completeDto.Profile.Demographic,
          height: undefined,
        },
      },
    };
    const result = await useCase.execute(
      1,
      dtoWithoutHeight as any,
      mockAvatarFile,
      mockSelfieFile,
    );
    expect(result.Profile.profileCompleted).toBe(false);
  });

  it("should return profileCompleted as false if profession is missing", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1.webp",
    });
    mockAvatarProcessor.processAndSaveSelfie.mockResolvedValue({
      relativeUrl: "/uploads/selfies/selfie_1.webp",
    });

    const dtoWithoutJob = {
      ...completeDto,
      Profile: {
        ...completeDto.Profile,
        Demographic: {
          ...completeDto.Profile.Demographic,
          profession: undefined,
        },
      },
    };
    const result = await useCase.execute(
      1,
      dtoWithoutJob as any,
      mockAvatarFile,
      mockSelfieFile,
    );
    expect(result.Profile.profileCompleted).toBe(false);
  });

  it("should return profileCompleted as false if kind of relationship is missing", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1.webp",
    });
    mockAvatarProcessor.processAndSaveSelfie.mockResolvedValue({
      relativeUrl: "/uploads/selfies/selfie_1.webp",
    });

    const dtoWithoutRelation = {
      ...completeDto,
      Profile: {
        ...completeDto.Profile,
        Preferences: {
          relation: undefined,
        },
      },
    };
    const result = await useCase.execute(
      1,
      dtoWithoutRelation as any,
      mockAvatarFile,
      mockSelfieFile,
    );
    expect(result.Profile.profileCompleted).toBe(false);
  });

  it("should not touch existing fields when performing incremental update", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      userId: 1,
      fullName: "John Doe",
      username: "john_doe",
      avatarUrl: "/uploads/avatars/avatar_existing.webp",
      selfieUrl: "/uploads/selfies/selfie_existing.webp",
      languages: ["en"],
    });
    mockPrisma.demographic.findUnique.mockResolvedValue({
      userId: 1,
      birthDate: new Date("1998-11-25"),
      gender: "MALE",
      height: 180,
      degree: "DOCTORATE",
      job: "Engineer",
      relationStatus: "SINGLE",
    });
    mockPrisma.preferences.findUnique.mockResolvedValue({
      userId: 1,
      relation: "FUN",
    });

    // Only update height and profession
    const result = await useCase.execute(1, {
      Profile: {
        Demographic: {
          height: 182,
          profession: "Senior Architect",
        },
      },
    });

    expect(result.Profile.fullName).toBe("John Doe");
    expect(result.Profile.username).toBe("john_doe");
    expect(result.Profile.avatar).toBe("/uploads/avatars/avatar_existing.webp");
    expect(result.Profile.Demographic.height).toBe(182);
    expect(result.Profile.Demographic.profession).toBe("Senior Architect");
    expect(result.Profile.Demographic.degree).toBe("DOCTORATE");
    expect(result.Profile.Demographic.relationStatus).toBe("SINGLE");
    expect(result.Profile.RelationType).toBe("FUN");
    expect(result.Profile.profileCompleted).toBe(true);
  });

  it("should throw BadRequestException if language is empty string", async () => {
    await expect(useCase.execute(1, { language: "" })).rejects.toThrow(
      "Language cannot be empty",
    );
  });

  it("should throw BadRequestException if language is neither EN nor FA", async () => {
    await expect(useCase.execute(1, { language: "FR" })).rejects.toThrow(
      "Language must be either EN (English) or FA (Farsi)",
    );

    await expect(useCase.execute(1, { language: "de" })).rejects.toThrow(
      "Language must be either EN (English) or FA (Farsi)",
    );
  });

  it("should normalize language to uppercase in response", async () => {
    const result = await useCase.execute(1, { language: "EN" });
    expect(result.language).toBe("EN");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { language: "EN" },
    });
  });

  it("should normalize fa to FA in response", async () => {
    const result = await useCase.execute(1, { language: "fa" });
    expect(result.language).toBe("FA");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { language: "FA" },
    });
  });

  it("should support updating bio and cityId for edit profile", async () => {
    mockPrisma.city.findUnique.mockResolvedValue({ id: 10 });
    const result = await useCase.execute(1, {
      Profile: {
        bio: "Loves mountain climbing and coffee.",
        Demographic: { City: { id: 10 } },
      },
    });
    expect(result.Profile.bio).toBe("Loves mountain climbing and coffee.");
    expect(result.Profile.Demographic.City).toMatchObject({ id: 10 });
    expect(result.Profile.profileCompleted).toBe(false);
  });

  it("should update cityId when valid city exists in database", async () => {
    mockPrisma.city.findUnique.mockResolvedValue({ id: 15 });
    const result = await useCase.execute(1, {
      Profile: { Demographic: { City: { id: 15 } } },
    });
    expect(result.Profile.Demographic.City).toMatchObject({ id: 15 });
  });

  it("should return null for City if city does not exist in database (preventing FK violation)", async () => {
    mockPrisma.city.findUnique.mockResolvedValue(null);
    const result = await useCase.execute(1, {
      Profile: { Demographic: { City: { id: 999999 } } },
    });
    expect(result.Profile.Demographic.City).toBeNull();
  });

  it("should return null for unfilled fullName, username instead of empty string", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    const result = await useCase.execute(1, {});
    expect(result.Profile.fullName).toBeNull();
    expect(result.Profile.username).toBeNull();
  });

  it("should preserve existing fullName when subsequent step sends empty string or omitted", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      userId: 1,
      fullName: "Ali",
      username: "ali_dev",
      avatarUrl: "/uploads/avatars/avatar_1.webp",
    });

    const result = await useCase.execute(1, {
      Profile: {
        fullName: "",
        username: "",
        bio: "New bio",
      },
    });

    expect(result.Profile.fullName).toBe("Ali");
    expect(result.Profile.username).toBe("ali_dev");
    expect(result.Profile.bio).toBe("New bio");
  });

  it("should return filled values when user provides fullName and username", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);
    const result = await useCase.execute(1, {
      Profile: { fullName: "Sarah Connor", username: "sarah_connor" },
    });

    expect(result.Profile.fullName).toBe("Sarah Connor");
    expect(result.Profile.username).toBe("sarah_connor");
  });

  it("should process and return the Android-matching payload format", async () => {
    mockPrisma.city.findUnique.mockResolvedValue({
      id: 12,
      name: "Tehran",
      state: { name: "Tehran Province", country: { name: "Iran" } },
    });

    const userPayload = {
      language: "en",
      lat: 35.6892,
      lon: 51.389,
      Profile: {
        fullName: "Parsa",
        username: "parsa",
        phoneNumber: "+1234567890",
        bio: "Software engineer living in Tehran.",
        languages: ["Persian", "English"],
        Demographic: {
          birthDate: "1998-11-25",
          gender: "Male",
          height: 180,
          degree: "PhD",
          profession: "Software Engineer",
          relationStatus: "Single",
          City: { id: 12 },
        },
        Preferences: {
          relation: "Long term",
        },
      },
    };

    const res = await useCase.execute(1, userPayload as any);

    expect(res).toMatchObject({
      id: 1,
      email: "user@example.com",
      language: "EN",
      lat: 35.6892,
      lon: 51.389,
      profileValidated: false,
      isPremium: false,
      Profile: {
        fullName: "Parsa",
        username: "parsa",
        phoneNumber: "+1234567890",
        bio: "Software engineer living in Tehran.",
        languages: ["fa", "en"],
        avatar: "",
        profilePicture: null,
        profilePictureId: null,
        profileCompleted: false,
        isPremium: false,
        Demographic: {
          birthDate: "1998-11-25",
          gender: "MALE",
          height: 180,
          degree: "DOCTORATE",
          profession: "Software Engineer",
          relationStatus: "SINGLE",
          City: {
            id: 12,
            name: "Tehran",
            state: "Tehran Province",
            country: "Iran",
          },
        },
        RelationType: "LONG",
        Answers: {},
        LikedActivities: {},
      },
      gallery: [],
    });

    // Verify old keys are completely removed from response
    expect((res as any).personal).toBeUndefined();
    expect((res as any).account).toBeUndefined();
    expect((res as any).location).toBeUndefined();
    expect((res as any).dating).toBeUndefined();
  });

  it("should gracefully extract and map fields from Android mobile data payload", async () => {
    mockPrisma.city.findUnique.mockResolvedValue({
      id: 12,
      name: "Tehran",
      state: {
        name: "Tehran Province",
        country: { name: "Iran" },
      },
    });

    const mobilePayload = {
      data: JSON.stringify({
        firstName: "Parsa Mobile",
        username: "parsa_mobile",
        phoneNumber: "+989121234567",
        languages: ["Persian", "English"],
        bio: "Mobile app user",
        LikedActivities: [
          { id: 1, Interest: [{ id: 101 }, { id: 102 }] },
        ],
        Demographic: {
          birthDate: "1998-11-25T00:00:00.000Z",
          gender: "MALE",
          height: 185,
          degree: "MASTER",
          profession: "Mobile Engineer",
          relationStatus: "SINGLE",
          City: { id: 12, name: "Tehran" },
        },
        Preferences: {
          relation: "LONG_TERM",
        },
        language: "FA",
      }),
    };

    const res = await useCase.execute(1, mobilePayload as any);

    expect(res.Profile.fullName).toBe("Parsa Mobile");
    expect(res.Profile.Demographic.birthDate).toBe("1998-11-25");
    expect(res.Profile.Demographic.gender).toBe("MALE");
    expect(res.Profile.phoneNumber).toBe("+989121234567");
    expect(res.language).toBe("FA");

    expect(res.Profile.bio).toBe("Mobile app user");
    expect(res.Profile.Demographic.height).toBe(185);
    expect(res.Profile.Demographic.degree).toBe("MASTER_DEGREE");
    expect(res.Profile.Demographic.profession).toBe("Mobile Engineer");
    expect(res.Profile.languages).toEqual(["fa", "en"]);

    expect(res.Profile.Demographic.City).toMatchObject({ id: 12, name: "Tehran" });

    expect(res.Profile.Demographic.relationStatus).toBe("SINGLE");
    expect(res.Profile.RelationType).toBe("LONG");

    expect(res.Profile.username).toBe("parsa_mobile");
  });

  describe("Spoken languages normalization and validation", () => {
    it("should accept valid 2-letter language codes and return them lowercase", async () => {
      const res = await useCase.execute(1, {
        Profile: { languages: ["EN", "de", "FR", "it"] },
      });
      expect(res.Profile.languages).toEqual(["en", "de", "fr", "it"]);
    });

    it("should map full language names to their 2-letter codes", async () => {
      const res = await useCase.execute(1, {
        Profile: { languages: ["Persian", "English", "German", "Spanish", "Japanese"] },
      });
      expect(res.Profile.languages).toEqual(["fa", "en", "de", "es", "ja"]);
    });

    it("should deduplicate language codes if both full name and code are sent", async () => {
      const res = await useCase.execute(1, {
        Profile: { languages: ["en", "English", "farsi", "fa"] },
      });
      expect(res.Profile.languages).toEqual(["en", "fa"]);
    });

    it("should parse comma-separated string of languages into codes", async () => {
      const res = await useCase.execute(1, {
        Profile: { languages: "Russian, Turkish, Arabic" },
      });
      expect(res.Profile.languages).toEqual(["ru", "tr", "ar"]);
    });

    it("should throw BadRequestException for unsupported languages", async () => {
      await expect(
        useCase.execute(1, { Profile: { languages: ["klingon"] } }),
      ).rejects.toThrow("Invalid language 'klingon'");

      await expect(
        useCase.execute(1, { Profile: { languages: ["xx"] } }),
      ).rejects.toThrow("Invalid language 'xx'");
    });
  });

  describe("Flat form-data and existing demographic updates", () => {
    it("should update profile and demographic from flat DTO fields", async () => {
      mockPrisma.city.findUnique.mockResolvedValue({ id: 12, name: "Tehran" });

      const res = await useCase.execute(1, {
        language: "fa",
        lat: 35.6892,
        lon: 51.389,
        fullName: "Parsa Moloody",
        username: "parsam",
        phoneNumber: "+989123456789",
        bio: "Fullstack Dev",
        birthDate: "1998-11-25",
        gender: "MALE",
        height: 180,
        degree: "DOCTORATE",
        profession: "Software Engineer",
        relationStatus: "SINGLE",
        relation: "LONG",
        cityId: 12,
        languages: ["fa"],
      } as any);

      expect(res.language).toBe("FA");
      expect(res.lat).toBe(35.6892);
      expect(res.lon).toBe(51.389);
      expect(res.Profile.fullName).toBe("Parsa Moloody");
      expect(res.Profile.username).toBe("parsam");
      expect(res.Profile.phoneNumber).toBe("+989123456789");
      expect(res.Profile.bio).toBe("Fullstack Dev");
      expect(res.Profile.languages).toEqual(["fa"]);
      expect(res.Profile.Demographic.birthDate).toBe("1998-11-25");
      expect(res.Profile.Demographic.gender).toBe("MALE");
      expect(res.Profile.Demographic.height).toBe(180);
      expect(res.Profile.Demographic.degree).toBe("DOCTORATE");
      expect(res.Profile.Demographic.profession).toBe("Software Engineer");
      expect(res.Profile.Demographic.relationStatus).toBe("SINGLE");
      expect(res.Profile.Demographic.City).toMatchObject({ id: 12, name: "Tehran" });
      expect(res.Profile.RelationType).toBe("LONG");
    });

    it("should update birthDate when existingDemographic already exists", async () => {
      mockPrisma.demographic.findUnique.mockResolvedValue({
        id: 10,
        userId: 1,
        birthDate: new Date("1990-01-01"),
        gender: "MALE",
        cityId: null,
      });

      const res = await useCase.execute(1, {
        Profile: {
          Demographic: {
            birthDate: "1998-11-25",
          },
        },
      } as any);

      expect(res.Profile.Demographic.birthDate).toBe("1998-11-25");
      expect(mockPrisma.demographic.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 1 },
          data: expect.objectContaining({
            birthDate: new Date("1998-11-25T00:00:00.000Z"),
          }),
        }),
      );
    });

    it("should update LikedActivities when passed inside Profile as key-value map", async () => {
      mockPrisma.interest = {
        findMany: jest.fn().mockResolvedValue([{ id: 1 }, { id: 3 }, { id: 72 }]),
      } as any;
      mockPrisma.userInterest = {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        findMany: jest.fn().mockResolvedValue([
          { interestId: 1, interest: { id: 1, categoryId: 1 } },
          { interestId: 3, interest: { id: 3, categoryId: 1 } },
          { interestId: 72, interest: { id: 72, categoryId: 9 } },
        ]),
      } as any;

      const res = await useCase.execute(1, {
        Profile: {
          LikedActivities: {
            '1': [1, 3],
            '9': 72,
          },
        },
      } as any);

      expect(mockPrisma.userInterest.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 1, interestId: 1, isLiked: true },
          { userId: 1, interestId: 3, isLiked: true },
          { userId: 1, interestId: 72, isLiked: true },
        ],
      });
      expect(res.Profile.LikedActivities).toEqual({
        '1': [1, 3],
        '9': 72,
      });
    });

    it("should update profile fullName, username, and Demographic when passed inside data.Profile (Android payload)", async () => {
      mockPrisma.demographic.findUnique.mockResolvedValueOnce(null);
      const res = await useCase.execute(1, {
        data: {
          Profile: {
            fullName: "name4",
            username: "user4",
            Demographic: {
              birthDate: "1998-11-25",
              gender: "MALE",
              height: 180,
              degree: "BACHELOR",
              profession: "Software Engineer",
              relationStatus: "SINGLE",
            },
          },
          language: "EN",
          tempId: "2425d398-8cb3-4ac9-bf81-370b051c7c0c",
        },
      } as any);

      expect(res.Profile.fullName).toBe("name4");
      expect(res.Profile.username).toBe("user4");
      expect(res.Profile.Demographic.gender).toBe("MALE");
      expect(res.Profile.Demographic.birthDate).toBe("1998-11-25");
      expect(res.Profile.Demographic.height).toBe(180);
      expect(res.Profile.Demographic.degree).toBe("BACHELOR_DEGREE");
      expect(res.Profile.Demographic.profession).toBe("Software Engineer");
      expect(res.language).toBe("EN");
    });

    it("should update profile when passed as lowercase profile at root or inside data", async () => {
      const res1 = await useCase.execute(1, {
        profile: {
          bio: "Direct lowercase profile bio",
          fullName: "parsa",
          username: "parsa_0",
        },
      } as any);
      expect(res1.Profile.bio).toBe("Direct lowercase profile bio");
      expect(res1.Profile.fullName).toBe("parsa");
      expect(res1.Profile.username).toBe("parsa_0");

      const res2 = await useCase.execute(1, {
        data: {
          profile: {
            bio: "Nested lowercase profile bio",
            fullName: "Nested Name",
          },
        },
      } as any);
      expect(res2.Profile.bio).toBe("Nested lowercase profile bio");
      expect(res2.Profile.fullName).toBe("Nested Name");
    });
  });

  describe("Gallery rules & profile picture selection", () => {
    it("should reject update if candidate gallery items in update API exceed 1 (array of multiple items)", async () => {
      const excessiveGallery = [
        { id: 1 },
        { id: 2 },
      ];
      await expect(
        useCase.execute(1, {
          gallery: excessiveGallery,
        } as any),
      ).rejects.toThrow(
        new BadRequestException(
          "Only one gallery picture is allowed per request. Multiple gallery uploads are not permitted.",
        ),
      );
    });

    it("should reject update if multiple gallery files are provided", async () => {
      const fakeFiles: any[] = [
        { buffer: Buffer.alloc(100) },
        { buffer: Buffer.alloc(100) },
      ];
      await expect(
        useCase.execute(
          1,
          {} as any,
          undefined,
          undefined,
          fakeFiles,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          "Only one gallery picture is allowed per request. Multiple gallery uploads are not permitted.",
        ),
      );
    });

    it("should reject update if total projected gallery images exceed 10", async () => {
      mockPrisma.userGallery.count.mockResolvedValue(10);
      const fakeFiles: any[] = [
        { buffer: Buffer.alloc(100) },
      ];
      await expect(
        useCase.execute(
          1,
          {} as any,
          undefined,
          undefined,
          fakeFiles,
        ),
      ).rejects.toThrow(
        /User gallery cannot exceed maximum limit of 10 images/,
      );
    });

    it("should set first gallery as isProfilePicture by default when isProfilePicture is not sent", async () => {
      mockPrisma.userGallery.count.mockResolvedValue(0);
      mockPrisma.userGallery.findFirst.mockResolvedValue(null);
      mockPrisma.userGallery.create.mockResolvedValue({
        id: 1,
        userId: 1,
        imageUrl: "images/gallery_1_first.webp",
        isProfilePicture: true,
      });
      mockPrisma.userGallery.findMany.mockResolvedValue([
        {
          id: 1,
          userId: 1,
          imageUrl: "images/gallery_1_first.webp",
          isProfilePicture: true,
          createdAt: new Date("2026-10-04T12:00:00Z"),
        },
      ]);

      const singleFile: any = { buffer: Buffer.alloc(100) };
      const res = await useCase.execute(
        1,
        {
          // gallery object without isProfilePicture
          gallery: { description: "First upload" },
        } as any,
        undefined,
        undefined,
        [singleFile],
      );

      expect(mockPrisma.userGallery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isProfilePicture: true,
            description: "First upload",
          }),
        }),
      );
      expect(res.Profile.profilePicture).toBe("images/gallery_1_first.webp");
      expect(res.Profile.profilePictureId).toBe(1);
      expect(res.gallery![0].isProfilePicture).toBe(true);
    });

    it("should select one of the gallery images as profilePicture (distinct from avatar)", async () => {
      mockPrisma.userGallery.findFirst.mockResolvedValue({
        id: 15,
        userId: 1,
        imageUrl: "images/gallery_1_custom.webp",
        isProfilePicture: false,
      });
      mockPrisma.userGallery.findMany.mockResolvedValue([
        {
          id: 15,
          userId: 1,
          imageUrl: "images/gallery_1_custom.webp",
          description: "My profile photo",
          likesCount: 5,
          isProfilePicture: true,
          createdAt: new Date("2026-10-04T12:00:00Z"),
        },
      ]);

      const res = await useCase.execute(1, {
        profilePictureId: 15,
        Profile: {
          fullName: "Parsa",
        },
      } as any);

      expect(mockPrisma.userGallery.updateMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        data: { isProfilePicture: false },
      });
      expect(mockPrisma.userGallery.update).toHaveBeenCalledWith({
        where: { id: 15 },
        data: { isProfilePicture: true },
      });
      expect(res.Profile.profilePicture).toBe("images/gallery_1_custom.webp");
      expect(res.gallery).toHaveLength(1);
      expect(res.gallery![0].isProfilePicture).toBe(true);
      expect(res.gallery![0].id).toBe(15);
    });

    it("should delete gallery images specified in deleteGalleryIds", async () => {
      await useCase.execute(1, {
        deleteGalleryIds: [10, 11],
      } as any);

      expect(mockPrisma.userGallery.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: [10, 11] },
          userId: 1,
        },
      });
    });

    it("should not change active profile picture when uploading a second gallery photo with isProfilePicture omitted", async () => {
      mockPrisma.userGallery.count.mockResolvedValue(1);
      // Existing active profile picture exists
      mockPrisma.userGallery.findFirst.mockResolvedValue({
        id: 1,
        userId: 1,
        imageUrl: "images/gallery_1_existing.webp",
        isProfilePicture: true,
      });
      mockPrisma.userGallery.create.mockResolvedValue({
        id: 2,
        userId: 1,
        imageUrl: "images/gallery_1_second.webp",
        isProfilePicture: false,
      });
      mockPrisma.userGallery.findMany.mockResolvedValue([
        {
          id: 1,
          userId: 1,
          imageUrl: "images/gallery_1_existing.webp",
          isProfilePicture: true,
          createdAt: new Date("2026-10-04T12:00:00Z"),
        },
        {
          id: 2,
          userId: 1,
          imageUrl: "images/gallery_1_second.webp",
          isProfilePicture: false,
          createdAt: new Date("2026-10-04T13:00:00Z"),
        },
      ]);

      const singleFile: any = { buffer: Buffer.alloc(100) };
      const res = await useCase.execute(
        1,
        {
          gallery: { description: "Second photo" },
        } as any,
        undefined,
        undefined,
        [singleFile],
      );

      // The new photo is NOT set as profile picture because an existing active one already exists
      expect(mockPrisma.userGallery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isProfilePicture: false,
          }),
        }),
      );
      expect(res.Profile.profilePictureId).toBe(1);
    });

    it("should throw BadRequestException if profilePictureId does not exist for the user", async () => {
      mockPrisma.userGallery.findFirst.mockResolvedValue(null);

      await expect(
        useCase.execute(1, {
          profilePictureId: 9999,
        } as any),
      ).rejects.toThrow(
        new BadRequestException("Gallery image with specified profilePictureId not found."),
      );
    });

    it("should update profile picture by profilePictureId without needing profilePicture key in request", async () => {
      mockPrisma.userGallery.findFirst.mockResolvedValue({
        id: 42,
        userId: 1,
        imageUrl: "images/gallery_42.webp",
      });
      mockPrisma.userGallery.findMany.mockResolvedValue([
        {
          id: 42,
          userId: 1,
          imageUrl: "images/gallery_42.webp",
          isProfilePicture: true,
          createdAt: new Date("2026-10-04T12:00:00Z"),
        },
      ]);

      const res = await useCase.execute(1, {
        profilePictureId: 42,
        // Notice: NO profilePicture key provided in request
      } as any);

      expect(mockPrisma.userGallery.update).toHaveBeenCalledWith({
        where: { id: 42 },
        data: { isProfilePicture: true },
      });
      expect(res.Profile.profilePicture).toBe("images/gallery_42.webp");
      expect(res.Profile.profilePictureId).toBe(42);
    });

    it("should replace an existing gallery image when gallery id and a new file are provided", async () => {
      mockPrisma.userGallery.findFirst.mockResolvedValue({
        id: 10,
        userId: 1,
        imageUrl: "images/gallery_10_old.webp",
        description: "Old description",
        isProfilePicture: false,
      });
      mockPrisma.userGallery.update.mockResolvedValue({
        id: 10,
        userId: 1,
        imageUrl: "images/gallery_1_first.webp",
        description: "New description",
        isProfilePicture: false,
      });
      mockPrisma.userGallery.findMany.mockResolvedValue([
        {
          id: 10,
          userId: 1,
          imageUrl: "images/gallery_1_first.webp",
          description: "New description",
          isProfilePicture: false,
          createdAt: new Date("2026-10-04T12:00:00Z"),
        },
      ]);

      const dummyFile: any = {
        fieldname: "gallery",
        originalname: "gallery.webp",
        encoding: "7bit",
        mimetype: "image/webp",
        buffer: Buffer.from("fake-image-bytes"),
        size: 100000,
      };

      const res = await useCase.execute(
        1,
        {
          gallery: {
            id: 10,
            description: "New description",
          },
        } as any,
        undefined,
        undefined,
        [dummyFile],
      );

      // Must update existing record, NOT create a new one
      expect(mockPrisma.userGallery.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: expect.objectContaining({
          imageUrl: "images/gallery_1_first.webp",
          description: "New description",
        }),
      });
      expect(mockPrisma.userGallery.create).not.toHaveBeenCalled();
      expect(res.gallery![0].id).toBe(10);
      expect(res.gallery![0].url).toBe("images/gallery_1_first.webp");
    });

    it("should throw BadRequestException if gallery id does not exist when uploading a file to replace it", async () => {
      mockPrisma.userGallery.findFirst.mockResolvedValue(null);

      const dummyFile: any = {
        fieldname: "gallery",
        originalname: "gallery.webp",
        encoding: "7bit",
        mimetype: "image/webp",
        buffer: Buffer.from("fake-image-bytes"),
        size: 100000,
      };

      await expect(
        useCase.execute(
          1,
          {
            gallery: {
              id: 9999,
            },
          } as any,
          undefined,
          undefined,
          [dummyFile],
        ),
      ).rejects.toThrow(
        new BadRequestException("Gallery image with specified id not found."),
      );
    });

    it("should allow replacing an existing gallery image even if user already has 10 gallery photos (projected count does not exceed limit)", async () => {
      mockPrisma.userGallery.findFirst.mockResolvedValue({
        id: 5,
        userId: 1,
        imageUrl: "images/gallery_5_old.webp",
        isProfilePicture: false,
      });
      mockPrisma.userGallery.count.mockResolvedValue(10); // user already has max 10 photos
      mockPrisma.userGallery.update.mockResolvedValue({
        id: 5,
        userId: 1,
        imageUrl: "images/gallery_1_first.webp",
        isProfilePicture: false,
      });
      mockPrisma.userGallery.findMany.mockResolvedValue([
        {
          id: 5,
          userId: 1,
          imageUrl: "images/gallery_1_first.webp",
          isProfilePicture: false,
          createdAt: new Date("2026-10-04T12:00:00Z"),
        },
      ]);

      const dummyFile: any = {
        fieldname: "gallery",
        originalname: "gallery.webp",
        encoding: "7bit",
        mimetype: "image/webp",
        buffer: Buffer.from("fake-image-bytes"),
        size: 100000,
      };

      const res = await useCase.execute(
        1,
        {
          gallery: {
            id: 5,
          },
        } as any,
        undefined,
        undefined,
        [dummyFile],
      );

      // Replaces in place without throwing limit exceeded
      expect(mockPrisma.userGallery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5 },
          data: expect.objectContaining({
            imageUrl: "images/gallery_1_first.webp",
          }),
        }),
      );
      expect(mockPrisma.userGallery.create).not.toHaveBeenCalled();
      expect(res.gallery![0].id).toBe(5);
    });

    it("should update profilePicture when replacing the gallery photo that is currently the active profile picture", async () => {
      mockPrisma.userGallery.findFirst.mockResolvedValue({
        id: 7,
        userId: 1,
        imageUrl: "images/gallery_7_old.webp",
        isProfilePicture: true,
      });
      mockPrisma.userGallery.update.mockResolvedValue({
        id: 7,
        userId: 1,
        imageUrl: "images/gallery_1_first.webp",
        isProfilePicture: true,
      });
      mockPrisma.userGallery.findMany.mockResolvedValue([
        {
          id: 7,
          userId: 1,
          imageUrl: "images/gallery_1_first.webp",
          isProfilePicture: true,
          createdAt: new Date("2026-10-04T12:00:00Z"),
        },
      ]);

      const dummyFile: any = {
        fieldname: "gallery",
        originalname: "gallery.webp",
        encoding: "7bit",
        mimetype: "image/webp",
        buffer: Buffer.from("fake-image-bytes"),
        size: 100000,
      };

      const res = await useCase.execute(
        1,
        {
          gallery: {
            id: 7,
          },
        } as any,
        undefined,
        undefined,
        [dummyFile],
      );

      expect(mockPrisma.userGallery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 7 },
          data: expect.objectContaining({
            imageUrl: "images/gallery_1_first.webp",
          }),
        }),
      );
      expect(res.Profile.profilePicture).toBe("images/gallery_1_first.webp");
      expect(res.Profile.profilePictureId).toBe(7);
    });

    it("should resolve and validate city via GeoLookupService and return City object in response", async () => {
      const mockGeoLookup = {
        getCityById: jest.fn().mockResolvedValue({
          id: 135129,
          name: "Tehran",
          state: "Tehran",
          country: "Iran",
        }),
      };

      const customUseCase = new UpdateProfileUseCase(
        mockPrisma,
        mockAvatarProcessor,
        mockGalleryProcessor,
        undefined,
        mockGeoLookup as any,
      );

      mockPrisma.demographic.findUnique.mockResolvedValue({
        userId: 1,
        birthDate: new Date("1995-05-15"),
        gender: "MALE",
        cityId: null,
      });

      const res = await customUseCase.execute(1, {
        cityId: 135129,
      } as any);

      expect(mockGeoLookup.getCityById).toHaveBeenCalledWith(135129);
      expect(res.Profile.Demographic.City).toMatchObject({
        id: 135129,
        name: "Tehran",
        state: "Tehran",
        country: "Iran",
      });
    });
  });
});



