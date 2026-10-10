import { describe, it, expect } from 'vitest';
import {
  formatWorkoutDate,
  formatWorkoutTime,
  getWorkoutDateKey,
  formatDateGroupHeading,
  toLocalDatetimeInputValue,
  toUtcIsoString,
} from './date';

describe('Date Utilities', () => {
  describe('getWorkoutDateKey', () => {
    it('extracts YYYY-MM-DD key from ISO string', () => {
      const key = getWorkoutDateKey('2026-10-10T14:30:00.000Z');
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns "unknown" for invalid date strings', () => {
      expect(getWorkoutDateKey('not-a-date')).toBe('unknown');
      expect(getWorkoutDateKey('')).toBe('unknown');
    });
  });

  describe('formatDateGroupHeading', () => {
    it('returns "Today" for current date key', () => {
      const today = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

      expect(formatDateGroupHeading(todayKey)).toBe('Today');
    });

    it('returns "Yesterday" for previous date key', () => {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const pad = (n: number) => String(n).padStart(2, '0');
      const yesterdayKey = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;

      expect(formatDateGroupHeading(yesterdayKey)).toBe('Yesterday');
    });

    it('returns "Undated Sessions" for unknown key', () => {
      expect(formatDateGroupHeading('unknown')).toBe('Undated Sessions');
    });

    it('formats arbitrary past dates into localized weekday string', () => {
      const formatted = formatDateGroupHeading('2025-05-15');
      expect(formatted).toContain('May');
      expect(formatted).toContain('2025');
    });
  });

  describe('toLocalDatetimeInputValue & toUtcIsoString', () => {
    it('formats a date into datetime-local compatible format YYYY-MM-DDTHH:mm', () => {
      const date = new Date(2026, 9, 10, 14, 30); // Oct 10 2026, 14:30
      const localVal = toLocalDatetimeInputValue(date);
      expect(localVal).toBe('2026-10-10T14:30');
    });

    it('converts local input string back to valid UTC ISO string', () => {
      const iso = toUtcIsoString('2026-10-10T14:30');
      expect(new Date(iso).getTime()).not.toBeNaN();
    });

    it('handles empty input gracefully in toUtcIsoString by returning valid current date', () => {
      const fallbackIso = toUtcIsoString('');
      expect(new Date(fallbackIso).getTime()).not.toBeNaN();
    });
  });

  describe('formatWorkoutDate & formatWorkoutTime', () => {
    it('formats valid ISO date into readable month and day', () => {
      const res = formatWorkoutDate('2026-10-10T14:30:00.000Z');
      expect(res).toContain('2026');
      expect(res).toContain('Oct');
    });

    it('returns empty string for invalid date in formatWorkoutTime', () => {
      expect(formatWorkoutTime('invalid-date')).toBe('');
    });
  });
});
