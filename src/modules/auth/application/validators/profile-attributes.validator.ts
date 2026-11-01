import { BadRequestException } from '@nestjs/common';
import { EducationStatus, RelationshipStatus, RelationType, ReligionStatus } from '@prisma/client';

export const ALLOWED_SPOKEN_LANGUAGES = [
  'en', 'fa', 'de', 'fr', 'es', 'it', 'pt', 'ru',
  'uk', 'tr', 'ar', 'hi', 'ur', 'zh', 'ja', 'ko',
  'nl', 'pl', 'sv', 'no', 'da', 'fi', 'cs', 'el', 'he',
] as const;

export type AllowedSpokenLanguage = (typeof ALLOWED_SPOKEN_LANGUAGES)[number];

export const LANGUAGE_NAME_TO_CODE: Record<string, AllowedSpokenLanguage> = {
  // English
  english: 'en',

  // Persian / Farsi
  persian: 'fa',
  farsi: 'fa',
  parsi: 'fa',

  // German
  german: 'de',
  deutsch: 'de',

  // French
  french: 'fr',
  francais: 'fr',
  français: 'fr',

  // Spanish
  spanish: 'es',
  espanol: 'es',
  español: 'es',
  castilian: 'es',

  // Italian
  italian: 'it',
  italiano: 'it',

  // Portuguese
  portuguese: 'pt',
  portugues: 'pt',
  português: 'pt',

  // Russian
  russian: 'ru',
  russkiy: 'ru',
  русский: 'ru',

  // Ukrainian
  ukrainian: 'uk',
  ukrayinska: 'uk',
  українська: 'uk',

  // Turkish
  turkish: 'tr',
  turkce: 'tr',
  türkçe: 'tr',

  // Arabic
  arabic: 'ar',
  arabiya: 'ar',
  العربية: 'ar',

  // Hindi
  hindi: 'hi',
  हिन्दी: 'hi',

  // Urdu
  urdu: 'ur',
  اردو: 'ur',

  // Chinese
  chinese: 'zh',
  mandarin: 'zh',
  cantonese: 'zh',
  zhongwen: 'zh',
  中文: 'zh',

  // Japanese
  japanese: 'ja',
  nihongo: 'ja',
  日本語: 'ja',

  // Korean
  korean: 'ko',
  hangul: 'ko',
  hangugeo: 'ko',
  한국어: 'ko',

  // Dutch
  dutch: 'nl',
  nederlands: 'nl',
  flemish: 'nl',

  // Polish
  polish: 'pl',
  polski: 'pl',

  // Swedish
  swedish: 'sv',
  svenska: 'sv',

  // Norwegian
  norwegian: 'no',
  norsk: 'no',

  // Danish
  danish: 'da',
  dansk: 'da',

  // Finnish
  finnish: 'fi',
  suomi: 'fi',

  // Czech
  czech: 'cs',
  cestina: 'cs',
  čeština: 'cs',

  // Greek
  greek: 'el',
  ellinika: 'el',
  ellenika: 'el',
  ελληνικά: 'el',

  // Hebrew
  hebrew: 'he',
  ivrit: 'he',
  עברית: 'he',
};

export function normalizeEducation(value?: string | null): EducationStatus | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const clean = value.toLowerCase().replace(/[\s\-_]+/g, '');
  if (clean.includes('phd') || clean.includes('doctorate')) return EducationStatus.DOCTORATE;
  if (clean.includes('master')) return EducationStatus.MASTER_DEGREE;
  if (clean.includes('bachelor')) return EducationStatus.BACHELOR_DEGREE;
  if (clean.includes('associate')) return EducationStatus.ASSOCIATE_DEGREE;
  if (clean.includes('somecollege') || clean === 'college') return EducationStatus.SOME_COLLEGE;
  if (clean.includes('highschool') || clean.includes('diploma')) return EducationStatus.HIGH_SCHOOL_DIPLOMA;
  if (clean.includes('rathernotsay')) return EducationStatus.RATHER_NOT_SAY;

  const upper = value.toUpperCase().trim() as EducationStatus;
  if (Object.values(EducationStatus).includes(upper)) {
    return upper;
  }
  return undefined;
}

export function normalizeRelationshipStatus(value?: string | null): RelationshipStatus | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const clean = value.toLowerCase().replace(/[\s\-_]+/g, '');
  if (clean === 'single') return RelationshipStatus.SINGLE;
  if (clean === 'married') return RelationshipStatus.MARRIED;
  if (clean.includes('hookingup') || clean.includes('complicated')) return RelationshipStatus.COMPLICATED;
  if (clean.includes('inarelationship') || clean === 'relationship') return RelationshipStatus.IN_A_RELATIONSHIP;
  if (clean.includes('openrelationship') || clean === 'open') return RelationshipStatus.OPEN_RELATIONSHIP;
  if (clean === 'divorced') return RelationshipStatus.DIVORCED;
  if (clean === 'widowed') return RelationshipStatus.WIDOWED;
  if (clean.includes('rathernotsay')) return RelationshipStatus.RATHER_NOT_SAY;

  const upper = value.toUpperCase().trim() as RelationshipStatus;
  if (Object.values(RelationshipStatus).includes(upper)) {
    return upper;
  }
  return undefined;
}

export function normalizeRelationType(value?: string | null): RelationType | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const clean = value.toLowerCase().replace(/[\s\-_]+/g, '');
  if (clean.includes('fun') || clean.includes('dating')) return RelationType.FUN;
  if (clean.includes('open')) return RelationType.OPEN;
  if (clean.includes('long')) return RelationType.LONG;

  const upper = value.toUpperCase().trim() as RelationType;
  if (Object.values(RelationType).includes(upper)) {
    return upper;
  }
  return undefined;
}

export function normalizeReligion(value?: string | null): ReligionStatus | undefined {
  if (!value || typeof value !== 'string') return undefined;
  const clean = value.toLowerCase().replace(/[\s\-_]+/g, '');
  if (clean.includes('christian')) return ReligionStatus.CHRISTIANITY;
  if (clean.includes('islam') || clean.includes('muslim')) return ReligionStatus.ISLAM;
  if (clean.includes('hindu')) return ReligionStatus.HINDUISM;
  if (clean.includes('buddh')) return ReligionStatus.BUDDHISM;
  if (clean.includes('judai') || clean.includes('jew')) return ReligionStatus.JUDAISM;
  if (clean.includes('spirit')) return ReligionStatus.SPIRITUALITY;
  if (clean.includes('agnostic')) return ReligionStatus.AGNOSTIC;
  if (clean.includes('atheis')) return ReligionStatus.ATHEISM;
  if (clean.includes('other')) return ReligionStatus.OTHER;
  if (clean.includes('rathernotsay')) return ReligionStatus.RATHER_NOT_SAY;

  const upper = value.toUpperCase().trim() as ReligionStatus;
  if (Object.values(ReligionStatus).includes(upper)) {
    return upper;
  }
  return undefined;
}

export function normalizeLanguages(value?: any): string[] | undefined {
  if (value === undefined || value === null) return undefined;

  let rawList: any[] = [];
  if (Array.isArray(value)) {
    rawList = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          rawList = parsed;
        } else {
          rawList = [trimmed];
        }
      } catch {
        rawList = trimmed.split(',');
      }
    } else {
      rawList = trimmed.split(',');
    }
  } else {
    return undefined;
  }

  const normalizedSet = new Set<string>();

  for (const item of rawList) {
    if (item === undefined || item === null) continue;
    const str = String(item).trim().toLowerCase();
    if (!str) continue;

    // Direct check for 2-letter allowed code
    if ((ALLOWED_SPOKEN_LANGUAGES as readonly string[]).includes(str)) {
      normalizedSet.add(str);
      continue;
    }

    // Check if matches a full language name
    const code = LANGUAGE_NAME_TO_CODE[str];
    if (code) {
      normalizedSet.add(code);
      continue;
    }

    throw new BadRequestException(
      `Invalid language '${item}'. Allowed languages are: ${ALLOWED_SPOKEN_LANGUAGES.join(', ')}`,
    );
  }

  return Array.from(normalizedSet);
}
