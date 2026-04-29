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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'GET') return jsonResponse({ error: 'Method not allowed' }, 405);

  // API key auth
  const apiKey = req.headers.get('x-api-key');
  const expected = Deno.env.get('EXTERNAL_API_KEY');
  if (!expected) return jsonResponse({ error: 'Server not configured (missing EXTERNAL_API_KEY)' }, 500);
  if (!apiKey || apiKey !== expected) return jsonResponse({ error: 'Unauthorized: invalid x-api-key' }, 401);

  const url = new URL(req.url);
  const monthStr = url.searchParams.get('month');
  const yearStr = url.searchParams.get('year');
  const workArea = url.searchParams.get('work_area');
  const staffUid = url.searchParams.get('staff_uid');
  const format = (url.searchParams.get('format') || 'json').toLowerCase();

  const month = Number(monthStr);
  const year = Number(yearStr);
  if (!month || month < 1 || month > 12) return jsonResponse({ error: '`month` (1-12) wajib' }, 400);
  if (!year || year < 2000 || year > 2100) return jsonResponse({ error: '`year` wajib (cth: 2026)' }, 400);

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

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

  const { data, error } = await q;
  if (error) return jsonResponse({ error: error.message }, 500);

  let rows = data ?? [];

  if (workArea && rows.length > 0) {
    const uids = Array.from(new Set(rows.map(r => r.staff_uid)));
    const { data: staffs } = await supabase
      .from('staff_users')
      .select('uid, work_area')
      .in('uid', uids);
    const allowed = new Set((staffs ?? []).filter(s => s.work_area === workArea).map(s => s.uid));
    rows = rows.filter(r => allowed.has(r.staff_uid));
  }

  if (format === 'csv') {
    const headers = ['id','checklist_date','staff_uid','staff_name','p2h_checked','p2h_photo_url','toolbox_checked','toolbox_photo_url','created_at'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      lines.push(headers.map(h => csvEscape((r as any)[h])).join(','));
    }
    return new Response(lines.join('\n'), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="p2h_toolbox_${year}_${month}.csv"`,
      },
    });
  }

  return jsonResponse({
    month, year,
    count: rows.length,
    period: { start: startDate, end: endDate },
    data: rows,
  });
});
