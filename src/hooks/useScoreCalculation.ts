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
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
};

// Check if clock-in time is late
export const isLate = (checkInTime: string, employeeType: string, workArea: string): boolean => {
  const deadline = getClockInDeadline(employeeType, workArea);
  const deadlineMinutes = parseTimeToMinutes(deadline);
  const checkInMinutes = parseTimeToMinutes(checkInTime);
  
  return checkInMinutes > deadlineMinutes;
};

// Calculate score components
export const calculateScore = (input: ScoreInput): ScoreResult => {
  const { 
    checkInTime, 
    checkOutTime, 
    employeeType, 
    workArea,
    p2hChecked = false, 
    toolboxChecked = false 
  } = input;

  // 1. Clock In Score: 1 star if on time, 0 if late
  const late = isLate(checkInTime, employeeType, workArea);
  const clockInScore = late ? 0 : 1;

  // 2. Clock Out Score: 1 star if clocked out, 0 if not
  const clockOutScore = checkOutTime ? 1 : 0;

  // 3. P2H Score (only for primary): 1 star if checked
  const p2hScore = employeeType === 'primary' && p2hChecked ? 1 : 0;

  // 4. Toolbox Score (only for primary): 1 star if checked
  const toolboxScore = employeeType === 'primary' && toolboxChecked ? 1 : 0;

  // Calculate final score based on employee type
  let finalScore: number;
  
  if (employeeType === 'primary') {
    // Primary: all 4 components, max 4 stars, then scale to 5
    const rawScore = clockInScore + clockOutScore + p2hScore + toolboxScore;
    // Scale from 0-4 to 0-5 (multiply by 1.25)
    finalScore = Math.round((rawScore * 1.25) * 10) / 10;
  } else {
    // Staff: only clock in + clock out, max 2 stars, scale to 5
    const rawScore = clockInScore + clockOutScore;
    // Scale from 0-2 to 0-5 (multiply by 2.5)
    finalScore = Math.round((rawScore * 2.5) * 10) / 10;
  }

  return {
    clockInScore,
    clockOutScore,
    p2hScore,
    toolboxScore,
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
