import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { networkDetector } from '@/lib/networkDetector';
import { offlineStorage, OfflineAttendanceRecord } from '@/lib/offlineStorage';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface OfflineIndicatorProps {
  onSyncComplete?: () => void;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ onSyncComplete }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleStatusChange = (online: boolean) => {
      setIsOnline(online);
    };

    networkDetector.addListener(handleStatusChange);
    loadPendingCount();

    return () => {
      networkDetector.removeListener(handleStatusChange);
    };
  }, []);

  const loadPendingCount = async () => {
    try {
      const records = await offlineStorage.getAllRecords();
      setPendingCount(records.length);
    } catch (error) {
      console.error('Error loading pending count:', error);
    }
  };

  const base64ToBlob = (base64: string): Blob => {
    const parts = base64.split(',');
    const contentType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const b64Data = parts[1];
    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let i = 0; i < byteCharacters.length; i += 512) {
      const slice = byteCharacters.slice(i, i + 512);
      const byteNumbers = new Array(slice.length);
      for (let j = 0; j < slice.length; j++) {
        byteNumbers[j] = slice.charCodeAt(j);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: contentType });
  };

  const syncRecord = async (record: OfflineAttendanceRecord): Promise<boolean> => {
    try {
      const { data: existingRecord } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('staff_uid', record.staff_uid)
        .eq('date', record.date)
        .single();

      if (record.action_type === 'checkin') {
        let selfieUrl = null;
        if (record.selfie_checkin_base64) {
          const blob = base64ToBlob(record.selfie_checkin_base64);
          const fileName = `${record.staff_uid}_checkin_${record.date}_${Date.now()}.jpg`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('attendance-photos')
            .upload(fileName, blob, { contentType: 'image/jpeg' });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('attendance-photos')
            .getPublicUrl(fileName);
          selfieUrl = publicUrl;
        }

        const attendanceData = {
          staff_uid: record.staff_uid,
          staff_name: record.staff_name,
          date: record.date,
          check_in_time: record.check_in_time,
          checkin_location_lat: record.checkin_location_lat,
          checkin_location_lng: record.checkin_location_lng,
          checkin_location_address: record.checkin_location_address,
          selfie_checkin_url: selfieUrl,
          status: record.status.toLowerCase(), // Convert to lowercase for database
          reason: record.reason,
        };

        if (existingRecord) {
          const { error } = await supabase
            .from('attendance_records')
            .update(attendanceData)
            .eq('id', existingRecord.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('attendance_records')
            .insert([attendanceData]);
          if (error) throw error;
        }
      } else {
        if (!existingRecord) {
          throw new Error('No check-in record found for checkout');
        }

        let selfieUrl = null;
        if (record.selfie_checkout_base64) {
          const blob = base64ToBlob(record.selfie_checkout_base64);
          const fileName = `${record.staff_uid}_checkout_${record.date}_${Date.now()}.jpg`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('attendance-photos')
            .upload(fileName, blob, { contentType: 'image/jpeg' });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('attendance-photos')
            .getPublicUrl(fileName);
          selfieUrl = publicUrl;
        }

        const { error } = await supabase
          .from('attendance_records')
          .update({
            check_out_time: record.check_out_time,
            checkout_location_lat: record.checkout_location_lat,
            checkout_location_lng: record.checkout_location_lng,
            checkout_location_address: record.checkout_location_address,
            selfie_checkout_url: selfieUrl,
          })
          .eq('id', existingRecord.id);

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Sync error for record:', record.id, error);
      await offlineStorage.updateSyncAttempt(record.id, String(error));
      return false;
    }
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      toast({
        title: "⚠️ Tidak Ada Koneksi",
        description: "Tidak dapat sinkronisasi saat offline",
        variant: "destructive",
      });
      return;
    }

    setIsSyncing(true);
    try {
      const records = await offlineStorage.getAllRecords();
      
      if (records.length === 0) {
        toast({
          title: "✅ Sudah Tersinkronisasi",
          description: "Tidak ada data yang perlu disinkronkan",
        });
        setIsSyncing(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const record of records) {
        const success = await syncRecord(record);
        if (success) {
          await offlineStorage.deleteRecord(record.id);
          successCount++;
        } else {
          failCount++;
        }
      }

      await loadPendingCount();

      if (failCount === 0) {
        toast({
          title: "✅ Sinkronisasi Berhasil",
          description: `${successCount} data berhasil disinkronkan`,
        });
      } else {
        toast({
          title: "⚠️ Sinkronisasi Sebagian",
          description: `${successCount} berhasil, ${failCount} gagal`,
          variant: "destructive",
        });
      }

      if (onSyncComplete) onSyncComplete();
    } catch (error) {
      console.error('Manual sync error:', error);
      toast({
        title: "❌ Sinkronisasi Gagal",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      {!isOnline && (
        <Badge variant="destructive" className="flex items-center gap-1">
          <WifiOff className="h-3 w-3" />
          Mode Offline
        </Badge>
      )}
      
      {isOnline && pendingCount > 0 && (
        <>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Wifi className="h-3 w-3" />
            {pendingCount} Data Belum Tersinkron
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="h-6 text-xs px-2"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Menyinkronkan...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Sinkronkan Sekarang
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
};

export default OfflineIndicator;
