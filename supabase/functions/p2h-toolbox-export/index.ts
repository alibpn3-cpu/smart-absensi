import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function lastDay(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  const apiKey = req.headers.get('x-api-key');
  const expected = Deno.env.get('EXTERNAL_API_KEY');
  if (!expected) return jsonResponse({ error: 'Server not configured (missing EXTERNAL_API_KEY)' }, 500);
  if (!apiKey || apiKey !== expected) return jsonResponse({ error: 'Unauthorized: invalid x-api-key' }, 401);

  const url = new URL(req.url);
  // Range params (preferred): start_month/start_year/end_month/end_year
  // Backward-compat: month/year (single month)
  // Or: start_date/end_date (YYYY-MM-DD)
  const sMonth = url.searchParams.get('start_month');
  const sYear = url.searchParams.get('start_year');
  const eMonth = url.searchParams.get('end_month');
  const eYear = url.searchParams.get('end_year');
  const monthStr = url.searchParams.get('month');
  const yearStr = url.searchParams.get('year');
  const startDateParam = url.searchParams.get('start_date');
  const endDateParam = url.searchParams.get('end_date');

  const workArea = url.searchParams.get('work_area');
  const staffUid = url.searchParams.get('staff_uid');
  const activity = (url.searchParams.get('activity') || 'both').toLowerCase(); // both | p2h | toolbox
  const format = (url.searchParams.get('format') || 'json').toLowerCase();

  if (!['both', 'p2h', 'toolbox'].includes(activity)) {
    return jsonResponse({ error: '`activity` harus salah satu: both | p2h | toolbox' }, 400);
  }

  let startDate: string;
  let endDate: string;

  if (startDateParam && endDateParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateParam) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateParam)) {
      return jsonResponse({ error: 'start_date / end_date harus format YYYY-MM-DD' }, 400);
    }
    startDate = startDateParam;
    endDate = endDateParam;
  } else if (sMonth && sYear && eMonth && eYear) {
    const sm = Number(sMonth), sy = Number(sYear), em = Number(eMonth), ey = Number(eYear);
    if (!sm || sm < 1 || sm > 12 || !em || em < 1 || em > 12) return jsonResponse({ error: 'start_month/end_month harus 1-12' }, 400);
    if (!sy || !ey) return jsonResponse({ error: 'start_year/end_year wajib' }, 400);
    if (sy * 12 + sm > ey * 12 + em) return jsonResponse({ error: 'Range akhir harus >= range awal' }, 400);
    startDate = `${sy}-${String(sm).padStart(2,'0')}-01`;
    endDate = `${ey}-${String(em).padStart(2,'0')}-${String(lastDay(ey, em)).padStart(2,'0')}`;
  } else if (monthStr && yearStr) {
    const m = Number(monthStr), y = Number(yearStr);
    if (!m || m < 1 || m > 12) return jsonResponse({ error: '`month` (1-12) wajib' }, 400);
    if (!y || y < 2000 || y > 2100) return jsonResponse({ error: '`year` wajib' }, 400);
    startDate = `${y}-${String(m).padStart(2,'0')}-01`;
    endDate = `${y}-${String(m).padStart(2,'0')}-${String(lastDay(y, m)).padStart(2,'0')}`;
  } else {
    return jsonResponse({
      error: 'Tentukan periode: gunakan (start_month,start_year,end_month,end_year) ATAU (month,year) ATAU (start_date,end_date)',
    }, 400);
  }

  if (endDate < startDate) return jsonResponse({ error: 'end_date harus >= start_date' }, 400);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let q = supabase
    .from('p2h_toolbox_checklist')
    .select('id, checklist_date, staff_uid, staff_name, p2h_checked, p2h_photo_url, toolbox_checked, toolbox_photo_url, created_at, updated_at')
    .gte('checklist_date', startDate)
    .lte('checklist_date', endDate)
    .order('checklist_date', { ascending: true });

  if (staffUid) q = q.eq('staff_uid', staffUid);
  if (activity === 'p2h') q = q.eq('p2h_checked', true);
  else if (activity === 'toolbox') q = q.eq('toolbox_checked', true);

  const { data, error } = await q;
  if (error) return jsonResponse({ error: error.message }, 500);

  let rows = data ?? [];

  // Always enrich with staff work_area & position
  const staffMap = new Map<string, { work_area?: string; position?: string }>();
  if (rows.length > 0) {
    const uids = Array.from(new Set(rows.map(r => r.staff_uid)));
    const { data: staffs } = await supabase
      .from('staff_users')
      .select('uid, work_area, position')
      .in('uid', uids);
    (staffs ?? []).forEach(s => staffMap.set(s.uid, { work_area: s.work_area, position: s.position }));

    if (workArea) {
      rows = rows.filter(r => staffMap.get(r.staff_uid)?.work_area === workArea);
    }
  }

  // Project columns based on activity
  const projected = rows.map(r => {
    const s = staffMap.get(r.staff_uid) || {};
    const base: any = {
      id: r.id,
      checklist_date: r.checklist_date,
      staff_uid: r.staff_uid,
      staff_name: r.staff_name,
      work_area: s.work_area ?? null,
      position: s.position ?? null,
      created_at: r.created_at,
    };
    if (activity === 'both' || activity === 'p2h') {
      base.p2h_checked = r.p2h_checked;
      base.p2h_photo_url = r.p2h_photo_url;
    }
    if (activity === 'both' || activity === 'toolbox') {
      base.toolbox_checked = r.toolbox_checked;
      base.toolbox_photo_url = r.toolbox_photo_url;
    }
    return base;
  });

  if (format === 'csv') {
    const headers = ['id','checklist_date','staff_uid','staff_name','work_area','position'];
    if (activity === 'both' || activity === 'p2h') headers.push('p2h_checked','p2h_photo_url');
    if (activity === 'both' || activity === 'toolbox') headers.push('toolbox_checked','toolbox_photo_url');
    headers.push('created_at');
    const lines = [headers.join(',')];
    for (const r of projected) lines.push(headers.map(h => csvEscape((r as any)[h])).join(','));
    return new Response(lines.join('\n'), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="p2h_toolbox_${startDate}_to_${endDate}.csv"`,
      },
    });
  }

  return jsonResponse({
    period: { start: startDate, end: endDate },
    activity,
    count: projected.length,
    data: projected,
  });
});
