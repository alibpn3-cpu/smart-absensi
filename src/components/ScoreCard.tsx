import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react';
import { getYesterdayScore } from '@/hooks/useScoreCalculation';

interface ScoreCardProps {
  staffUid: string;
}

const ScoreCard = ({ staffUid }: ScoreCardProps) => {
  const [score, setScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchScore = async () => {
      if (!staffUid) {
        setIsLoading(false);
        return;
      }

      const yesterdayScore = await getYesterdayScore(staffUid);
      setScore(yesterdayScore);
      setIsLoading(false);
    };

    fetchScore();
  }, [staffUid]);

  // Render stars based on score (0-5)
  const renderStars = () => {
    const stars = [];
    const displayScore = score ?? 0;
    
    for (let i = 1; i <= 5; i++) {
      const isFilled = i <= Math.floor(displayScore);
      const isHalf = !isFilled && i <= displayScore + 0.5;
      
      stars.push(
        <Star
          key={i}
          className={`h-5 w-5 transition-colors ${
            isFilled 
              ? 'fill-yellow-400 text-yellow-400' 
              : isHalf 
                ? 'fill-yellow-400/50 text-yellow-400' 
                : 'fill-muted text-muted-foreground/30'
          }`}
        />
      );
    }
    
    return stars;
  };

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800">
        <CardContent className="p-4">
          <div className="animate-pulse flex items-center gap-2">
            <div className="h-5 w-5 bg-muted rounded"></div>
            <div className="h-4 w-24 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (score === null) {
    return null; // No score yesterday, don't show card
  }

  return (
    <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Score Kemarin
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              {score.toFixed(1)} / 5.0
            </p>
          </div>
          <div className="flex items-center gap-0.5">
            {renderStars()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScoreCard;
