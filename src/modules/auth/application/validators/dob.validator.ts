import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Normalizes input DOB into YYYY-MM-DD string if provided as ISO string or Date.
 */
export function normalizeDobString(input: any): string | null {
  if (input === undefined || input === null) return null;
  if (typeof input === 'number') {
    const ms = input < 1e11 ? input * 1000 : input;
    const d = new Date(ms);
    return !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Standard YYYY-MM-DD format (must have exactly 2-digit month and day)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    // YYYY/MM/DD format (normalize slashes to hyphens)
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
      return trimmed.replace(/\//g, '-');
    }

    // ISO string or datetime starting with YYYY-MM-DD or YYYY/MM/DD
    if (/^\d{4}[-/]\d{2}[-/]\d{2}[T\s]/.test(trimmed)) {
      return trimmed.slice(0, 10).replace(/\//g, '-');
    }

    return null;
  }
  if (input instanceof Date && !isNaN(input.getTime())) {
    return input.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Calculates exact age in full years from a date of birth.
 */
export function calculateAge(dob: Date | string): number {
  const birth = typeof dob === 'string' ? new Date(dob) : dob;
  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Validates date of birth format, validity, and age restrictions (18 <= age <= 80).
 */
export function validateDateOfBirth(dobInput: any): {
  isValid: boolean;
  error?: string;
  parsedDate?: Date;
  age?: number;
} {
  if (
    dobInput === undefined ||
    dobInput === null ||
    (typeof dobInput === 'string' && dobInput.trim() === '')
  ) {
    return { isValid: false, error: 'Date of birth cannot be empty' };
  }

  const normalized = normalizeDobString(dobInput);
  if (!normalized) {
    return {
      isValid: false,
      error: 'Invalid date format. Expected YYYY-MM-DD (e.g., 1998-11-25)',
    };
  }

  // Strict format check: YYYY-MM-DD
  const formatRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (!formatRegex.test(normalized)) {
    return {
      isValid: false,
      error: 'Invalid date format. Expected YYYY-MM-DD (e.g., 1998-11-25)',
    };
  }

  const [yearStr, monthStr, dayStr] = normalized.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Validate calendar date (handles 28/29/30/31 days and leap years)
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return {
      isValid: false,
      error: 'Date of birth contains an invalid or impossible calendar date',
    };
  }

  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  // Ensure date is not in the future
  if (parsed.getTime() > todayUtc.getTime()) {
    return {
      isValid: false,
      error: 'Date of birth cannot be a future date',
    };
  }

  // Calculate age accurately
  let age = todayUtc.getUTCFullYear() - parsed.getUTCFullYear();
  const monthDiff = todayUtc.getUTCMonth() - parsed.getUTCMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && todayUtc.getUTCDate() < parsed.getUTCDate())
  ) {
    age--;
  }

  if (age < 18) {
    return {
      isValid: false,
      error: `You must be at least 18 years old to use DateMate (current age: ${age})`,
    };
  }

  if (age > 80) {
    return {
      isValid: false,
      error: `Date of birth indicates age above maximum limit of 80 years (current age: ${age})`,
    };
  }

  return {
    isValid: true,
    parsedDate: parsed,
    age,
  };
}

@ValidatorConstraint({ name: 'IsValidDateOfBirth', async: false })
export class IsValidDateOfBirthConstraint implements ValidatorConstraintInterface {
  private errorMessage = 'Invalid date of birth';

  validate(dob: any): boolean {
    if (dob === undefined || dob === null || dob === '') {
      return true;
    }
    const res = validateDateOfBirth(dob);
    if (!res.isValid) {
      this.errorMessage = res.error || 'Invalid date of birth';
      return false;
    }
    return true;
  }

  defaultMessage(): string {
    return this.errorMessage;
  }
}

export function IsValidDateOfBirth(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidDateOfBirthConstraint,
    });
  };
}
