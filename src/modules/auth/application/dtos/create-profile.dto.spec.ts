import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateProfileDto, UpdateProfileDto } from "./create-profile.dto";

describe("UpdateProfileDto / CreateProfileDto Validation", () => {
  const baseValidObject = {
    firstName: "Sara",
    username: "sara_smith",
    gender: "Female",
    language: "EN",
  };

  it('should pass validation when language is "EN"', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      ...baseValidObject,
      language: "EN",
    });
    const errors = await validate(dto);
    const langError = errors.find((e) => e.property === "language");
    expect(langError).toBeUndefined();
    expect(dto.language).toBe("en");
  });

  it('should pass validation when language is "FA"', async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      ...baseValidObject,
      language: "FA",
    });
    const errors = await validate(dto);
    const langError = errors.find((e) => e.property === "language");
    expect(langError).toBeUndefined();
    expect(dto.language).toBe("fa");
  });

  it('should pass validation and normalize mixed case "Fa" and "En"', async () => {
    const dtoFa = plainToInstance(UpdateProfileDto, {
      ...baseValidObject,
      language: "Fa",
    });
    const errorsFa = await validate(dtoFa);
    expect(errorsFa.find((e) => e.property === "language")).toBeUndefined();
    expect(dtoFa.language).toBe("fa");

    const dtoEn = plainToInstance(CreateProfileDto, {
      ...baseValidObject,
      language: "En",
    });
    const errorsEn = await validate(dtoEn);
    expect(errorsEn.find((e) => e.property === "language")).toBeUndefined();
    expect(dtoEn.language).toBe("en");
  });

  it('should fail validation when language is invalid (e.g. "FR", "DE")', async () => {
    const dtoFr = plainToInstance(UpdateProfileDto, {
      ...baseValidObject,
      language: "FR",
    });
    const errorsFr = await validate(dtoFr);
    const langErrorFr = errorsFr.find((e) => e.property === "language");
    expect(langErrorFr).toBeDefined();
    expect(langErrorFr?.constraints?.isIn).toContain(
      "Language must be either EN (English) or FA (Farsi)",
    );
  });

  it("should fail validation when language is empty", async () => {
    const dtoEmpty = plainToInstance(UpdateProfileDto, {
      ...baseValidObject,
      language: "",
    });
    const errorsEmpty = await validate(dtoEmpty);
    const langErrorEmpty = errorsEmpty.find((e) => e.property === "language");
    expect(langErrorEmpty).toBeDefined();
  });

  it("should pass validation on partial payload for step-by-step onboarding (e.g. only firstName)", async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      firstName: "John",
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should pass validation on partial payload with bio and cityId for edit profile", async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      bio: "Enthusiastic developer and hiker.",
      cityId: 5,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should fail validation if username has invalid characters", async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      username: "user with spaces",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "username")).toBe(true);
  });

  it("should fail validation if gender is not Male or Female", async () => {
    const dto = plainToInstance(UpdateProfileDto, {
      gender: "Other",
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "gender")).toBe(true);
  });
});
