import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CameraCaptureProps {
  onCapture: (photo: Blob) => void;
  onClose: () => void;
  loading: boolean;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose, loading }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive"
      });
      console.error('Error accessing camera:', error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startShutterProcess = () => {
    if (isRecording) return;
    
    setIsRecording(true);
    setCountdown(3);
    setProgress(0);

    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(countdownInterval);
        // Start progress animation
        startProgressAnimation();
      }
    }, 1000);
  };

  const startProgressAnimation = () => {
    let progressValue = 0;
    const progressInterval = setInterval(() => {
      progressValue += 2;
      setProgress(progressValue);
      
      if (progressValue >= 100) {
        clearInterval(progressInterval);
        capturePhoto();
      }
    }, 30); // 1.5 second total (50 intervals)
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Play shutter sound effect
    playShutterSound();

    // Convert canvas to blob
    canvas.toBlob((blob) => {
      if (blob) {
        onCapture(blob);
      }
    }, 'image/jpeg', 0.8);

    setIsRecording(false);
  };

  const playShutterSound = () => {
    // Create a simple camera shutter sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Ambil Foto Selfie</h3>
            <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Camera View */}
          <div className="relative mb-4">
            <div className="relative w-full aspect-square rounded-full overflow-hidden border-4 border-primary bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              {/* Progress Ring */}
              {isRecording && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-full h-full absolute" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="48"
                      fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={`${progress * 3.02} 301.59`}
                      transform="rotate(-90 50 50)"
                      className="transition-all duration-75"
                    />
                  </svg>
                </div>
              )}

              {/* Countdown Display */}
              {countdown > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                  <span className="text-4xl font-bold text-white">{countdown}</span>
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <p className="text-sm text-muted-foreground text-center mb-4">
            {isRecording 
              ? "Sedang mengambil foto..." 
              : "Tekan dan tahan tombol kamera untuk mengambil foto selfie"
            }
          </p>

          {/* Shutter Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              disabled={loading || !stream}
              onMouseDown={startShutterProcess}
              onTouchStart={startShutterProcess}
              className="w-16 h-16 rounded-full p-0"
              variant={isRecording ? "secondary" : "default"}
            >
              <Camera className="h-6 w-6" />
            </Button>
          </div>

          {/* Hidden canvas for photo capture */}
          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>
    </div>
  );
};

export default CameraCapture;