import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
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
});
