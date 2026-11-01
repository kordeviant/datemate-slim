import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ValidationPipe } from "@nestjs/common";
import { CreateProfileDto, UpdateProfileDto } from "./update-profile.dto";

describe("UpdateProfileDto / CreateProfileDto Validation", () => {
  const baseValidPayload = {
    language: "EN",
    lat: 35.6892,
    lon: 51.389,
    Profile: {
      fullName: "Sara Connor",
      username: "sara_connor",
      phoneNumber: "+1234567890",
      bio: "Software engineer living in Tehran.",
      languages: ["Persian", "English"],
      Demographic: {
        birthDate: "1998-11-25",
        gender: "Female",
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

  it("should pass validation with fully structured payload", async () => {
    const dto = plainToInstance(UpdateProfileDto, baseValidPayload);
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.Profile?.fullName).toBe("Sara Connor");
    expect(dto.language).toBe("en");
    expect(dto.Profile?.Demographic?.height).toBe(180);
    expect(dto.Profile?.Demographic?.City?.id).toBe(12);
    expect(dto.Profile?.Preferences?.relation).toBe("Long term");
    expect(dto.Profile?.username).toBe("sara_connor");
  });

  it('should pass validation and normalize language "EN" to "en"', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      ...baseValidPayload,
      language: "EN",
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.language).toBe("en");
  });

  it('should pass validation and normalize language "FA" to "fa"', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      ...baseValidPayload,
      language: "FA",
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.language).toBe("fa");
  });

  it('should pass validation and normalize mixed case "Fa" and "En"', async () => {
    const dtoFa = plainToInstance(UpdateProfileDto, {
      language: "Fa",
      Profile: { fullName: "Sara" },
    });
    const errorsFa = await validate(dtoFa);
    expect(errorsFa.length).toBe(0);
    expect(dtoFa.language).toBe("fa");

    const dtoEn = plainToInstance(CreateProfileDto, {
      language: "En",
      Profile: { fullName: "Sara" },
    });
    const errorsEn = await validate(dtoEn);
    expect(errorsEn.length).toBe(0);
    expect(dtoEn.language).toBe("en");
  });

  it('should fail validation when language is invalid (e.g. "FR", "DE")', async () => {
    const dtoFr = plainToInstance(UpdateProfileDto, {
      language: "FR",
    });
    const errorsFr = await validate(dtoFr);
    expect(errorsFr.length).toBeGreaterThan(0);
    const languageErrors = errorsFr.find((e) => e.property === "language");
    expect(languageErrors).toBeDefined();
  });

  it("should fail validation when username in Profile has invalid characters", async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      Profile: {
        username: "user with spaces",
      },
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const profileErrors = errors.find((e) => e.property === "Profile");
    expect(profileErrors?.children?.some((c) => c.property === "username")).toBe(true);
  });

  it("should fail validation if gender in Demographic is not Male or Female", async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      Profile: {
        fullName: "Sara",
        Demographic: {
          gender: "Other",
        },
      },
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const profileErrors = errors.find((e) => e.property === "Profile");
    const demographicErrors = profileErrors?.children?.find(
      (c) => c.property === "Demographic",
    );
    expect(
      demographicErrors?.children?.some((c) => c.property === "gender"),
    ).toBe(true);
  });

  it("should pass validation on partial payload for step-by-step onboarding (e.g. only Profile.fullName)", async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      Profile: {
        fullName: "John Doe",
      },
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.Profile?.fullName).toBe("John Doe");
  });

  it("should pass validation on partial payload with bio and City", async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      Profile: {
        bio: "Enthusiastic developer and hiker.",
        Demographic: {
          City: { id: 5 },
        },
      },
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.Profile?.bio).toBe("Enthusiastic developer and hiker.");
    expect(dto.Profile?.Demographic?.City?.id).toBe(5);
  });

  it("should pass validation with top-level language and lat/lon", async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      language: "EN",
      lat: 35.6892,
      lon: 51.389,
      Profile: {
        fullName: "Alex Smith",
        username: "alex_smith",
        Demographic: {
          birthDate: "1995-05-15",
          gender: "Male",
          degree: "PhD",
          profession: "Architect",
          relationStatus: "Single",
          City: { id: 12 },
        },
        Preferences: {
          relation: "Long term",
        },
      },
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
    expect(dto.Profile?.fullName).toBe("Alex Smith");
    expect(dto.language).toBe("en");
    expect(dto.lat).toBe(35.6892);
  });

  describe("ValidationPipe with whitelist: true compatibility", () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    it("should preserve all properties when Profile is sent as stringified JSON (multipart/form-data)", async () => {
      const payload = {
        language: "FA",
        lat: 35.6892,
        lon: 51.389,
        Profile: JSON.stringify({
          fullName: "Parsa Moloody",
          username: "parsam",
          phoneNumber: "+989123456789",
          bio: "Fullstack Dev",
          languages: ["fa"],
          Demographic: {
            birthDate: "1998-11-25",
            gender: "MALE",
            height: 180,
            degree: "DOCTORATE",
            profession: "Software Engineer",
            relationStatus: "SINGLE",
            City: { id: 12 },
          },
          Preferences: {
            relation: "LONG",
          },
        }),
      };

      const result: UpdateProfileDto = await pipe.transform(payload, {
        type: "body",
        metatype: UpdateProfileDto,
      });

      expect(result.language).toBe("fa");
      expect(result.lat).toBe(35.6892);
      expect(result.lon).toBe(51.389);
      expect(result.Profile).toBeDefined();
      expect(result.Profile?.fullName).toBe("Parsa Moloody");
      expect(result.Profile?.username).toBe("parsam");
      expect(result.Profile?.phoneNumber).toBe("+989123456789");
      expect(result.Profile?.bio).toBe("Fullstack Dev");
      expect(result.Profile?.languages).toEqual(["fa"]);
      expect(result.Profile?.Demographic?.birthDate).toBe("1998-11-25");
      expect(result.Profile?.Demographic?.gender).toBe("MALE");
      expect(result.Profile?.Demographic?.height).toBe(180);
      expect(result.Profile?.Demographic?.degree).toBe("DOCTORATE");
      expect(result.Profile?.Demographic?.profession).toBe("Software Engineer");
      expect(result.Profile?.Demographic?.relationStatus).toBe("SINGLE");
      expect(result.Profile?.Demographic?.City?.id).toBe(12);
      expect(result.Profile?.Preferences?.relation).toBe("LONG");
    });

    it("should preserve flat form-data properties without stripping them", async () => {
      const payload = {
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
      };

      const result: UpdateProfileDto = await pipe.transform(payload, {
        type: "body",
        metatype: UpdateProfileDto,
      });

      expect(result.language).toBe("fa");
      expect(result.fullName).toBe("Parsa Moloody");
      expect(result.username).toBe("parsam");
      expect(result.phoneNumber).toBe("+989123456789");
      expect(result.bio).toBe("Fullstack Dev");
      expect(result.birthDate).toBe("1998-11-25");
      expect(result.gender).toBe("MALE");
      expect(result.height).toBe(180);
      expect(result.degree).toBe("DOCTORATE");
      expect(result.profession).toBe("Software Engineer");
      expect(result.relationStatus).toBe("SINGLE");
      expect(result.relation).toBe("LONG");
      expect(result.cityId).toBe(12);
      expect(result.languages).toEqual(["fa"]);
    });

    it("should support lowercase profile alias with stringified JSON", async () => {
      const payload = {
        language: "fa",
        profile: JSON.stringify({
          fullName: "Parsa Moloody",
          username: "parsam",
        }),
      };

      const result: UpdateProfileDto = await pipe.transform(payload, {
        type: "body",
        metatype: UpdateProfileDto,
      });

      expect(result.profile?.fullName).toBe("Parsa Moloody");
      expect(result.profile?.username).toBe("parsam");
    });

    it("should accept RelationType directly in Profile and at root level", async () => {
      const payload = {
        Profile: {
          fullName: "Parsa Moloody",
          RelationType: "LONG",
        },
        RelationType: "LONG",
      };

      const result: UpdateProfileDto = await pipe.transform(payload, {
        type: "body",
        metatype: UpdateProfileDto,
      });

      expect(result.Profile?.RelationType).toBe("LONG");
      expect(result.RelationType).toBe("LONG");
    });

    it("should transform single gallery object with isProfilePicture and description", async () => {
      const payload = {
        gallery: {
          id: 5,
          isProfilePicture: true,
          description: "Trip photo",
        },
        profilePictureId: 5,
      };

      const result: UpdateProfileDto = await pipe.transform(payload, {
        type: "body",
        metatype: UpdateProfileDto,
      });

      expect(result.gallery).toBeDefined();
      expect(result.gallery?.id).toBe(5);
      expect(result.gallery?.isProfilePicture).toBe(true);
      expect(result.gallery?.description).toBe("Trip photo");
      expect(result.profilePictureId).toBe(5);
    });

    it("should parse stringified JSON gallery object and coerce string isProfilePicture", async () => {
      const payload = {
        gallery: JSON.stringify({
          isProfilePicture: "true",
          description: "From mobile",
        }),
      };

      const result: UpdateProfileDto = await pipe.transform(payload, {
        type: "body",
        metatype: UpdateProfileDto,
      });

      expect(result.gallery).toBeDefined();
      expect(result.gallery?.isProfilePicture).toBe(true);
      expect(result.gallery?.description).toBe("From mobile");
    });

    it("should reject multiple gallery items in gallery payload with BadRequestException", async () => {
      const payload = {
        gallery: [
          { id: 1, isProfilePicture: true },
          { id: 2, isProfilePicture: false },
        ],
      };

      await expect(
        pipe.transform(payload, {
          type: "body",
          metatype: UpdateProfileDto,
        }),
      ).rejects.toThrow(
        "Only one gallery picture is allowed per request. Multiple gallery uploads are not permitted.",
      );
    });
  });
});

