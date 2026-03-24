import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppPayload {
  phone_number: string;
  recipient_name: string;
  message_type: 'request_submitted' | 'approval_needed' | 'status_update';
  request_number?: string;
  request_type?: string; // 'Cuti' or 'Ijin'
  creator_name?: string;
  status?: string;
  approver_name?: string;
  details?: string;
  app_url?: string;
}

const buildMessage = (payload: WhatsAppPayload): string => {
  const {
    message_type, request_number, request_type, creator_name,
    status, approver_name, recipient_name, details, app_url
  } = payload;

  const appLink = app_url || 'https://absensi.petrolog.my.id';
  const requestsUrl = `${appLink}/requests`;

  switch (message_type) {
    case 'request_submitted':
      return `📝 *Permintaan ${request_type} Diajukan*\n\nHalo ${recipient_name},\n\nPermintaan ${request_type} Anda telah berhasil diajukan.\n\n📋 No: *${request_number}*\n${details || ''}\n\nSilakan pantau status di:\n${requestsUrl}\n\n_Pesan otomatis dari Digital Absensi_`;

    case 'approval_needed':
      return `🔔 *Permintaan ${request_type} Menunggu Approval*\n\nHalo ${recipient_name},\n\nAnda diminta untuk mereview permintaan:\n\n📋 No: *${request_number}*\n👤 Dari: ${creator_name}\n${details || ''}\n\nSilakan review di:\n${requestsUrl}\n\n_Pesan otomatis dari Digital Absensi_`;

    case 'status_update':
      if (status === 'approved') {
        return `✅ *Permintaan ${request_type} Disetujui*\n\nHalo ${recipient_name},\n\nPermintaan ${request_type} *${request_number}* telah disetujui oleh ${approver_name || 'approver'}.\n\nDetail:\n${requestsUrl}\n\n_Pesan otomatis dari Digital Absensi_`;
      } else if (status === 'rejected') {
        return `❌ *Permintaan ${request_type} Ditolak*\n\nHalo ${recipient_name},\n\nPermintaan ${request_type} *${request_number}* ditolak oleh ${approver_name || 'approver'}.\n${details ? `\nCatatan: ${details}` : ''}\n\nDetail:\n${requestsUrl}\n\n_Pesan otomatis dari Digital Absensi_`;
      }
      return `ℹ️ *Update Permintaan ${request_type}*\n\nHalo ${recipient_name},\n\n${request_number} status: ${status}\n\n${requestsUrl}\n\n_Pesan otomatis dari Digital Absensi_`;

    default:
      return `Notifikasi dari Digital Absensi: ${request_type} ${request_number}\n\n${requestsUrl}`;
  }
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FONNTE_TOKEN = Deno.env.get('FONNTE_TOKEN');
    if (!FONNTE_TOKEN) {
      console.warn('⚠️ FONNTE_TOKEN not configured');
      return new Response(
        JSON.stringify({ success: false, reason: 'WhatsApp API Token not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const payload: WhatsAppPayload = await req.json();

    if (!payload.phone_number) {
      return new Response(
        JSON.stringify({ success: false, reason: 'No phone number provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Normalize phone number (08x -> 628x)
    let phone = payload.phone_number.replace(/[\s\-\+]/g, '');
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1);
    }

    const message = buildMessage(payload);

    const fonnteResponse = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": FONNTE_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        target: phone,
        message: message,
        countryCode: "62"
      })
    });

    const result = await fonnteResponse.json();

    if (!result.status) {
      console.error('❌ Fonnte API error:', result);
      return new Response(
        JSON.stringify({ success: false, error: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`✅ WhatsApp sent to ${phone}`);
    return new Response(
      JSON.stringify({ success: true, phone, detail: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Error in send-whatsapp-notification:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
