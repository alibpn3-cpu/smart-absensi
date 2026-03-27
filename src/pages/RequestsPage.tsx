import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Plus, FileText, ClipboardList, Loader2, Eye, Pencil, Trash2, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import ApprovalProgressLine from '@/components/ApprovalProgressLine';
import LeaveRequestForm from '@/components/LeaveRequestForm';
import PermissionRequestForm from '@/components/PermissionRequestForm';
import RequestApprovalDialog from '@/components/RequestApprovalDialog';
import RequestDetailDialog from '@/components/RequestDetailDialog';
import { generateLeaveRequestPDF, generatePermissionRequestPDF } from '@/utils/pdfExportRequest';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface UserSession {
  uid: string;
  name: string;
  position: string;
  work_area: string;
  division?: string;
  supervisor_uid?: string;
  hcga_approver_uid?: string;
}

interface LeaveRequest {
  id: string;
  request_number: string;
  staff_uid: string;
  staff_name: string;
  department: string | null;
  position: string | null;
  leave_year: number;
  days_requested: number;
  leave_dates: any;
  remaining_balance: number | null;
  supervisor_status: string | null;
  hcga_status: string | null;
  status: string | null;
  created_at: string | null;
  supervisor_uid: string | null;
  hcga_approver_uid: string | null;
  supervisor_notes: string | null;
  hcga_notes: string | null;
  supervisor_recommendation: string | null;
  other_decisions: string | null;
  join_date: string | null;
  previous_year_balance: number | null;
}

interface PermissionRequest {
  id: string;
  request_number: string;
  staff_uid: string;
  staff_name: string;
  department: string | null;
  position: string | null;
  permission_duration: string;
  permission_date: string;
  phone_number: string | null;
  reason: string;
  supervisor_status: string | null;
  hcga_status: string | null;
  status: string | null;
  created_at: string | null;
  supervisor_uid: string | null;
  hcga_approver_uid: string | null;
  supervisor_notes: string | null;
  hcga_notes: string | null;
  join_date: string | null;
}

const statusBadge = (status: string | null) => {
  switch (status) {
    case 'approved': return <Badge className="bg-green-100 text-green-800 border-green-300">Disetujui</Badge>;
    case 'rejected': return <Badge variant="destructive">Ditolak</Badge>;
    default: return <Badge variant="secondary">Menunggu</Badge>;
  }
};

const RequestsPage = () => {
  const navigate = useNavigate();
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequest[]>([]);
  const [approvalLeaves, setApprovalLeaves] = useState<LeaveRequest[]>([]);
  const [approvalPermissions, setApprovalPermissions] = useState<PermissionRequest[]>([]);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [showPermissionForm, setShowPermissionForm] = useState(false);
  const [editLeaveData, setEditLeaveData] = useState<any>(null);
  const [editPermissionData, setEditPermissionData] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'leave' | 'permission'; number: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [approvalDialog, setApprovalDialog] = useState<{
    isOpen: boolean;
    requestId: string;
    requestNumber: string;
    requestType: 'leave' | 'permission';
    approverRole: 'supervisor' | 'hcga';
    staffName: string;
  } | null>(null);
  const [detailDialog, setDetailDialog] = useState<{
    isOpen: boolean;
    request: LeaveRequest | PermissionRequest;
    type: 'leave' | 'permission';
  } | null>(null);
  const [activeTab, setActiveTab] = useState('my-requests');
  const [leaveEnabled, setLeaveEnabled] = useState(false);
  const [permissionEnabled, setPermissionEnabled] = useState(false);
  const [approverNames, setApproverNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const sessionData = localStorage.getItem('userSession');
    if (!sessionData) {
      navigate('/user-login');
      return;
    }
    const session = JSON.parse(sessionData) as UserSession;
    setUserSession(session);
    fetchFeatureFlags();
    fetchData(session);
  }, [navigate]);

  const fetchFeatureFlags = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['leave_request_enabled', 'permission_request_enabled']);
    if (data) {
      setLeaveEnabled(data.find(d => d.setting_key === 'leave_request_enabled')?.setting_value === 'true');
      setPermissionEnabled(data.find(d => d.setting_key === 'permission_request_enabled')?.setting_value === 'true');
    }
  };

  const fetchData = async (session: UserSession) => {
    setLoading(true);
    try {
      const { data: myLeaves } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('staff_uid', session.uid)
        .order('created_at', { ascending: false });

      const { data: myPermissions } = await supabase
        .from('permission_requests')
        .select('*')
        .eq('staff_uid', session.uid)
        .order('created_at', { ascending: false });

      setLeaveRequests(myLeaves || []);
      setPermissionRequests(myPermissions || []);

      const { data: appLeaves } = await supabase
        .from('leave_requests')
        .select('*')
        .or(`supervisor_uid.eq.${session.uid},hcga_approver_uid.eq.${session.uid}`)
        .order('created_at', { ascending: false });

      const { data: appPermissions } = await supabase
        .from('permission_requests')
        .select('*')
        .or(`supervisor_uid.eq.${session.uid},hcga_approver_uid.eq.${session.uid}`)
        .order('created_at', { ascending: false });

      setApprovalLeaves(appLeaves || []);
      setApprovalPermissions(appPermissions || []);

      const allUids = new Set<string>();
      [...(myLeaves || []), ...(myPermissions || []), ...(appLeaves || []), ...(appPermissions || [])].forEach(r => {
        if (r.supervisor_uid) allUids.add(r.supervisor_uid);
        if (r.hcga_approver_uid) allUids.add(r.hcga_approver_uid);
      });
      if (allUids.size > 0) {
        const { data: names } = await supabase.from('staff_users').select('uid, name').in('uid', Array.from(allUids));
        if (names) {
          const map: Record<string, string> = {};
          names.forEach(n => { map[n.uid] = n.name; });
          setApproverNames(map);
        }
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const getApproverRole = (request: LeaveRequest | PermissionRequest, uid: string): 'supervisor' | 'hcga' => {
    if (request.supervisor_uid === uid) return 'supervisor';
    return 'hcga';
  };

  const canApprove = (request: LeaveRequest | PermissionRequest, uid: string): boolean => {
    const role = getApproverRole(request, uid);
    if (role === 'supervisor') return request.supervisor_status === 'pending';
    return request.supervisor_status === 'approved' && request.hcga_status === 'pending';
  };

  const isPending = (request: LeaveRequest | PermissionRequest): boolean => {
    return request.supervisor_status === 'pending' && request.hcga_status === 'pending' && request.status === 'pending';
  };

  const handleEdit = (request: any, type: 'leave' | 'permission') => {
    if (type === 'leave') {
      setEditLeaveData(request);
      setShowLeaveForm(true);
    } else {
      setEditPermissionData(request);
      setShowPermissionForm(true);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const table = deleteConfirm.type === 'leave' ? 'leave_requests' : 'permission_requests';
      const { error } = await supabase.from(table).delete().eq('id', deleteConfirm.id);
      if (error) throw error;
      toast({ title: "Berhasil", description: `Permintaan ${deleteConfirm.number} berhasil dihapus` });
      setDeleteConfirm(null);
      if (userSession) fetchData(userSession);
    } catch (error: any) {
      toast({ title: "Gagal", description: error.message || "Gagal menghapus permintaan", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const hasApprovalItems = approvalLeaves.length > 0 || approvalPermissions.length > 0;

  const renderRequestCard = (request: LeaveRequest | PermissionRequest, type: 'leave' | 'permission', isApproval: boolean = false) => {
    const isLeave = type === 'leave';
    const req = request as any;
    const isOwner = request.staff_uid === userSession?.uid;
    const canEditDelete = isOwner && isPending(request) && !isApproval;

    return (
      <Card key={request.id} className="border shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{request.request_number}</p>
              {isApproval && <p className="text-xs text-muted-foreground">{request.staff_name}</p>}
            </div>
            {statusBadge(request.status)}
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            {isLeave ? (
              <>
                <p>📅 {(req.leave_dates as string[])?.length || req.days_requested} hari cuti — Tahun {req.leave_year}</p>
                <p>📆 {Array.isArray(req.leave_dates) ? (req.leave_dates as string[]).map((d: string) => {
                  try { return format(new Date(d), 'dd MMM', { locale: idLocale }); } catch { return d; }
                }).join(', ') : '-'}</p>
              </>
            ) : (
              <>
                <p>⏱️ Durasi: {req.permission_duration}</p>
                <p>📅 Tanggal: {req.permission_date ? format(new Date(req.permission_date), 'dd MMM yyyy', { locale: idLocale }) : '-'}</p>
                <p>📝 {req.reason}</p>
              </>
            )}
            <p className="text-[10px]">Diajukan: {request.created_at ? format(new Date(request.created_at), 'dd MMM yyyy HH:mm', { locale: idLocale }) : '-'}</p>
          </div>

          <ApprovalProgressLine
            supervisorStatus={request.supervisor_status || 'pending'}
            hcgaStatus={request.hcga_status || 'pending'}
            supervisorName={approverNames[request.supervisor_uid || '']}
            hcgaName={approverNames[request.hcga_approver_uid || '']}
          />

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setDetailDialog({ isOpen: true, request, type })}>
              <Eye className="h-3 w-3 mr-1" /> Detail
            </Button>
            {canEditDelete && (
              <>
                <Button size="sm" variant="outline" onClick={() => handleEdit(request, type)}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm({ id: request.id, type, number: request.request_number })}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </>
            )}
            {isApproval && userSession && canApprove(request, userSession.uid) && (
              <Button size="sm" className="flex-1" onClick={() => setApprovalDialog({
                isOpen: true,
                requestId: request.id,
                requestNumber: request.request_number,
                requestType: type,
                approverRole: getApproverRole(request, userSession.uid),
                staffName: request.staff_name,
              })}>
                Review
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="max-w-lg mx-auto space-y-4">
        <Button variant="ghost" onClick={() => navigate('/')} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>

        <h1 className="text-xl font-bold text-foreground">Permintaan Cuti & Ijin</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="my-requests">Permintaan Saya</TabsTrigger>
            <TabsTrigger value="approvals" disabled={!hasApprovalItems}>
              Approval {hasApprovalItems && <Badge variant="secondary" className="ml-1 h-5 px-1">{approvalLeaves.filter(r => canApprove(r, userSession?.uid || '')).length + approvalPermissions.filter(r => canApprove(r, userSession?.uid || '')).length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-requests" className="space-y-4">
            <div className="flex gap-2">
              {leaveEnabled && (
                <Button onClick={() => { setEditLeaveData(null); setShowLeaveForm(true); }} className="flex-1" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Cuti
                </Button>
              )}
              {permissionEnabled && (
                <Button onClick={() => { setEditPermissionData(null); setShowPermissionForm(true); }} variant="outline" className="flex-1" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Ijin
                </Button>
              )}
            </div>

            {leaveRequests.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1"><FileText className="h-4 w-4" /> Cuti</h3>
                {leaveRequests.map(r => renderRequestCard(r, 'leave'))}
              </div>
            )}

            {permissionRequests.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1"><ClipboardList className="h-4 w-4" /> Ijin</h3>
                {permissionRequests.map(r => renderRequestCard(r, 'permission'))}
              </div>
            )}

            {leaveRequests.length === 0 && permissionRequests.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Belum ada permintaan</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="approvals" className="space-y-4">
            {approvalLeaves.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1"><FileText className="h-4 w-4" /> Cuti</h3>
                {approvalLeaves.map(r => renderRequestCard(r, 'leave', true))}
              </div>
            )}
            {approvalPermissions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1"><ClipboardList className="h-4 w-4" /> Ijin</h3>
                {approvalPermissions.map(r => renderRequestCard(r, 'permission', true))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Forms */}
      <LeaveRequestForm
        isOpen={showLeaveForm}
        onClose={() => { setShowLeaveForm(false); setEditLeaveData(null); }}
        onSubmitted={() => userSession && fetchData(userSession)}
        editData={editLeaveData}
      />
      <PermissionRequestForm
        isOpen={showPermissionForm}
        onClose={() => { setShowPermissionForm(false); setEditPermissionData(null); }}
        onSubmitted={() => userSession && fetchData(userSession)}
        editData={editPermissionData}
      />

      {/* Approval Dialog */}
      {approvalDialog && (
        <RequestApprovalDialog
          {...approvalDialog}
          onClose={() => setApprovalDialog(null)}
          onApproved={() => userSession && fetchData(userSession)}
        />
      )}

      {/* Detail Dialog */}
      {detailDialog && (
        <RequestDetailDialog
          isOpen={detailDialog.isOpen}
          onClose={() => setDetailDialog(null)}
          request={detailDialog.request}
          type={detailDialog.type}
          approverNames={approverNames}
        />
      )}

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Permintaan</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Apakah Anda yakin ingin menghapus permintaan <strong>{deleteConfirm?.number}</strong>? Tindakan ini tidak dapat dibatalkan.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={deleting}>Batal</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequestsPage;
