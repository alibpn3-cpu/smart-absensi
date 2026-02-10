import { supabase } from '@/integrations/supabase/client';

interface ScoreInput {
  staffUid: string;
  staffName: string;
  checkInTime: string;
  checkOutTime: string | null;
  employeeType: string;
  workArea: string;
  p2hChecked?: boolean;
  toolboxChecked?: boolean;
}

interface ScoreResult {
  clockInScore: number;
  clockOutScore: number;
  p2hScore: number;
  toolboxScore: number;
  finalScore: number;
  isLate: boolean;
}

interface WorkSchedule {
  clockIn: string;
  clockOut: string;
}

// Cache for work schedules
let scheduleCache: Map<string, WorkSchedule> | null = null;
let scheduleCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fetch schedules from database
const fetchSchedules = async (): Promise<Map<string, WorkSchedule>> => {
  const now = Date.now();
  if (scheduleCache && (now - scheduleCacheTime) < CACHE_DURATION) {
    return scheduleCache;
  }

  const { data, error } = await supabase
    .from('work_area_schedules')
    .select('work_area, employee_type, clock_in_time, clock_out_time');

  if (error) {
    console.error('Error fetching work schedules:', error);
    // Return empty map, will use default fallback
    return new Map();
  }

  const map = new Map<string, WorkSchedule>();
  data?.forEach(s => {
    const key = `${s.work_area.toUpperCase()}|${s.employee_type}`;
    map.set(key, { clockIn: s.clock_in_time, clockOut: s.clock_out_time });
  });

  scheduleCache = map;
  scheduleCacheTime = now;
  console.log('📅 Work schedules cached:', map.size, 'entries');
  return map;
};

// Get schedule for specific work area + employee type
const getSchedule = async (workArea: string, employeeType: string): Promise<WorkSchedule> => {
  const schedules = await fetchSchedules();
  const normalizedArea = workArea?.toUpperCase() || '';
  const normalizedType = employeeType || 'staff';
  
  // Try exact match first
  const exactKey = `${normalizedArea}|${normalizedType}`;
  if (schedules.has(exactKey)) {
    return schedules.get(exactKey)!;
  }
  
  // Try partial match (for areas that might have slightly different names)
  for (const [key, schedule] of schedules.entries()) {
    const [area, type] = key.split('|');
    if (type === normalizedType && normalizedArea.includes(area)) {
      return schedule;
    }
  }
  
  // Fallback to DEFAULT
  const defaultKey = `DEFAULT|${normalizedType}`;
  if (schedules.has(defaultKey)) {
    return schedules.get(defaultKey)!;
  }
  
  // Ultimate fallback (hardcoded)
  return normalizedType === 'primary' 
    ? { clockIn: '07:00', clockOut: '16:00' }
    : { clockIn: '08:00', clockOut: '17:00' };
};

// Parse time string to minutes since midnight
const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
};

// Calculate how many minutes late (async version)
const calculateLateMinutesAsync = async (checkInTime: string, employeeType: string, workArea: string): Promise<number> => {
  const schedule = await getSchedule(workArea, employeeType);
  const deadlineMinutes = parseTimeToMinutes(schedule.clockIn);
  const checkInMinutes = parseTimeToMinutes(checkInTime);
  
  const diff = checkInMinutes - deadlineMinutes;
  return diff > 0 ? diff : 0;
};

// Check if clock-in time is late (async)
export const isLate = async (checkInTime: string, employeeType: string, workArea: string): Promise<boolean> => {
  const lateMinutes = await calculateLateMinutesAsync(checkInTime, employeeType, workArea);
  return lateMinutes > 0;
};

// Check if clock-in time is late (sync version for non-async contexts - uses default schedule)
export const isLateSyncFallback = (checkInTime: string, employeeType: string): boolean => {
  const deadline = employeeType === 'primary' ? '07:00' : '08:00';
  const deadlineMinutes = parseTimeToMinutes(deadline);
  const checkInMinutes = parseTimeToMinutes(checkInTime);
  return checkInMinutes > deadlineMinutes;
};

// Get clock-in penalty based on late minutes and employee type
const getClockInPenalty = (lateMinutes: number, employeeType: string): number => {
  if (lateMinutes === 0) return 0;
  
  if (employeeType === 'primary') {
    // Primary: max penalty -25 (25% of total)
    if (lateMinutes <= 30) return -10;
    if (lateMinutes <= 60) return -20;
    return -25;
  } else {
    // Staff: max penalty -35 (50% weight but graduated)
    if (lateMinutes <= 30) return -15;
    if (lateMinutes <= 60) return -25;
    return -35;
  }
};

// Get clock-out penalty based on clock-out time, employee type, and schedule
const getClockOutPenaltyWithSchedule = (checkOutTime: string | null, employeeType: string, minClockOutTime: string): number => {
  // No clock out - maximum penalty
  if (!checkOutTime) {
    return employeeType === 'primary' ? -25 : -50;
  }
  
  const checkOutMinutes = parseTimeToMinutes(checkOutTime);
  const minClockOutMinutes = parseTimeToMinutes(minClockOutTime);
  
  if (employeeType === 'primary') {
    if (checkOutMinutes >= minClockOutMinutes) return 0;
    if (checkOutMinutes >= minClockOutMinutes - 60) return -10; // 1 hour early
    if (checkOutMinutes >= minClockOutMinutes - 120) return -20; // 2 hours early
    return -25; // > 2 hours early
  } else {
    if (checkOutMinutes >= minClockOutMinutes) return 0;
    if (checkOutMinutes >= minClockOutMinutes - 60) return -15; // 1 hour early
    if (checkOutMinutes >= minClockOutMinutes - 120) return -25; // 2 hours early
    return -35; // > 2 hours early
  }
};

// Calculate score components using subtractive formula (start from 100) - ASYNC version
export const calculateScoreAsync = async (input: ScoreInput): Promise<ScoreResult> => {
  const { 
    checkInTime, 
    checkOutTime, 
    employeeType, 
    workArea,
    p2hChecked = false, 
    toolboxChecked = false 
  } = input;

  // Get schedule from database
  const schedule = await getSchedule(workArea, employeeType);
  console.log(`📊 Score calculation for ${workArea}/${employeeType}: schedule=${schedule.clockIn}-${schedule.clockOut}`);

  // Calculate late minutes using dynamic schedule
  const deadlineMinutes = parseTimeToMinutes(schedule.clockIn);
  const checkInMinutes = parseTimeToMinutes(checkInTime);
  const lateMinutes = Math.max(0, checkInMinutes - deadlineMinutes);
  const late = lateMinutes > 0;

  // Get penalties
  const clockInPenalty = getClockInPenalty(lateMinutes, employeeType);
  const clockOutPenalty = getClockOutPenaltyWithSchedule(checkOutTime, employeeType, schedule.clockOut);
  
  // P2H and Toolbox penalties (only for primary)
  const p2hPenalty = employeeType === 'primary' && !p2hChecked ? -25 : 0;
  const toolboxPenalty = employeeType === 'primary' && !toolboxChecked ? -25 : 0;

  // Calculate raw score (start from 100, apply penalties)
  let rawScore = 100 + clockInPenalty + clockOutPenalty;
  
  if (employeeType === 'primary') {
    rawScore += p2hPenalty + toolboxPenalty;
  }
  
  // Ensure raw score is between 0 and 100
  rawScore = Math.max(0, Math.min(100, rawScore));
  
  // Convert to 0-5 star scale
  const finalScore = Math.round((rawScore / 100) * 5 * 10) / 10;

  return {
    clockInScore: clockInPenalty,
    clockOutScore: clockOutPenalty,
    p2hScore: p2hPenalty,
    toolboxScore: toolboxPenalty,
    finalScore,
    isLate: late
  };
};

// Sync version for backward compatibility (uses cached schedule or default)
export const calculateScore = (input: ScoreInput): ScoreResult => {
  const { 
    checkInTime, 
    checkOutTime, 
    employeeType, 
    workArea,
    p2hChecked = false, 
    toolboxChecked = false 
  } = input;

  // Try to get from cache synchronously
  const normalizedArea = workArea?.toUpperCase() || '';
  const normalizedType = employeeType || 'staff';
  
  let schedule: WorkSchedule = normalizedType === 'primary' 
    ? { clockIn: '07:00', clockOut: '16:00' }
    : { clockIn: '08:00', clockOut: '17:00' };
  
  if (scheduleCache) {
    const exactKey = `${normalizedArea}|${normalizedType}`;
    if (scheduleCache.has(exactKey)) {
      schedule = scheduleCache.get(exactKey)!;
    } else {
      const defaultKey = `DEFAULT|${normalizedType}`;
      if (scheduleCache.has(defaultKey)) {
        schedule = scheduleCache.get(defaultKey)!;
      }
    }
  }

  // Calculate late minutes using schedule
  const deadlineMinutes = parseTimeToMinutes(schedule.clockIn);
  const checkInMinutes = parseTimeToMinutes(checkInTime);
  const lateMinutes = Math.max(0, checkInMinutes - deadlineMinutes);
  const late = lateMinutes > 0;

  // Get penalties
  const clockInPenalty = getClockInPenalty(lateMinutes, employeeType);
  const clockOutPenalty = getClockOutPenaltyWithSchedule(checkOutTime, employeeType, schedule.clockOut);
  
  // P2H and Toolbox penalties (only for primary)
  const p2hPenalty = employeeType === 'primary' && !p2hChecked ? -25 : 0;
  const toolboxPenalty = employeeType === 'primary' && !toolboxChecked ? -25 : 0;

  // Calculate raw score (start from 100, apply penalties)
  let rawScore = 100 + clockInPenalty + clockOutPenalty;
  
  if (employeeType === 'primary') {
    rawScore += p2hPenalty + toolboxPenalty;
  }
  
  // Ensure raw score is between 0 and 100
  rawScore = Math.max(0, Math.min(100, rawScore));
  
  // Convert to 0-5 star scale
  const finalScore = Math.round((rawScore / 100) * 5 * 10) / 10;

  return {
    clockInScore: clockInPenalty,
    clockOutScore: clockOutPenalty,
    p2hScore: p2hPenalty,
    toolboxScore: toolboxPenalty,
    finalScore,
    isLate: late
  };
};

// Save score to database (uses async version)
export const saveScore = async (input: ScoreInput): Promise<boolean> => {
  try {
    const scoreResult = await calculateScoreAsync(input);
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('daily_scores')
      .upsert({
        staff_uid: input.staffUid,
        staff_name: input.staffName,
        score_date: today,
        clock_in_score: scoreResult.clockInScore,
        clock_out_score: scoreResult.clockOutScore,
        p2h_score: scoreResult.p2hScore,
        toolbox_score: scoreResult.toolboxScore,
        final_score: scoreResult.finalScore,
        check_in_time: input.checkInTime,
        check_out_time: input.checkOutTime,
        is_late: scoreResult.isLate,
        employee_type: input.employeeType,
        work_area: input.workArea,
        calculation_method: 'manual'
      }, {
        onConflict: 'staff_uid,score_date'
      });

    if (error) {
      console.error('Error saving score:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in saveScore:', error);
    return false;
  }
};

// Get yesterday's score for a user
export const getYesterdayScore = async (staffUid: string): Promise<number | null> => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_scores')
      .select('final_score')
      .eq('staff_uid', staffUid)
      .eq('score_date', yesterdayStr)
      .single();

    if (error || !data) {
      return null;
    }

    return Number(data.final_score);
  } catch (error) {
    console.error('Error fetching yesterday score:', error);
    return null;
  }
};

// Get today's score for a user (used after clock-out)
export const getTodayScore = async (staffUid: string): Promise<number | null> => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_scores')
      .select('final_score')
      .eq('staff_uid', staffUid)
      .eq('score_date', today)
      .single();

    if (error || !data) {
      return null;
    }

    return Number(data.final_score);
  } catch (error) {
    console.error('Error fetching today score:', error);
    return null;
  }
};

// Get monthly accumulated score (sum of all daily scores from 1st of current month to yesterday)
export const getMonthlyAccumulatedScore = async (staffUid: string): Promise<number | null> => {
  try {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstOfMonthStr = firstOfMonth.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    // Jika tanggal 1, belum ada data bulan ini
    if (firstOfMonthStr === todayStr) return null;

    const { data, error } = await supabase
      .from('daily_scores')
      .select('final_score')
      .eq('staff_uid', staffUid)
      .gte('score_date', firstOfMonthStr)
      .lt('score_date', todayStr);

    if (error || !data || data.length === 0) return null;

    return data.reduce((sum, row) => sum + Number(row.final_score), 0);
  } catch (error) {
    console.error('Error fetching monthly accumulated score:', error);
    return null;
  }
};

// Pre-load schedules on module init
fetchSchedules().catch(console.error);
