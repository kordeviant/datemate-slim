import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'moderator',
  'staff',
  'official',
  'verified',
  'security',
  'api',
  'null',
  'undefined',
  'official_team',
  'team',
  'datemate',
  'date_mate',
  'taylor_swift',
  'taylorswift',
  'elon_musk',
  'elonmusk',
  'mark_zuckerberg',
  'cristiano_ronaldo',
]);

const STATUS_SUFFIXES = [
  '_verified',
  '_official',
  '_admin',
  '_support',
  '_staff',
  '_moderator',
  '.verified',
  '.official',
  '.admin',
  '.support',
  '.staff',
  '.moderator',
  '-verified',
  '-official',
  '-admin',
  '-support',
  '-staff',
  '-moderator',
];
const STATUS_PREFIXES = [
  'verified_',
  'official_',
  'admin_',
  'support_',
  'staff_',
  'moderator_',
  'verified.',
  'official.',
  'admin.',
  'support.',
  'staff.',
  'moderator.',
  'verified-',
  'official-',
  'admin-',
  'support-',
  'staff-',
  'moderator-',
];

// Characters prohibited explicitly: < > ' " ; { } --
const FORBIDDEN_CHAR_REGEX = /[<>'";{}]|--/;

// Invisible / zero-width characters
const ZERO_WIDTH_REGEX = /[\u200B-\u200D\uFEFF\u00A0\u200E\u200F]/;

// Emojis
const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

/**
 * Validates a username against length, character, formatting, and impersonation rules.
 * Returns { isValid: true } or { isValid: false, error: string }
 */
export function validateUsername(username: string): {
  isValid: boolean;
  error?: string;
} {
  if (!username || typeof username !== 'string') {
    return { isValid: false, error: 'Username cannot be empty' };
  }

  const trimmed = username.trim();

  // Length rule: between 3 and 30 characters
  if (trimmed.length < 3 || trimmed.length > 30) {
    return {
      isValid: false,
      error: 'Username must be between 3 and 30 characters in length',
    };
  }

  // Spaces rule
  if (/\s/.test(trimmed)) {
    return { isValid: false, error: 'Username cannot contain spaces' };
  }

  // Invisible or zero-width characters
  if (ZERO_WIDTH_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username cannot contain invisible or zero-width characters',
    };
  }

  // Emojis rule
  if (EMOJI_REGEX.test(trimmed)) {
    return { isValid: false, error: 'Username cannot contain emojis' };
  }

  // HTML / SQL / script characters rule
  if (FORBIDDEN_CHAR_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username contains invalid HTML, SQL, or script characters',
    };
  }

  // Supported character set rule: only letters (a-z, A-Z), digits (0-9), dot (.), underscore (_), hyphen (-)
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username contains unsupported characters. Only alphanumeric, dots, underscores, and hyphens are allowed',
    };
  }

  // Cannot contain only numbers
  if (/^\d+$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username cannot contain only numbers (must include at least one letter)',
    };
  }

  // Cannot start or end with special characters
  if (!/^[a-zA-Z0-9]/.test(trimmed) || !/[a-zA-Z0-9]$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username cannot start or end with special characters',
    };
  }

  // Cannot contain consecutive special characters (e.g., __, .., --, ._, -., etc.)
  if (/[._-]{2,}/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username cannot contain consecutive special characters',
    };
  }

  const lower = trimmed.toLowerCase();

  // Reserved / Impersonation exact match
  if (RESERVED_USERNAMES.has(lower)) {
    return {
      isValid: false,
      error: `Username "${trimmed}" is reserved or prohibited`,
    };
  }

  // Status badges / prefixes / suffixes
  for (const suffix of STATUS_SUFFIXES) {
    if (lower.endsWith(suffix)) {
      return {
        isValid: false,
        error: `Username cannot end with status suffix "${suffix}"`,
      };
    }
  }

  for (const prefix of STATUS_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return {
        isValid: false,
        error: `Username cannot start with status prefix "${prefix}"`,
      };
    }
  }

  // Administrative, official, or verified status keyword segment check
  if (
    /(?:^|[._-])(verified|official|admin|administrator|support|staff|moderator|official_team)(?:[._-]|$)/i.test(
      trimmed,
    )
  ) {
    return {
      isValid: false,
      error:
        'Username cannot contain administrative, official, or verified status badges/keywords',
    };
  }

  return { isValid: true };
}

@ValidatorConstraint({ name: 'IsValidUsername', async: false })
export class IsValidUsernameConstraint implements ValidatorConstraintInterface {
  private errorMessage = 'Invalid username';

  validate(username: any): boolean {
    const res = validateUsername(username);
    if (!res.isValid) {
      this.errorMessage = res.error || 'Invalid username';
      return false;
    }
    return true;
  }

  defaultMessage(): string {
    return this.errorMessage;
  }
}

export function IsValidUsername(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidUsernameConstraint,
    });
  };
}
