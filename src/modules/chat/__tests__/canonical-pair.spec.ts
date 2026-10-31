import { CanonicalPairUtil } from "@common/utils/canonical-pair.util";
import { CanonicalPairKey } from "../domain/value-objects/canonical-pair-key.vo";
import { SelfConversationNotAllowedException } from "../domain/exceptions/self-conversation-not-allowed.exception";

describe("Canonical Pair Key and Deterministic UUID", () => {
  it("should create canonical pair key regardless of user order", () => {
    const key1 = CanonicalPairUtil.createPairKey(10, 42);
    const key2 = CanonicalPairUtil.createPairKey(42, 10);

    expect(key1).toBe("10:42");
    expect(key2).toBe("10:42");
    expect(key1).toBe(key2);
  });

  it("should throw SelfConversationNotAllowedException if users are identical", () => {
    expect(() => CanonicalPairUtil.createPairKey(5, 5)).toThrow();
    expect(() => new CanonicalPairKey(5, 5)).toThrow(SelfConversationNotAllowedException);
  });

  it("should generate the same deterministic UUID for the same pair", () => {
    const key = CanonicalPairUtil.createPairKey(10, 42);
    const uuid1 = CanonicalPairUtil.generateDeterministicId(key);
    const uuid2 = CanonicalPairUtil.generateDeterministicId(key);

    expect(uuid1).toBe(uuid2);
    expect(uuid1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});
