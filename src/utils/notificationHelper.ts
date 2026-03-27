import { supabase } from '@/integrations/supabase/client';

interface NotifyApproverParams {
  requestId: string;
  requestNumber: string;
  requestType: 'Cuti' | 'Ijin';
  creatorName: string;
  approverUid: string;
  details?: string;
}

interface NotifyStatusParams {
  requestNumber: string;
  requestType: 'Cuti' | 'Ijin';
  staffUid: string;
  staffName: string;
  status: 'approved' | 'rejected';
  approverName: string;
  notes?: string;
}

interface NotifySubmittedParams {
  requestNumber: string;
  requestType: 'Cuti' | 'Ijin';
  staffUid: string;
  staffName: string;
  details?: string;
}

// Get staff info (name, phone, email) from staff_users
const getStaffInfo = async (uid: string) => {
  const { data } = await supabase
    .from('staff_users')
    .select('name, phone_number, email, uid')
    .eq('uid', uid)
    .single();
  return data;
};

// Send WhatsApp notification (fire-and-forget, don't block UI)
const sendWhatsApp = async (phoneNumber: string, payload: Record<string, any>) => {
  try {
    await supabase.functions.invoke('send-whatsapp-notification', {
      body: { phone_number: phoneNumber, ...payload }
    });
  } catch (e) {
    console.warn('WhatsApp notification failed:', e);
  }
};

// Send Email notification (fire-and-forget)
const sendEmail = async (payload: Record<string, any>) => {
  try {
    await supabase.functions.invoke('send-email-notification', {
      body: payload
    });
  } catch (e) {
    console.warn('Email notification failed:', e);
  }
};

// Notify approver that a new request needs review
export const notifyApproverNewRequest = async (params: NotifyApproverParams) => {
  const approver = await getStaffInfo(params.approverUid);
  if (!approver) return;

  // WhatsApp
  if (approver.phone_number) {
    await sendWhatsApp(approver.phone_number, {
      recipient_name: approver.name,
      message_type: 'approval_needed',
      request_number: params.requestNumber,
      request_type: params.requestType,
      creator_name: params.creatorName,
      details: params.details,
    });
  }

  // Email - we don't have email field yet, so skip for now
  // Could be added when email field is added to staff_users
};

// Notify staff that their request status changed
export const notifyStatusUpdate = async (params: NotifyStatusParams) => {
  const staff = await getStaffInfo(params.staffUid);
  if (!staff) return;

  if (staff.phone_number) {
    await sendWhatsApp(staff.phone_number, {
      recipient_name: staff.name,
      message_type: 'status_update',
      request_number: params.requestNumber,
      request_type: params.requestType,
      status: params.status,
      approver_name: params.approverName,
      details: params.notes,
    });
  }
};

// Notify staff that their request was submitted
export const notifyRequestSubmitted = async (params: NotifySubmittedParams) => {
  const staff = await getStaffInfo(params.staffUid);
  if (!staff) return;

  if (staff.phone_number) {
    await sendWhatsApp(staff.phone_number, {
      recipient_name: staff.name,
      message_type: 'request_submitted',
      request_number: params.requestNumber,
      request_type: params.requestType,
      details: params.details,
    });
  }
};
