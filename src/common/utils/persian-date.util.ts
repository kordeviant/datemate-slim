/**
 * Utility functions for formatting dates and numbers in Persian (Farsi).
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: number | string): string {
  return input
    .toString()
    .replace(/\d/g, (char) => PERSIAN_DIGITS[parseInt(char, 10)]);
}

/**
 * Formats a Date into a human-friendly Persian relative time string.
 * Example: "۱۷ دقیقه قبل", "۲ ساعت قبل", "چند لحظه قبل"
 */
export function formatPersianRelativeTime(
  date: Date | string,
  now: Date = new Date(),
): string {
  const targetDate = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Math.max(0, now.getTime() - targetDate.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return 'چند لحظه قبل';
  }

  if (diffMinutes < 60) {
    return `${toPersianDigits(diffMinutes)} دقیقه قبل`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${toPersianDigits(diffHours)} ساعت قبل`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) {
    return `${toPersianDigits(diffDays)} روز قبل`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) {
    return `${toPersianDigits(diffMonths)} ماه قبل`;
  }

  const diffYears = Math.floor(diffMonths / 12);
  return `${toPersianDigits(diffYears)} سال قبل`;
}
