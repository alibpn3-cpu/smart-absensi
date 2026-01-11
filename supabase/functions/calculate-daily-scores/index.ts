import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WorkSchedule {
  clockIn: string;
  clockOut: string;
}

// Parse time string to minutes since midnight
const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
};

// Get schedule from map with fallback
const getScheduleFromMap = (
  scheduleMap: Map<string, WorkSchedule>,
  workArea: string,
  employeeType: string
): WorkSchedule => {
  const normalizedArea = workArea?.toUpperCase() || '';
  const normalizedType = employeeType || 'staff';
  
  // Try exact match first
  const exactKey = `${normalizedArea}|${normalizedType}`;
  if (scheduleMap.has(exactKey)) {
    return scheduleMap.get(exactKey)!;
  }
  
  // Try partial match
  for (const [key, schedule] of scheduleMap.entries()) {
    const [area, type] = key.split('|');
    if (type === normalizedType && normalizedArea.includes(area)) {
      return schedule;
    }
  }
  
  // Fallback to DEFAULT
  const defaultKey = `DEFAULT|${normalizedType}`;
  if (scheduleMap.has(defaultKey)) {
    return scheduleMap.get(defaultKey)!;
  }
  
  // Ultimate fallback (hardcoded)
  return normalizedType === 'primary' 
    ? { clockIn: '07:00', clockOut: '16:00' }
    : { clockIn: '08:00', clockOut: '17:00' };
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
const getClockOutPenalty = (checkOutTime: string | null, employeeType: string, minClockOutTime: string): number => {
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

// Calculate score using subtractive formula (start from 100)
const calculateScore = (
  checkInTime: string,
  checkOutTime: string | null,
  employeeType: string,
  schedule: WorkSchedule,
  p2hChecked: boolean,
  toolboxChecked: boolean
) => {
  // Calculate late minutes using dynamic schedule
  const deadlineMinutes = parseTimeToMinutes(schedule.clockIn);
  const checkInMinutes = parseTimeToMinutes(checkInTime);
  const lateMinutes = Math.max(0, checkInMinutes - deadlineMinutes);
  const late = lateMinutes > 0;

  // Get penalties
  const clockInPenalty = getClockInPenalty(lateMinutes, employeeType);
  const clockOutPenalty = getClockOutPenalty(checkOutTime, employeeType, schedule.clockOut);
  
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

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting daily score calculation (Dynamic Schedule v3)...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if score feature is enabled
    const { data: featureFlag } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'score_feature_enabled')
      .single();

    if (featureFlag?.setting_value !== 'true') {
      console.log('⏸️ Score feature is disabled, skipping calculation');
      return new Response(
        JSON.stringify({ success: true, message: 'Score feature disabled, skipped' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch work area schedules from database
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('work_area_schedules')
      .select('work_area, employee_type, clock_in_time, clock_out_time');

    if (scheduleError) {
      console.error('❌ Error fetching work schedules:', scheduleError);
    }

    // Build schedule map
    const scheduleMap = new Map<string, WorkSchedule>();
    scheduleData?.forEach(s => {
      const key = `${s.work_area.toUpperCase()}|${s.employee_type}`;
      scheduleMap.set(key, { clockIn: s.clock_in_time, clockOut: s.clock_out_time });
    });
    console.log(`📅 Loaded ${scheduleMap.size} work schedules from database`);

    // Get today's date in WIB (Asia/Jakarta) timezone
    const wibTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const todayStr = wibTime.toISOString().split('T')[0];
    console.log(`📅 Processing scores for date: ${todayStr} (WIB timezone)`);

    // Get all attendance records for today that have check_in but might not have check_out
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('date', todayStr)
      .eq('attendance_type', 'regular')
      .not('check_in_time', 'is', null);

    if (attendanceError) {
      console.error('❌ Error fetching attendance records:', attendanceError);
      throw attendanceError;
    }

    console.log(`📊 Found ${attendanceRecords?.length || 0} attendance records to process`);

    // Get all staff users to get employee_type
    const { data: staffUsers, error: staffError } = await supabase
      .from('staff_users')
      .select('uid, name, employee_type, work_area');

    if (staffError) {
      console.error('❌ Error fetching staff users:', staffError);
      throw staffError;
    }

    const staffMap = new Map(staffUsers?.map(s => [s.uid, s]) || []);

    // Get P2H/Toolbox checklist for today
    const { data: checklists } = await supabase
      .from('p2h_toolbox_checklist')
      .select('*')
      .eq('checklist_date', todayStr);

    const checklistMap = new Map(checklists?.map(c => [c.staff_uid, c]) || []);

    let processedCount = 0;
    let errorCount = 0;

    for (const record of attendanceRecords || []) {
      try {
        const staff = staffMap.get(record.staff_uid);
        const checklist = checklistMap.get(record.staff_uid);
        
        const employeeType = staff?.employee_type || 'staff';
        const workArea = staff?.work_area || '';
        const p2hChecked = checklist?.p2h_checked || false;
        const toolboxChecked = checklist?.toolbox_checked || false;

        // Get schedule from map
        const schedule = getScheduleFromMap(scheduleMap, workArea, employeeType);
        
        console.log(`👤 ${record.staff_name} (${workArea}/${employeeType}): schedule=${schedule.clockIn}-${schedule.clockOut}`);

        const scoreResult = calculateScore(
          record.check_in_time,
          record.check_out_time,
          employeeType,
          schedule,
          p2hChecked,
          toolboxChecked
        );

        // Check if score already exists
        const { data: existingScore } = await supabase
          .from('daily_scores')
          .select('id, calculation_method')
          .eq('staff_uid', record.staff_uid)
          .eq('score_date', todayStr)
          .single();

        // Only update if not already calculated manually
        if (existingScore && existingScore.calculation_method === 'manual') {
          console.log(`⏭️ Skipping ${record.staff_name} - already has manual score`);
          continue;
        }

        // Upsert score
        const { error: upsertError } = await supabase
          .from('daily_scores')
          .upsert({
            staff_uid: record.staff_uid,
            staff_name: record.staff_name,
            score_date: todayStr,
            clock_in_score: scoreResult.clockInScore,
            clock_out_score: scoreResult.clockOutScore,
            p2h_score: scoreResult.p2hScore,
            toolbox_score: scoreResult.toolboxScore,
            final_score: scoreResult.finalScore,
            check_in_time: record.check_in_time,
            check_out_time: record.check_out_time,
            is_late: scoreResult.isLate,
            employee_type: employeeType,
            work_area: workArea,
            calculation_method: 'auto_cron'
          }, {
            onConflict: 'staff_uid,score_date'
          });

        if (upsertError) {
          console.error(`❌ Error saving score for ${record.staff_name}:`, upsertError);
          errorCount++;
        } else {
          const clockOutStatus = record.check_out_time ? record.check_out_time : 'NO CLOCK OUT';
          console.log(`✅ Score saved for ${record.staff_name}: ${scoreResult.finalScore}/5 (IN: ${scoreResult.clockInScore}, OUT: ${scoreResult.clockOutScore}, clockOut: ${clockOutStatus})`);
          processedCount++;
        }
      } catch (recordError) {
        console.error(`❌ Error processing record for ${record.staff_name}:`, recordError);
        errorCount++;
      }
    }

    console.log(`🏁 Completed! Processed: ${processedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        date: todayStr,
        processed: processedCount,
        errors: errorCount,
        total: attendanceRecords?.length || 0,
        formula: 'dynamic_schedule_v3',
        schedulesLoaded: scheduleMap.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Fatal error in calculate-daily-scores:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
