import { v5 as uuidv5 } from 'uuid';

// Dedicated DateMate direct conversation UUID namespace (RFC 4122 v5 UUID namespace)
export const DIRECT_CONVERSATION_UUID_NAMESPACE = 'e57b98d2-1c09-4bf4-9132-7fcfb09ce13b';

export class CanonicalPairUtil {
  public static createPairKey(userIdA: number, userIdB: number): string {
    if (userIdA === userIdB) {
      throw new Error('Self-conversation is not allowed');
    }
    const min = Math.min(userIdA, userIdB);
    const max = Math.max(userIdA, userIdB);
    return `${min}:${max}`;
  }

  public static generateDeterministicId(pairKey: string): string {
    return uuidv5(pairKey, DIRECT_CONVERSATION_UUID_NAMESPACE);
  }
}
