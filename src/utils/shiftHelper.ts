/**
 * Shift-aware date helpers for night-shift users.
 *
 * Concept: `date` on attendance_records stores the LOGICAL work date (the
 * calendar date at clock-in). Night-shift users clocking OUT the next morning
 * do NOT create a new record — the checkout flow adopts the still-open
 * record from yesterday (see fetchTodayAttendance) and writes check_out_time
 * onto it, so the record keeps its original clock-in date.
 *
 * Rationale: previously we treated any clock-in before 12:00 as a
 * continuation of yesterday's shift. That caused morning-shift users who
 * picked "shift" to be logged under the previous day. Now clock-in always
 * uses today's calendar date; cross-day continuation is handled purely by
 * matching an open yesterday record at checkout time.
 */

export type ShiftType = 'regular' | 'shift' | 'shift_morning' | 'shift_afternoon' | 'shift_night';

const pad = (n: number) => String(n).padStart(2, '0');

export const toLocalDateString = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Logical work date for a clock-in at `now` = today's local calendar date. */
export const computeWorkDate = (now: Date, _shiftType?: string | null): string => {
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
  shiftType === 'shift_night' || shiftType === 'shift';

export const SHIFT_LABELS: Record<ShiftType, string> = {
  regular: 'Regular',
  shift: 'Shift (Lintas Hari)',
  shift_morning: 'Shift Pagi (07-15)',
  shift_afternoon: 'Shift Sore (15-23)',
  shift_night: 'Shift Malam (23-07)',
};
