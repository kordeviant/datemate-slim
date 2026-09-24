import { EducationStatus, RelationshipStatus, RelationType } from '@prisma/client';

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

export function normalizeLanguages(value?: any): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) {
    return value.map((l) => String(l).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((l) => String(l).trim()).filter(Boolean);
        }
      } catch {}
    }
    return trimmed
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
  }
  return undefined;
}
