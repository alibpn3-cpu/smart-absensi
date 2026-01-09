import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { Trophy, Medal, Award, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

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

const MAX_USERS_PER_TIER = 5;

const RankingCard = () => {
  const [rankings, setRankings] = useState<MedalTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  
  // Month/Year selection - show previous month's ranking on 1st-15th of current month
  const today = new Date();
  const dayOfMonth = today.getDate();
  
  // If we're in the first 15 days, show PREVIOUS month's ranking
  // Otherwise show current month's ranking (which may still be in progress)
  const getDefaultMonth = () => {
    if (dayOfMonth <= 15) {
      // Show previous month
      const prevMonth = today.getMonth() - 1;
      return prevMonth < 0 ? 11 : prevMonth;
    }
    return today.getMonth();
  };
  
  const getDefaultYear = () => {
    if (dayOfMonth <= 15 && today.getMonth() === 0) {
      // If January 1-15, show December of previous year
      return today.getFullYear() - 1;
    }
    return today.getFullYear();
  };
  
  const [selectedMonth, setSelectedMonth] = useState(getDefaultMonth());
  const [selectedYear, setSelectedYear] = useState(getDefaultYear());

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Generate available years (current year - 2 to current year)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 2 + i);

  useEffect(() => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap());
    api.on('select', () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

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
        // First, check for manual overrides
        const { data: overrides, error: overrideError } = await supabase
          .from('monthly_ranking_overrides')
          .select('*')
          .eq('year', selectedYear)
          .eq('month', selectedMonth + 1)
          .order('tier')
          .order('display_order');

        if (overrideError) throw overrideError;

        // If we have overrides, use them
        if (overrides && overrides.length > 0) {
          const tierMap: Record<string, RankingUser[]> = {
            platinum: [],
            gold: [],
            silver: [],
            bronze: []
          };

          overrides.forEach(o => {
            if (tierMap[o.tier]) {
              tierMap[o.tier].push({
                staff_uid: o.staff_uid,
                staff_name: o.staff_name,
                avg_score: Number(o.display_score),
                photo_url: o.photo_url || undefined
              });
            }
          });

          const tiers: MedalTier[] = [
            {
              name: 'Platinum',
              icon: <Trophy className="h-5 w-5" />,
              color: 'text-cyan-600 dark:text-cyan-400',
              bgColor: 'bg-gradient-to-r from-cyan-100 to-slate-100 dark:from-cyan-900/30 dark:to-slate-900/30',
              minScore: 4.5,
              users: tierMap.platinum.slice(0, MAX_USERS_PER_TIER)
            },
            {
              name: 'Gold',
              icon: <Medal className="h-5 w-5" />,
              color: 'text-yellow-600 dark:text-yellow-400',
              bgColor: 'bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30',
              minScore: 4.0,
              users: tierMap.gold.slice(0, MAX_USERS_PER_TIER)
            },
            {
              name: 'Silver',
              icon: <Award className="h-5 w-5" />,
              color: 'text-slate-500 dark:text-slate-400',
              bgColor: 'bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800/30 dark:to-gray-800/30',
              minScore: 3.5,
              users: tierMap.silver.slice(0, MAX_USERS_PER_TIER)
            },
            {
              name: 'Bronze',
              icon: <Star className="h-5 w-5" />,
              color: 'text-orange-600 dark:text-orange-400',
              bgColor: 'bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30',
              minScore: 3.0,
              users: tierMap.bronze.slice(0, MAX_USERS_PER_TIER)
            }
          ];

          setRankings(tiers.filter(t => t.users.length > 0));
          return;
        }

        // No overrides - use auto-calculated from daily_scores
        const firstDay = new Date(selectedYear, selectedMonth, 1);
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
        const firstDayStr = firstDay.toISOString().split('T')[0];
        const lastDayStr = lastDay.toISOString().split('T')[0];

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
        const topUids = avgScores.slice(0, 20).map(u => u.staff_uid);
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
            icon: <Trophy className="h-5 w-5" />,
            color: 'text-cyan-600 dark:text-cyan-400',
            bgColor: 'bg-gradient-to-r from-cyan-100 to-slate-100 dark:from-cyan-900/30 dark:to-slate-900/30',
            minScore: 4.5,
            users: avgScores.filter(u => u.avg_score >= 4.5).slice(0, MAX_USERS_PER_TIER)
          },
          {
            name: 'Gold',
            icon: <Medal className="h-5 w-5" />,
            color: 'text-yellow-600 dark:text-yellow-400',
            bgColor: 'bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30',
            minScore: 4.0,
            users: avgScores.filter(u => u.avg_score >= 4.0 && u.avg_score < 4.5).slice(0, MAX_USERS_PER_TIER)
          },
          {
            name: 'Silver',
            icon: <Award className="h-5 w-5" />,
            color: 'text-slate-500 dark:text-slate-400',
            bgColor: 'bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800/30 dark:to-gray-800/30',
            minScore: 3.5,
            users: avgScores.filter(u => u.avg_score >= 3.5 && u.avg_score < 4.0).slice(0, MAX_USERS_PER_TIER)
          },
          {
            name: 'Bronze',
            icon: <Star className="h-5 w-5" />,
            color: 'text-orange-600 dark:text-orange-400',
            bgColor: 'bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30',
            minScore: 3.0,
            users: avgScores.filter(u => u.avg_score >= 3.0 && u.avg_score < 3.5).slice(0, MAX_USERS_PER_TIER)
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

  const renderTierContent = (tier: MedalTier) => (
    <div className={`rounded-lg p-3 ${tier.bgColor} min-h-[140px]`}>
      <div className={`flex items-center gap-2 mb-3 ${tier.color}`}>
        {tier.icon}
        <span className="text-sm font-bold">{tier.name}</span>
        <span className="text-xs opacity-70">≥{tier.minScore}</span>
      </div>
      <div className="space-y-2">
        {tier.users.map((user, idx) => (
          <div key={user.staff_uid} className="flex items-center gap-2 bg-background/80 rounded-full px-2 py-1.5">
            <span className={`text-xs font-bold w-4 ${tier.color}`}>#{idx + 1}</span>
            <Avatar className="h-7 w-7 border border-border">
              <AvatarImage src={user.photo_url} alt={user.staff_name} />
              <AvatarFallback className="text-[10px] bg-primary/10">
                {user.staff_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium truncate block">
                {user.staff_name}
              </span>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              ⭐{user.avg_score.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-5 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
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
      <CardContent className="p-3">
        {rankings.length === 0 ? (
          <div className="text-center py-4">
            <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Belum ada data ranking untuk {months[selectedMonth]} {selectedYear}
            </p>
          </div>
        ) : rankings.length === 1 ? (
          // Only one tier - no carousel needed
          renderTierContent(rankings[0])
        ) : (
          // Multiple tiers - use carousel
          <div>
            <Carousel
              setApi={setApi}
              opts={{ loop: true }}
              plugins={[
                Autoplay({ delay: 5000, stopOnInteraction: false })
              ]}
              className="w-full"
            >
              <CarouselContent>
                {rankings.map((tier) => (
                  <CarouselItem key={tier.name}>
                    {renderTierContent(tier)}
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
            {/* Dot Indicators */}
            <div className="flex justify-center gap-1.5 mt-3">
              {rankings.map((tier, index) => (
                <button
                  key={tier.name}
                  onClick={() => api?.scrollTo(index)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors duration-300",
                    index === current ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                  aria-label={`Go to ${tier.name} tier`}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RankingCard;
