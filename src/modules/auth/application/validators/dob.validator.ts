import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

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
  return age;
}

/**
 * Validates date of birth format, validity, and age restrictions (18 <= age <= 80).
 */
export function validateDateOfBirth(dobString: string): {
  isValid: boolean;
  error?: string;
  parsedDate?: Date;
  age?: number;
} {
  if (!dobString || typeof dobString !== 'string') {
    return { isValid: false, error: 'Date of birth cannot be empty' };
  }

  const trimmed = dobString.trim();

  // Strict format check: YYYY-MM-DD
  const formatRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (!formatRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid date format. Expected YYYY-MM-DD (e.g., 1998-11-25)',
    };
  }

  const [yearStr, monthStr, dayStr] = trimmed.split('-');
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

  const today = new Date();
  // Ensure date is not in the future
  if (parsed.getTime() > today.getTime()) {
    return {
      isValid: false,
      error: 'Date of birth cannot be a future date',
    };
  }

  // Calculate age
  const age = calculateAge(parsed);

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
