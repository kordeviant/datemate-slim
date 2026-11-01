export interface PageCursorData {
  bucket?: string;
  pagingState?: string | null;
  offset?: number;
  minBucket?: string;
  t?: number; // timestamp marker
  shard?: number;
}

export class CursorUtil {
  public static encode(data: PageCursorData): string {
    const json = JSON.stringify(data);
    return Buffer.from(json, 'utf8').toString('base64url');
  }

  public static decode(cursor: string): PageCursorData {
    try {
      const json = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(json);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Cursor payload must be an object');
      }
      return parsed as PageCursorData;
    } catch {
      throw new Error('Invalid opaque cursor');
    }
  }
}
