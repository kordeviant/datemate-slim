import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from "@nestjs/common";
import { UpdateProfileUseCase } from "./update-profile.use-case";
import { PrismaService } from "../../../../infrastructure/database/prisma.service";
import { AvatarProcessorService } from "../services/avatar-processor.service";

describe("UpdateProfileUseCase (Profile step-by-step onboarding & edit)", () => {
  let useCase: UpdateProfileUseCase;
  let mockPrisma: any;
  let mockAvatarProcessor: any;

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, language: "EN" }),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateProfileUseCase,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AvatarProcessorService, useValue: mockAvatarProcessor },
      ],
    }).compile();

    useCase = module.get<UpdateProfileUseCase>(UpdateProfileUseCase);
  });

  const validDto = {
    firstName: "John",
    username: "john_doe",
    birthDate: "1998-11-25",
    gender: "Male",
    language: "EN",
    phoneNumber: "+1234567890",
    cityId: 10,
    latitude: 35.6892,
    longitude: 51.389,
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
    expect(result.avatarUrl).toBe("");
    expect(mockAvatarProcessor.processAndSaveAvatar).not.toHaveBeenCalled();
    expect(mockPrisma.profile.upsert).toHaveBeenCalled();
    expect(result.profileCompleted).toBe(false);
  });

  it("should retain existing avatarUrl when no new avatar is uploaded", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      userId: 1,
      firstName: "John",
      username: "john_doe",
      avatarUrl: "/uploads/avatars/existing.webp",
      languages: ["en"],
    });

    const result = await useCase.execute(1, { firstName: "Johnny" }, undefined);
    expect(result.avatarUrl).toBe("/uploads/avatars/existing.webp");
    expect(result.firstName).toBe("Johnny");
    expect(result.profileCompleted).toBe(false);
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
    expect(result.avatarUrl).toBe("/uploads/avatars/avatar_1_12345.webp");
    expect(result.profileCompleted).toBe(false);
  });

  it("should throw BadRequestException if username is invalid", async () => {
    await expect(
      useCase.execute(1, { ...validDto, username: "123456" }, mockAvatarFile),
    ).rejects.toThrow("cannot contain only numbers");
  });

  it("should throw ConflictException if username is taken by another user", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue({
      id: 99,
      userId: 2, // different user
      username: "john_doe",
    });

    await expect(useCase.execute(1, validDto, mockAvatarFile)).rejects.toThrow(
      ConflictException,
    );
  });

  it("should allow user to keep their own username", async () => {
    mockPrisma.profile.findFirst.mockResolvedValue({
      id: 99,
      userId: 1, // same user
      username: "john_doe",
    });

    const result = await useCase.execute(1, validDto, undefined);
    expect(result.username).toBe("john_doe");
  });

  it("should throw BadRequestException if date of birth indicates age < 18", async () => {
    await expect(
      useCase.execute(
        1,
        { ...validDto, birthDate: "2015-05-10" },
        mockAvatarFile,
      ),
    ).rejects.toThrow("at least 18 years old");
  });

  it("should reject modification of birthDate if user already set it previously", async () => {
    mockPrisma.demographic.findUnique.mockResolvedValue({
      userId: 1,
      birthDate: new Date("1990-01-01"),
      gender: "MALE",
    });

    await expect(useCase.execute(1, validDto, mockAvatarFile)).rejects.toThrow(
      "Date of birth cannot be changed after initial setup",
    );
  });

  it("should permit update without birthDate if demographic already exists", async () => {
    mockPrisma.demographic.findUnique.mockResolvedValue({
      userId: 1,
      birthDate: new Date("1998-11-25"),
      gender: "MALE",
    });

    const result = await useCase.execute(
      1,
      { firstName: "John Updated" },
      undefined,
    );
    expect(result.firstName).toBe("John Updated");
    expect(result.age).toBeDefined();
    expect(result.profileCompleted).toBe(false);
  });

  it("should return profileCompleted as false during onboarding steps", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1.webp",
    });

    const result = await useCase.execute(1, validDto, mockAvatarFile);

    expect(result).toMatchObject({
      userId: 1,
      firstName: "John",
      username: "john_doe",
      avatarUrl: "/uploads/avatars/avatar_1.webp",
      gender: "MALE",
      language: "en",
      profileCompleted: false, // returns false until all questions and steps are completed
    });
    expect(result.age).toBeGreaterThanOrEqual(18);
    expect((result as any).birthDate).toBeUndefined(); // Exact DOB remains private
  });

  const completeDto = {
    ...validDto,
    height: 178,
    languages: ["en", "fa"],
    education: "PhD",
    job: "Software Engineer",
    relationStatus: "Single",
    kindOfRelationship: "Fun and Dating",
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
    mockPrisma.userQuestionAnswer.count.mockResolvedValue(5);

    const result = await useCase.execute(
      1,
      completeDto,
      mockAvatarFile,
      mockSelfieFile,
    );
    expect(result.profileCompleted).toBe(true);
    expect(result.selfieUrl).toBe("/uploads/selfies/selfie_1.webp");
    expect(result.height).toBe(178);
    expect(result.degree).toBe("DOCTORATE");
    expect(result.profession).toBe("Software Engineer");
    expect(result.relationStatus).toBe("SINGLE");
    expect(result.relation).toBe("FUN");
    expect(result.languages).toEqual(["en", "fa"]);
  });

  it("should return profileCompleted as false if questions exist but not all answered", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1.webp",
    });
    mockAvatarProcessor.processAndSaveSelfie.mockResolvedValue({
      relativeUrl: "/uploads/selfies/selfie_1.webp",
    });
    mockPrisma.question.count.mockResolvedValue(5);
    mockPrisma.userQuestionAnswer.count.mockResolvedValue(3); // only 3 answered

    const result = await useCase.execute(
      1,
      completeDto,
      mockAvatarFile,
      mockSelfieFile,
    );
    expect(result.profileCompleted).toBe(false);
  });

  it("should return profileCompleted as false if selfie is missing", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1.webp",
    });

    const result = await useCase.execute(
      1,
      completeDto,
      mockAvatarFile,
      undefined,
    );
    expect(result.profileCompleted).toBe(false);
  });

  it("should return profileCompleted as false if height is missing", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1.webp",
    });
    mockAvatarProcessor.processAndSaveSelfie.mockResolvedValue({
      relativeUrl: "/uploads/selfies/selfie_1.webp",
    });

    const { height, ...dtoWithoutHeight } = completeDto;
    const result = await useCase.execute(
      1,
      dtoWithoutHeight,
      mockAvatarFile,
      mockSelfieFile,
    );
    expect(result.profileCompleted).toBe(false);
  });

  it("should return profileCompleted as false if job is missing", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1.webp",
    });
    mockAvatarProcessor.processAndSaveSelfie.mockResolvedValue({
      relativeUrl: "/uploads/selfies/selfie_1.webp",
    });

    const { job, ...dtoWithoutJob } = completeDto;
    const result = await useCase.execute(
      1,
      dtoWithoutJob,
      mockAvatarFile,
      mockSelfieFile,
    );
    expect(result.profileCompleted).toBe(false);
  });

  it("should return profileCompleted as false if kind of relationship is missing", async () => {
    mockAvatarProcessor.processAndSaveAvatar.mockResolvedValue({
      relativeUrl: "/uploads/avatars/avatar_1.webp",
    });
    mockAvatarProcessor.processAndSaveSelfie.mockResolvedValue({
      relativeUrl: "/uploads/selfies/selfie_1.webp",
    });

    const { kindOfRelationship, ...dtoWithoutRelation } = completeDto;
    const result = await useCase.execute(
      1,
      dtoWithoutRelation,
      mockAvatarFile,
      mockSelfieFile,
    );
    expect(result.profileCompleted).toBe(false);
  });

  it("should not touch existing fields when performing incremental update", async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      userId: 1,
      firstName: "John",
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
      profession: "Engineer",
      relationStatus: "SINGLE",
    });
    mockPrisma.preferences.findUnique.mockResolvedValue({
      userId: 1,
      relation: "FUN",
    });

    // Only update height and job
    const result = await useCase.execute(1, {
      height: 182,
      job: "Senior Architect",
    });

    expect(result.firstName).toBe("John");
    expect(result.username).toBe("john_doe");
    expect(result.avatarUrl).toBe("/uploads/avatars/avatar_existing.webp");
    expect(result.selfieUrl).toBe("/uploads/selfies/selfie_existing.webp");
    expect(result.height).toBe(182);
    expect(result.profession).toBe("Senior Architect");
    expect(result.degree).toBe("DOCTORATE");
    expect(result.relationStatus).toBe("SINGLE");
    expect(result.relation).toBe("FUN");
    expect(result.profileCompleted).toBe(true);
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

  it("should normalize uppercase EN to lowercase en for profile and EN for user", async () => {
    const result = await useCase.execute(1, { language: "EN" });
    expect(result.language).toBe("en");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { language: "EN" },
    });
  });

  it("should normalize lowercase fa to lowercase fa for profile and FA for user", async () => {
    const result = await useCase.execute(1, { language: "fa" });
    expect(result.language).toBe("fa");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { language: "FA" },
    });
  });

  it("should support updating bio and cityId for edit profile", async () => {
    mockPrisma.city.findUnique.mockResolvedValue({ id: 10 });
    const result = await useCase.execute(1, {
      bio: "Loves mountain climbing and coffee.",
      cityId: 10,
    });
    expect(result.bio).toBe("Loves mountain climbing and coffee.");
    expect(result.cityId).toBe(10);
    expect(result.profileCompleted).toBe(false);
  });

  it("should support city_id alias and nested City objects in useCase", async () => {
    mockPrisma.city.findUnique.mockResolvedValue({ id: 15 });
    const result = await useCase.execute(1, {
      city_id: 15,
    } as any);
    expect(result.cityId).toBe(15);
  });

  it("should return null for cityId if city does not exist in database (preventing FK violation)", async () => {
    mockPrisma.city.findUnique.mockResolvedValue(null);
    const result = await useCase.execute(1, {
      cityId: 999999,
    });
    expect(result.cityId).toBeNull();
  });
});
