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

// Get clock-in deadline based on employee type and work area
const getClockInDeadline = (employeeType: string, workArea: string): string => {
  const isHO = workArea.toLowerCase().includes('ho') || 
               workArea.toLowerCase().includes('head office') ||
               workArea.toLowerCase().includes('jakarta');
  
  if (isHO) {
    return '08:30';
  }
  
  if (employeeType === 'primary') {
    return '07:00';
  }
  
  return '08:00';
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

// Calculate how many minutes late
const calculateLateMinutes = (checkInTime: string, employeeType: string, workArea: string): number => {
  const deadline = getClockInDeadline(employeeType, workArea);
  const deadlineMinutes = parseTimeToMinutes(deadline);
  const checkInMinutes = parseTimeToMinutes(checkInTime);
  
  const diff = checkInMinutes - deadlineMinutes;
  return diff > 0 ? diff : 0;
};

// Check if clock-in time is late
export const isLate = (checkInTime: string, employeeType: string, workArea: string): boolean => {
  return calculateLateMinutes(checkInTime, employeeType, workArea) > 0;
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

// Get clock-out penalty based on clock-out time and employee type
const getClockOutPenalty = (checkOutTime: string | null, employeeType: string): number => {
  // No clock out - maximum penalty
  if (!checkOutTime) {
    return employeeType === 'primary' ? -25 : -50;
  }
  
  const checkOutMinutes = parseTimeToMinutes(checkOutTime);
  
  if (employeeType === 'primary') {
    // Primary: minimum 16:00 (960 minutes)
    const minClockOut = 16 * 60; // 16:00
    if (checkOutMinutes >= minClockOut) return 0;
    if (checkOutMinutes >= 15 * 60) return -10; // 15:00-15:59
    if (checkOutMinutes >= 14 * 60) return -20; // 14:00-14:59
    return -25; // < 14:00
  } else {
    // Staff: minimum 17:00 (1020 minutes)
    const minClockOut = 17 * 60; // 17:00
    if (checkOutMinutes >= minClockOut) return 0;
    if (checkOutMinutes >= 16 * 60) return -15; // 16:00-16:59
    if (checkOutMinutes >= 15 * 60) return -25; // 15:00-15:59
    return -35; // < 15:00
  }
};

// Calculate score components using subtractive formula (start from 100)
export const calculateScore = (input: ScoreInput): ScoreResult => {
  const { 
    checkInTime, 
    checkOutTime, 
    employeeType, 
    workArea,
    p2hChecked = false, 
    toolboxChecked = false 
  } = input;

  // Calculate late minutes
  const lateMinutes = calculateLateMinutes(checkInTime, employeeType, workArea);
  const late = lateMinutes > 0;

  // Get penalties
  const clockInPenalty = getClockInPenalty(lateMinutes, employeeType);
  const clockOutPenalty = getClockOutPenalty(checkOutTime, employeeType);
  
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

// Save score to database
export const saveScore = async (input: ScoreInput): Promise<boolean> => {
  try {
    const scoreResult = calculateScore(input);
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
