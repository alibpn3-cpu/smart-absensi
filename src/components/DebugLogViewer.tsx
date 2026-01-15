import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Bug, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight, 
  Camera, 
  MapPin, 
  Smartphone, 
  Monitor,
  AlertCircle,
  CheckCircle,
  XCircle,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface DebugLog {
  id: string;
  created_at: string;
  staff_uid: string | null;
  staff_name: string | null;
  platform: string | null;
  issue_type: string | null;
  error_message: string | null;
  error_stack: string | null;
  user_notes: string | null;
  user_agent: string | null;
  screen_width: number | null;
  screen_height: number | null;
  device_id: string | null;
  permissions_state: {
    camera?: boolean;
    location?: boolean;
    geolocationAvailable?: boolean;
    mediaDevicesAvailable?: boolean;
    cameraError?: {
      name: string;
      message: string;
      stack?: string;
    };
  } | null;
  location_data: {
    lat?: number;
    lng?: number;
    accuracy?: number;
    error?: string;
  } | null;
  console_logs: string[] | null;
}

const DebugLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [issueTypeFilter, setIssueTypeFilter] = useState('all');
  const [searchName, setSearchName] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [dateFrom, dateTo, issueTypeFilter]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('debug_logs')
        .select('*')
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false });

      if (issueTypeFilter !== 'all') {
        query = query.eq('issue_type', issueTypeFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter by name if search is active
      let filteredData = (data || []) as DebugLog[];
      if (searchName.trim()) {
        const search = searchName.toLowerCase();
        filteredData = filteredData.filter(log => 
          log.staff_name?.toLowerCase().includes(search) ||
          log.staff_uid?.toLowerCase().includes(search)
        );
      }

      setLogs(filteredData);
    } catch (error) {
      console.error('Error fetching debug logs:', error);
      toast({
        title: "Gagal Memuat Log",
        description: "Terjadi kesalahan saat memuat data debug logs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getIssueTypeBadge = (issueType: string | null) => {
    switch (issueType) {
      case 'location':
        return <Badge variant="destructive" className="gap-1"><MapPin className="h-3 w-3" /> Location</Badge>;
      case 'camera':
        return <Badge className="gap-1 bg-orange-500 hover:bg-orange-600"><Camera className="h-3 w-3" /> Camera</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> General</Badge>;
    }
  };

  const getPermissionIcon = (granted: boolean | undefined) => {
    if (granted === true) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (granted === false) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return <span className="text-muted-foreground">-</span>;
  };

  const getPlatformIcon = (platform: string | null) => {
    if (platform === 'Android' || platform === 'iOS') {
      return <Smartphone className="h-4 w-4" />;
    }
    return <Monitor className="h-4 w-4" />;
  };

  const exportToExcel = () => {
    if (logs.length === 0) {
      toast({
        title: "Tidak ada data",
        description: "Tidak ada log untuk diekspor",
        variant: "destructive"
      });
      return;
    }

    const exportData = logs.map(log => ({
      Waktu: log.created_at ? format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: id }) : '-',
      Nama: log.staff_name || '-',
      UID: log.staff_uid || '-',
      Platform: log.platform || '-',
      'Issue Type': log.issue_type || 'general',
      Error: log.error_message || '-',
      'Camera Permission': log.permissions_state?.camera ? 'Granted' : 'Denied',
      'Location Permission': log.permissions_state?.location ? 'Granted' : 'Denied',
      'User Notes': log.user_notes || '-',
      'User Agent': log.user_agent || '-',
      'Screen': `${log.screen_width || 0}x${log.screen_height || 0}`,
      'Device ID': log.device_id || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Debug Logs');
    
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, `debug-logs-${dateFrom}-${dateTo}.xlsx`);

    toast({
      title: "Export Berhasil",
      description: `${logs.length} log berhasil diekspor ke Excel`
    });
  };

  const filteredLogs = React.useMemo(() => {
    if (!searchName.trim()) return logs;
    const search = searchName.toLowerCase();
    return logs.filter(log => 
      log.staff_name?.toLowerCase().includes(search) ||
      log.staff_uid?.toLowerCase().includes(search)
    );
  }, [logs, searchName]);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-title-primary">
          <Bug className="h-5 w-5" />
          Debug Logs dari User
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="space-y-2">
            <Label className="text-xs">Dari Tanggal</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Issue Type</Label>
            <Select value={issueTypeFilter} onValueChange={setIssueTypeFilter}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="location">Location</SelectItem>
                <SelectItem value="camera">Camera</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Cari Nama/UID</Label>
            <Input
              placeholder="Ketik nama..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={fetchLogs} variant="outline" className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={exportToExcel} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Total: <strong className="text-foreground">{filteredLogs.length}</strong> logs</span>
          <span>•</span>
          <span>Camera Issues: <strong className="text-orange-500">{filteredLogs.filter(l => l.issue_type === 'camera').length}</strong></span>
          <span>•</span>
          <span>Location Issues: <strong className="text-red-500">{filteredLogs.filter(l => l.issue_type === 'location').length}</strong></span>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-8"></TableHead>
                <TableHead>Waktu</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead className="text-center">Cam</TableHead>
                <TableHead className="text-center">Loc</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Memuat data...</p>
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Tidak ada debug logs ditemukan
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <Collapsible key={log.id} asChild open={expandedRows.has(log.id)}>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleRow(log.id)}
                        >
                          <TableCell>
                            {expandedRows.has(log.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {log.created_at 
                              ? format(new Date(log.created_at), 'dd MMM HH:mm', { locale: id })
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{log.staff_name || '-'}</div>
                            <div className="text-xs text-muted-foreground">{log.staff_uid || '-'}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {getPlatformIcon(log.platform)}
                              <span className="text-xs">{log.platform || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getIssueTypeBadge(log.issue_type)}</TableCell>
                          <TableCell className="text-center">
                            {getPermissionIcon(log.permissions_state?.camera)}
                          </TableCell>
                          <TableCell className="text-center">
                            {getPermissionIcon(log.permissions_state?.location)}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-xs">
                            {log.error_message || '-'}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-xs">
                            {log.user_notes || '-'}
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={9} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              {/* Device Info */}
                              <div className="space-y-1">
                                <div className="font-medium text-xs text-muted-foreground uppercase">Device Info</div>
                                <div><span className="text-muted-foreground">Device ID:</span> {log.device_id || '-'}</div>
                                <div><span className="text-muted-foreground">Screen:</span> {log.screen_width}x{log.screen_height}</div>
                                <div className="text-xs break-all">
                                  <span className="text-muted-foreground">User Agent:</span><br/>
                                  {log.user_agent || '-'}
                                </div>
                              </div>

                              {/* Permissions Detail */}
                              <div className="space-y-1">
                                <div className="font-medium text-xs text-muted-foreground uppercase">Permissions</div>
                                <div className="flex items-center gap-2">
                                  <Camera className="h-4 w-4" />
                                  <span>Camera: {log.permissions_state?.camera ? '✅ Granted' : '❌ Denied'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4" />
                                  <span>Location: {log.permissions_state?.location ? '✅ Granted' : '❌ Denied'}</span>
                                </div>
                                {log.permissions_state?.cameraError && (
                                  <div className="mt-2 p-2 bg-destructive/10 rounded text-xs">
                                    <div className="font-medium text-destructive">Camera Error:</div>
                                    <div>{log.permissions_state.cameraError.name}: {log.permissions_state.cameraError.message}</div>
                                  </div>
                                )}
                              </div>

                              {/* Location Data */}
                              <div className="space-y-1">
                                <div className="font-medium text-xs text-muted-foreground uppercase">Location Data</div>
                                {log.location_data?.error ? (
                                  <div className="text-destructive">{log.location_data.error}</div>
                                ) : log.location_data?.lat ? (
                                  <>
                                    <div><span className="text-muted-foreground">Lat:</span> {log.location_data.lat}</div>
                                    <div><span className="text-muted-foreground">Lng:</span> {log.location_data.lng}</div>
                                    <div><span className="text-muted-foreground">Accuracy:</span> {log.location_data.accuracy}m</div>
                                  </>
                                ) : (
                                  <div className="text-muted-foreground">No location data</div>
                                )}
                              </div>

                              {/* Error Stack */}
                              {log.error_stack && (
                                <div className="col-span-full">
                                  <div className="font-medium text-xs text-muted-foreground uppercase mb-1">Error Stack</div>
                                  <pre className="text-xs bg-background p-2 rounded overflow-x-auto">
                                    {log.error_stack}
                                  </pre>
                                </div>
                              )}

                              {/* Console Logs */}
                              {log.console_logs && log.console_logs.length > 0 && (
                                <div className="col-span-full">
                                  <div className="font-medium text-xs text-muted-foreground uppercase mb-1">Console Logs</div>
                                  <pre className="text-xs bg-background p-2 rounded overflow-x-auto max-h-32">
                                    {log.console_logs.join('\n')}
                                  </pre>
                                </div>
                              )}

                              {/* Full User Notes */}
                              {log.user_notes && (
                                <div className="col-span-full">
                                  <div className="font-medium text-xs text-muted-foreground uppercase mb-1">User Notes</div>
                                  <div className="bg-background p-2 rounded">{log.user_notes}</div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default DebugLogViewer;
