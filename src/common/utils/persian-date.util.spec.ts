import {
  formatPersianRelativeTime,
  toPersianDigits,
} from './persian-date.util';

describe('persian-date.util', () => {
  describe('toPersianDigits', () => {
    it('should convert english digits to persian digits', () => {
      expect(toPersianDigits(17)).toBe('۱۷');
      expect(toPersianDigits('2026')).toBe('۲۰۲۶');
      expect(toPersianDigits(0)).toBe('۰');
    });
  });

  describe('formatPersianRelativeTime', () => {
    const now = new Date('2026-10-05T12:00:00.000Z');

    it('should return چند لحظه قبل for less than 1 minute', () => {
      const date = new Date(now.getTime() - 30 * 1000);
      expect(formatPersianRelativeTime(date, now)).toBe('چند لحظه قبل');
    });

    it('should return X دقیقه قبل for minutes', () => {
      const date = new Date(now.getTime() - 17 * 60 * 1000);
      expect(formatPersianRelativeTime(date, now)).toBe('۱۷ دقیقه قبل');
    });

    it('should return X ساعت قبل for hours', () => {
      const date = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      expect(formatPersianRelativeTime(date, now)).toBe('۲ ساعت قبل');
    });

    it('should return X روز قبل for days', () => {
      const date = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      expect(formatPersianRelativeTime(date, now)).toBe('۳ روز قبل');
    });

    it('should accept ISO string date', () => {
      const dateStr = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
      expect(formatPersianRelativeTime(dateStr, now)).toBe('۱۰ دقیقه قبل');
    });
  });
});
