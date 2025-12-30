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
    
    // Request location permission
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      newPermissions.location = true;
    } catch (error) {
      console.error('Location permission denied:', error);
    }
    
    // Request camera permission - similar approach to QR Scanner for better compatibility
    try {
      // Directly request camera with same constraints as QR Scanner
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      
      // Success - stop stream and update state
      stream.getTracks().forEach(track => track.stop());
      newPermissions.camera = true;
      
    } catch (error: any) {
      console.error('Camera permission error:', error);
      
      // Specific error messages based on error type
      if (error.name === 'NotFoundError') {
        toast({
          title: "Kamera Tidak Ditemukan",
          description: "Tidak ada kamera terdeteksi. Jika menggunakan PC, silakan hubungkan webcam terlebih dahulu.",
          variant: "destructive",
          duration: 6000
        });
      } else if (error.name === 'NotReadableError') {
        toast({
          title: "Kamera Sedang Digunakan",
          description: "Kamera tidak dapat diakses karena sedang digunakan aplikasi lain (Zoom, Teams, dll). Silakan tutup aplikasi tersebut.",
          variant: "destructive",
          duration: 6000
        });
      } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        toast({
          title: "Izin Kamera Ditolak",
          description: "Anda menolak akses kamera. Klik ikon kunci di address bar untuk memberikan izin.",
          variant: "destructive",
          duration: 6000
        });
      } else {
        toast({
          title: "Error Kamera",
          description: error.message || "Tidak dapat mengakses kamera",
          variant: "destructive",
          duration: 6000
        });
      }
    }
    
    // Save to localStorage
    localStorage.setItem('attendance_permissions', JSON.stringify(newPermissions));
    onPermissionsUpdate(newPermissions);
    
    // Only show success if BOTH granted
    if (newPermissions.location && newPermissions.camera) {
      toast({
        title: "✅ Berhasil",
        description: "Semua izin telah diberikan"
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
