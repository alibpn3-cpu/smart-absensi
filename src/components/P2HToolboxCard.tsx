import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronDown, ClipboardCheck, Camera, X, RefreshCw, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface P2HToolboxCardProps {
  staffUid: string;
  staffName: string;
  onChecklistChange?: (p2h: boolean, toolbox: boolean) => void;
}

const P2HToolboxCard = ({ staffUid, staffName, onChecklistChange }: P2HToolboxCardProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [p2hChecked, setP2hChecked] = useState(false);
  const [toolboxChecked, setToolboxChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [p2hPhotoUrl, setP2hPhotoUrl] = useState<string | null>(null);
  const [toolboxPhotoUrl, setToolboxPhotoUrl] = useState<string | null>(null);
  
  // Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [captureType, setCaptureType] = useState<'p2h' | 'toolbox' | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch existing checklist for today
  useEffect(() => {
    const fetchChecklist = async () => {
      if (!staffUid) {
        setIsLoading(false);
        return;
      }

      try {
        const today = new Date().toISOString().split('T')[0];
        
        const { data, error } = await supabase
          .from('p2h_toolbox_checklist')
          .select('p2h_checked, toolbox_checked, p2h_photo_url, toolbox_photo_url')
          .eq('staff_uid', staffUid)
          .eq('checklist_date', today)
          .single();

        if (!error && data) {
          setP2hChecked(data.p2h_checked || false);
          setToolboxChecked(data.toolbox_checked || false);
          setP2hPhotoUrl(data.p2h_photo_url || null);
          setToolboxPhotoUrl(data.toolbox_photo_url || null);
        }
      } catch (error) {
        console.error('Error fetching checklist:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChecklist();
  }, [staffUid]);

  // Notify parent of changes
  useEffect(() => {
    onChecklistChange?.(p2hChecked, toolboxChecked);
  }, [p2hChecked, toolboxChecked, onChecklistChange]);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Gagal mengakses kamera');
      setShowCamera(false);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (showCamera) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [showCamera]);

  // Compress image to thumbnail
  const compressToThumbnail = async (blob: Blob): Promise<Blob> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 200; // Max 200x200 thumbnail
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (compressedBlob) => resolve(compressedBlob || blob),
          'image/jpeg',
          0.6 // 60% quality
        );
      };
      img.src = URL.createObjectURL(blob);
    });
  };

  // Capture photo
  const capturePhoto = async () => {
    if (!videoRef.current || !captureType) return;
    
    setIsCapturing(true);
    
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.8);
      });
      
      // Compress to thumbnail
      const thumbnail = await compressToThumbnail(blob);
      
      // Upload to storage
      const fileName = `${staffUid}_${captureType}_${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('p2h-photos')
        .upload(fileName, thumbnail);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('p2h-photos')
        .getPublicUrl(uploadData.path);

      // Update state and save to database
      if (captureType === 'p2h') {
        setP2hPhotoUrl(publicUrl);
        setP2hChecked(true);
        await saveChecklist(true, toolboxChecked, publicUrl, toolboxPhotoUrl);
      } else {
        setToolboxPhotoUrl(publicUrl);
        setToolboxChecked(true);
        await saveChecklist(p2hChecked, true, p2hPhotoUrl, publicUrl);
      }

      toast.success(`Foto ${captureType === 'p2h' ? 'P2H' : 'Toolbox Meeting'} berhasil disimpan`);
      setShowCamera(false);
    } catch (error) {
      console.error('Capture error:', error);
      toast.error('Gagal mengambil foto');
    } finally {
      setIsCapturing(false);
    }
  };

  const saveChecklist = async (
    p2h: boolean, 
    toolbox: boolean, 
    p2hPhoto: string | null = p2hPhotoUrl, 
    toolboxPhoto: string | null = toolboxPhotoUrl
  ) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('p2h_toolbox_checklist')
        .upsert({
          staff_uid: staffUid,
          staff_name: staffName,
          checklist_date: today,
          p2h_checked: p2h,
          toolbox_checked: toolbox,
          p2h_photo_url: p2hPhoto,
          toolbox_photo_url: toolboxPhoto
        }, {
          onConflict: 'staff_uid,checklist_date'
        });

      if (error) {
        console.error('Error saving checklist:', error);
        toast.error('Gagal menyimpan checklist');
      }
    } catch (error) {
      console.error('Error in saveChecklist:', error);
    }
  };

  const handleP2HChange = (checked: boolean) => {
    if (checked && !p2hPhotoUrl) {
      // Open camera to take photo
      setCaptureType('p2h');
      setShowCamera(true);
    } else if (!checked) {
      // Uncheck - no photo needed
      setP2hChecked(false);
      saveChecklist(false, toolboxChecked);
    }
  };

  const handleToolboxChange = (checked: boolean) => {
    if (checked && !toolboxPhotoUrl) {
      // Open camera to take photo
      setCaptureType('toolbox');
      setShowCamera(true);
    } else if (!checked) {
      // Uncheck - no photo needed
      setToolboxChecked(false);
      saveChecklist(p2hChecked, false);
    }
  };

  const handleRetakePhoto = (type: 'p2h' | 'toolbox') => {
    setCaptureType(type);
    setShowCamera(true);
  };

  if (isLoading) {
    return (
      <Card className="border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="animate-pulse flex items-center gap-2">
            <div className="h-5 w-5 bg-muted rounded"></div>
            <div className="h-4 w-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <CardContent className="p-4 cursor-pointer hover:bg-blue-100/50 dark:hover:bg-blue-900/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-blue-800 dark:text-blue-200">
                    Checklist Harian
                  </span>
                  {(p2hChecked || toolboxChecked) && (
                    <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                      {[p2hChecked && 'P2H', toolboxChecked && 'Toolbox'].filter(Boolean).join(', ')}
                    </span>
                  )}
                </div>
                <ChevronDown className={`h-4 w-4 text-blue-600 dark:text-blue-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardContent>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-3">
              {/* P2H Checkbox with Photo */}
              <div className="p-3 bg-white dark:bg-background rounded-lg border space-y-2">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="p2h"
                    checked={p2hChecked}
                    onCheckedChange={handleP2HChange}
                  />
                  <Label 
                    htmlFor="p2h" 
                    className="text-sm font-medium cursor-pointer flex-1"
                  >
                    P2H (Pemeriksaan Harian)
                  </Label>
                  {p2hChecked && <CheckCircle className="h-4 w-4 text-green-500" />}
                </div>
                {p2hPhotoUrl && (
                  <div className="flex items-center gap-2 ml-6">
                    <img 
                      src={p2hPhotoUrl} 
                      alt="P2H Evidence" 
                      className="h-12 w-12 object-cover rounded border"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetakePhoto('p2h')}
                      className="text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Ganti Foto
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Toolbox Checkbox with Photo */}
              <div className="p-3 bg-white dark:bg-background rounded-lg border space-y-2">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="toolbox"
                    checked={toolboxChecked}
                    onCheckedChange={handleToolboxChange}
                  />
                  <Label 
                    htmlFor="toolbox" 
                    className="text-sm font-medium cursor-pointer flex-1"
                  >
                    Toolbox Meeting
                  </Label>
                  {toolboxChecked && <CheckCircle className="h-4 w-4 text-green-500" />}
                </div>
                {toolboxPhotoUrl && (
                  <div className="flex items-center gap-2 ml-6">
                    <img 
                      src={toolboxPhotoUrl} 
                      alt="Toolbox Evidence" 
                      className="h-12 w-12 object-cover rounded border"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetakePhoto('toolbox')}
                      className="text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Ganti Foto
                    </Button>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Centang dan ambil foto bukti jika sudah melakukan P2H atau mengikuti Toolbox Meeting hari ini.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Camera Dialog */}
      <Dialog open={showCamera} onOpenChange={(open) => !open && setShowCamera(false)}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Ambil Foto {captureType === 'p2h' ? 'P2H' : 'Toolbox Meeting'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative bg-black aspect-[4/3]">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* Capture overlay */}
            <div className="absolute inset-0 flex items-end justify-center pb-6">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 rounded-full bg-white/20 border-white/50 text-white hover:bg-white/30"
                  onClick={() => setShowCamera(false)}
                >
                  <X className="h-5 w-5" />
                </Button>
                
                <Button
                  size="icon"
                  className="h-16 w-16 rounded-full bg-white hover:bg-white/90 text-black shadow-lg"
                  onClick={capturePhoto}
                  disabled={isCapturing}
                >
                  {isCapturing ? (
                    <RefreshCw className="h-6 w-6 animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6" />
                  )}
                </Button>
                
                <div className="h-12 w-12" /> {/* Spacer for balance */}
              </div>
            </div>
          </div>
          
          <div className="p-4 pt-2 text-center text-sm text-muted-foreground">
            Arahkan kamera ke bukti {captureType === 'p2h' ? 'P2H' : 'Toolbox Meeting'} dan tekan tombol capture
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default P2HToolboxCard;
