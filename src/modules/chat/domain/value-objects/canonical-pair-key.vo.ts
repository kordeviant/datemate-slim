import { SelfConversationNotAllowedException } from "../exceptions/self-conversation-not-allowed.exception";

export class CanonicalPairKey {
  private readonly _value: string;
  private readonly _userA: number;
  private readonly _userB: number;

  constructor(userIdA: number, userIdB: number) {
    if (userIdA === userIdB) {
      throw new SelfConversationNotAllowedException();
    }
    this._userA = Math.min(userIdA, userIdB);
    this._userB = Math.max(userIdA, userIdB);
    this._value = `${this._userA}:${this._userB}`;
  }

  get value(): string {
    return this._value;
  }

  get userA(): number {
    return this._userA;
  }

  get userB(): number {
    return this._userB;
  }

  public equals(other: CanonicalPairKey): boolean {
    return this._value === other._value;
  }
}
