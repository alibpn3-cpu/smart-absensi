import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react';
import { getMonthlyAccumulatedScore } from '@/hooks/useScoreCalculation';

interface ScoreCardProps {
  staffUid: string;
}

const ScoreCard = ({ staffUid }: ScoreCardProps) => {
  const [score, setScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentMonth = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  useEffect(() => {
    const fetchScore = async () => {
      if (!staffUid) {
        setIsLoading(false);
        return;
      }

      const monthlyScore = await getMonthlyAccumulatedScore(staffUid);
      setScore(monthlyScore);
      setIsLoading(false);
    };

    fetchScore();
  }, [staffUid]);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-md rounded-xl bg-amber-50 dark:bg-amber-950/20">
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
    return null;
  }

  return (
    <Card className="border-0 shadow-md rounded-xl bg-amber-50 dark:bg-amber-950/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Total Bintang Bulan Ini
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              {currentMonth}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            <span className="text-lg font-bold text-amber-800 dark:text-amber-200">
              {score % 1 === 0 ? score.toFixed(0) : score.toFixed(1)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScoreCard;
