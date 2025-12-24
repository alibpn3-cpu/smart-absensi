import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Get clock-in deadline based on employee type and work area
const getClockInDeadline = (employeeType: string, workArea: string): string => {
  const isHO = workArea?.toLowerCase().includes('ho') || 
               workArea?.toLowerCase().includes('head office') ||
               workArea?.toLowerCase().includes('jakarta');
  
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

// Check if clock-in time is late
const isLate = (checkInTime: string, employeeType: string, workArea: string): boolean => {
  const deadline = getClockInDeadline(employeeType, workArea);
  const deadlineMinutes = parseTimeToMinutes(deadline);
  const checkInMinutes = parseTimeToMinutes(checkInTime);
  
  return checkInMinutes > deadlineMinutes;
};

// Calculate score for a user
const calculateScore = (
  checkInTime: string,
  checkOutTime: string | null,
  employeeType: string,
  workArea: string,
  p2hChecked: boolean,
  toolboxChecked: boolean
) => {
  // 1. Clock In Score: 1 star if on time, 0 if late
  const late = isLate(checkInTime, employeeType, workArea);
  const clockInScore = late ? 0 : 1;

  // 2. Clock Out Score: 1 star if clocked out, -1 if not (forgot to clock out)
  const clockOutScore = checkOutTime ? 1 : -1;

  // 3. P2H Score (only for primary): 1 star if checked
  const p2hScore = employeeType === 'primary' && p2hChecked ? 1 : 0;

  // 4. Toolbox Score (only for primary): 1 star if checked
  const toolboxScore = employeeType === 'primary' && toolboxChecked ? 1 : 0;

  // Calculate final score based on employee type
  let finalScore: number;
  
  if (employeeType === 'primary') {
    // Primary: all 4 components, max 4 stars (including -1 for no clock out)
    const rawScore = clockInScore + clockOutScore + p2hScore + toolboxScore;
    // Scale from -1 to 4 range to 0-5 (shift by 1, then multiply by 1.25)
    finalScore = Math.max(0, Math.round(((rawScore + 1) * 1) * 10) / 10);
  } else {
    // Staff: only clock in + clock out, max 2 stars
    const rawScore = clockInScore + clockOutScore;
    // Scale from -1 to 2 range to 0-5
    finalScore = Math.max(0, Math.round(((rawScore + 1) * 1.67) * 10) / 10);
  }

  return {
    clockInScore,
    clockOutScore,
    p2hScore,
    toolboxScore,
    finalScore: Math.min(5, finalScore), // Cap at 5
    isLate: late
  };
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Starting daily score calculation...');
    
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

    // Get today's date
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    console.log(`📅 Processing scores for date: ${todayStr}`);

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
        const workArea = staff?.work_area || record.staff_name || '';
        const p2hChecked = checklist?.p2h_checked || false;
        const toolboxChecked = checklist?.toolbox_checked || false;

        const scoreResult = calculateScore(
          record.check_in_time,
          record.check_out_time,
          employeeType,
          workArea,
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
          console.log(`✅ Score saved for ${record.staff_name}: ${scoreResult.finalScore}/5 (clock_out: ${record.check_out_time ? 'yes' : 'no'})`);
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
        total: attendanceRecords?.length || 0
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
