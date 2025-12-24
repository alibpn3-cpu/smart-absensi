import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Medal, Award, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface RankingUser {
  staff_uid: string;
  staff_name: string;
  avg_score: number;
  photo_url?: string;
}

interface MedalTier {
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  minScore: number;
  users: RankingUser[];
}

const RankingCard = () => {
  const [rankings, setRankings] = useState<MedalTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Month/Year selection
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Generate available years (current year - 2 to current year)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 2 + i);

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(prev => prev - 1);
      } else {
        setSelectedMonth(prev => prev - 1);
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(prev => prev + 1);
      } else {
        setSelectedMonth(prev => prev + 1);
      }
    }
  };

  useEffect(() => {
    const fetchRankings = async () => {
      setIsLoading(true);
      try {
        // Get selected month date range
        const firstDay = new Date(selectedYear, selectedMonth, 1);
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
        const firstDayStr = firstDay.toISOString().split('T')[0];
        const lastDayStr = lastDay.toISOString().split('T')[0];

        // Get all scores for selected month
        const { data: scores, error } = await supabase
          .from('daily_scores')
          .select('staff_uid, staff_name, final_score')
          .gte('score_date', firstDayStr)
          .lte('score_date', lastDayStr);

        if (error) throw error;

        // Calculate average score per user
        const userScores = new Map<string, { name: string; scores: number[] }>();
        
        scores?.forEach(score => {
          if (!userScores.has(score.staff_uid)) {
            userScores.set(score.staff_uid, { name: score.staff_name, scores: [] });
          }
          userScores.get(score.staff_uid)!.scores.push(Number(score.final_score));
        });

        // Calculate averages and sort
        const avgScores: RankingUser[] = [];
        for (const [uid, data] of userScores) {
          const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
          avgScores.push({
            staff_uid: uid,
            staff_name: data.name,
            avg_score: Math.round(avg * 10) / 10
          });
        }

        avgScores.sort((a, b) => b.avg_score - a.avg_score);

        // Fetch photos for top users
        const topUids = avgScores.slice(0, 8).map(u => u.staff_uid);
        if (topUids.length > 0) {
          const { data: users } = await supabase
            .from('staff_users')
            .select('uid, photo_url')
            .in('uid', topUids);

          const photoMap = new Map(users?.map(u => [u.uid, u.photo_url]) || []);
          avgScores.forEach(u => {
            u.photo_url = photoMap.get(u.staff_uid) || undefined;
          });
        }

        // Group by medal tiers
        const tiers: MedalTier[] = [
          {
            name: 'Platinum',
            icon: <Trophy className="h-4 w-4" />,
            color: 'text-cyan-600 dark:text-cyan-400',
            bgColor: 'bg-gradient-to-r from-cyan-100 to-slate-100 dark:from-cyan-900/30 dark:to-slate-900/30',
            minScore: 4.5,
            users: avgScores.filter(u => u.avg_score >= 4.5).slice(0, 2)
          },
          {
            name: 'Gold',
            icon: <Medal className="h-4 w-4" />,
            color: 'text-yellow-600 dark:text-yellow-400',
            bgColor: 'bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30',
            minScore: 4.0,
            users: avgScores.filter(u => u.avg_score >= 4.0 && u.avg_score < 4.5).slice(0, 2)
          },
          {
            name: 'Silver',
            icon: <Award className="h-4 w-4" />,
            color: 'text-slate-500 dark:text-slate-400',
            bgColor: 'bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800/30 dark:to-gray-800/30',
            minScore: 3.5,
            users: avgScores.filter(u => u.avg_score >= 3.5 && u.avg_score < 4.0).slice(0, 2)
          },
          {
            name: 'Bronze',
            icon: <Star className="h-4 w-4" />,
            color: 'text-orange-600 dark:text-orange-400',
            bgColor: 'bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30',
            minScore: 3.0,
            users: avgScores.filter(u => u.avg_score >= 3.0 && u.avg_score < 3.5).slice(0, 2)
          }
        ];

        // Filter out empty tiers
        setRankings(tiers.filter(t => t.users.length > 0));
      } catch (error) {
        console.error('Error fetching rankings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRankings();
  }, [selectedMonth, selectedYear]);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-muted rounded w-1/3"></div>
            <div className="h-12 bg-muted rounded"></div>
            <div className="h-12 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg overflow-hidden">
      <CardHeader className="pb-2 pt-3 px-4 bg-gradient-to-r from-primary/10 to-primary/5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Ranking Bulanan
        </CardTitle>
        {/* Month/Year Selector */}
        <div className="flex items-center gap-1 mt-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => navigateMonth('prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select
            value={selectedMonth.toString()}
            onValueChange={(v) => setSelectedMonth(parseInt(v))}
          >
            <SelectTrigger className="h-7 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, idx) => (
                <SelectItem key={idx} value={idx.toString()}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="h-7 text-xs w-16">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => navigateMonth('next')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 space-y-2">
        {rankings.length === 0 ? (
          <div className="text-center py-4">
            <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Belum ada data ranking untuk {months[selectedMonth]} {selectedYear}
            </p>
          </div>
        ) : (
          rankings.map((tier) => (
            <div key={tier.name} className={`rounded-lg p-2 ${tier.bgColor}`}>
              <div className={`flex items-center gap-1.5 mb-1.5 ${tier.color}`}>
                {tier.icon}
                <span className="text-xs font-semibold">{tier.name}</span>
                <span className="text-xs opacity-70">≥{tier.minScore}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {tier.users.map((user) => (
                  <div key={user.staff_uid} className="flex items-center gap-2 bg-background/80 rounded-full px-2 py-1">
                    <Avatar className="h-6 w-6 border border-border">
                      <AvatarImage src={user.photo_url} alt={user.staff_name} />
                      <AvatarFallback className="text-[10px] bg-primary/10">
                        {user.staff_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium truncate max-w-[80px]">
                        {user.staff_name.split(' ')[0]}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {user.avg_score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default RankingCard;
