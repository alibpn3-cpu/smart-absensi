import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Star, X, Trophy } from 'lucide-react';
import { getTodayScore } from '@/hooks/useScoreCalculation';

interface ScorePopupProps {
  isOpen: boolean;
  onClose: () => void;
  staffUid: string;
  staffName: string;
}

const ScorePopup = ({ isOpen, onClose, staffUid, staffName }: ScorePopupProps) => {
  const [score, setScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchScore = async () => {
      if (!isOpen || !staffUid) return;
      
      setIsLoading(true);
      try {
        const todayScore = await getTodayScore(staffUid);
        setScore(todayScore);
      } catch (error) {
        console.error('Error fetching today score:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchScore();
  }, [isOpen, staffUid]);

  // Mark as shown in localStorage
  useEffect(() => {
    if (isOpen && score !== null) {
      const today = new Date().toISOString().split('T')[0];
      localStorage.setItem(`score_popup_shown_${today}_${staffUid}`, 'true');
    }
  }, [isOpen, score, staffUid]);

  const renderStars = () => {
    const stars = [];
    const displayScore = score ?? 0;
    
    for (let i = 1; i <= 5; i++) {
      const isFilled = i <= Math.floor(displayScore);
      const isHalf = !isFilled && i <= displayScore + 0.5;
      
      stars.push(
        <Star
          key={i}
          className={`h-8 w-8 transition-all duration-300 ${
            isFilled 
              ? 'fill-yellow-400 text-yellow-400 drop-shadow-lg animate-pulse' 
              : isHalf 
                ? 'fill-yellow-400/50 text-yellow-400' 
                : 'fill-muted text-muted-foreground/30'
          }`}
          style={{ animationDelay: `${i * 0.1}s` }}
        />
      );
    }
    
    return stars;
  };

  const getScoreMessage = () => {
    if (score === null) return '';
    if (score >= 4.5) return '🎉 Luar Biasa!';
    if (score >= 4) return '👏 Sangat Baik!';
    if (score >= 3) return '👍 Baik!';
    if (score >= 2) return '💪 Terus Tingkatkan!';
    return '📈 Ayo Lebih Baik Lagi!';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950/40 dark:via-yellow-950/40 dark:to-orange-950/40 border-amber-300 dark:border-amber-700">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-8 w-8 rounded-full"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        
        <DialogHeader className="text-center pt-4">
          <div className="flex justify-center mb-2">
            <Trophy className="h-12 w-12 text-amber-500 animate-bounce" />
          </div>
          <DialogTitle className="text-xl font-bold text-amber-800 dark:text-amber-200">
            Score Hari Ini
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-4 py-4">
          {isLoading ? (
            <div className="animate-pulse flex flex-col items-center gap-3">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-8 w-8 bg-muted rounded-full" />
                ))}
              </div>
              <div className="h-6 w-24 bg-muted rounded" />
            </div>
          ) : score !== null ? (
            <>
              <div className="flex items-center gap-1">
                {renderStars()}
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                  {score.toFixed(1)} / 5.0
                </p>
                <p className="text-lg font-medium text-amber-600 dark:text-amber-400 mt-1">
                  {getScoreMessage()}
                </p>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Terima kasih, {staffName}! <br />
                Clock out berhasil dicatat.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Score belum tersedia</p>
          )}
        </div>
        
        <div className="flex justify-center pb-2">
          <Button
            onClick={onClose}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold px-8"
          >
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScorePopup;
