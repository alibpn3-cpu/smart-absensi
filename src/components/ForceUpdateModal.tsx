import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Sparkles } from 'lucide-react';
import ChangelogCarousel from './ChangelogCarousel';

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
  const [showCarousel, setShowCarousel] = useState(false);

  // Parse changelog into pages using ---PAGE--- delimiter
  const parseChangelogPages = (changelogText: string): string[] => {
    const pages = changelogText.split('---PAGE---').map(page => page.trim()).filter(Boolean);
    // If no pages found or no delimiter, return as single page
    return pages.length > 0 ? pages : [changelogText];
  };

  const changelogPages = parseChangelogPages(changelog);
  const hasMultiplePages = changelogPages.length > 1;

  const handleStartUpdate = () => {
    // Show carousel if there are pages to show
    setShowCarousel(true);
  };

  const handleCarouselComplete = async () => {
    try {
      // Selective clear: preserve auth session (sb-*) and critical settings.
      // A blanket localStorage.clear() would sign the user out.
      const PRESERVE_PREFIXES = ['sb-']; // Supabase auth tokens
      const PRESERVE_KEYS = new Set([
        'shared_device_mode',
        'device_id',
        'user_timezone',
        'app_installed_version',
        'selected_staff_uid',
        'kiosk_geofence_area_id',
      ]);

      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          if (PRESERVE_KEYS.has(k)) continue;
          if (PRESERVE_PREFIXES.some((p) => k.startsWith(p))) continue;
          keysToRemove.push(k);
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch (e) {
        console.warn('Selective localStorage clear failed:', e);
      }

      // Clear runtime caches so new build assets are fetched
      if ('caches' in window) {
        try {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((n) => caches.delete(n)));
        } catch (e) {
          console.warn('Cache clear failed:', e);
        }
      }

      // Persist installed version BEFORE reload, and verify it stuck
      try {
        localStorage.setItem('app_installed_version', newVersion);
        if (localStorage.getItem('app_installed_version') !== newVersion) {
          console.warn('Version write verification failed');
        }
      } catch (e) {
        console.warn('Version write failed:', e);
      }

      onUpdate();

      setTimeout(() => {
        window.location.reload();
      }, 300);
    } catch (error) {
      console.error('Error during update:', error);
      window.location.reload();
    }
  };

  // Show carousel if triggered
  if (showCarousel) {
    return (
      <ChangelogCarousel
        pages={changelogPages}
        version={newVersion}
        onComplete={handleCarouselComplete}
      />
    );
  }

  // Parse changelog for preview (just first few lines)
  const previewLines = changelogPages[0]?.split('\n').filter(line => line.trim()).slice(0, 4) || [];

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-md mx-auto [&>[data-radix-dialog-close]]:hidden"
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
              {previewLines.map((line, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{line.replace(/^[•\-\*]\s*/, '')}</span>
                </li>
              ))}
              {hasMultiplePages && (
                <li className="text-xs text-muted-foreground italic pt-2">
                  + {changelogPages.length - 1} halaman panduan lainnya...
                </li>
              )}
            </ul>
          </div>
        </div>
        
        <Button 
          onClick={handleStartUpdate}
          className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90"
          size="lg"
        >
          <Download className="w-5 h-5 mr-2" />
          Update Sekarang
        </Button>
        
        <p className="text-xs text-center text-muted-foreground mt-2">
          {hasMultiplePages 
            ? 'Anda akan melihat panduan update sebelum aplikasi dimuat ulang'
            : 'Aplikasi akan dimuat ulang setelah update'
          }
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default ForceUpdateModal;
