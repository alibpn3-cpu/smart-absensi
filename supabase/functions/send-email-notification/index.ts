import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import nodemailer from "npm:nodemailer@6.9.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  to_email: string;
  to_name: string;
  subject: string;
  message_type: 'request_submitted' | 'approval_needed' | 'status_update';
  request_number: string;
  request_type: string;
  creator_name?: string;
  status?: string;
  approver_name?: string;
  details?: string;
  app_url?: string;
}

const generateEmailHTML = (payload: EmailPayload): string => {
  const appLink = payload.app_url || 'https://absensi.petrolog.my.id';
  const requestsUrl = `${appLink}/requests`;

  let headerBg = '#3b82f6';
  let headerTitle = 'Notifikasi';
  let bodyContent = '';

  switch (payload.message_type) {
    case 'request_submitted':
      headerBg = '#3b82f6';
      headerTitle = `Permintaan ${payload.request_type} Diajukan`;
      bodyContent = `
        <p>Halo <strong>${payload.to_name}</strong>,</p>
        <p>Permintaan ${payload.request_type} Anda telah berhasil diajukan.</p>
        <table style="width:100%; background:#f8f9fa; border-radius:8px; margin:16px 0;">
          <tr><td style="padding:12px;">
            <p style="margin:4px 0;"><strong>Nomor:</strong> ${payload.request_number}</p>
            ${payload.details ? `<p style="margin:4px 0;">${payload.details}</p>` : ''}
          </td></tr>
        </table>
        <p>Permintaan Anda akan diproses oleh atasan dan HC&GA Site.</p>
      `;
      break;

    case 'approval_needed':
      headerBg = '#f59e0b';
      headerTitle = `Approval Diperlukan - ${payload.request_type}`;
      bodyContent = `
        <p>Halo <strong>${payload.to_name}</strong>,</p>
        <p>Anda diminta untuk mereview dan menyetujui permintaan berikut:</p>
        <table style="width:100%; background:#f8f9fa; border-radius:8px; margin:16px 0;">
          <tr><td style="padding:12px;">
            <p style="margin:4px 0;"><strong>Nomor:</strong> ${payload.request_number}</p>
            <p style="margin:4px 0;"><strong>Tipe:</strong> ${payload.request_type}</p>
            <p style="margin:4px 0;"><strong>Dari:</strong> ${payload.creator_name || '-'}</p>
            ${payload.details ? `<p style="margin:4px 0;">${payload.details}</p>` : ''}
          </td></tr>
        </table>
      `;
      break;

    case 'status_update':
      headerBg = payload.status === 'approved' ? '#22c55e' : '#ef4444';
      headerTitle = payload.status === 'approved'
        ? `${payload.request_type} Disetujui`
        : `${payload.request_type} Ditolak`;
      bodyContent = `
        <p>Halo <strong>${payload.to_name}</strong>,</p>
        <p>Permintaan ${payload.request_type} <strong>${payload.request_number}</strong> telah 
        ${payload.status === 'approved' ? 'disetujui' : 'ditolak'} oleh ${payload.approver_name || 'approver'}.</p>
        ${payload.details ? `<p><strong>Catatan:</strong> ${payload.details}</p>` : ''}
      `;
      break;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f4f4f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;">
    <tr><td align="center" style="padding:20px 0;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td align="center" style="background:${headerBg};padding:24px 20px;border-radius:10px 10px 0 0;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${headerTitle}</h1>
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Digital Presensi</p>
        </td></tr>
        <tr><td style="background:#fff;padding:24px 30px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;font-size:14px;color:#333;line-height:1.6;">
          ${bodyContent}
          <table cellpadding="0" cellspacing="0" align="center" style="margin:20px 0;">
            <tr><td align="center" style="border-radius:8px;background:${headerBg};">
              <a href="${requestsUrl}" style="padding:12px 24px;border-radius:8px;font-size:15px;color:#fff;text-decoration:none;font-weight:bold;display:inline-block;">
                Lihat Detail
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:16px;border-top:1px solid #e0e0e0;">
          <p style="margin:0;font-size:11px;color:#999;">Email otomatis dari Digital Presensi</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SMTP_HOST = Deno.env.get("SMTP_HOST");
    const SMTP_PORT = Deno.env.get("SMTP_PORT");
    const SMTP_USER = Deno.env.get("SMTP_USER");
    const SMTP_PASSWORD = Deno.env.get("SMTP_PASSWORD");
    const SMTP_FROM_EMAIL = Deno.env.get("SMTP_FROM_EMAIL");

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
      console.warn("⚠️ SMTP not configured");
      return new Response(
        JSON.stringify({ success: false, reason: "SMTP not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const payload: EmailPayload = await req.json();

    if (!payload.to_email) {
      return new Response(
        JSON.stringify({ success: false, reason: "No email provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    console.log(`📧 Sending email to: ${payload.to_email}`);
    console.log(`📧 SMTP config: host=${SMTP_HOST}, port=${SMTP_PORT}, user=${SMTP_USER}`);

    const emailHtml = generateEmailHTML(payload);
    const fromEmail = SMTP_FROM_EMAIL || SMTP_USER;
    const smtpPort = parseInt(SMTP_PORT || "587");

    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const info = await transporter.sendMail({
      from: `"Digital Absensi" <${fromEmail}>`,
      to: payload.to_email,
      subject: payload.subject,
      html: emailHtml,
    });

    console.log(`✅ Email sent to: ${payload.to_email}, messageId: ${info.messageId}`);

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Error sending email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
