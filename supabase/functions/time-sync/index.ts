// Lightweight time sync endpoint. Returns server epoch in ms.
// Used by client to detect clock skew (timezone-agnostic, UTC compare).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const now = Date.now();
  return new Response(
    JSON.stringify({
      server_time: new Date(now).toISOString(),
      server_epoch_ms: now,
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
});
