import { CursorUtil } from "@common/utils/cursor.util";

describe("Opaque Cursor Utility", () => {
  it("should encode and decode cursor payload", () => {
    const payload = {
      bucket: "20261013",
      pagingState: "abcdef123456",
      minBucket: "20261001",
    };

    const encoded = CursorUtil.encode(payload);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = CursorUtil.decode(encoded);
    expect(decoded).toEqual(payload);
  });

  it("should throw on invalid cursor", () => {
    expect(() => CursorUtil.decode("invalid-non-base64-random-string-!!")).toThrow("Invalid opaque cursor");
    expect(() => CursorUtil.decode("bm90LWpzb24=")).toThrow("Invalid opaque cursor");
  });
});
