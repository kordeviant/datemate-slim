import { calculateAge, validateDateOfBirth } from './dob.validator';

describe('DateOfBirthValidator', () => {
  describe('Format and Calendar Validity', () => {
    it('should reject empty or invalid format', () => {
      expect(validateDateOfBirth('').isValid).toBe(false);
      expect(validateDateOfBirth('02/02/1999').isValid).toBe(false);
      expect(validateDateOfBirth('1999-2-2').isValid).toBe(false);
      expect(validateDateOfBirth('invalid-date').isValid).toBe(false);
    });

    it('should reject impossible dates (e.g., February 30th, 13th month)', () => {
      expect(validateDateOfBirth('2026-02-30').isValid).toBe(false);
      expect(validateDateOfBirth('2026-13-01').isValid).toBe(false);
      expect(validateDateOfBirth('2023-02-29').isValid).toBe(false); // 2023 not leap year
    });

    it('should accept valid leap year dates (e.g., 2004-02-29)', () => {
      const res = validateDateOfBirth('2004-02-29');
      expect(res.isValid).toBe(true);
    });
  });

  describe('Age Restrictions (18 to 80 years)', () => {
    it('should reject future dates', () => {
      const futureYear = new Date().getFullYear() + 1;
      const res = validateDateOfBirth(`${futureYear}-01-01`);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('cannot be a future date');
    });

    it('should reject users younger than 18 years old', () => {
      const res = validateDateOfBirth('2015-05-10');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('at least 18 years old');
    });

    it('should reject users older than 80 years old', () => {
      const res = validateDateOfBirth('1900-01-01');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('maximum limit of 80 years');
    });

    it('should reject today as date of birth', () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const res = validateDateOfBirth(todayStr);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('at least 18 years old');
    });

    it('should accept ISO timestamp string and Date object for valid ages', () => {
      const isoRes = validateDateOfBirth('1998-11-25T12:00:00.000Z');
      expect(isoRes.isValid).toBe(true);
      expect(isoRes.age).toBeGreaterThanOrEqual(18);

      const dateObjRes = validateDateOfBirth(new Date('1995-05-20'));
      expect(dateObjRes.isValid).toBe(true);
      expect(dateObjRes.age).toBeGreaterThanOrEqual(18);
    });

    it('should accept valid date of birth between 18 and 80', () => {
      const res = validateDateOfBirth('2000-06-15');
      expect(res.isValid).toBe(true);
      expect(res.age).toBeGreaterThanOrEqual(18);
      expect(res.age).toBeLessThanOrEqual(80);
    });
  });

  describe('calculateAge', () => {
    it('should accurately calculate full years', () => {
      const age = calculateAge('1998-11-25');
      expect(typeof age).toBe('number');
      expect(age).toBeGreaterThan(20);
    });
  });
});
