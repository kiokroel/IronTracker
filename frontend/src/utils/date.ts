/**
 * Format ISO datetime string to localized human readable string.
 * e.g. "Oct 10, 2026, 14:30"
 */
export function formatWorkoutDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Format ISO datetime string to simple time.
 * e.g. "14:30"
 */
export function formatWorkoutTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Extract YYYY-MM-DD date key from ISO string for grouping workouts by day.
 */
export function getWorkoutDateKey(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'unknown';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return 'unknown';
  }
}

/**
 * Format date key (YYYY-MM-DD) into user-friendly heading (Today, Yesterday, or full date).
 */
export function formatDateGroupHeading(dateKey: string): string {
  if (dateKey === 'unknown') return 'Undated Sessions';

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(
    yesterday.getDate()
  ).padStart(2, '0')}`;

  if (dateKey === todayKey) {
    return 'Today';
  }
  if (dateKey === yesterdayKey) {
    return 'Yesterday';
  }

  const [year, month, day] = dateKey.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(targetDate);
}

/**
 * Convert Date or ISO string to value for <input type="datetime-local">.
 * Format: "YYYY-MM-DDTHH:mm"
 */
export function toLocalDatetimeInputValue(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert local datetime string from <input type="datetime-local"> to ISO UTC string.
 */
export function toUtcIsoString(datetimeLocalValue: string): string {
  if (!datetimeLocalValue) {
    return new Date().toISOString();
  }
  const d = new Date(datetimeLocalValue);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
