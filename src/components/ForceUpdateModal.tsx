import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Sparkles } from 'lucide-react';

interface ForceUpdateModalProps {
  isOpen: boolean;
  newVersion: string;
  changelog: string;
  onUpdate: () => void;
}

const ForceUpdateModal: React.FC<ForceUpdateModalProps> = ({
  isOpen,
  newVersion,
  changelog,
  onUpdate
}) => {
  const handleUpdate = async () => {
    try {
      // Preserve kiosk mode and device settings
      const kioskMode = localStorage.getItem('shared_device_mode');
      const deviceId = localStorage.getItem('device_id');
      const userTimezone = localStorage.getItem('user_timezone');
      
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      }
      
      // Clear localStorage except preserved items
      localStorage.clear();
      
      // Restore preserved settings
      if (kioskMode) localStorage.setItem('shared_device_mode', kioskMode);
      if (deviceId) localStorage.setItem('device_id', deviceId);
      if (userTimezone) localStorage.setItem('user_timezone', userTimezone);
      
      // Update installed version
      localStorage.setItem('app_installed_version', newVersion);
      
      // Trigger callback
      onUpdate();
      
      // Reload page
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch (error) {
      console.error('Error during update:', error);
      window.location.reload();
    }
  };

  // Parse changelog into lines
  const changelogLines = changelog.split('\n').filter(line => line.trim());

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-md mx-auto [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold text-center">
            Update {newVersion} Tersedia!
          </DialogTitle>
          <DialogDescription className="text-center">
            Versi baru aplikasi tersedia dengan fitur-fitur baru
          </DialogDescription>
        </DialogHeader>
        
        <div className="my-4">
          <div className="bg-muted/50 rounded-lg p-4 border border-border">
            <h4 className="font-semibold text-sm text-primary mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Yang Baru:
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {changelogLines.map((line, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{line.replace(/^[•\-\*]\s*/, '')}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <Button 
          onClick={handleUpdate}
          className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90"
          size="lg"
        >
          <Download className="w-5 h-5 mr-2" />
          Update Sekarang
        </Button>
        
        <p className="text-xs text-center text-muted-foreground mt-2">
          Aplikasi akan dimuat ulang setelah update
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default ForceUpdateModal;
