import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Bug, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface DebugLoggerProps {
  staffUid?: string;
  staffName?: string;
  workAreas?: string[];
  permissions?: { location: boolean; camera: boolean };
}

const DebugLogger: React.FC<DebugLoggerProps> = ({ staffUid, staffName, workAreas, permissions }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const generateDeviceId = () => {
    let deviceId = localStorage.getItem('debug_device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('debug_device_id', deviceId);
    }
    return deviceId;
  };

  const detectPlatform = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (/android/.test(ua)) return 'Android';
    if (/iphone|ipad|ipod/.test(ua)) return 'iOS';
    if (/windows/.test(ua)) return 'Windows';
    if (/macintosh|mac os/.test(ua)) return 'macOS';
    if (/linux/.test(ua)) return 'Linux';
    return 'Unknown';
  };

  const getLocationData = async () => {
    return new Promise<{ lat: number; lng: number; accuracy: number; error?: string } | { error: string }>((resolve) => {
      if (!navigator.geolocation) {
        resolve({ error: 'Geolocation not supported' });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          let errorMessage = 'Unknown error';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permission denied by user';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Position unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'Request timeout';
              break;
          }
          resolve({ error: errorMessage });
        },
        { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
      );
    });
  };

  const collectAndSendLogs = async () => {
    setLoading(true);

    try {
      // Collect device info
      const deviceId = generateDeviceId();
      const userAgent = navigator.userAgent;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const platform = detectPlatform();

      // Get location data (with potential error)
      const locationData = await getLocationData();

      // Determine issue type based on location result
      let issueType = 'general';
      let errorMessage = '';
      
      if ('error' in locationData) {
        issueType = 'location';
        errorMessage = locationData.error;
      }

      // Check permissions state
      const permissionsState = {
        ...permissions,
        geolocationAvailable: 'geolocation' in navigator,
        mediaDevicesAvailable: 'mediaDevices' in navigator
      };

      // Collect console logs from localStorage if any
      const consoleLogs: string[] = [];

      // Insert to database
      const { error } = await supabase
        .from('debug_logs')
        .insert({
          device_id: deviceId,
          user_agent: userAgent,
          screen_width: screenWidth,
          screen_height: screenHeight,
          platform: platform,
          staff_uid: staffUid || null,
          staff_name: staffName || null,
          issue_type: issueType,
          error_message: errorMessage || null,
          permissions_state: permissionsState,
          work_areas_data: workAreas ? { areas: workAreas, count: workAreas.length } : null,
          location_data: locationData,
          console_logs: consoleLogs.length > 0 ? consoleLogs : null,
          user_notes: userNotes || null
        });

      if (error) throw error;

      toast({
        title: "✅ Log Debug Terkirim",
        description: "Data debug berhasil dikirim untuk analisis"
      });

      setIsOpen(false);
      setUserNotes('');

    } catch (error) {
      console.error('Failed to send debug log:', error);
      toast({
        title: "❌ Gagal Mengirim Log",
        description: "Terjadi kesalahan saat mengirim data debug",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setIsOpen(true)}
        className="text-xs"
      >
        <Bug className="h-3 w-3 mr-1" />
        Debug
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Kirim Log Debug
            </DialogTitle>
            <DialogDescription>
              Data device dan permission akan dikirim untuk membantu mengatasi masalah lokasi/kamera.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="text-sm space-y-2 bg-muted/50 p-3 rounded-lg">
              <div className="font-medium">Data yang akan dikirim:</div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Info device (browser, layar, platform)</li>
                <li>• Status permission (lokasi, kamera)</li>
                <li>• Data lokasi saat ini (jika tersedia)</li>
                <li>• Daftar area tugas yang tersedia</li>
              </ul>
            </div>

            <div>
              <Label className="text-sm font-medium">Catatan Masalah (opsional)</Label>
              <Textarea
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="Jelaskan masalah yang anda alami..."
                className="mt-2 min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={loading}>
              Batal
            </Button>
            <Button onClick={collectAndSendLogs} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Kirim Log
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DebugLogger;
