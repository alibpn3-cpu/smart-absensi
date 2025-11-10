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
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      newPermissions.location = true;
    } catch (error) {
      console.error('Location permission denied:', error);
    }
    
    // Request camera permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      newPermissions.camera = true;
    } catch (error) {
      console.error('Camera permission denied:', error);
    }
    
    onPermissionsUpdate(newPermissions);
    
    if (newPermissions.location && newPermissions.camera) {
      toast({
        title: "Berhasil",
        description: "Semua izin telah diberikan"
      });
    } else {
      toast({
        title: "Peringatan",
        description: "Beberapa izin belum diberikan",
        variant: "destructive"
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
