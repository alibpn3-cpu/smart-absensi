import React from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Camera } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PermissionsState {
  location: boolean;
  camera: boolean;
}

interface PermissionIndicatorsProps {
  permissions: PermissionsState;
  onPermissionsUpdate: (permissions: PermissionsState) => void;
}

const PermissionIndicators: React.FC<PermissionIndicatorsProps> = ({ 
  permissions, 
  onPermissionsUpdate 
}) => {
  const requestPermissions = async () => {
    const newPermissions = { location: false, camera: false };
    
    // Request location permission - works on all devices/browsers
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });
      });
      newPermissions.location = true;
      console.log('✅ Location permission granted');
    } catch (error: any) {
      console.error('Location permission error:', error);
      let message = "Tidak dapat mengakses lokasi. ";
      
      if (error.code === 1) { // PERMISSION_DENIED
        message += "Izin lokasi ditolak. Periksa pengaturan browser Anda.";
      } else if (error.code === 2) { // POSITION_UNAVAILABLE
        message += "Posisi tidak tersedia. GPS mungkin tidak aktif.";
      } else if (error.code === 3) { // TIMEOUT
        message += "Waktu habis. Coba lagi.";
      }
      
      toast({
        title: "📍 Error Lokasi",
        description: message,
        variant: "destructive",
        duration: 5000
      });
    }
    
    // Request camera permission - cross-browser/device compatible
    try {
      // iOS Safari & Chrome iOS: Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MEDIA_DEVICES_NOT_SUPPORTED');
      }

      // Try to check permission state (not supported on all browsers)
      let permissionState = 'prompt';
      try {
        const permissionStatus = await navigator.permissions.query({ 
          name: 'camera' as PermissionName 
        });
        permissionState = permissionStatus.state;
        console.log('Camera permission state:', permissionState);
        
        if (permissionState === 'denied') {
          throw new Error('PERMISSION_DENIED_BY_SYSTEM');
        }
      } catch (permError) {
        // Permission API not supported (Safari iOS, older browsers) - proceed anyway
        console.log('Permission API not supported, proceeding with getUserMedia');
      }

      // Request camera access with video constraints
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Stop all tracks immediately after permission granted
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Camera track stopped:', track.label);
      });
      
      newPermissions.camera = true;
      console.log('✅ Camera permission granted');
      
    } catch (error: any) {
      console.error('Camera permission error:', error);
      
      // Cross-browser/device error messages
      if (error.message === 'MEDIA_DEVICES_NOT_SUPPORTED') {
        toast({
          title: "❌ Tidak Didukung",
          description: "Browser Anda tidak mendukung akses kamera. Gunakan browser modern seperti Chrome atau Safari.",
          variant: "destructive",
          duration: 6000
        });
      } else if (error.message === 'PERMISSION_DENIED_BY_SYSTEM' || error.name === 'NotAllowedError') {
        // Detect platform for specific instructions
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
        let instructions = "";
        if (isIOS) {
          instructions = "iOS: Buka Settings → Safari → Camera → Allow";
        } else if (isAndroid) {
          instructions = "Android: Buka Settings → Apps → Browser → Permissions → Camera → Allow";
        } else if (isSafari) {
          instructions = "Safari: Safari → Preferences → Websites → Camera → Allow";
        } else {
          instructions = "Klik ikon kunci/kamera di address bar → Site settings → Camera → Allow";
        }
        
        toast({
          title: "🚫 Izin Kamera Ditolak",
          description: instructions,
          variant: "destructive",
          duration: 8000
        });
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        toast({
          title: "📷 Kamera Tidak Ditemukan",
          description: "Tidak ada kamera terdeteksi. Pastikan kamera terhubung dan tidak digunakan aplikasi lain.",
          variant: "destructive",
          duration: 6000
        });
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        toast({
          title: "🔒 Kamera Sedang Digunakan",
          description: "Kamera tidak dapat diakses karena sedang digunakan aplikasi lain. Tutup aplikasi tersebut dan coba lagi.",
          variant: "destructive",
          duration: 6000
        });
      } else if (error.name === 'OverconstrainedError') {
        toast({
          title: "⚠️ Kamera Tidak Kompatibel",
          description: "Kamera Anda tidak mendukung resolusi yang diminta. Coba lagi.",
          variant: "destructive",
          duration: 6000
        });
      } else if (error.name === 'SecurityError') {
        toast({
          title: "🔐 Error Keamanan",
          description: "Akses kamera diblokir karena alasan keamanan. Pastikan menggunakan HTTPS atau localhost.",
          variant: "destructive",
          duration: 6000
        });
      } else {
        toast({
          title: "❌ Error Kamera",
          description: error.message || "Tidak dapat mengakses kamera. Periksa izin browser Anda.",
          variant: "destructive",
          duration: 6000
        });
      }
    }
    
    // Save to localStorage for persistence
    localStorage.setItem('attendance_permissions', JSON.stringify(newPermissions));
    onPermissionsUpdate(newPermissions);
    
    // Only show success if BOTH granted
    if (newPermissions.location && newPermissions.camera) {
      toast({
        title: "✅ Berhasil",
        description: "Semua izin telah diberikan",
        duration: 3000
      });
    } else if (!newPermissions.location && !newPermissions.camera) {
      toast({
        title: "⚠️ Peringatan",
        description: "Kedua izin gagal diberikan. Periksa pengaturan browser Anda.",
        variant: "destructive",
        duration: 5000
      });
    } else if (!newPermissions.location) {
      toast({
        title: "⚠️ Izin Lokasi Gagal",
        description: "Kamera berhasil, tapi lokasi gagal. Coba minta izin lagi.",
        variant: "destructive",
        duration: 5000
      });
    } else if (!newPermissions.camera) {
      toast({
        title: "⚠️ Izin Kamera Gagal",
        description: "Lokasi berhasil, tapi kamera gagal. Coba minta izin lagi.",
        variant: "destructive",
        duration: 5000
      });
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap justify-center">
      <div className="flex items-center gap-1">
        <div 
          className={`w-2 h-2 rounded-full ${permissions.location ? 'bg-green-500' : 'bg-red-500'}`}
          title={permissions.location ? 'Lokasi diizinkan' : 'Lokasi tidak diizinkan'}
        />
        <MapPin className={`h-3 w-3 ${permissions.location ? 'text-green-600' : 'text-red-600'}`} />
      </div>
      
      <div className="flex items-center gap-1">
        <div 
          className={`w-2 h-2 rounded-full ${permissions.camera ? 'bg-green-500' : 'bg-red-500'}`}
          title={permissions.camera ? 'Kamera diizinkan' : 'Kamera tidak diizinkan'}
        />
        <Camera className={`h-3 w-3 ${permissions.camera ? 'text-green-600' : 'text-red-600'}`} />
      </div>
      
      {(!permissions.location || !permissions.camera) && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={requestPermissions}
          className="h-6 text-xs px-2"
        >
          Minta Izin
        </Button>
      )}
    </div>
  );
};

export default PermissionIndicators;
