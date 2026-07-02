/**
 * Shift-aware date helpers for night-shift users.
 *
 * Concept: the `date` column on attendance_records always stores the LOGICAL
 * work date (the date the shift started). For regular users this equals the
 * calendar date. For shift_night users who clock in at 20:00-23:59, the work
 * date is today. If they clock in at 00:00-11:59 (very early), we treat it as
 * a continuation of yesterday's shift (only if there is an open record from
 * yesterday). Otherwise, standard rules apply.
 */

export type ShiftType = 'regular' | 'shift_morning' | 'shift_afternoon' | 'shift_night';

const pad = (n: number) => String(n).padStart(2, '0');

export const toLocalDateString = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Return the logical work date (YYYY-MM-DD) for a clock-in at `now`.
 * - shift_night + hour < 12  -> yesterday (continuation)
 * - shift_night + hour >= 12 -> today (new shift starting evening)
 * - other shifts             -> today (calendar date)
 */
export const computeWorkDate = (now: Date, shiftType?: string | null): string => {
  const t = (shiftType || 'regular') as ShiftType;
  if (t === 'shift_night') {
    const h = now.getHours();
    if (h < 12) {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return toLocalDateString(y);
    }
  }
  return toLocalDateString(now);
};

/**
 * Return yesterday's YYYY-MM-DD (used when checking for open night-shift record).
 */
export const yesterdayDateString = (now: Date): string => {
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  return toLocalDateString(y);
};

export const isNightShift = (shiftType?: string | null): boolean =>
  shiftType === 'shift_night';

export const SHIFT_LABELS: Record<ShiftType, string> = {
  regular: 'Regular',
  shift_morning: 'Shift Pagi (07-15)',
  shift_afternoon: 'Shift Sore (15-23)',
  shift_night: 'Shift Malam (23-07)',
};
