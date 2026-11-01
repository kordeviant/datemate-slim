export class TimeBucketUtil {
  public static getBucket(date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  public static getBucketFromTimeUuid(timeUuid: any): string {
    if (!timeUuid) {
      return this.getBucket();
    }
    const date = typeof timeUuid.getDate === 'function' ? timeUuid.getDate() : new Date();
    return this.getBucket(date);
  }

  public static getPreviousBucket(currentBucket: string): string {
    const year = parseInt(currentBucket.substring(0, 4), 10);
    const month = parseInt(currentBucket.substring(4, 6), 10) - 1;
    const day = parseInt(currentBucket.substring(6, 8), 10);
    const date = new Date(Date.UTC(year, month, day));
    date.setUTCDate(date.getUTCDate() - 1);
    return this.getBucket(date);
  }

  public static isBucketOlderThan(bucketA: string, bucketB: string): boolean {
    return parseInt(bucketA, 10) < parseInt(bucketB, 10);
  }
}
